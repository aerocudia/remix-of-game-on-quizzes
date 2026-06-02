import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function calcPoints(base: number, responseMs: number, timerSec: number) {
  const maxMs = timerSec * 1000;
  const ratio = Math.max(0, 1 - responseMs / maxMs);
  return Math.round(base * (0.5 + 0.5 * ratio));
}

export interface SubmitAnswerInput {
  sessionId: string;
  playerId: string;
  questionId: string;
  answer: string | null;
}

export const submitAnswerFn = createServerFn({ method: "POST" })
  .inputValidator((d: SubmitAnswerInput) => {
    if (!d || typeof d.sessionId !== "string" || typeof d.playerId !== "string" || typeof d.questionId !== "string") {
      throw new Error("Invalid input");
    }
    return { ...d, answer: d.answer == null ? null : String(d.answer).slice(0, 500) };
  })
  .handler(async ({ data }) => {
    // Idempotency: bail if a response already exists
    const { data: existing } = await supabaseAdmin
      .from("session_responses")
      .select("id, points_earned, answer, is_correct")
      .eq("session_id", data.sessionId)
      .eq("player_id", data.playerId)
      .eq("question_id", data.questionId)
      .maybeSingle();
    if (existing) return { points: existing.points_earned ?? 0, correct: !!existing.is_correct, duplicate: true };

    // Load session + question authoritatively
    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("id, status, current_question_index, current_question_started_at")
      .eq("id", data.sessionId)
      .single();
    if (!session) throw new Error("Session not found");
    if (session.status !== "active") {
      // Round closed; record a zero
      await supabaseAdmin.from("session_responses").insert({
        session_id: data.sessionId, player_id: data.playerId, question_id: data.questionId,
        answer: data.answer, is_correct: false, points_earned: 0, response_time_ms: 0,
      });
      return { points: 0, correct: false, late: true };
    }

    const { data: question } = await supabaseAdmin
      .from("questions")
      .select("id, type, correct_answer, points, timer_seconds")
      .eq("id", data.questionId)
      .single();
    if (!question) throw new Error("Question not found");

    const startedAt = session.current_question_started_at ? new Date(session.current_question_started_at).getTime() : Date.now();
    const responseMs = Math.max(0, Date.now() - startedAt);
    const overtime = responseMs > question.timer_seconds * 1000 + 500;

    const isPoll = question.type === "poll";
    let correct = false;
    if (!isPoll && question.correct_answer && data.answer != null) {
      correct = question.type === "type_answer"
        ? data.answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()
        : data.answer === question.correct_answer;
    }
    const points = correct && !overtime ? calcPoints(question.points, responseMs, question.timer_seconds) : 0;

    await supabaseAdmin.from("session_responses").insert({
      session_id: data.sessionId, player_id: data.playerId, question_id: data.questionId,
      answer: data.answer, is_correct: correct, points_earned: points, response_time_ms: responseMs,
    });

    if (points > 0) {
      const { data: pl } = await supabaseAdmin
        .from("session_players").select("score").eq("id", data.playerId).maybeSingle();
      await supabaseAdmin.from("session_players")
        .update({ score: (pl?.score ?? 0) + points })
        .eq("id", data.playerId);
    }

    return { points, correct, late: overtime };
  });

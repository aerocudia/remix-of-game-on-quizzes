import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ANSWER_COLORS, type Question, calculatePoints, fireConfetti } from "@/lib/quiz";
import { Zap, Trophy } from "lucide-react";

export const Route = createFileRoute("/play/$sessionid")({ component: PlayScreen });

interface SessionRow {
  id: string; quiz_id: string; status: string;
  current_question_index: number; current_question_started_at: string | null;
}
interface PlayerCache { id: string; nickname: string; avatar: string; }

function PlayScreen() {
  const { sessionid } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [player, setPlayer] = useState<PlayerCache | null>(null);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [myPoints, setMyPoints] = useState<number | null>(null);
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [allPlayers, setAllPlayers] = useState<{ id: string; nickname: string; avatar: string; score: number }[]>([]);
  const [typedAnswer, setTypedAnswer] = useState("");

  // Restore player from local storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = localStorage.getItem(`player-${sessionid}`);
    if (!cached) { navigate({ to: "/join" }); return; }
    const p = JSON.parse(cached);
    setPlayer({ id: p.id, nickname: p.nickname, avatar: p.avatar });
  }, [sessionid, navigate]);

  // Load session + questions
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("sessions").select("*").eq("id", sessionid).single();
      if (!s) return;
      setSession(s as SessionRow);
      const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("order_index");
      setQuestions((qs as Question[]) || []);
      const { data: ps } = await supabase.from("session_players").select("*").eq("session_id", sessionid);
      setAllPlayers((ps as any[]) || []);
    })();
  }, [sessionid]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("play-" + sessionid)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionid}` },
        (p: any) => {
          const prevIdx = session?.current_question_index;
          setSession(p.new);
          if (p.new.current_question_index !== prevIdx) {
            setMyAnswer(null); setMyPoints(null); setAnsweredAt(null); setTypedAnswer("");
          }
          if (p.new.status === "ended") navigate({ to: "/results/$sessionid", params: { sessionid } });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${sessionid}` },
        (p: any) => {
          if (p.eventType === "INSERT") setAllPlayers((ps) => [...ps, p.new]);
          else if (p.eventType === "UPDATE") setAllPlayers((ps) => ps.map(x => x.id === p.new.id ? p.new : x));
          else if (p.eventType === "DELETE") setAllPlayers((ps) => ps.filter(x => x.id !== p.old.id));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionid, navigate, session?.current_question_index]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const currentQ = session && session.current_question_index >= 0 ? questions[session.current_question_index] : null;
  const elapsed = useMemo(() => {
    if (!currentQ || !session?.current_question_started_at) return 0;
    return (now - new Date(session.current_question_started_at).getTime()) / 1000;
  }, [currentQ, session, now]);
  const remaining = currentQ ? Math.max(0, Math.ceil(currentQ.timer_seconds - elapsed)) : 0;
  const progressPct = currentQ ? Math.min(100, (elapsed / currentQ.timer_seconds) * 100) : 0;

  const submitAnswer = async (answer: string) => {
    if (!player || !currentQ || myAnswer !== null || !session?.current_question_started_at) return;
    const responseTimeMs = now - new Date(session.current_question_started_at).getTime();
    const isPoll = currentQ.type === "poll";
    const correct = !isPoll && currentQ.correct_answer && (
      currentQ.type === "type_answer"
        ? answer.trim().toLowerCase() === currentQ.correct_answer.trim().toLowerCase()
        : answer === currentQ.correct_answer
    );
    const pts = correct ? calculatePoints(currentQ.points, responseTimeMs, currentQ.timer_seconds) : 0;
    setMyAnswer(answer); setAnsweredAt(now); setMyPoints(pts);
    await supabase.from("session_responses").insert({
      session_id: sessionid, player_id: player.id, question_id: currentQ.id,
      answer, is_correct: !!correct, points_earned: pts, response_time_ms: responseTimeMs,
    });
    // Update score immediately
    if (pts > 0) {
      const me = allPlayers.find(p => p.id === player.id);
      await supabase.from("session_players").update({ score: (me?.score || 0) + pts }).eq("id", player.id);
    }
  };

  if (!player || !session) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  // LOBBY
  if (session.status === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl animate-float mb-6">{player.avatar}</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">{player.nickname}</h1>
        <p className="text-muted-foreground mb-8">You're in! Waiting for host to start…</p>
        <div className="flex gap-1 mb-8">
          <span className="w-2 h-2 bg-neon rounded-full animate-pulse" />
          <span className="w-2 h-2 bg-neon rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
          <span className="w-2 h-2 bg-neon rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
        </div>
        <div className="glass rounded-2xl p-4 max-w-xs w-full">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{allPlayers.length} players in lobby</p>
          <div className="flex flex-wrap gap-1 justify-center">
            {allPlayers.slice(0, 20).map(p => <span key={p.id} className="text-2xl" title={p.nickname}>{p.avatar}</span>)}
          </div>
        </div>
      </div>
    );
  }

  // ENDED
  if (session.status === "ended") {
    navigate({ to: "/results/$sessionid", params: { sessionid } });
    return null;
  }

  if (!currentQ) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading question…</div>;

  // REVEAL
  if (session.status === "reveal") {
    const correct = myAnswer === currentQ.correct_answer;
    const sorted = [...allPlayers].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex(p => p.id === player.id) + 1;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        {currentQ.type === "poll" ? (
          <>
            <div className="text-6xl mb-4">📊</div>
            <h1 className="font-display text-3xl font-bold mb-2">Thanks for voting!</h1>
            <p className="text-muted-foreground">Your answer: <span className="text-foreground font-semibold">{myAnswer}</span></p>
          </>
        ) : myAnswer === null ? (
          <>
            <div className="text-6xl mb-4">⏰</div>
            <h1 className="font-display text-3xl font-bold">Too slow!</h1>
            <p className="text-muted-foreground mt-2">Correct answer: <span className="text-neon font-semibold">{currentQ.correct_answer}</span></p>
          </>
        ) : correct ? (
          <>
            <div className="text-7xl mb-4 animate-pop">✅</div>
            <h1 className="font-display text-4xl md:text-5xl font-bold gradient-text mb-2">Correct!</h1>
            <p className="text-3xl font-display font-bold text-neon animate-pop">+{myPoints} pts</p>
          </>
        ) : (
          <>
            <div className="text-7xl mb-4 animate-pop">❌</div>
            <h1 className="font-display text-3xl font-bold mb-1">Wrong answer 😬</h1>
            <p className="text-sm text-muted-foreground mb-1">Your pick: <span className="text-destructive">{myAnswer}</span></p>
            <p className="text-sm text-muted-foreground">Correct: <span className="text-neon font-semibold">{currentQ.correct_answer}</span></p>
          </>
        )}
        <div className="glass rounded-2xl px-6 py-4 mt-10 flex items-center gap-3">
          <Trophy className="w-5 h-5 text-neon" />
          <span className="font-semibold">You're #{myRank} of {allPlayers.length}</span>
        </div>
      </div>
    );
  }

  // ACTIVE - playing
  const hasAnswered = myAnswer !== null;
  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{player.avatar}</span>
          <span className="font-semibold text-sm">{player.nickname}</span>
        </div>
        <div className="text-sm text-muted-foreground">Q {session.current_question_index + 1}/{questions.length}</div>
      </header>

      {/* Progress bar */}
      <div className="h-2 bg-card rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-200 ${remaining <= 3 ? "bg-destructive" : "gradient-neon"}`}
          style={{ width: `${100 - progressPct}%` }}
        />
      </div>

      {/* Timer + question */}
      <div className="glass-strong rounded-3xl p-6 md:p-8 mb-6 text-center relative">
        <div className={`absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full gradient-primary glow-violet flex items-center justify-center font-display font-bold text-2xl text-white ${remaining <= 3 ? "animate-pulse" : ""}`}>
          {remaining}
        </div>
        {currentQ.image_url && <img src={currentQ.image_url} alt="" className="max-h-40 mx-auto rounded-xl mb-4" />}
        <h2 className="font-display text-2xl md:text-3xl font-bold mt-2">{currentQ.question_text}</h2>
      </div>

      {/* Answers */}
      <div className="flex-1">
        {currentQ.type === "type_answer" ? (
          <form onSubmit={(e) => { e.preventDefault(); if (typedAnswer.trim()) submitAnswer(typedAnswer); }} className="space-y-3">
            <input
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              disabled={hasAnswered}
              placeholder="Type your answer…"
              autoFocus
              className="w-full bg-card rounded-2xl px-5 py-5 text-xl font-semibold outline-none focus:ring-2 focus:ring-neon disabled:opacity-60"
            />
            <button type="submit" disabled={hasAnswered || !typedAnswer.trim()}
              className="w-full gradient-primary text-white font-bold py-4 rounded-2xl glow-violet disabled:opacity-50">
              {hasAnswered ? "Locked in! ⚡" : "Submit"}
            </button>
          </form>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {currentQ.options.filter(o => o).map((opt, i) => {
              const color = ANSWER_COLORS[i % 4];
              const isMine = myAnswer === opt;
              return (
                <button
                  key={i}
                  onClick={() => submitAnswer(opt)}
                  disabled={hasAnswered}
                  className={`${color.bg} ${color.text} rounded-2xl p-6 min-h-[80px] font-display font-bold text-lg md:text-xl text-left transition-all ${
                    hasAnswered && !isMine ? "opacity-30 scale-95" : ""
                  } ${isMine ? "ring-4 ring-neon glow-neon scale-105" : "hover:scale-105 active:scale-95"}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {hasAnswered && (
        <div className="text-center mt-6 animate-pop">
          <div className="inline-flex items-center gap-2 gradient-neon text-background font-bold px-5 py-2 rounded-full glow-neon">
            <Zap className="w-4 h-4" fill="currentColor" /> Locked in!
          </div>
          <p className="text-xs text-muted-foreground mt-2">Waiting for other players…</p>
        </div>
      )}
    </div>
  );
}

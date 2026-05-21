import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ANSWER_COLORS, type Question } from "@/lib/quiz";
import { Play, SkipForward, X, UserX, Copy, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/session/$id")({ component: HostSession });

interface SessionRow {
  id: string; quiz_id: string; room_code: string; status: string;
  current_question_index: number; current_question_started_at: string | null;
  started_at: string | null;
}
interface Player { id: string; nickname: string; avatar: string; score: number; }

function HostSession() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<{ question_id: string; answer: string | null; player_id: string }[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/" }); }, [user, authLoading, navigate]);

  // Load session + questions
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("sessions").select("*").eq("id", id).single();
      if (!s) return;
      setSession(s as SessionRow);
      const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("order_index");
      setQuestions((qs as Question[]) || []);
      const { data: ps } = await supabase.from("session_players").select("*").eq("session_id", id);
      setPlayers((ps as Player[]) || []);
    })();
  }, [id]);

  // Realtime: players + session changes + responses
  useEffect(() => {
    const ch = supabase.channel("host-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${id}` },
        (p: any) => {
          if (p.eventType === "INSERT") setPlayers((ps) => [...ps, p.new]);
          else if (p.eventType === "UPDATE") setPlayers((ps) => ps.map(x => x.id === p.new.id ? p.new : x));
          else if (p.eventType === "DELETE") setPlayers((ps) => ps.filter(x => x.id !== p.old.id));
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${id}` },
        (p: any) => setSession(p.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "session_responses", filter: `session_id=eq.${id}` },
        (p: any) => setResponses((r) => [...r, p.new]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  // Tick timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const currentQ = session && session.current_question_index >= 0 ? questions[session.current_question_index] : null;
  const remaining = useMemo(() => {
    if (!currentQ || !session?.current_question_started_at || session.status !== "active") return 0;
    const elapsed = (now - new Date(session.current_question_started_at).getTime()) / 1000;
    return Math.max(0, Math.ceil(currentQ.timer_seconds - elapsed));
  }, [currentQ, session, now]);

  const qResponses = currentQ ? responses.filter(r => r.question_id === currentQ.id) : [];
  const tally = useMemo(() => {
    if (!currentQ) return {} as Record<string, number>;
    const t: Record<string, number> = {};
    qResponses.forEach(r => { if (r.answer) t[r.answer] = (t[r.answer] || 0) + 1; });
    return t;
  }, [qResponses, currentQ]);

  // Auto-advance to reveal when timer hits 0
  useEffect(() => {
    if (session?.status === "active" && currentQ && remaining === 0) {
      reveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session?.status]);

  const startQuiz = async () => {
    if (players.length === 0) return toast.error("Wait for at least 1 player");
    await advanceTo(0);
  };

  const advanceTo = async (idx: number) => {
    if (idx >= questions.length) return endSession();
    await supabase.from("sessions").update({
      status: "active", current_question_index: idx,
      current_question_started_at: new Date().toISOString(),
      started_at: session?.started_at || new Date().toISOString(),
    }).eq("id", id);
  };

  const reveal = async () => {
    if (!currentQ) return;
    await supabase.from("sessions").update({ status: "reveal" }).eq("id", id);
    // Score players
    const qResponses = responses.filter(r => r.question_id === currentQ.id);
    const { data: full } = await supabase.from("session_responses").select("*").eq("session_id", id).eq("question_id", currentQ.id);
    const all = full || qResponses;
    for (const r of all as any[]) {
      if (r.points_earned > 0) continue; // already scored
      const correct = isCorrect(r.answer, currentQ);
      const pts = correct ? r.points_earned || 0 : 0;
      if (correct && (r.points_earned ?? 0) === 0) {
        // backfill
      }
      if (correct) {
        await supabase.from("session_players").update({ score: (players.find(p => p.id === r.player_id)?.score || 0) + (r.points_earned || currentQ.points) }).eq("id", r.player_id);
      }
      void pts;
    }
  };

  const nextQuestion = async () => {
    if (!session) return;
    const next = session.current_question_index + 1;
    if (next >= questions.length) return endSession();
    await advanceTo(next);
  };

  const endSession = async () => {
    await supabase.from("sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", id);
    navigate({ to: "/results/$sessionid", params: { sessionid: id } });
  };

  const kickPlayer = async (pid: string) => {
    await supabase.from("session_players").delete().eq("id", pid);
  };

  const copyLink = () => {
    const url = `${window.location.origin}/join/${session?.room_code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  if (!session) return <div className="p-10 text-muted-foreground">Loading session…</div>;

  // LOBBY
  if (session.status === "lobby") {
    const joinUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${session.room_code}`;
    return (
      <div className="min-h-screen p-6 md:p-10 flex flex-col">
        <header className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Lobby</h1>
          <button onClick={endSession} className="text-sm text-muted-foreground hover:text-destructive">Cancel session</button>
        </header>
        <div className="grid lg:grid-cols-[1fr_400px] gap-8 flex-1">
          <div className="glass-strong rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center text-center">
            <p className="text-sm uppercase tracking-widest text-muted-foreground mb-3">Scan to join</p>
            <div className="bg-white p-5 rounded-3xl mb-6">
              <QRCodeSVG value={joinUrl} size={240} level="M" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">or go to <span className="text-foreground font-semibold">{typeof window !== "undefined" ? window.location.host : ""}/join</span> and enter</p>
            <div className="font-display font-bold text-6xl md:text-8xl gradient-text tracking-[0.15em] my-4">{session.room_code}</div>
            <button onClick={copyLink} className="text-xs glass rounded-full px-3 py-1.5 flex items-center gap-1 hover:bg-primary/20"><Copy className="w-3 h-3" /> Copy join link</button>
          </div>

          <div className="glass-strong rounded-3xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">Players</h2>
              <span className="gradient-neon text-background font-bold text-sm px-3 py-1 rounded-full">{players.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {players.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Waiting for players…</p>
              ) : players.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-card animate-pop">
                  <span className="text-2xl">{p.avatar}</span>
                  <span className="font-semibold flex-1 truncate">{p.nickname}</span>
                  <button onClick={() => kickPlayer(p.id)} className="opacity-50 hover:opacity-100 hover:text-destructive p-1"><UserX className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button
              onClick={startQuiz}
              disabled={players.length === 0}
              className="gradient-primary text-white font-bold py-4 rounded-2xl glow-violet hover:scale-105 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
            >
              <Play className="w-5 h-5" fill="currentColor" /> Start Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-neon">{session.room_code}</span>
          <span className="text-sm text-muted-foreground">Q{session.current_question_index + 1} / {questions.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {session.status === "active" && (
            <button onClick={reveal} className="glass rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary/20 flex items-center gap-2">
              <SkipForward className="w-4 h-4" /> Skip to reveal
            </button>
          )}
          {session.status === "reveal" && (
            <button onClick={nextQuestion} className="gradient-primary text-white px-5 py-2 rounded-xl glow-violet font-bold flex items-center gap-2">
              {session.current_question_index + 1 >= questions.length ? "Show Results" : "Next Question"} <SkipForward className="w-4 h-4" />
            </button>
          )}
          <button onClick={endSession} className="glass rounded-xl px-3 py-2 text-sm hover:bg-destructive/20 hover:text-destructive flex items-center gap-2">
            <X className="w-4 h-4" /> End
          </button>
        </div>
      </header>

      {currentQ && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="glass-strong rounded-3xl p-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs glass px-3 py-1 rounded-full">{currentQ.points} pts</span>
              {session.status === "active" ? (
                <div className={`font-display font-bold text-4xl ${remaining <= 3 ? "text-destructive animate-pulse" : "text-neon"}`}>{remaining}s</div>
              ) : (
                <span className="text-xs glass px-3 py-1 rounded-full text-neon">REVEAL</span>
              )}
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">{currentQ.question_text}</h2>
            {currentQ.image_url && <img src={currentQ.image_url} alt="" className="w-full max-h-72 object-contain rounded-2xl mb-6" />}
            <div className="grid sm:grid-cols-2 gap-3">
              {currentQ.options.map((opt, i) => {
                const color = ANSWER_COLORS[i % 4];
                const count = tally[opt] || 0;
                const pct = players.length > 0 ? (count / players.length) * 100 : 0;
                const isCorrect = session.status === "reveal" && currentQ.correct_answer === opt;
                return (
                  <div key={i} className={`${color.bg} ${color.text} rounded-xl p-4 relative overflow-hidden ${isCorrect ? "ring-4 ring-neon glow-neon" : session.status === "reveal" ? "opacity-50" : ""}`}>
                    <div className="absolute inset-0 bg-background/20" style={{ width: `${100 - pct}%`, right: 0, left: "auto" }} />
                    <div className="relative flex justify-between items-center font-semibold">
                      <span>{opt || `Option ${i + 1}`}</span>
                      <span className="text-sm opacity-80">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 text-sm text-muted-foreground text-center">
              {qResponses.length} / {players.length} answered
            </div>
          </div>

          <div className="glass-strong rounded-3xl p-5">
            <h3 className="font-display font-bold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-neon" /> Leaderboard</h3>
            <div className="space-y-2">
              {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-card">
                  <span className="font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                  <span className="text-xl">{p.avatar}</span>
                  <span className="text-sm flex-1 truncate">{p.nickname}</span>
                  <span className="font-bold text-neon">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isCorrect(answer: string | null, q: Question) {
  if (q.type === "poll") return false;
  if (!answer || !q.correct_answer) return false;
  if (q.type === "type_answer") return answer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
  return answer === q.correct_answer;
}

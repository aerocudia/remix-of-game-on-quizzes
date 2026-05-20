import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fireConfetti } from "@/lib/quiz";
import { Trophy, Share2, Home } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/results/$sessionid")({ component: Results });

interface Player { id: string; nickname: string; avatar: string; score: number; }

function Results() {
  const { sessionid } = Route.useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("session_players").select("*").eq("session_id", sessionid).order("score", { ascending: false });
      setPlayers((data as Player[]) || []);
      const { data: s } = await supabase.from("sessions").select("quizzes(title)").eq("id", sessionid).single();
      setQuizTitle((s as any)?.quizzes?.title || "Quiz");
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(`player-${sessionid}`);
        if (cached) setMyId(JSON.parse(cached).id);
      }
      setTimeout(() => fireConfetti(), 200);
      setTimeout(() => fireConfetti(), 1000);
    })();
  }, [sessionid]);

  const podium = players.slice(0, 3);
  const rest = players.slice(3);
  const me = players.find(p => p.id === myId);
  const myRank = me ? players.findIndex(p => p.id === me.id) + 1 : null;

  const share = () => {
    const txt = me
      ? `I scored ${me.score} pts (#${myRank} of ${players.length}) on "${quizTitle}" — DeonToWin 🏆⚡`
      : `Check out "${quizTitle}" on DeonToWin!`;
    navigator.clipboard.writeText(txt);
    toast.success("Score copied — paste anywhere!");
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-6 py-12">
      <Trophy className="w-16 h-16 text-neon mb-3" />
      <h1 className="font-display text-4xl md:text-6xl font-bold text-center mb-2">Final Results</h1>
      <p className="text-muted-foreground mb-12 text-center">{quizTitle}</p>

      {/* Podium */}
      {podium.length > 0 && (
        <div className="flex items-end justify-center gap-4 mb-10 w-full max-w-2xl">
          {[1, 0, 2].map((idx) => {
            const p = podium[idx]; if (!p) return <div key={idx} className="flex-1" />;
            const heights = ["h-32", "h-44", "h-24"];
            const colors = ["gradient-neon", "gradient-primary", "bg-accent"];
            const places = ["🥈", "🥇", "🥉"];
            return (
              <div key={p.id} className="flex-1 flex flex-col items-center">
                <div className="text-5xl mb-1 animate-float" style={{ animationDelay: `${idx * 0.2}s` }}>{p.avatar}</div>
                <p className="font-bold text-sm truncate max-w-full">{p.nickname}</p>
                <p className="text-xs text-muted-foreground mb-2">{p.score} pts</p>
                <div className={`${colors[idx]} ${heights[idx]} w-full rounded-t-2xl flex items-start justify-center pt-3 text-3xl ${idx === 0 ? "glow-violet" : idx === 1 ? "glow-neon" : ""}`}>
                  {places[idx]}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* My result */}
      {me && (
        <div className="glass-strong rounded-2xl p-6 mb-8 w-full max-w-md text-center animate-pop">
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-2">Your result</p>
          <div className="flex items-center justify-center gap-4">
            <span className="text-5xl">{me.avatar}</span>
            <div className="text-left">
              <p className="font-display font-bold text-2xl">{me.nickname}</p>
              <p className="text-neon font-bold">#{myRank} · {me.score} pts</p>
            </div>
          </div>
        </div>
      )}

      {/* Rest */}
      {rest.length > 0 && (
        <div className="w-full max-w-md glass rounded-2xl p-4 mb-8">
          {rest.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 p-2 ${p.id === myId ? "bg-primary/20 rounded-lg" : ""}`}>
              <span className="font-bold text-muted-foreground w-6 text-center">{i + 4}</span>
              <span className="text-2xl">{p.avatar}</span>
              <span className="flex-1 truncate">{p.nickname}</span>
              <span className="font-bold text-neon">{p.score}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={share} className="glass rounded-xl px-5 py-3 font-semibold hover:bg-primary/20 flex items-center gap-2">
          <Share2 className="w-4 h-4" /> Share Score
        </button>
        <Link to="/" className="gradient-primary text-white px-5 py-3 rounded-xl font-bold glow-violet flex items-center gap-2">
          <Home className="w-4 h-4" /> Home
        </Link>
      </div>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap, Sparkles, Trophy, Users, ArrowRight } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "DeonToWin — Live Quizzes & Game Shows" },
      { name: "description", content: "Bold, energetic live quiz hosting. Sign in with Google to build, host, and analyze. Players join with a room code." },
    ],
  }),
});

function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/admin/dashboard" });
  }, [user, navigate]);

  const signIn = async () => {
    setSigningIn(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Sign-in failed. Try again.");
      setSigningIn(false);
    }
  };

  const joinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim().length < 4) return toast.error("Enter a valid room code");
    navigate({ to: "/join/$roomcode", params: { roomcode: roomCode.trim().toUpperCase() } });
  };

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold text-xl">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center glow-violet">
            <Zap className="w-5 h-5 text-white" fill="currentColor" />
          </div>
          <span>Deon<span className="gradient-text">ToWin</span></span>
        </div>
        <div className="flex items-center gap-5 text-sm font-semibold text-muted-foreground">
          <Link to="/library" className="hover:text-foreground transition">Library</Link>
          <Link to="/join" className="hover:text-foreground transition">Have a code? Join →</Link>
        </div>
      </header>

      <main className="px-6 pt-12 pb-20 max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-8 text-xs font-semibold text-neon">
            <Sparkles className="w-3.5 h-3.5" /> Live quizzes, no login for players
          </div>
          <h1 className="font-display text-6xl md:text-8xl font-bold leading-[0.95] tracking-tight">
            A Deontological Quiz
          </h1>
          <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
            Host live game-show quizzes for your classroom, team, or party. Players scan a QR code, pick an avatar, and the chaos begins.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={signIn}
              disabled={signingIn || loading}
              className="group inline-flex items-center gap-3 gradient-primary text-white font-semibold rounded-2xl px-8 py-4 glow-violet hover:scale-105 transition-transform disabled:opacity-60"
            >
              <GoogleIcon /> {signingIn ? "Opening Google..." : "Sign in with Google to host"}
            </button>
          </div>

          <div className="mt-16 glass-strong rounded-3xl p-6 md:p-8 max-w-md mx-auto">
            <p className="text-sm uppercase tracking-widest text-muted-foreground mb-4">Joining a game?</p>
            <form onSubmit={joinGame} className="flex gap-2">
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={8}
                className="flex-1 bg-input rounded-xl px-4 py-3 font-display font-bold tracking-[0.3em] text-center text-2xl outline-none focus:ring-2 focus:ring-neon"
              />
              <button type="submit" className="gradient-neon text-background font-bold rounded-xl px-5 glow-neon hover:scale-105 transition">
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-4">
          <Feature icon={<Zap className="w-5 h-5" />} title="Built in minutes" body="Multiple choice, true/false, polls, type-the-answer. Drag to reorder. Auto-saves as you go." />
          <Feature icon={<Users className="w-5 h-5" />} title="No friction for players" body="Scan QR or tap a code. No accounts. No downloads. Just join and play." />
          <Feature icon={<Trophy className="w-5 h-5" />} title="Live everything" body="Synced timers, live answer tallies, leaderboards between rounds, podium finale." />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-6 hover:border-primary/50 transition">
      <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center mb-4 text-white">{icon}</div>
      <h3 className="font-display font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" opacity=".9" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" opacity=".8" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#fff" opacity=".7" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/join")({
  component: JoinPage,
  head: () => ({ meta: [{ title: "Join a Game — DeonToWin" }] }),
});

function JoinPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const go = async () => {
    if (loading) return;
    const clean = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (clean.length < 4) {
      toast.error("Enter the room code from your host (4+ characters)");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, status")
        .eq("room_code", clean)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Room not found — double-check the code");
        setLoading(false);
        return;
      }
      if (data.status === "ended") {
        toast.error("This game has already ended");
        setLoading(false);
        return;
      }
      // Hard navigation — guaranteed to work regardless of router state
      window.location.assign(`/join/${clean}`);
    } catch (err) {
      console.error("join lookup failed", err);
      toast.error("Couldn't reach the server — check your connection");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-2 font-display font-bold text-2xl mb-12">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-violet">
          <Zap className="w-5 h-5 text-white" fill="currentColor" />
        </div>
        Deon<span className="gradient-text">ToWin</span>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); go(); }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md"
      >
        <h1 className="font-display font-bold text-3xl text-center mb-2">Enter room code</h1>
        <p className="text-center text-muted-foreground text-sm mb-6">Ask your host for the code on their screen</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={8}
          autoFocus
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full bg-input rounded-2xl px-4 py-6 font-display font-bold tracking-[0.3em] text-center text-4xl outline-none focus:ring-2 focus:ring-neon mb-4"
        />
        <button
          type="button"
          onClick={go}
          className="w-full gradient-primary text-white font-bold py-4 rounded-2xl glow-violet hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2"
        >
          Continue <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-center text-xs text-muted-foreground mt-4">No account needed. Just bring vibes. ✨</p>
      </form>
    </div>
  );
}

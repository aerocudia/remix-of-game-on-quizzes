import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/join")({
  component: JoinPage,
  head: () => ({ meta: [{ title: "Join a Game — DeonToWin" }] }),
});

function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-2 font-display font-bold text-2xl mb-12">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-violet">
          <Zap className="w-5 h-5 text-white" fill="currentColor" />
        </div>
        Deon<span className="gradient-text">ToWin</span>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 4) navigate({ to: "/join/$roomcode", params: { roomcode: code.trim().toUpperCase() } }); }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md"
      >
        <h1 className="font-display font-bold text-3xl text-center mb-2">Enter room code</h1>
        <p className="text-center text-muted-foreground text-sm mb-6">Ask your host for the 6-letter code</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={8}
          autoFocus
          className="w-full bg-input rounded-2xl px-4 py-6 font-display font-bold tracking-[0.3em] text-center text-4xl outline-none focus:ring-2 focus:ring-neon mb-4"
        />
        <button type="submit" className="w-full gradient-primary text-white font-bold py-4 rounded-2xl glow-violet hover:scale-105 transition flex items-center justify-center gap-2">
          Continue <ArrowRight className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

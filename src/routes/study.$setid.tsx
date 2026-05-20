import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Question } from "@/lib/quiz";
import { ArrowLeft, RotateCcw, ChevronLeft, ChevronRight, Shuffle, Check, X } from "lucide-react";

export const Route = createFileRoute("/study/$setid")({
  component: Study,
  head: () => ({
    meta: [
      { title: "Flashcard Study — DeonToWin" },
      { name: "description", content: "Flip through quiz cards to study. No login needed." },
    ],
  }),
});

function Study() {
  const { setid } = Route.useParams();
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<Question[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: quiz } = await supabase.from("quizzes").select("title").eq("id", setid).single();
      if (quiz) setTitle(quiz.title);
      const { data } = await supabase.from("questions").select("*").eq("quiz_id", setid).order("order_index");
      const list = (data as Question[]) || [];
      setCards(list);
      setOrder(list.map((_, i) => i));
      setLoading(false);
    })();
  }, [setid]);

  const current = useMemo(() => cards[order[idx]], [cards, order, idx]);
  const total = cards.length;

  const next = () => { setFlipped(false); setIdx((i) => Math.min(total - 1, i + 1)); };
  const prev = () => { setFlipped(false); setIdx((i) => Math.max(0, i - 1)); };
  const shuffle = () => {
    setFlipped(false);
    setIdx(0);
    setOrder((o) => [...o].sort(() => Math.random() - 0.5));
  };
  const reset = () => { setFlipped(false); setIdx(0); setKnown(new Set()); };

  const mark = (good: boolean) => {
    if (!current) return;
    setKnown((s) => {
      const n = new Set(s);
      if (good) n.add(current.id); else n.delete(current.id);
      return n;
    });
    next();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "1") mark(false);
      else if (e.key === "2") mark(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, idx, total]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!cards.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">No cards in this set yet.</p>
        <Link to="/library" className="gradient-primary text-white px-5 py-3 rounded-xl glow-violet font-semibold">Back to library</Link>
      </div>
    );
  }

  const front = current.question_text;
  const back = current.correct_answer || current.options.find((o) => o) || "—";
  const progress = ((idx + 1) / total) * 100;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border">
        <Link to="/library" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Library
        </Link>
        <div className="text-sm">
          <span className="font-display font-bold">{title}</span>
          <span className="text-muted-foreground ml-3">{idx + 1} / {total}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={shuffle} className="p-2 rounded-lg bg-accent hover:bg-primary/30" title="Shuffle"><Shuffle className="w-4 h-4" /></button>
          <button onClick={reset} className="p-2 rounded-lg bg-accent hover:bg-primary/30" title="Reset"><RotateCcw className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="h-1 bg-card">
        <div className="h-full gradient-neon transition-all" style={{ width: `${progress}%` }} />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div
          className="relative w-full max-w-2xl aspect-[3/2] cursor-pointer select-none"
          style={{ perspective: "1500px" }}
          onClick={() => setFlipped((f) => !f)}
        >
          <div
            className="relative w-full h-full transition-transform duration-500"
            style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}
          >
            <div
              className="absolute inset-0 glass-strong rounded-3xl flex flex-col items-center justify-center p-10 text-center"
              style={{ backfaceVisibility: "hidden" }}
            >
              <span className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Question</span>
              <p className="font-display text-3xl md:text-4xl font-bold leading-tight">{front}</p>
              <span className="absolute bottom-4 text-xs text-muted-foreground">Tap or press SPACE to flip</span>
            </div>
            <div
              className="absolute inset-0 gradient-primary rounded-3xl flex flex-col items-center justify-center p-10 text-center glow-violet"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <span className="text-xs uppercase tracking-widest text-white/70 mb-6">Answer</span>
              <p className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">{back}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full max-w-2xl">
          <button onClick={prev} disabled={idx === 0} className="p-3 rounded-xl bg-accent hover:bg-primary/30 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => mark(false)} className="flex-1 bg-answer-red/20 text-answer-red hover:bg-answer-red/30 rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition">
            <X className="w-4 h-4" /> Still learning
          </button>
          <button onClick={() => mark(true)} className="flex-1 bg-neon/20 text-neon hover:bg-neon/30 rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition">
            <Check className="w-4 h-4" /> Got it
          </button>
          <button onClick={next} disabled={idx >= total - 1} className="p-3 rounded-xl bg-accent hover:bg-primary/30 disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          Mastered <span className="text-neon font-bold">{known.size}</span> / {total}
        </div>
      </main>
    </div>
  );
}

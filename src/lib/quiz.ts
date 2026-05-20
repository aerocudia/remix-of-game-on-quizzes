export const AVATARS = [
  "🦊","🐼","🦁","🐯","🐸","🐙","🦄","🐺","🦖","🐲",
  "🦉","🐬","🦋","🐢","🦅","🐝","🐧","🦩","🦜","🐳",
  "👾","🤖","👻","🎮","🚀","⚡","🌟","🔥","💎","🎯",
];

export const ANSWER_COLORS = [
  { bg: "bg-answer-red", text: "text-white", hex: "oklch(0.62 0.24 25)" },
  { bg: "bg-answer-blue", text: "text-white", hex: "oklch(0.6 0.22 245)" },
  { bg: "bg-answer-yellow", text: "text-background", hex: "oklch(0.82 0.18 85)" },
  { bg: "bg-answer-green", text: "text-white", hex: "oklch(0.7 0.22 145)" },
  { bg: "bg-primary", text: "text-white", hex: "oklch(0.55 0.27 295)" },
  { bg: "bg-neon", text: "text-background", hex: "oklch(0.87 0.24 130)" },
];

export const TIMER_OPTIONS = [5, 10, 20, 30, 60, 90];
export const POINT_OPTIONS = [0, 100, 200, 500, 1000];

export function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export type QuestionType = "multiple_choice" | "true_false" | "type_answer" | "poll" | "image";

export interface Question {
  id: string;
  quiz_id: string;
  type: QuestionType;
  question_text: string;
  image_url: string | null;
  options: string[];
  correct_answer: string | null;
  timer_seconds: number;
  points: number;
  order_index: number;
}

export function calculatePoints(basePoints: number, responseTimeMs: number, timerSeconds: number) {
  const maxMs = timerSeconds * 1000;
  const ratio = Math.max(0, 1 - responseTimeMs / maxMs);
  // 50% base + up to 50% speed bonus
  return Math.round(basePoints * (0.5 + 0.5 * ratio));
}

export function fireConfetti() {
  if (typeof document === "undefined") return;
  const colors = ["#7C3AED","#A3E635","#F59E0B","#EC4899","#3B82F6"];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.left = Math.random() * 100 + "vw";
    el.style.background = colors[i % colors.length];
    el.style.animationDelay = Math.random() * 0.6 + "s";
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

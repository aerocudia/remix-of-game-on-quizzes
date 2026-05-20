import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TIMER_OPTIONS, POINT_OPTIONS, ANSWER_COLORS, type Question, type QuestionType } from "@/lib/quiz";
import { generateAIQuiz } from "@/lib/ai-quiz.functions";
import { Plus, Trash2, GripVertical, Save, Play, ArrowLeft, Check, Sparkles, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple Choice",
  true_false: "True / False",
  type_answer: "Type Answer",
  poll: "Poll",
  image: "Image Question",
};

export function QuizBuilder({ quizId: initialId }: { quizId: string | null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizId, setQuizId] = useState<string | null>(initialId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [isPublic, setIsPublic] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!initialId);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiLoading, setAiLoading] = useState(false);
  const generateFn = useServerFn(generateAIQuiz);
  const dragIdx = useRef<number | null>(null);

  // Load existing
  useEffect(() => {
    if (!initialId || !user) return;
    (async () => {
      const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", initialId).single();
      if (quiz) {
        setTitle(quiz.title);
        setDescription(quiz.description || "");
        setSubject(quiz.subject || "");
        setDifficulty(quiz.difficulty || "Medium");
        setIsPublic(!!quiz.is_public);
      }
      const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", initialId).order("order_index");
      setQuestions((qs as Question[]) || []);
      setLoaded(true);
    })();
  }, [initialId, user]);

  const ensureQuiz = async (): Promise<string | null> => {
    if (quizId) return quizId;
    if (!user) return null;
    const { data, error } = await supabase
      .from("quizzes")
      .insert({ admin_id: user.id, title: title || "Untitled quiz", description, subject, difficulty })
      .select()
      .single();
    if (error || !data) { toast.error("Failed to create quiz"); return null; }
    setQuizId(data.id);
    return data.id;
  };

  const saveAll = async (silent = false) => {
    if (!user) return;
    setSaving(true);
    const id = await ensureQuiz();
    if (!id) { setSaving(false); return; }
    await supabase.from("quizzes").update({ title: title || "Untitled quiz", description, subject, difficulty, is_public: isPublic, updated_at: new Date().toISOString() }).eq("id", id);
    // Save questions: upsert by id
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const payload = {
        quiz_id: id, type: q.type, question_text: q.question_text, image_url: q.image_url,
        options: q.options, correct_answer: q.correct_answer, timer_seconds: q.timer_seconds,
        points: q.points, order_index: i,
      };
      if (q.id.startsWith("tmp-")) {
        const { data } = await supabase.from("questions").insert(payload).select().single();
        if (data) setQuestions((qs) => qs.map((qq, idx) => (idx === i ? { ...qq, id: data.id } : qq)));
      } else {
        await supabase.from("questions").update(payload).eq("id", q.id);
      }
    }
    setSaving(false);
    if (!silent) toast.success("Saved");
  };

  // Autosave every 30s
  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(() => saveAll(true), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, title, description, subject, difficulty, isPublic, questions]);

  const runAiGenerate = async () => {
    if (aiTopic.trim().length < 2) return toast.error("Enter a topic");
    setAiLoading(true);
    try {
      const { questions: gen } = await generateFn({ data: { topic: aiTopic.trim(), count: aiCount, difficulty: difficulty as "Easy" | "Medium" | "Hard" } });
      if (!gen.length) { toast.error("AI returned no usable questions"); return; }
      const startIdx = questions.length;
      const newQs: Question[] = gen.map((g, i) => ({
        id: "tmp-" + Math.random().toString(36).slice(2),
        quiz_id: quizId || "",
        type: "multiple_choice",
        question_text: g.question_text,
        image_url: null,
        options: g.options,
        correct_answer: g.correct_answer,
        timer_seconds: 20,
        points: 500,
        order_index: startIdx + i,
      }));
      setQuestions((qs) => [...qs, ...newQs]);
      setSelectedIdx(startIdx);
      if (!title) setTitle(aiTopic.trim());
      toast.success(`Generated ${newQs.length} questions`);
      setAiOpen(false);
      setAiTopic("");
    } catch (e: any) {
      toast.error(e?.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const addQuestion = (type: QuestionType = "multiple_choice") => {
    const base: Question = {
      id: "tmp-" + Math.random().toString(36).slice(2),
      quiz_id: quizId || "",
      type,
      question_text: "",
      image_url: null,
      options: type === "true_false" ? ["True", "False"] : type === "type_answer" ? [] : ["", "", "", ""],
      correct_answer: type === "true_false" ? "True" : null,
      timer_seconds: 20,
      points: 500,
      order_index: questions.length,
    };
    setQuestions((qs) => [...qs, base]);
    setSelectedIdx(questions.length);
  };

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const deleteQuestion = async (idx: number) => {
    const q = questions[idx];
    if (!q.id.startsWith("tmp-")) await supabase.from("questions").delete().eq("id", q.id);
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
    setSelectedIdx(Math.max(0, idx - 1));
  };

  const onDragStart = (i: number) => (dragIdx.current = i);
  const onDrop = (i: number) => {
    if (dragIdx.current === null || dragIdx.current === i) return;
    setQuestions((qs) => {
      const copy = [...qs];
      const [m] = copy.splice(dragIdx.current!, 1);
      copy.splice(i, 0, m);
      return copy;
    });
    dragIdx.current = null;
    setSelectedIdx(i);
  };

  const host = async () => {
    if (questions.length === 0) return toast.error("Add at least one question");
    await saveAll(true);
    if (!quizId || !user) return;
    const { generateRoomCode } = await import("@/lib/quiz");
    const { data, error } = await supabase
      .from("sessions")
      .insert({ quiz_id: quizId, admin_id: user.id, room_code: generateRoomCode(), status: "lobby" })
      .select()
      .single();
    if (error || !data) return toast.error("Could not start session");
    navigate({ to: "/admin/session/$id", params: { id: data.id } });
  };

  if (!loaded) return <div className="p-10 text-muted-foreground">Loading…</div>;
  const current = questions[selectedIdx];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border glass-strong px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link to="/admin/dashboard" className="p-2 rounded-lg hover:bg-accent"><ArrowLeft className="w-4 h-4" /></Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled quiz"
          className="bg-transparent font-display font-bold text-xl outline-none flex-1 min-w-0"
        />
        <button
          onClick={() => setIsPublic((v) => !v)}
          title={isPublic ? "Public — listed in library" : "Private"}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition ${isPublic ? "bg-neon/20 text-neon" : "bg-accent text-muted-foreground hover:text-white"}`}
        >
          {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {isPublic ? "Public" : "Private"}
        </button>
        <button onClick={() => setAiOpen(true)} className="px-4 py-2 rounded-xl bg-accent hover:bg-primary/30 transition flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="w-4 h-4 text-neon" /> AI Generate
        </button>
        <button onClick={() => saveAll()} disabled={saving} className="px-4 py-2 rounded-xl bg-accent hover:bg-primary/30 transition flex items-center gap-2 text-sm font-semibold">
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={host} className="gradient-neon text-background font-bold px-5 py-2.5 rounded-xl glow-neon hover:scale-105 transition flex items-center gap-2 text-sm">
          <Play className="w-4 h-4" fill="currentColor" /> Host Live
        </button>
      </header>

      {aiOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4" onClick={() => !aiLoading && setAiOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="glass-strong rounded-3xl p-8 max-w-md w-full">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-neon" />
              <h2 className="font-display text-2xl font-bold">AI Quick-Quiz</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Describe a topic and we'll generate multiple-choice questions for you.</p>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Topic</label>
            <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Roman Empire, JavaScript basics, 90s pop music"
              className="w-full bg-input rounded-xl px-4 py-3 mt-2 mb-4 outline-none focus:ring-2 focus:ring-primary" autoFocus />
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Questions</label>
                <input type="number" min={1} max={15} value={aiCount} onChange={(e) => setAiCount(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))}
                  className="w-full bg-input rounded-xl px-4 py-3 mt-2 outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full bg-input rounded-xl px-4 py-3 mt-2 outline-none focus:ring-2 focus:ring-primary">
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAiOpen(false)} disabled={aiLoading} className="flex-1 bg-accent rounded-xl py-3 font-semibold hover:bg-accent/70 transition">Cancel</button>
              <button onClick={runAiGenerate} disabled={aiLoading} className="flex-1 gradient-primary text-white rounded-xl py-3 font-bold glow-violet hover:scale-105 transition disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2">
                {aiLoading ? "Generating…" : <><Sparkles className="w-4 h-4" /> Generate</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Question list */}
        <div className="w-72 border-r border-border p-4 space-y-2 overflow-y-auto">
          <div className="space-y-2 mb-3">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="w-full bg-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            <div className="grid grid-cols-2 gap-2">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="bg-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="bg-input rounded-lg px-3 py-2 text-sm outline-none">
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
            </div>
          </div>

          {questions.map((q, i) => (
            <div
              key={q.id}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onClick={() => setSelectedIdx(i)}
              className={`group flex items-center gap-2 p-3 rounded-xl cursor-pointer transition ${
                selectedIdx === i ? "bg-primary/20 border border-primary/50" : "bg-card hover:bg-accent"
              }`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
              <span className="text-sm truncate flex-1">{q.question_text || "New question"}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteQuestion(i); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <div className="pt-2 grid grid-cols-2 gap-2">
            <button onClick={() => addQuestion("multiple_choice")} className="text-xs glass rounded-lg px-2 py-2 hover:bg-primary/20 flex items-center justify-center gap-1">
              <Plus className="w-3 h-3" /> MC
            </button>
            <button onClick={() => addQuestion("true_false")} className="text-xs glass rounded-lg px-2 py-2 hover:bg-primary/20">T/F</button>
            <button onClick={() => addQuestion("type_answer")} className="text-xs glass rounded-lg px-2 py-2 hover:bg-primary/20">Type</button>
            <button onClick={() => addQuestion("poll")} className="text-xs glass rounded-lg px-2 py-2 hover:bg-primary/20">Poll</button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 p-6 md:p-10 overflow-y-auto">
          {!current ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h3 className="font-display text-2xl font-bold mb-2">No questions yet</h3>
              <p className="text-muted-foreground mb-6">Add your first question from the sidebar.</p>
              <button onClick={() => addQuestion()} className="gradient-primary text-white px-5 py-3 rounded-xl glow-violet font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add question
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs glass rounded-full px-3 py-1 font-semibold">{TYPE_LABELS[current.type]}</span>
                <span className="text-sm text-muted-foreground">Question {selectedIdx + 1} of {questions.length}</span>
              </div>

              <textarea
                value={current.question_text}
                onChange={(e) => updateQuestion(selectedIdx, { question_text: e.target.value })}
                placeholder="Type your question…"
                rows={3}
                className="w-full bg-card rounded-2xl p-6 text-2xl font-display font-semibold outline-none focus:ring-2 focus:ring-primary resize-none"
              />

              {current.type === "image" || current.image_url ? (
                <input value={current.image_url || ""} onChange={(e) => updateQuestion(selectedIdx, { image_url: e.target.value })}
                  placeholder="Image URL (optional)" className="w-full bg-input rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary" />
              ) : null}

              {current.type === "multiple_choice" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {current.options.map((opt, i) => {
                    const color = ANSWER_COLORS[i % 4];
                    const isCorrect = current.correct_answer === opt && opt !== "";
                    return (
                      <div key={i} className={`${color.bg} rounded-xl p-4 relative ${isCorrect ? "ring-4 ring-neon" : ""}`}>
                        <input
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...current.options]; newOpts[i] = e.target.value;
                            updateQuestion(selectedIdx, {
                              options: newOpts,
                              correct_answer: current.correct_answer === opt ? e.target.value : current.correct_answer,
                            });
                          }}
                          placeholder={`Answer ${i + 1}`}
                          className={`bg-transparent w-full outline-none font-semibold ${color.text} placeholder:opacity-60`}
                        />
                        <button
                          onClick={() => updateQuestion(selectedIdx, { correct_answer: opt })}
                          className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition ${
                            isCorrect ? "bg-neon text-background" : "bg-background/30 hover:bg-background/60"
                          }`}
                          title="Mark correct"
                        >
                          {isCorrect && <Check className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {current.type === "true_false" && (
                <div className="grid grid-cols-2 gap-3">
                  {["True", "False"].map((opt, i) => {
                    const color = ANSWER_COLORS[i];
                    const isCorrect = current.correct_answer === opt;
                    return (
                      <button key={opt} onClick={() => updateQuestion(selectedIdx, { correct_answer: opt })}
                        className={`${color.bg} ${color.text} rounded-xl p-6 font-display font-bold text-2xl transition ${isCorrect ? "ring-4 ring-neon" : "opacity-80 hover:opacity-100"}`}>
                        {opt} {isCorrect && "✓"}
                      </button>
                    );
                  })}
                </div>
              )}

              {current.type === "type_answer" && (
                <input value={current.correct_answer || ""} onChange={(e) => updateQuestion(selectedIdx, { correct_answer: e.target.value })}
                  placeholder="Correct answer (case-insensitive)" className="w-full bg-card rounded-xl px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-neon" />
              )}

              {current.type === "poll" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {current.options.map((opt, i) => {
                    const color = ANSWER_COLORS[i % 4];
                    return (
                      <input key={i} value={opt} onChange={(e) => {
                        const newOpts = [...current.options]; newOpts[i] = e.target.value;
                        updateQuestion(selectedIdx, { options: newOpts });
                      }} placeholder={`Option ${i + 1}`} className={`${color.bg} ${color.text} rounded-xl p-4 font-semibold outline-none placeholder:opacity-60`} />
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timer</label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {TIMER_OPTIONS.map((t) => (
                      <button key={t} onClick={() => updateQuestion(selectedIdx, { timer_seconds: t })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${current.timer_seconds === t ? "gradient-primary text-white" : "bg-accent text-muted-foreground"}`}>
                        {t}s
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Points</label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {POINT_OPTIONS.map((p) => (
                      <button key={p} onClick={() => updateQuestion(selectedIdx, { points: p })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${current.points === p ? "gradient-neon text-background" : "bg-accent text-muted-foreground"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode } from "@/lib/quiz";
import { Plus, Play, Edit3, Copy, Trash2, FileQuestion } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/dashboard")({
  component: Dashboard,
});

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  subject: string | null;
  difficulty: string | null;
  created_at: string;
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("quizzes")
        .select("*")
        .eq("admin_id", user.id)
        .order("created_at", { ascending: false });
      setQuizzes((data as Quiz[]) || []);
      if (data?.length) {
        const { data: qs } = await supabase
          .from("questions")
          .select("quiz_id")
          .in("quiz_id", data.map((q) => q.id));
        const c: Record<string, number> = {};
        qs?.forEach((q: any) => { c[q.quiz_id] = (c[q.quiz_id] || 0) + 1; });
        setCounts(c);
      }
      setLoading(false);
    })();
  }, [user]);

  const hostQuiz = async (quizId: string) => {
    if (!user) return;
    const { count } = await supabase.from("questions").select("*", { count: "exact", head: true }).eq("quiz_id", quizId);
    if (!count) return toast.error("Add at least one question first");
    const room_code = generateRoomCode();
    const { data, error } = await supabase
      .from("sessions")
      .insert({ quiz_id: quizId, admin_id: user.id, room_code, status: "lobby" })
      .select()
      .single();
    if (error || !data) return toast.error("Could not create session");
    navigate({ to: "/admin/session/$id", params: { id: data.id } });
  };

  const duplicateQuiz = async (id: string) => {
    if (!user) return;
    const { data: orig } = await supabase.from("quizzes").select("*").eq("id", id).single();
    if (!orig) return;
    const { data: questions } = await supabase.from("questions").select("*").eq("quiz_id", id).order("order_index");
    const { data: copy } = await supabase
      .from("quizzes")
      .insert({
        admin_id: user.id,
        title: orig.title + " (copy)",
        description: orig.description,
        subject: orig.subject,
        difficulty: orig.difficulty,
        cover_image: orig.cover_image,
      })
      .select()
      .single();
    if (!copy) return toast.error("Duplicate failed");
    if (questions?.length) {
      await supabase.from("questions").insert(
        questions.map(({ id: _id, created_at: _c, ...q }: any) => ({ ...q, quiz_id: copy.id }))
      );
    }
    toast.success("Duplicated");
    setQuizzes((qs) => [copy as Quiz, ...qs]);
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm("Delete this quiz and all its questions?")) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) return toast.error("Delete failed");
    setQuizzes((qs) => qs.filter((q) => q.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-bold">My Quizzes</h1>
          <p className="text-muted-foreground mt-1">Build, host, and run the room.</p>
        </div>
        <Link to="/admin/quiz/new" className="gradient-primary text-white font-semibold px-5 py-3 rounded-xl glow-violet hover:scale-105 transition flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Quiz
        </Link>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : quizzes.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <FileQuestion className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-display text-xl font-bold mb-2">No quizzes yet</h3>
          <p className="text-muted-foreground mb-6">Build your first one in under two minutes.</p>
          <Link to="/admin/quiz/new" className="gradient-primary text-white font-semibold px-5 py-3 rounded-xl glow-violet inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create a quiz
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((q) => (
            <div key={q.id} className="glass rounded-2xl overflow-hidden group hover:border-primary/50 transition">
              <div className="h-32 gradient-primary relative">
                {q.cover_image && <img src={q.cover_image} alt="" className="w-full h-full object-cover" />}
                <div className="absolute top-3 right-3 glass-strong rounded-full px-3 py-1 text-xs font-semibold">
                  {counts[q.id] || 0} Qs
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-display font-bold text-lg truncate">{q.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
                  {q.description || "No description"}
                </p>
                <div className="flex items-center gap-2 mt-3 mb-4">
                  {q.subject && <span className="text-xs glass px-2 py-0.5 rounded-full">{q.subject}</span>}
                  {q.difficulty && <span className="text-xs glass px-2 py-0.5 rounded-full">{q.difficulty}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => hostQuiz(q.id)} className="flex-1 gradient-neon text-background font-bold py-2.5 rounded-xl glow-neon hover:scale-105 transition flex items-center justify-center gap-2 text-sm">
                    <Play className="w-4 h-4" fill="currentColor" /> Host Live
                  </button>
                  <Link to="/admin/quiz/$id/edit" params={{ id: q.id }} className="p-2.5 rounded-xl bg-accent hover:bg-primary/30 transition" title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </Link>
                  <button onClick={() => duplicateQuiz(q.id)} className="p-2.5 rounded-xl bg-accent hover:bg-primary/30 transition" title="Duplicate">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteQuiz(q.id)} className="p-2.5 rounded-xl bg-accent hover:bg-destructive/30 hover:text-destructive transition" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

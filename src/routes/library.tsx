import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Copy, BookOpen, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/library")({
  component: Library,
  head: () => ({
    meta: [
      { title: "Public Quiz Library — DeonToWin" },
      { name: "description", content: "Browse and clone community quizzes. Study with flashcards or host live." },
    ],
  }),
});

interface PubQuiz {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  difficulty: string | null;
  cover_image: string | null;
  admin_id: string;
}

function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<PubQuiz[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("quizzes")
        .select("id,title,description,subject,difficulty,cover_image,admin_id")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(60);
      const list = (data as PubQuiz[]) || [];
      setQuizzes(list);
      if (list.length) {
        const { data: qs } = await supabase
          .from("questions")
          .select("quiz_id")
          .in("quiz_id", list.map((q) => q.id));
        const c: Record<string, number> = {};
        qs?.forEach((q: any) => { c[q.quiz_id] = (c[q.quiz_id] || 0) + 1; });
        setCounts(c);
      }
      setLoading(false);
    })();
  }, []);

  const clone = async (id: string) => {
    if (!user) return toast.error("Sign in to clone");
    const { data: orig } = await supabase.from("quizzes").select("*").eq("id", id).single();
    if (!orig) return;
    const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", id).order("order_index");
    const { data: copy } = await supabase.from("quizzes").insert({
      admin_id: user.id,
      title: orig.title + " (from library)",
      description: orig.description,
      subject: orig.subject,
      difficulty: orig.difficulty,
      cover_image: orig.cover_image,
    }).select().single();
    if (!copy) return toast.error("Clone failed");
    if (qs?.length) {
      await supabase.from("questions").insert(qs.map(({ id: _i, created_at: _c, ...q }: any) => ({ ...q, quiz_id: copy.id })));
    }
    toast.success("Cloned to your library");
    navigate({ to: "/admin/quiz/$id/edit", params: { id: copy.id } });
  };

  const filtered = quizzes.filter((q) =>
    !query || q.title.toLowerCase().includes(query.toLowerCase()) || (q.subject || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between border-b border-border">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>
        {user ? (
          <Link to="/admin/dashboard" className="text-sm font-semibold gradient-text">My Dashboard →</Link>
        ) : (
          <Link to="/join" className="text-sm font-semibold text-muted-foreground hover:text-foreground">Join a game →</Link>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-4 text-xs font-semibold text-neon">
            <Sparkles className="w-3.5 h-3.5" /> Community Library
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold">Discover<span className="gradient-text"> & remix.</span></h1>
          <p className="text-muted-foreground mt-3">Clone any quiz into your library, or jump straight into flashcard study mode.</p>
        </div>

        <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3 mb-8 max-w-xl mx-auto">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or subject…" className="bg-transparent flex-1 outline-none text-sm" />
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center text-muted-foreground">No public quizzes yet. Be the first to share one!</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((q) => (
              <div key={q.id} className="glass rounded-2xl overflow-hidden group hover:border-primary/50 transition">
                <div className="h-28 gradient-primary relative">
                  {q.cover_image && <img src={q.cover_image} alt="" className="w-full h-full object-cover" />}
                  <div className="absolute top-3 right-3 glass-strong rounded-full px-3 py-1 text-xs font-semibold">{counts[q.id] || 0} Qs</div>
                </div>
                <div className="p-5">
                  <h3 className="font-display font-bold text-lg truncate">{q.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">{q.description || "No description"}</p>
                  <div className="flex items-center gap-2 mt-3 mb-4">
                    {q.subject && <span className="text-xs glass px-2 py-0.5 rounded-full">{q.subject}</span>}
                    {q.difficulty && <span className="text-xs glass px-2 py-0.5 rounded-full">{q.difficulty}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Link to="/study/$setid" params={{ setid: q.id }} className="flex-1 gradient-neon text-background font-bold py-2.5 rounded-xl glow-neon hover:scale-105 transition flex items-center justify-center gap-2 text-sm">
                      <BookOpen className="w-4 h-4" /> Study
                    </Link>
                    {user && (
                      <button onClick={() => clone(q.id)} className="flex-1 bg-accent hover:bg-primary/30 rounded-xl py-2.5 font-semibold text-sm flex items-center justify-center gap-2">
                        <Copy className="w-4 h-4" /> Clone
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

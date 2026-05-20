import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({ component: Analytics });

interface Row { id: string; room_code: string; status: string; started_at: string | null; ended_at: string | null; quiz: { title: string } | null; player_count: number; }

function Analytics() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, room_code, status, started_at, ended_at, quizzes(title)")
        .eq("admin_id", user.id)
        .order("created_at", { ascending: false });
      const sessions = (data || []) as any[];
      const counts = await Promise.all(
        sessions.map((s) =>
          supabase.from("session_players").select("*", { count: "exact", head: true }).eq("session_id", s.id)
        )
      );
      setRows(
        sessions.map((s, i) => ({
          id: s.id, room_code: s.room_code, status: s.status,
          started_at: s.started_at, ended_at: s.ended_at,
          quiz: s.quizzes, player_count: counts[i].count || 0,
        }))
      );
      setLoading(false);
    })();
  }, [user]);

  const exportCsv = () => {
    const csv = ["Room,Quiz,Status,Players,Started,Ended", ...rows.map(r =>
      `${r.room_code},"${r.quiz?.title || ""}",${r.status},${r.player_count},${r.started_at || ""},${r.ended_at || ""}`
    )].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "deontowin-sessions.csv"; a.click();
  };

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">All your sessions, in one place.</p>
        </div>
        <button onClick={exportCsv} className="glass rounded-xl px-4 py-2.5 font-semibold text-sm hover:bg-primary/20">Export CSV</button>
      </div>

      {loading ? <div className="text-muted-foreground">Loading…</div> : rows.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No sessions yet. Host a quiz to start seeing data.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-4">Room</th><th className="p-4">Quiz</th><th className="p-4">Status</th><th className="p-4">Players</th><th className="p-4">Date</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-4 font-mono font-bold text-neon">{r.room_code}</td>
                  <td className="p-4">{r.quiz?.title || "—"}</td>
                  <td className="p-4"><span className={`text-xs px-2 py-1 rounded-full ${r.status === "ended" ? "bg-muted" : "bg-neon/20 text-neon"}`}>{r.status}</span></td>
                  <td className="p-4">{r.player_count}</td>
                  <td className="p-4 text-muted-foreground">{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Plus, BarChart3, LogOut, Zap, Library } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const nav = [
    { to: "/admin/dashboard", label: "My Quizzes", icon: LayoutDashboard },
    { to: "/admin/quiz/new", label: "New Quiz", icon: Plus },
    { to: "/library", label: "Public Library", icon: Library },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-border glass-strong px-4 py-6 sticky top-0 h-screen">
        <Link to="/admin/dashboard" className="flex items-center gap-2 font-display font-bold text-lg mb-8 px-2">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center glow-violet">
            <Zap className="w-5 h-5 text-white" fill="currentColor" />
          </div>
          Deon<span className="gradient-text">ToWin</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = path === to || (to !== "/admin/dashboard" && path.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active ? "bg-primary/20 text-white" : "text-muted-foreground hover:bg-accent hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center gap-3 px-2">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold">
                {(user.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="text-xs">
              <div className="font-semibold truncate max-w-[140px]">{user.user_metadata?.full_name || user.email}</div>
            </div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

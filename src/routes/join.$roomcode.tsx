import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AVATARS } from "@/lib/quiz";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$roomcode")({ component: JoinRoom });

function JoinRoom() {
  const { roomcode } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<{ id: string; status: string } | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [joining, setJoining] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sessions").select("id, status").eq("room_code", roomcode.toUpperCase()).maybeSingle();
      if (!data) { setNotFound(true); return; }
      setSession(data);
    })();
  }, [roomcode]);

  const PROFANITY = ["fuck","shit","bitch","cunt","nigger","faggot","retard","asshole"];
  const isProfane = (s: string) => {
    const norm = s.toLowerCase().replace(/[^a-z]/g, "");
    return PROFANITY.some(w => norm.includes(w));
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (session.status !== "lobby") return toast.error("This game has already started");
    const name = nickname.trim().slice(0, 20);
    if (!name) return toast.error("Pick a nickname");
    if (name.length < 2) return toast.error("Nickname too short");
    if (isProfane(name)) return toast.error("Please pick a friendlier nickname");
    setJoining(true);
    // Duplicate-nickname check
    const { data: existing } = await supabase
      .from("session_players")
      .select("id")
      .eq("session_id", session.id)
      .ilike("nickname", name);
    if (existing && existing.length > 0) {
      setJoining(false);
      return toast.error("That nickname is taken — try another");
    }
    const { data, error } = await supabase
      .from("session_players")
      .insert({ session_id: session.id, nickname: name, avatar })
      .select()
      .single();
    if (error || !data) { setJoining(false); return toast.error("Could not join"); }
    if (typeof window !== "undefined") {
      localStorage.setItem(`player-${session.id}`, JSON.stringify({ id: data.id, nickname: name, avatar }));
    }
    navigate({ to: "/play/$sessionid", params: { sessionid: session.id } });
  };

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="glass-strong rounded-3xl p-10 max-w-md">
        <h1 className="font-display text-3xl font-bold mb-2">Room not found</h1>
        <p className="text-muted-foreground mb-6">Double-check the code or ask your host.</p>
        <button onClick={() => navigate({ to: "/join" })} className="gradient-primary text-white px-6 py-3 rounded-xl font-semibold glow-violet">Try again</button>
      </div>
    </div>
  );

  if (!session) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Finding room…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={join} className="glass-strong rounded-3xl p-6 md:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Room</p>
          <p className="font-display font-bold text-3xl gradient-text tracking-[0.2em]">{roomcode.toUpperCase()}</p>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Nickname</label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Pick a name"
          maxLength={20}
          autoFocus
          className="w-full bg-input rounded-xl px-4 py-3 text-lg font-semibold outline-none focus:ring-2 focus:ring-primary mb-6"
        />
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Avatar</label>
        <div className="grid grid-cols-6 gap-2 mb-6 max-h-48 overflow-y-auto">
          {AVATARS.map((a) => (
            <button type="button" key={a} onClick={() => setAvatar(a)}
              className={`text-2xl aspect-square rounded-xl flex items-center justify-center transition ${avatar === a ? "gradient-primary glow-violet scale-110" : "bg-card hover:bg-accent"}`}>
              {a}
            </button>
          ))}
        </div>
        <button type="submit" disabled={joining} className="w-full gradient-neon text-background font-bold py-4 rounded-2xl glow-neon hover:scale-105 transition disabled:opacity-60">
          {joining ? "Joining…" : "Join Game ⚡"}
        </button>
      </form>
    </div>
  );
}

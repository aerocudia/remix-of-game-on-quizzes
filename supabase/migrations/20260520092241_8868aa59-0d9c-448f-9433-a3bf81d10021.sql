
-- Profiles for admins (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quizzes owned by admin
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  subject TEXT,
  difficulty TEXT DEFAULT 'Medium',
  settings JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'multiple_choice',
  question_text TEXT NOT NULL,
  image_url TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  timer_seconds INT NOT NULL DEFAULT 20,
  points INT NOT NULL DEFAULT 500,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Live sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby', -- lobby | active | reveal | leaderboard | ended
  current_question_index INT NOT NULL DEFAULT -1,
  current_question_started_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.sessions(room_code);

-- Players joined to a session (no auth)
CREATE TABLE public.session_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🎮',
  score INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.session_players(session_id);

-- Player responses
CREATE TABLE public.session_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.session_players(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer TEXT,
  is_correct BOOLEAN DEFAULT false,
  points_earned INT DEFAULT 0,
  response_time_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, question_id)
);
CREATE INDEX ON public.session_responses(session_id, question_id);

-- Auto profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_responses ENABLE ROW LEVEL SECURITY;

-- Profiles: user manages own
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Quizzes: admin CRUD own; anyone can read public ones
CREATE POLICY "quizzes_owner_all" ON public.quizzes FOR ALL USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "quizzes_public_read" ON public.quizzes FOR SELECT USING (is_public = true);

-- Questions: admin manages via quiz ownership; anyone can read questions of public quizzes or active sessions
CREATE POLICY "questions_owner_all" ON public.questions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.admin_id = auth.uid()));
CREATE POLICY "questions_session_read" ON public.questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.quiz_id = quiz_id));

-- Sessions: admin manages own; anyone can read (needed for room code lookup & players)
CREATE POLICY "sessions_owner_all" ON public.sessions FOR ALL USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "sessions_public_read" ON public.sessions FOR SELECT USING (true);

-- Session players: anyone can insert/read/update (no auth flow for players)
CREATE POLICY "session_players_public_read" ON public.session_players FOR SELECT USING (true);
CREATE POLICY "session_players_public_insert" ON public.session_players FOR INSERT WITH CHECK (true);
CREATE POLICY "session_players_public_update" ON public.session_players FOR UPDATE USING (true);
CREATE POLICY "session_players_admin_delete" ON public.session_players FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.admin_id = auth.uid()));

-- Responses: anyone can insert/read
CREATE POLICY "responses_public_read" ON public.session_responses FOR SELECT USING (true);
CREATE POLICY "responses_public_insert" ON public.session_responses FOR INSERT WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_responses;
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.session_players REPLICA IDENTITY FULL;
ALTER TABLE public.session_responses REPLICA IDENTITY FULL;

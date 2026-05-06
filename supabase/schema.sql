-- הרצה ב-Supabase: SQL Editor → הדבקה → Run
-- ניתן להריץ שוב: מוחק מדיניות ישנות ויוצר מחדש.
--
-- סנכרון צוות (טבלאות + RLS): אחרי הקובץ הזה הריצו גם את team_workspace.sql
-- והפעילו Realtime על public.fm_documents (בלוח Supabase → Database).

CREATE TABLE IF NOT EXISTS public.user_vaults (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  device_id text
);

ALTER TABLE public.user_vaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_vaults_select_own" ON public.user_vaults;
DROP POLICY IF EXISTS "user_vaults_insert_own" ON public.user_vaults;
DROP POLICY IF EXISTS "user_vaults_update_own" ON public.user_vaults;
DROP POLICY IF EXISTS "user_vaults_delete_own" ON public.user_vaults;

CREATE POLICY "user_vaults_select_own"
  ON public.user_vaults FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_vaults_insert_own"
  ON public.user_vaults FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_vaults_update_own"
  ON public.user_vaults FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_vaults_delete_own"
  ON public.user_vaults FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_vaults TO authenticated;
GRANT ALL ON TABLE public.user_vaults TO service_role;

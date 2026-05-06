-- =============================================================================
-- מצב צוות: מסמכים לפי workspace + RLS + Realtime
-- הרצה ב-Supabase → SQL Editor (אחרי schema.sql הקיים עם user_vaults)
-- =============================================================================

-- טבלאות ליבה ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'משפחה',
  invite_token uuid NOT NULL DEFAULT gen_random_uuid(),
  open_invites boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'operator')),
  operator_scope_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT workspace_members_operator_scope CHECK (
    (role = 'operator' AND operator_scope_id IS NOT NULL AND length(trim(operator_scope_id)) > 0)
    OR (role <> 'operator')
  )
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members (user_id);

-- מסמך אחד לשורה: collection + id (מזהה מהאפליקציה)
CREATE TABLE IF NOT EXISTS public.fm_documents (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  collection text NOT NULL,
  id text NOT NULL,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  PRIMARY KEY (workspace_id, collection, id),
  CONSTRAINT fm_documents_collection_check CHECK (
    collection IN (
      'accounts', 'categories', 'transactions', 'checks', 'recurring',
      'budgets', 'tasks', 'events', 'settings'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_fm_documents_ws_updated ON public.fm_documents (workspace_id, updated_at DESC);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fm_documents ENABLE ROW LEVEL SECURITY;

-- Realtime (דורש הרשאות replication — בלוח Realtime אפשר להפעיל גם ידנית)
ALTER TABLE public.fm_documents REPLICA IDENTITY FULL;

-- ניקוי מדיניות ישנה (אם מריצים שוב)
DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
DROP POLICY IF EXISTS "workspace_members_select_self" ON public.workspace_members;
DROP POLICY IF EXISTS "fm_select" ON public.fm_documents;
DROP POLICY IF EXISTS "fm_insert" ON public.fm_documents;
DROP POLICY IF EXISTS "fm_update" ON public.fm_documents;
DROP POLICY IF EXISTS "fm_delete" ON public.fm_documents;

-- Workspaces: רק חברים רואים
CREATE POLICY "workspaces_select_member"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = workspaces.id AND m.user_id = auth.uid()
    )
  );

-- חברי workspace רואים רשימת חברים באותו workspace
CREATE POLICY "workspace_members_select_self"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = workspace_members.workspace_id AND m.user_id = auth.uid()
    )
  );

-- SELECT מסמכים: מלא ל-owner/admin/member; מפעיל — תנועות שלו + קריאת תלות
CREATE POLICY "fm_select"
  ON public.fm_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = fm_documents.workspace_id
        AND wm.user_id = auth.uid()
        AND (
          wm.role IN ('owner', 'admin', 'member')
          OR (
            wm.role = 'operator'
            AND fm_documents.collection IN ('accounts', 'categories')
          )
          OR (
            wm.role = 'operator'
            AND fm_documents.collection = 'transactions'
            AND (fm_documents.doc->>'createdByOperatorId') IS NOT NULL
            AND (fm_documents.doc->>'createdByOperatorId') = wm.operator_scope_id
          )
        )
    )
  );

-- INSERT
CREATE POLICY "fm_insert"
  ON public.fm_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = fm_documents.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin', 'member')
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = fm_documents.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role = 'operator'
          AND fm_documents.collection = 'transactions'
          AND (fm_documents.doc->>'createdByOperatorId') = wm.operator_scope_id
      )
    )
  );

-- UPDATE
CREATE POLICY "fm_update"
  ON public.fm_documents FOR UPDATE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = fm_documents.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin', 'member')
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = fm_documents.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role = 'operator'
          AND fm_documents.collection = 'transactions'
          AND (fm_documents.doc->>'createdByOperatorId') = wm.operator_scope_id
          AND (fm_documents.doc->>'createdByOperatorId') IS NOT NULL
      )
    )
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = fm_documents.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin', 'member')
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = fm_documents.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role = 'operator'
          AND fm_documents.collection = 'transactions'
          AND (fm_documents.doc->>'createdByOperatorId') = wm.operator_scope_id
      )
    )
  );

-- DELETE
CREATE POLICY "fm_delete"
  ON public.fm_documents FOR DELETE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = fm_documents.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin', 'member')
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = fm_documents.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role = 'operator'
          AND fm_documents.collection = 'transactions'
          AND (fm_documents.doc->>'createdByOperatorId') = wm.operator_scope_id
      )
    )
  );

GRANT SELECT ON public.workspaces TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fm_documents TO authenticated;

-- RPC: יצירת workspace + owner (פעם ראשונה למשתמש)
CREATE OR REPLACE FUNCTION public.ensure_my_workspace(p_name text DEFAULT 'המשפחה')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid uuid;
BEGIN
  SELECT wm.workspace_id INTO wid
  FROM public.workspace_members wm
  WHERE wm.user_id = auth.uid()
  LIMIT 1;

  IF wid IS NOT NULL THEN
    RETURN wid;
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (COALESCE(NULLIF(trim(p_name), ''), 'המשפחה'))
  RETURNING id INTO wid;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (wid, auth.uid(), 'owner');

  RETURN wid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_workspace(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_workspace(text) TO authenticated;

-- הצטרפות עם טוקן הזמנה
CREATE OR REPLACE FUNCTION public.join_workspace_by_token(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid uuid;
BEGIN
  SELECT w.id INTO wid
  FROM public.workspaces w
  WHERE w.invite_token = p_token
    AND w.open_invites = true;

  IF wid IS NULL THEN
    RAISE EXCEPTION 'invalid_or_closed_invite';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (wid, auth.uid(), 'member')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN wid;
END;
$$;

REVOKE ALL ON FUNCTION public.join_workspace_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_workspace_by_token(uuid) TO authenticated;

-- Realtime: בלוח Supabase → Database → Publications / Realtime — הוסיפו את הטבלה fm_documents
-- או הריצו פעם אחת (אם אין שגיאת «already added»):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.fm_documents;

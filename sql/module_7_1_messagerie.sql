-- MADIC PORTAIL | Module 7.1 | Messagerie CRIC-client
-- Executer dans Supabase SQL Editor apres verification des pre-requis.
-- Pre-requis : public.madic_cric_spaces(id), public.madic_cric_clients(space_id,client_id),
-- public.madic_can_manage_cric_space(uuid), auth.uid().
-- Aucun acces transversal des administrateurs MADIC aux messages.
BEGIN;

CREATE TABLE IF NOT EXISTS public.madic_cric_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.madic_cric_spaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT 'Conversation generale',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT madic_conversation_subject_length CHECK (char_length(btrim(subject)) BETWEEN 1 AND 200),
  CONSTRAINT madic_conversation_space_client_unique UNIQUE (id, space_id, client_id)
);
CREATE INDEX IF NOT EXISTS madic_conversations_space_client_idx
  ON public.madic_cric_conversations(space_id, client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.madic_cric_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.madic_cric_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT madic_message_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 10000)
);
CREATE INDEX IF NOT EXISTS madic_messages_conversation_created_idx
  ON public.madic_cric_messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.madic_cric_message_reads (
  conversation_id uuid NOT NULL REFERENCES public.madic_cric_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Autorisation: consultant habilite de ce cabinet OU client rattache a ce cabinet.
-- La presence d'un compte super-admin MADIC ne donne aucun droit supplementaire.
CREATE OR REPLACE FUNCTION public.madic_can_access_cric_conversation(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.madic_cric_conversations v
    WHERE v.id = p_conversation_id
      AND auth.uid() IS NOT NULL
      AND (
        public.madic_can_manage_cric_space(v.space_id)
        OR (
          v.client_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.madic_cric_clients c
            JOIN public.madic_cric_spaces s ON s.id = c.space_id
            WHERE c.space_id = v.space_id
              AND c.client_id = auth.uid()
              AND s.access_status = 'active'
          )
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.madic_can_access_cric_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.madic_can_access_cric_conversation(uuid) TO authenticated;

ALTER TABLE public.madic_cric_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.madic_cric_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.madic_cric_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS madic_conversations_select ON public.madic_cric_conversations;
CREATE POLICY madic_conversations_select ON public.madic_cric_conversations
FOR SELECT TO authenticated USING (
  public.madic_can_manage_cric_space(space_id)
  OR (client_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.madic_cric_clients c
    JOIN public.madic_cric_spaces s ON s.id = c.space_id
    WHERE c.space_id = madic_cric_conversations.space_id
      AND c.client_id = (SELECT auth.uid()) AND s.access_status = 'active'
  ))
);

-- Seul un CRIC habilite peut ouvrir une conversation avec un client de SON cabinet.
DROP POLICY IF EXISTS madic_conversations_insert ON public.madic_cric_conversations;
CREATE POLICY madic_conversations_insert ON public.madic_cric_conversations
FOR INSERT TO authenticated WITH CHECK (
  created_by = (SELECT auth.uid())
  AND public.madic_can_manage_cric_space(space_id)
  AND EXISTS (
    SELECT 1 FROM public.madic_cric_clients c
    WHERE c.space_id = madic_cric_conversations.space_id
      AND c.client_id = madic_cric_conversations.client_id
  )
);

DROP POLICY IF EXISTS madic_messages_select ON public.madic_cric_messages;
CREATE POLICY madic_messages_select ON public.madic_cric_messages
FOR SELECT TO authenticated USING (public.madic_can_access_cric_conversation(conversation_id));
DROP POLICY IF EXISTS madic_messages_insert ON public.madic_cric_messages;
CREATE POLICY madic_messages_insert ON public.madic_cric_messages
FOR INSERT TO authenticated WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND public.madic_can_access_cric_conversation(conversation_id)
);

DROP POLICY IF EXISTS madic_reads_select ON public.madic_cric_message_reads;
CREATE POLICY madic_reads_select ON public.madic_cric_message_reads
FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) AND public.madic_can_access_cric_conversation(conversation_id)
);
DROP POLICY IF EXISTS madic_reads_insert ON public.madic_cric_message_reads;
CREATE POLICY madic_reads_insert ON public.madic_cric_message_reads
FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND public.madic_can_access_cric_conversation(conversation_id)
);
DROP POLICY IF EXISTS madic_reads_update ON public.madic_cric_message_reads;
CREATE POLICY madic_reads_update ON public.madic_cric_message_reads
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()) AND public.madic_can_access_cric_conversation(conversation_id))
WITH CHECK (user_id = (SELECT auth.uid()) AND public.madic_can_access_cric_conversation(conversation_id));

REVOKE ALL ON public.madic_cric_conversations, public.madic_cric_messages, public.madic_cric_message_reads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.madic_cric_conversations TO authenticated;
GRANT SELECT, INSERT ON public.madic_cric_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE (last_read_at) ON public.madic_cric_message_reads TO authenticated;

COMMIT;

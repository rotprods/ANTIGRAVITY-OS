-- Copilot conversation history for multi-turn context
CREATE TABLE IF NOT EXISTS public.copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]',
  tools_used TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user
  ON public.copilot_conversations(user_id, updated_at DESC);

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY copilot_conversations_user ON public.copilot_conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY copilot_conversations_service ON public.copilot_conversations
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.copilot_conversations IS 'Copilot chat history for multi-turn context';

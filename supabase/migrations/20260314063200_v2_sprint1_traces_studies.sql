-- Migration for ANTIGRAVITY OS V2 Sprint 1: Traces & Studies

-- 1. execution_traces
CREATE TABLE IF NOT EXISTS public.execution_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id UUID NOT NULL,
    parent_trace_id UUID,
    causation_id UUID,
    correlation_id UUID,
    agent_code_name TEXT NOT NULL,
    step TEXT NOT NULL,
    status TEXT NOT NULL,
    input_json JSONB,
    output_json JSONB,
    error TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    org_id UUID
);

CREATE INDEX IF NOT EXISTS idx_execution_traces_trace_id ON public.execution_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_execution_traces_agent_created ON public.execution_traces(agent_code_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_traces_correlation_id ON public.execution_traces(correlation_id);

ALTER TABLE public.execution_traces ENABLE ROW LEVEL SECURITY;

-- 2. provider_health
CREATE TABLE IF NOT EXISTS public.provider_health (
    provider TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    mode TEXT NOT NULL,
    last_check_at TIMESTAMPTZ DEFAULT now(),
    latency_ms INTEGER,
    error_rate NUMERIC,
    last_error TEXT,
    metadata JSONB
);

ALTER TABLE public.provider_health ENABLE ROW LEVEL SECURITY;

-- 3. study_versions
CREATE TABLE IF NOT EXISTS public.study_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id UUID NOT NULL REFERENCES public.agent_studies(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    summary TEXT,
    content_markdown TEXT,
    content_json JSONB,
    highlights JSONB,
    scores JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by_agent TEXT,
    UNIQUE(study_id, version)
);

ALTER TABLE public.study_versions ENABLE ROW LEVEL SECURITY;

-- 4. study_links
CREATE TABLE IF NOT EXISTS public.study_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id UUID NOT NULL REFERENCES public.agent_studies(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    link_role TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_links_entity ON public.study_links(entity_type, entity_id);

ALTER TABLE public.study_links ENABLE ROW LEVEL SECURITY;

-- 5. study_scores
CREATE TABLE IF NOT EXISTS public.study_scores (
    study_id UUID PRIMARY KEY REFERENCES public.agent_studies(id) ON DELETE CASCADE,
    confidence NUMERIC,
    novelty NUMERIC,
    impact NUMERIC,
    urgency NUMERIC,
    operator_relevance NUMERIC,
    telegram_priority NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_scores ENABLE ROW LEVEL SECURITY;

-- 6. Extensions to agent_studies
ALTER TABLE public.agent_studies
    ADD COLUMN IF NOT EXISTS trace_id UUID,
    ADD COLUMN IF NOT EXISTS quality_status TEXT DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS dedup_key TEXT,
    ADD COLUMN IF NOT EXISTS published_by TEXT,
    ADD COLUMN IF NOT EXISTS supersedes_study_id UUID;

-- 7. Extensions to agent_tasks
ALTER TABLE public.agent_tasks
    ADD COLUMN IF NOT EXISTS trace_id UUID,
    ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 50;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'execution_traces' AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.execution_traces FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'provider_health' AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.provider_health FOR ALL USING (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'study_versions' AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.study_versions FOR ALL USING (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'study_links' AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.study_links FOR ALL USING (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'study_scores' AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.study_scores FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- OCULOPS — Agent Intelligence v2
-- Tablas para: reasoning traces, audit logs, incidents, approval requests, memory v2

-- ─── 1. Reasoning Traces ─────────────────────────────────────────────────────
-- Almacena el razonamiento completo de cada run del brain loop

create table if not exists public.reasoning_traces (
  id          uuid primary key default gen_random_uuid(),
  agent       text not null,
  goal        text not null,
  plan        jsonb,               -- plan generado antes de ejecutar
  steps       jsonb default '[]',  -- [{skill, input, output, ok, ms, loop_count}]
  status      text default 'running' check (status in ('running','completed','escalated','failed','awaiting_approval')),
  confidence  float,
  tokens_used integer default 0,
  cost_usd    float default 0,
  duration_ms integer,
  rounds      integer default 0,
  session_id  text,
  created_at  timestamptz default now()
);

create index if not exists idx_traces_agent on public.reasoning_traces(agent);
create index if not exists idx_traces_status on public.reasoning_traces(status);
create index if not exists idx_traces_created on public.reasoning_traces(created_at desc);

alter table public.reasoning_traces enable row level security;
create policy "traces_service_all" on public.reasoning_traces using (true);

-- ─── 2. Audit Logs ────────────────────────────────────────────────────────────
-- Registro inmutable de decisiones y acciones

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  agent       text not null,
  event_type  text not null,  -- skill_executed, policy_blocked, escalated, approved, rejected
  skill       text,
  payload     jsonb default '{}',
  risk_level  integer default 0 check (risk_level between 0 and 4),
  approved_by text,
  trace_id    uuid references public.reasoning_traces(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists idx_audit_agent on public.audit_logs(agent);
create index if not exists idx_audit_event on public.audit_logs(event_type);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;
create policy "audit_service_all" on public.audit_logs using (true);

-- ─── 3. Incidents ─────────────────────────────────────────────────────────────
-- Incidentes detectados por agentes o WATCHDOG

create table if not exists public.incidents (
  id           uuid primary key default gen_random_uuid(),
  severity     text not null check (severity in ('low','medium','high','critical')),
  agent        text not null,
  description  text not null,
  context      jsonb default '{}',
  status       text default 'open' check (status in ('open','investigating','resolved','dismissed')),
  resolved_at  timestamptz,
  resolved_by  text,
  trace_id     uuid references public.reasoning_traces(id) on delete set null,
  created_at   timestamptz default now()
);

create index if not exists idx_incidents_severity on public.incidents(severity);
create index if not exists idx_incidents_status on public.incidents(status);
create index if not exists idx_incidents_agent on public.incidents(agent);

alter table public.incidents enable row level security;
create policy "incidents_service_all" on public.incidents using (true);

-- ─── 4. Approval Requests ────────────────────────────────────────────────────
-- Solicitudes de aprobación humana para acciones de alto riesgo

create table if not exists public.approval_requests (
  id          uuid primary key default gen_random_uuid(),
  agent       text not null,
  skill       text not null,
  payload     jsonb default '{}',
  urgency     text default 'medium' check (urgency in ('low','medium','high')),
  status      text default 'pending' check (status in ('pending','approved','rejected','expired')),
  approved_by text,
  user_comment text,
  expires_at  timestamptz default now() + interval '30 minutes',
  trace_id    uuid references public.reasoning_traces(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists idx_approvals_status on public.approval_requests(status);
create index if not exists idx_approvals_agent on public.approval_requests(agent);
create index if not exists idx_approvals_expires on public.approval_requests(expires_at);

-- Auto-expire pending requests
create or replace function expire_approval_requests()
returns void language sql as $$
  update public.approval_requests
  set status = 'expired'
  where status = 'pending' and expires_at < now();
$$;

alter table public.approval_requests enable row level security;
create policy "approvals_service_all" on public.approval_requests using (true);

-- ─── 5. Agent Memory v2 ──────────────────────────────────────────────────────
-- Memoria tipada por namespace con TTL y scoping por agente

create table if not exists public.agent_memory_v2 (
  id          bigserial primary key,
  agent       text not null,
  namespace   text not null check (namespace in (
    'working','session','episodic','procedural','knowledge','company','user','market'
  )),
  key         text not null,
  value       jsonb not null,
  confidence  float default 1.0 check (confidence between 0 and 1),
  expires_at  timestamptz,
  session_id  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Unique per agent+namespace+key (outside session-scoped entries)
create unique index if not exists idx_memory_v2_unique
  on public.agent_memory_v2(agent, namespace, key)
  where session_id is null;

create index if not exists idx_memory_v2_namespace on public.agent_memory_v2(namespace);
create index if not exists idx_memory_v2_expires on public.agent_memory_v2(expires_at)
  where expires_at is not null;
create index if not exists idx_memory_v2_agent_ns on public.agent_memory_v2(agent, namespace);

-- Auto-update updated_at
create or replace function update_memory_v2_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger memory_v2_updated_at
  before update on public.agent_memory_v2
  for each row execute function update_memory_v2_timestamp();

-- Purge expired entries (called by CORTEX weekly)
create or replace function purge_expired_memory_v2()
returns integer language sql as $$
  with deleted as (
    delete from public.agent_memory_v2
    where expires_at is not null and expires_at < now()
    returning id
  )
  select count(*)::integer from deleted;
$$;

alter table public.agent_memory_v2 enable row level security;
create policy "memory_v2_service_all" on public.agent_memory_v2 using (true);

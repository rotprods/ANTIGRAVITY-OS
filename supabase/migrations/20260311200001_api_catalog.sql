-- OCULOPS — API Catalog table
-- Populated by: node scripts/seed-api-catalog.mjs

create table if not exists public.api_catalog (
  id          bigserial primary key,
  name        text not null,
  url         text,
  docs        text,
  description text,
  category    text,
  auth        text default 'unknown',
  stars       integer,
  source      text,
  created_at  timestamptz default now()
);

-- Full-text search index
create index if not exists idx_api_catalog_name on public.api_catalog using gin(to_tsvector('english', coalesce(name, '')));
create index if not exists idx_api_catalog_desc on public.api_catalog using gin(to_tsvector('english', coalesce(description, '')));
create index if not exists idx_api_catalog_category on public.api_catalog(category);
create index if not exists idx_api_catalog_auth on public.api_catalog(auth);

-- Read-only for anon (public catalog)
alter table public.api_catalog enable row level security;
create policy "api_catalog_read" on public.api_catalog for select using (true);

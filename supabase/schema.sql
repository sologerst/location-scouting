-- Location Scouting — Supabase schema (optional caching + history)
-- Run in the Supabase SQL editor, or via the Supabase CLI.

-- Cache of normalized owner lookups, keyed by 13-digit folio.
create table if not exists public.owner_lookups (
  folio_raw     text primary key,
  site_address  text,
  owner_name    text,
  result        jsonb not null,
  fetched_at    timestamptz not null default now()
);

create index if not exists owner_lookups_fetched_at_idx
  on public.owner_lookups (fetched_at desc);

-- Cache of contact-enrichment results, keyed by folio, so revisiting a property
-- does not re-hit the paid skip-trace provider. Refreshed only on request.
create table if not exists public.contact_lookups (
  folio_raw   text primary key,
  subject     text,
  provider    text,
  result      jsonb not null,
  fetched_at  timestamptz not null default now()
);

alter table public.contact_lookups enable row level security;

-- Lightweight search log (no contact data stored here).
create table if not exists public.search_history (
  id            bigint generated always as identity primary key,
  query         text not null,
  query_type    text not null,
  matched       boolean not null default false,
  folio_raw     text,
  owner_name    text,
  site_address  text,
  created_at    timestamptz not null default now()
);

create index if not exists search_history_created_at_idx
  on public.search_history (created_at desc);

-- Access is server-side only (service role). Enable RLS and add no public
-- policies so the anon key cannot read these tables.
alter table public.owner_lookups  enable row level security;
alter table public.search_history enable row level security;

-- Cache of contact-enrichment (skip-trace) results, keyed by folio, so revisiting
-- a property does NOT re-hit the paid provider. Refreshed only on explicit request.
create table if not exists public.contact_lookups (
  folio_raw   text primary key,
  subject     text,
  provider    text,
  result      jsonb not null,
  fetched_at  timestamptz not null default now()
);

alter table public.contact_lookups enable row level security;

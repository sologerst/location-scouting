-- Store owner name + site address on the search log so the History tab can
-- render lookups without joining back to owner_lookups.
alter table public.search_history add column if not exists owner_name text;
alter table public.search_history add column if not exists site_address text;

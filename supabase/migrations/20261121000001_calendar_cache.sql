-- Speed: keep each calendar feed's events in the database, so pages don't
-- download and parse the feeds on every visit. The server refreshes them in the
-- background about once an hour.

create table public.calendar_feed_cache (
  source_id uuid primary key references public.calendar_sources (id) on delete cascade,
  -- events from a month ago to a year ahead, already parsed
  events jsonb not null default '[]'::jsonb,
  ok boolean not null default true,
  fetched_at timestamptz not null default now()
);

alter table public.calendar_feed_cache enable row level security;
-- No policies: only the server reads and writes this table.
revoke all on public.calendar_feed_cache from anon, authenticated;

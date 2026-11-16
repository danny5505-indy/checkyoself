-- Stage 5: calendars and school lunch menus
--
-- * profiles.school: which school a kid attends (decides which lunch menu they see)
-- * school_menus: lunch menus by school level, saved by the monthly menu job
--   (or typed in by a parent as a backup). Menus are public school information.
-- * calendar_sources: calendar feed links (district calendar, Apple calendars).
--   The links are private, so only parents can see them; events are read on the server.

alter table public.profiles add column school text;
alter table public.profiles add constraint school_key check (school is null or school ~ '^[a-z_]{2,40}$');

create table public.school_menus (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  meal text not null default 'lunch',
  day date not null,
  -- groups of menu lines, e.g. [["Rotini & Meat Sauce w/ Garlic Knot"], ["Green Beans", "Milk Choice"]]
  groups jsonb not null default '[]'::jsonb,
  -- e.g. "Professional Development Day - No Students"
  note text,
  source text not null default 'auto',
  updated_at timestamptz not null default now(),
  unique (level, meal, day),
  constraint menu_level check (level in ('elementary', 'middle', 'high')),
  constraint menu_meal check (meal in ('breakfast', 'lunch')),
  constraint menu_source check (source in ('auto', 'manual')),
  constraint menu_groups_array check (jsonb_typeof(groups) = 'array')
);

alter table public.school_menus enable row level security;

create policy "Signed-in people can read school menus" on public.school_menus
  for select to authenticated using (true);
-- No write policies: the menu job and parent fixes go through the server (secret key).

create type public.calendar_kind as enum ('school', 'family');

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  url text not null,
  kind public.calendar_kind not null default 'family',
  color text not null default '#4f46e5',
  created_at timestamptz not null default now(),
  constraint calendar_name_length check (char_length(name) between 1 and 40),
  constraint calendar_url check (char_length(url) <= 1000 and url ~* '^(https?|webcal)://'),
  constraint calendar_color check (color ~ '^#[0-9a-fA-F]{6}$')
);
create index calendar_sources_family_idx on public.calendar_sources (family_id);

alter table public.calendar_sources enable row level security;

create policy "Parents see calendar links" on public.calendar_sources
  for select to authenticated using (family_id = public.my_family_id() and public.is_parent());
create policy "Parents add calendars" on public.calendar_sources
  for insert to authenticated with check (family_id = public.my_family_id() and public.is_parent());
create policy "Parents change calendars" on public.calendar_sources
  for update to authenticated
  using (family_id = public.my_family_id() and public.is_parent())
  with check (family_id = public.my_family_id());
create policy "Parents remove calendars" on public.calendar_sources
  for delete to authenticated using (family_id = public.my_family_id() and public.is_parent());

revoke all on public.school_menus, public.calendar_sources from anon;
grant select on public.school_menus to authenticated;
grant select, insert, update, delete on public.calendar_sources to authenticated;

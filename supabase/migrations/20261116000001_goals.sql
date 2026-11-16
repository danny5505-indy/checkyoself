-- Stage 2: goals, plans (activities + milestones) and check-ins
--
-- A goal belongs to one person (its owner). Its plan is made of:
--   * activities: recurring things to do (daily, certain weekdays, or N times a week),
--     tracked as done/not done, minutes, or a count
--   * milestones: one-off steps with a target date
-- A check-in records one day's progress on one activity.
--
-- Who can see a goal:
--   * its owner and all parents, always
--   * other family members only when it's Shared and active
-- Who can change a goal's plan: its owner and parents.
-- Kids' goals start as 'pending' until a parent approves them.

create type public.goal_status as enum ('pending', 'active', 'completed', 'archived', 'declined');
create type public.goal_visibility as enum ('shared', 'private');
create type public.tracking_type as enum ('check', 'minutes', 'count');
create type public.schedule_type as enum ('daily', 'weekdays', 'per_week');

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  why text not null default '',
  emoji text not null default '🎯',
  target_date date,
  visibility public.goal_visibility not null default 'shared',
  status public.goal_status not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goal_title_length check (char_length(title) between 1 and 80),
  constraint goal_why_length check (char_length(why) <= 500),
  constraint goal_emoji_length check (char_length(emoji) between 1 and 8)
);
create index goals_family_idx on public.goals (family_id);
create index goals_owner_idx on public.goals (owner_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  tracking public.tracking_type not null default 'check',
  -- minutes or count per day that counts as "done" (null for check)
  target_amount integer,
  -- what's being counted, e.g. "free throws" (count only)
  unit text,
  schedule public.schedule_type not null default 'daily',
  -- 0 = Sunday … 6 = Saturday (weekdays only)
  weekdays smallint[] not null default '{}',
  -- how many days a week (per_week only)
  times_per_week smallint,
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint activity_title_length check (char_length(title) between 1 and 80),
  constraint activity_unit_length check (unit is null or char_length(unit) <= 30),
  constraint activity_target check (
    (tracking = 'check' and target_amount is null)
    or (tracking <> 'check' and target_amount between 1 and 10000)
  ),
  constraint activity_weekdays check (
    weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    and (schedule <> 'weekdays' or cardinality(weekdays) between 1 and 7)
  ),
  constraint activity_per_week check (
    schedule <> 'per_week' or times_per_week between 1 and 7
  )
);
create index activities_goal_idx on public.activities (goal_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  due_date date,
  sort_order integer not null default 0,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint milestone_title_length check (char_length(title) between 1 and 120)
);
create index milestones_goal_idx on public.milestones (goal_id);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  -- the goal owner this progress belongs to (copied for fast lookups)
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- the family's local calendar day
  day date not null,
  -- 1 for a check; minutes or count otherwise
  amount integer not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- set when a parent changes or adds someone else's check-in
  adjusted_by uuid references public.profiles (id) on delete set null,
  adjusted_at timestamptz,
  constraint check_in_amount check (amount between 1 and 10000),
  unique (activity_id, day)
);
create index check_ins_profile_day_idx on public.check_ins (profile_id, day);

-- ---------------------------------------------------------------------------
-- Helper functions for the access rules
-- ---------------------------------------------------------------------------

-- Today in the family's time zone.
create or replace function public.family_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Indiana/Indianapolis')::date
$$;

create or replace function public.can_view_goal(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.goals g
    where g.id = target
      and g.family_id = public.my_family_id()
      and (
        g.owner_id = auth.uid()
        or public.is_parent()
        or (g.visibility = 'shared' and g.status in ('active', 'completed'))
      )
  )
$$;

create or replace function public.can_edit_goal(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.goals g
    where g.id = target
      and g.family_id = public.my_family_id()
      and (g.owner_id = auth.uid() or public.is_parent())
  )
$$;

-- ---------------------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------------------

alter table public.goals enable row level security;

create policy "View goals you're allowed to see"
  on public.goals for select to authenticated
  using (
    family_id = public.my_family_id()
    and (
      owner_id = auth.uid()
      or public.is_parent()
      or (visibility = 'shared' and status in ('active', 'completed'))
    )
  );

create policy "Create goals in your family"
  on public.goals for insert to authenticated
  with check (
    family_id = public.my_family_id()
    and (owner_id = auth.uid() or public.is_parent())
  );

create policy "Owners and parents edit goals"
  on public.goals for update to authenticated
  using (family_id = public.my_family_id() and (owner_id = auth.uid() or public.is_parent()))
  with check (family_id = public.my_family_id());

create policy "Owners delete pending goals; parents delete any"
  on public.goals for delete to authenticated
  using (
    family_id = public.my_family_id()
    and (public.is_parent() or (owner_id = auth.uid() and status in ('pending', 'declined')))
  );

-- Enforces the approval flow, whoever calls the API.
create or replace function public.guard_goal_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent boolean := public.is_parent();
begin
  if auth.uid() is null then
    return new; -- server with the secret key
  end if;

  if tg_op = 'INSERT' then
    -- the owner must be in the same family
    if not exists (
      select 1 from public.profiles p where p.id = new.owner_id and p.family_id = new.family_id
    ) then
      raise exception 'The goal owner must be in your family';
    end if;
    new.created_by := auth.uid();
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
    new.completed_at := null;
    if parent then
      new.status := 'active';
    else
      new.status := 'pending';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.owner_id is distinct from old.owner_id or new.family_id is distinct from old.family_id then
    raise exception 'A goal cannot be moved to someone else';
  end if;
  new.created_by := old.created_by;
  new.updated_at := now();

  if new.status is distinct from old.status then
    if not parent then
      -- Kids may only resubmit a declined goal for approval.
      if not (old.status = 'declined' and new.status = 'pending') then
        raise exception 'Only parents can change a goal''s status';
      end if;
    end if;
    if new.status in ('active', 'declined') and old.status in ('pending', 'declined') then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    if new.status = 'completed' then
      new.completed_at := now();
    elsif old.status = 'completed' then
      new.completed_at := null;
    end if;
  elsif not parent then
    -- kids can't fake review details
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.review_note := old.review_note;
    new.completed_at := old.completed_at;
  end if;

  return new;
end;
$$;

create trigger guard_goal_changes
  before insert or update on public.goals
  for each row execute function public.guard_goal_changes();

-- ---------------------------------------------------------------------------
-- Activities and milestones (the plan)
-- ---------------------------------------------------------------------------

alter table public.activities enable row level security;
alter table public.milestones enable row level security;

create policy "View plan of visible goals" on public.activities
  for select to authenticated using (public.can_view_goal(goal_id));
create policy "Owners and parents add to the plan" on public.activities
  for insert to authenticated with check (public.can_edit_goal(goal_id));
create policy "Owners and parents change the plan" on public.activities
  for update to authenticated using (public.can_edit_goal(goal_id)) with check (public.can_edit_goal(goal_id));
create policy "Owners and parents remove from the plan" on public.activities
  for delete to authenticated using (public.can_edit_goal(goal_id));

create policy "View milestones of visible goals" on public.milestones
  for select to authenticated using (public.can_view_goal(goal_id));
create policy "Owners and parents add milestones" on public.milestones
  for insert to authenticated with check (public.can_edit_goal(goal_id));
create policy "Owners and parents change milestones" on public.milestones
  for update to authenticated using (public.can_edit_goal(goal_id)) with check (public.can_edit_goal(goal_id));
create policy "Owners and parents remove milestones" on public.milestones
  for delete to authenticated using (public.can_edit_goal(goal_id));

-- Record who ticked a milestone off.
create or replace function public.stamp_milestone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    new.completed_by := auth.uid();
  elsif new.completed_at is null then
    new.completed_by := null;
  end if;
  return new;
end;
$$;

create trigger stamp_milestone
  before insert or update on public.milestones
  for each row execute function public.stamp_milestone();

-- ---------------------------------------------------------------------------
-- Check-ins
-- ---------------------------------------------------------------------------

alter table public.check_ins enable row level security;

create policy "View check-ins of visible goals" on public.check_ins
  for select to authenticated
  using (public.can_view_goal((select a.goal_id from public.activities a where a.id = activity_id)));

-- Owners check in for themselves; parents can add or fix anyone's (an override).
create policy "Owners and parents add check-ins" on public.check_ins
  for insert to authenticated
  with check (public.can_edit_goal((select a.goal_id from public.activities a where a.id = activity_id)));
create policy "Owners and parents change check-ins" on public.check_ins
  for update to authenticated
  using (public.can_edit_goal((select a.goal_id from public.activities a where a.id = activity_id)))
  with check (public.can_edit_goal((select a.goal_id from public.activities a where a.id = activity_id)));
create policy "Owners and parents remove check-ins" on public.check_ins
  for delete to authenticated
  using (public.can_edit_goal((select a.goal_id from public.activities a where a.id = activity_id)));

create or replace function public.guard_check_in()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  goal_owner uuid;
  goal_state public.goal_status;
  parent boolean := public.is_parent();
begin
  select g.owner_id, g.status into goal_owner, goal_state
  from public.activities a join public.goals g on g.id = a.goal_id
  where a.id = new.activity_id;

  new.profile_id := goal_owner;   -- progress always belongs to the goal's owner
  new.updated_at := now();

  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.adjusted_by := null;
    new.adjusted_at := null;
  else
    new.created_by := old.created_by;
    new.activity_id := old.activity_id;
    new.day := old.day;
  end if;

  if parent and auth.uid() <> goal_owner then
    -- a parent changing someone else's progress is an override
    new.adjusted_by := auth.uid();
    new.adjusted_at := now();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.adjusted_by := old.adjusted_by;
    new.adjusted_at := old.adjusted_at;
  end if;

  -- Owners check in on active goals, for today or yesterday only.
  if goal_state <> 'active' then
    raise exception 'You can only check in on active goals';
  end if;
  if new.day > public.family_today() or new.day < public.family_today() - 1 then
    raise exception 'You can only check in for today or yesterday';
  end if;

  return new;
end;
$$;

create trigger guard_check_in
  before insert or update on public.check_ins
  for each row execute function public.guard_check_in();

-- Kids can't quietly undo a parent's adjustment or delete old history.
create or replace function public.guard_check_in_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_parent() then
    return old;
  end if;
  if old.day < public.family_today() - 1 then
    raise exception 'Older check-ins can only be removed by a parent';
  end if;
  return old;
end;
$$;

create trigger guard_check_in_delete
  before delete on public.check_ins
  for each row execute function public.guard_check_in_delete();

-- ---------------------------------------------------------------------------
-- API access
-- ---------------------------------------------------------------------------

revoke all on public.goals, public.activities, public.milestones, public.check_ins from anon;
grant select, insert, update, delete
  on public.goals, public.activities, public.milestones, public.check_ins
  to authenticated;

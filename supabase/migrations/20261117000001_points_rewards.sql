-- Stage 3: points, badges and the reward store
--
-- Points live in a ledger (point_events): every earn or spend is one row, and a
-- balance is the sum. Only the server (secret key) and the parent-only functions
-- below write to it, so nobody can award themselves points through the API.
--
-- Rewards are set up by parents. A kid requests one; points are deducted only
-- when a parent approves it (approve_redemption does both in one transaction).

-- ---------------------------------------------------------------------------
-- Point settings (one row per family; defaults apply until a parent saves)
-- ---------------------------------------------------------------------------

create table public.family_settings (
  family_id uuid primary key references public.families (id) on delete cascade,
  points_per_check_in integer not null default 10,
  streak_bonus integer not null default 25,
  milestone_points integer not null default 50,
  goal_points integer not null default 200,
  updated_at timestamptz not null default now(),
  constraint points_range check (
    points_per_check_in between 0 and 1000
    and streak_bonus between 0 and 10000
    and milestone_points between 0 and 10000
    and goal_points between 0 and 100000
  )
);

alter table public.family_settings enable row level security;

create policy "Members view their family's settings" on public.family_settings
  for select to authenticated using (family_id = public.my_family_id());
create policy "Parents create their family's settings" on public.family_settings
  for insert to authenticated with check (family_id = public.my_family_id() and public.is_parent());
create policy "Parents change their family's settings" on public.family_settings
  for update to authenticated
  using (family_id = public.my_family_id() and public.is_parent())
  with check (family_id = public.my_family_id());

-- ---------------------------------------------------------------------------
-- Rewards and redemption requests
-- ---------------------------------------------------------------------------

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null,
  emoji text not null default '🎁',
  cost integer not null,
  details text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint reward_title_length check (char_length(title) between 1 and 60),
  constraint reward_details_length check (char_length(details) <= 200),
  constraint reward_cost check (cost between 1 and 100000)
);
create index rewards_family_idx on public.rewards (family_id);

alter table public.rewards enable row level security;

create policy "Members view their family's rewards" on public.rewards
  for select to authenticated using (family_id = public.my_family_id());
create policy "Parents add rewards" on public.rewards
  for insert to authenticated with check (family_id = public.my_family_id() and public.is_parent());
create policy "Parents change rewards" on public.rewards
  for update to authenticated
  using (family_id = public.my_family_id() and public.is_parent())
  with check (family_id = public.my_family_id());
create policy "Parents remove rewards" on public.rewards
  for delete to authenticated using (family_id = public.my_family_id() and public.is_parent());

create type public.redemption_status as enum ('requested', 'approved', 'declined');

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid references public.rewards (id) on delete set null,
  -- copied at request time so later edits to the reward don't change history
  reward_title text not null,
  reward_emoji text not null,
  cost integer not null,
  status public.redemption_status not null default 'requested',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index redemptions_family_idx on public.redemptions (family_id, status);

alter table public.redemptions enable row level security;

create policy "People see their own requests; parents see all" on public.redemptions
  for select to authenticated
  using (family_id = public.my_family_id() and (profile_id = auth.uid() or public.is_parent()));
create policy "People request rewards for themselves" on public.redemptions
  for insert to authenticated
  with check (family_id = public.my_family_id() and profile_id = auth.uid());
create policy "People cancel their own open requests" on public.redemptions
  for delete to authenticated
  using (profile_id = auth.uid() and status = 'requested');
-- No update policy: decisions go through approve_redemption / decline_redemption.

-- Fill in the reward details from the reward itself; ignore anything else sent.
create or replace function public.prepare_redemption()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rewards;
begin
  select * into r from public.rewards where id = new.reward_id;
  if r.id is null or r.family_id <> new.family_id or not r.active then
    raise exception 'That reward isn''t available';
  end if;
  new.reward_title := r.title;
  new.reward_emoji := r.emoji;
  new.cost := r.cost;
  new.status := 'requested';
  new.decided_by := null;
  new.decided_at := null;
  new.note := null;
  return new;
end;
$$;

create trigger prepare_redemption
  before insert on public.redemptions
  for each row execute function public.prepare_redemption();

-- ---------------------------------------------------------------------------
-- Points ledger and badges
-- ---------------------------------------------------------------------------

create type public.point_kind as enum (
  'check_in', 'streak_bonus', 'milestone', 'goal_completed', 'redemption', 'adjustment'
);

create table public.point_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  kind public.point_kind not null,
  activity_id uuid references public.activities (id) on delete cascade,
  day date,
  milestone_id uuid references public.milestones (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete cascade,
  redemption_id uuid references public.redemptions (id) on delete set null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint point_amount check (amount <> 0 and amount between -100000 and 100000)
);
create index point_events_profile_idx on public.point_events (profile_id, created_at desc);
-- Each thing earns points at most once.
create unique index point_events_once_per_day on public.point_events (kind, activity_id, day)
  where kind in ('check_in', 'streak_bonus');
create unique index point_events_once_per_milestone on public.point_events (milestone_id)
  where kind = 'milestone';
create unique index point_events_once_per_goal on public.point_events (goal_id)
  where kind = 'goal_completed';

alter table public.point_events enable row level security;

create policy "People see their own points; parents see all" on public.point_events
  for select to authenticated
  using (family_id = public.my_family_id() and (profile_id = auth.uid() or public.is_parent()));
-- No insert/update/delete policies: only the server and the functions below write points.

create table public.badges_earned (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge text not null,
  earned_at timestamptz not null default now(),
  primary key (profile_id, badge)
);

alter table public.badges_earned enable row level security;

create policy "People see their own badges; parents see all" on public.badges_earned
  for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.is_parent() and exists (
      select 1 from public.profiles p where p.id = profile_id and p.family_id = public.my_family_id()
    ))
  );

-- ---------------------------------------------------------------------------
-- Parent-only actions that move points (each runs as one transaction)
-- ---------------------------------------------------------------------------

-- Internal: a person's balance, no access check. Used inside the functions below.
create or replace function public.balance_of(target uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer from public.point_events where profile_id = target
$$;

-- Your own balance, or (for parents) anyone's in your family. Others get null.
create or replace function public.point_balance(target uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target = auth.uid()
      or (public.is_parent() and exists (
        select 1 from public.profiles p where p.id = target and p.family_id = public.my_family_id()
      ))
    then public.balance_of(target)
  end
$$;

create or replace function public.approve_redemption(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.redemptions;
begin
  select * into r from public.redemptions where id = target for update;
  if r.id is null or r.family_id <> public.my_family_id() or not public.is_parent() then
    raise exception 'Only a parent in this family can approve this';
  end if;
  if r.status <> 'requested' then
    raise exception 'This request was already decided';
  end if;
  -- lock the person's ledger so two approvals can't overspend
  perform 1 from public.profiles where id = r.profile_id for update;
  if public.balance_of(r.profile_id) < r.cost then
    raise exception 'Not enough points for this reward';
  end if;

  insert into public.point_events (family_id, profile_id, amount, kind, redemption_id, note, created_by)
  values (r.family_id, r.profile_id, -r.cost, 'redemption', r.id, r.reward_emoji || ' ' || r.reward_title, auth.uid());

  update public.redemptions
  set status = 'approved', decided_by = auth.uid(), decided_at = now()
  where id = target;
end;
$$;

create or replace function public.decline_redemption(target uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.redemptions;
begin
  select * into r from public.redemptions where id = target for update;
  if r.id is null or r.family_id <> public.my_family_id() or not public.is_parent() then
    raise exception 'Only a parent in this family can decline this';
  end if;
  if r.status <> 'requested' then
    raise exception 'This request was already decided';
  end if;
  update public.redemptions
  set status = 'declined', decided_by = auth.uid(), decided_at = now(),
      note = nullif(left(trim(coalesce(reason, '')), 200), '')
  where id = target;
end;
$$;

-- A parent gives or takes points (e.g. "+20 for helping with dishes").
create or replace function public.adjust_points(target uuid, change integer, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fam uuid;
begin
  select family_id into fam from public.profiles where id = target for update;
  if fam is null or fam <> public.my_family_id() or not public.is_parent() then
    raise exception 'Only a parent in this family can do this';
  end if;
  if change = 0 or change not between -10000 and 10000 then
    raise exception 'Choose an amount between -10000 and 10000';
  end if;
  if public.balance_of(target) + change < 0 then
    raise exception 'That would take their points below zero';
  end if;
  insert into public.point_events (family_id, profile_id, amount, kind, note, created_by)
  values (fam, target, change, 'adjustment', nullif(left(trim(coalesce(reason, '')), 120), ''), auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- API access
-- ---------------------------------------------------------------------------

revoke all on public.family_settings, public.rewards, public.redemptions,
  public.point_events, public.badges_earned from anon;
grant select, insert, update on public.family_settings to authenticated;
grant select, insert, update, delete on public.rewards to authenticated;
grant select, insert, delete on public.redemptions to authenticated;
grant select on public.point_events, public.badges_earned to authenticated;

revoke all on function public.balance_of(uuid) from public, anon, authenticated;
revoke all on function public.point_balance(uuid) from public, anon;
revoke all on function public.approve_redemption(uuid) from public, anon;
revoke all on function public.decline_redemption(uuid, text) from public, anon;
revoke all on function public.adjust_points(uuid, integer, text) from public, anon;
grant execute on function public.point_balance(uuid) to authenticated;
grant execute on function public.approve_redemption(uuid) to authenticated;
grant execute on function public.decline_redemption(uuid, text) to authenticated;
grant execute on function public.adjust_points(uuid, integer, text) to authenticated;

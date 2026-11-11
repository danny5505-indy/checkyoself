-- Stage 1: families and profiles
--
-- Every signed-in person has one profile row. A profile belongs to one family
-- and is either a 'parent' (admin) or a 'kid'.
--
-- How people get in:
--   * The very first account created becomes a parent in a brand-new family.
--   * Everyone else is invited by a parent from the Parent dashboard. The invite
--     carries their family, role and name, which the trigger below copies into
--     their profile when the account is created.

create type public.family_role as enum ('parent', 'kid');

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  display_name text not null,
  role public.family_role not null default 'kid',
  color text not null default '#4f46e5',
  created_at timestamptz not null default now(),
  constraint display_name_length check (char_length(display_name) between 1 and 40),
  constraint color_format check (color ~ '^#[0-9a-fA-F]{6}$')
);

create index profiles_family_id_idx on public.profiles (family_id);

-- Helper functions used by the access rules. They run with elevated rights
-- (security definer) so the rules on `profiles` can look at `profiles`
-- without recursing into themselves.

create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select family_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_parent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'parent' from public.profiles where id = auth.uid()),
    false
  )
$$;

-- Access rules (row level security)

alter table public.families enable row level security;
alter table public.profiles enable row level security;

create policy "Members can view their family"
  on public.families for select
  to authenticated
  using (id = public.my_family_id());

create policy "Parents can rename their family"
  on public.families for update
  to authenticated
  using (id = public.my_family_id() and public.is_parent())
  with check (id = public.my_family_id());

create policy "Members can view profiles in their family"
  on public.profiles for select
  to authenticated
  using (family_id = public.my_family_id());

create policy "People can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Parents can update profiles in their family"
  on public.profiles for update
  to authenticated
  using (family_id = public.my_family_id() and public.is_parent())
  with check (family_id = public.my_family_id());

-- Nobody may move themselves to another family, and only parents may change
-- anyone's role (including their own). Column checks like this are easier to
-- read as a trigger than as policy conditions.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Changes made by the server with the secret key (no signed-in user) are allowed.
  if auth.uid() is null then
    return new;
  end if;

  if new.family_id is distinct from old.family_id then
    raise exception 'A profile cannot be moved to another family';
  end if;

  if new.role is distinct from old.role then
    if not public.is_parent() then
      raise exception 'Only parents can change roles';
    end if;
    if old.id = auth.uid() and new.role = 'kid' then
      raise exception 'Parents cannot remove their own parent role';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_profile_changes
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- Create a profile automatically whenever a new login account is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  target_family uuid;
  target_role public.family_role;
  name text;
begin
  name := coalesce(
    nullif(trim(meta ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  if meta ? 'family_id' then
    -- Invited by a parent: join their family with the role they chose.
    target_family := (meta ->> 'family_id')::uuid;
    target_role := coalesce((meta ->> 'role')::public.family_role, 'kid');
  elsif not exists (select 1 from public.families) then
    -- The very first account: start the family and make them a parent.
    insert into public.families (name)
    values (coalesce(nullif(trim(meta ->> 'family_name'), ''), 'Our Family'))
    returning id into target_family;
    target_role := 'parent';
  else
    -- Anyone else must be invited. Refuse the sign-up.
    raise exception 'Sign-up is by invitation only';
  end if;

  insert into public.profiles (id, family_id, display_name, role, color)
  values (
    new.id,
    target_family,
    left(name, 40),
    target_role,
    coalesce(nullif(meta ->> 'color', ''), '#4f46e5')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only signed-in users can reach these tables through the API.
revoke all on public.families from anon;
revoke all on public.profiles from anon;
grant select, update on public.families to authenticated;
grant select, update on public.profiles to authenticated;

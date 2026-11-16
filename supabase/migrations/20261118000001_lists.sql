-- Stage 4: lists (groceries, checklists, wish lists, to-dos)
--
-- Every list has an owner and is either shared with the whole family
-- (the grocery list) or with specific people (list_shares).
--
-- * Checklists: anyone with access adds and checks items. With per_person on,
--   each person checks off their own copy (item_checks), e.g. a packing list.
-- * Wish lists: only the owner adds items. Others can mark an item bought
--   (wishlist_claims), and the owner can never see those marks.
-- * To-dos: items can have a due date.

create type public.list_kind as enum ('grocery', 'checklist', 'wishlist', 'todo');

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  emoji text not null default '📝',
  kind public.list_kind not null default 'checklist',
  shared_with_all boolean not null default false,
  per_person boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint list_title_length check (char_length(title) between 1 and 60),
  constraint list_emoji_length check (char_length(emoji) between 1 and 8),
  constraint per_person_only_checklists check (not per_person or kind = 'checklist')
);
create index lists_family_idx on public.lists (family_id);
-- One family grocery list.
create unique index one_grocery_list_per_family on public.lists (family_id) where kind = 'grocery';

create table public.list_shares (
  list_id uuid not null references public.lists (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (list_id, profile_id)
);
create index list_shares_profile_idx on public.list_shares (profile_id);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  text text not null,
  quantity text,
  notes text,
  link text,
  due_date date,
  done boolean not null default false,
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  added_by uuid references public.profiles (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint item_text_length check (char_length(text) between 1 and 200),
  constraint item_quantity_length check (quantity is null or char_length(quantity) <= 30),
  constraint item_notes_length check (notes is null or char_length(notes) <= 300),
  constraint item_link check (link is null or (char_length(link) <= 500 and link ~* '^https?://'))
);
create index list_items_list_idx on public.list_items (list_id);

-- Per-person check-offs (lists with per_person on).
create table public.item_checks (
  item_id uuid not null references public.list_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (item_id, profile_id)
);

-- "I bought this" marks on wish list items. Hidden from the list's owner.
create table public.wishlist_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.list_items (id) on delete cascade,
  claimed_by uuid not null references public.profiles (id) on delete cascade,
  claimed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.can_view_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lists l
    where l.id = target
      and l.family_id = public.my_family_id()
      and (
        l.owner_id = auth.uid()
        or l.shared_with_all
        or exists (select 1 from public.list_shares s where s.list_id = l.id and s.profile_id = auth.uid())
      )
  )
$$;

create or replace function public.owns_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lists l where l.id = target and l.owner_id = auth.uid())
$$;

-- Can add/change items: anyone with access, except wish lists (owner only).
create or replace function public.can_edit_list_items(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_view_list(target)
    and exists (
      select 1 from public.lists l
      where l.id = target and (l.kind <> 'wishlist' or l.owner_id = auth.uid())
    )
$$;

create or replace function public.list_of_item(target uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select list_id from public.list_items where id = target
$$;

-- ---------------------------------------------------------------------------
-- Lists and sharing
-- ---------------------------------------------------------------------------

alter table public.lists enable row level security;
alter table public.list_shares enable row level security;

-- Checks the row's own columns (not can_view_list), so a list you just created
-- can be returned to you in the same statement.
create policy "See lists you own or that are shared with you" on public.lists
  for select to authenticated
  using (
    family_id = public.my_family_id()
    and (
      owner_id = auth.uid()
      or shared_with_all
      or exists (select 1 from public.list_shares s where s.list_id = id and s.profile_id = auth.uid())
    )
  );
create policy "Create your own lists" on public.lists
  for insert to authenticated
  with check (family_id = public.my_family_id() and owner_id = auth.uid());
create policy "Owners change their lists" on public.lists
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete their lists" on public.lists
  for delete to authenticated using (owner_id = auth.uid() and kind <> 'grocery');

create or replace function public.guard_list_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.kind = 'grocery' then
      new.shared_with_all := true;
    end if;
    return new;
  end if;
  if new.family_id is distinct from old.family_id or new.owner_id is distinct from old.owner_id then
    raise exception 'A list cannot be moved to someone else';
  end if;
  if new.kind is distinct from old.kind then
    raise exception 'A list''s type cannot be changed';
  end if;
  if old.kind = 'grocery' then
    new.shared_with_all := true;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_list_changes
  before insert or update on public.lists
  for each row execute function public.guard_list_changes();

create policy "See who a list is shared with" on public.list_shares
  for select to authenticated using (public.can_view_list(list_id));
create policy "Owners share their lists" on public.list_shares
  for insert to authenticated with check (public.owns_list(list_id));
create policy "Owners unshare their lists" on public.list_shares
  for delete to authenticated using (public.owns_list(list_id));

create or replace function public.guard_list_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.lists l join public.profiles p on p.family_id = l.family_id
    where l.id = new.list_id and p.id = new.profile_id
  ) then
    raise exception 'You can only share with people in your family';
  end if;
  return new;
end;
$$;

create trigger guard_list_share
  before insert on public.list_shares
  for each row execute function public.guard_list_share();

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------

alter table public.list_items enable row level security;

create policy "See items on lists you can see" on public.list_items
  for select to authenticated using (public.can_view_list(list_id));
create policy "Add items" on public.list_items
  for insert to authenticated with check (public.can_edit_list_items(list_id));
create policy "Change items" on public.list_items
  for update to authenticated
  using (public.can_edit_list_items(list_id)) with check (public.can_edit_list_items(list_id));
create policy "Remove items" on public.list_items
  for delete to authenticated using (public.can_edit_list_items(list_id));

create or replace function public.stamp_list_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.added_by := coalesce(auth.uid(), new.added_by);
  else
    new.list_id := old.list_id;
    new.added_by := old.added_by;
  end if;
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_by := auth.uid();
    new.done_at := now();
  elsif not new.done then
    new.done_by := null;
    new.done_at := null;
  else
    new.done_by := old.done_by;
    new.done_at := old.done_at;
  end if;
  return new;
end;
$$;

create trigger stamp_list_item
  before insert or update on public.list_items
  for each row execute function public.stamp_list_item();

-- ---------------------------------------------------------------------------
-- Per-person checks and wish list claims
-- ---------------------------------------------------------------------------

alter table public.item_checks enable row level security;
alter table public.wishlist_claims enable row level security;

create policy "See check-offs on lists you can see" on public.item_checks
  for select to authenticated using (public.can_view_list(public.list_of_item(item_id)));
create policy "Check off your own copy" on public.item_checks
  for insert to authenticated
  with check (profile_id = auth.uid() and public.can_view_list(public.list_of_item(item_id)));
create policy "Uncheck your own copy" on public.item_checks
  for delete to authenticated using (profile_id = auth.uid());

-- The list owner never sees claims, so the surprise stays a surprise.
create policy "See bought marks (not on your own wish list)" on public.wishlist_claims
  for select to authenticated
  using (
    public.can_view_list(public.list_of_item(item_id))
    and not public.owns_list(public.list_of_item(item_id))
  );
create policy "Mark a wish list item bought" on public.wishlist_claims
  for insert to authenticated
  with check (
    claimed_by = auth.uid()
    and public.can_view_list(public.list_of_item(item_id))
    and not public.owns_list(public.list_of_item(item_id))
    and exists (
      select 1 from public.list_items i join public.lists l on l.id = i.list_id
      where i.id = item_id and l.kind = 'wishlist'
    )
  );
create policy "Undo your own bought mark" on public.wishlist_claims
  for delete to authenticated using (claimed_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Live updates and API access
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.lists, public.list_items, public.item_checks;

revoke all on public.lists, public.list_shares, public.list_items,
  public.item_checks, public.wishlist_claims from anon;
grant select, insert, update, delete on public.lists, public.list_items to authenticated;
grant select, insert, delete on public.list_shares, public.item_checks, public.wishlist_claims to authenticated;

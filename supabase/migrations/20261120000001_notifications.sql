-- Push notifications
--
-- * push_subscriptions: one row per device that turned notifications on
-- * notification_prefs: each person's choices (daily reminder time, etc.)
-- * notification_log: what was sent, so nothing is sent twice
--
-- Sending happens on the server. A Supabase scheduled job (pg_cron + pg_net,
-- set up separately with the app's private cron password) calls the app every
-- 15 minutes to send reminders.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint endpoint_https check (endpoint ~ '^https://' and char_length(endpoint) <= 1000)
);
create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

create policy "See your own devices" on public.push_subscriptions
  for select to authenticated using (profile_id = auth.uid());
create policy "Add your own devices" on public.push_subscriptions
  for insert to authenticated with check (profile_id = auth.uid());
create policy "Remove your own devices" on public.push_subscriptions
  for delete to authenticated using (profile_id = auth.uid());

create table public.notification_prefs (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  daily_reminder boolean not null default true,
  -- local time (family time zone), between 7:00 and 20:45 in 15-minute steps
  reminder_time time not null default '19:00',
  approvals boolean not null default true,
  weekly_summary boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint reminder_window check (
    reminder_time >= '07:00' and reminder_time <= '20:45'
    and extract(minute from reminder_time)::int % 15 = 0
    and extract(second from reminder_time) = 0
  )
);

alter table public.notification_prefs enable row level security;

create policy "See your own notification settings" on public.notification_prefs
  for select to authenticated using (profile_id = auth.uid());
create policy "Create your own notification settings" on public.notification_prefs
  for insert to authenticated with check (profile_id = auth.uid());
create policy "Change your own notification settings" on public.notification_prefs
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  key text not null,
  sent_at timestamptz not null default now(),
  unique (profile_id, kind, key)
);

alter table public.notification_log enable row level security;
-- No policies: only the server reads and writes the log.

revoke all on public.push_subscriptions, public.notification_prefs, public.notification_log from anon;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant select, insert, update on public.notification_prefs to authenticated;

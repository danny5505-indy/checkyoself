# Check Yo Self

Our family's hub for goals, daily plans, rewards, lists, calendars and school lunch menus.
See [PLAN.md](PLAN.md) for what's in it and the build stages.

## How it's built

- **Next.js 16** (React, TypeScript, Tailwind CSS): the app, installable on the Home Screen
- **Supabase**: logins, the database, and access rules (who can see what)
- **Vercel**: hosting (later)

## Where things are

| Path | What it is |
|---|---|
| `src/app/(auth)/` | Sign-in and first-time family setup |
| `src/app/(app)/` | The signed-in app: Today, Goals, Rewards, Lists, Calendar, Settings, Parent dashboard |
| `src/components/` | Shared pieces (forms, tab bar, avatar, icons) |
| `src/lib/` | Helpers: Supabase clients, current-user lookup, time zone, quotes |
| `src/proxy.ts` | Runs before every page: keeps people signed in, sends signed-out visitors to /login |
| `supabase/migrations/` | Database tables and access rules, in order |

## How sign-in works

- The first account created becomes a parent and creates the family (`/setup`). After that, `/setup` is closed.
- Parents add everyone else from the Parent dashboard with an email and a starting password.
  Nobody can sign up on their own.
- Parents can reset anyone's password from the Parent dashboard.

## Running it on your computer

You need Node.js 22+ and Docker.

```bash
npm install
npx supabase start        # local database + logins in Docker
cp .env.example .env.local
npx supabase status       # copy the URL, publishable key and secret key into .env.local
npm run dev               # open http://localhost:3000
```

To wipe the local database and re-run all migrations: `npx supabase db reset`.

## Connecting the real Supabase project

1. In the Supabase dashboard, open **SQL Editor** and run each file in `supabase/migrations/` in order.
   (Or with the Supabase CLI: `npx supabase link` then `npx supabase db push`.)
2. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
   (The database refuses uninvited sign-ups anyway; this is a second lock.)
3. Put the project URL, publishable key and secret key in `.env.local` (and later in Vercel).
   The secret key must never be committed or shared.

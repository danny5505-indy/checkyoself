# Check Yo Self — Family Goals Hub (Final Plan)

**App name:** Check Yo Self
**Icon:** Checkmark
**Form:** Installable web app (Add to Home Screen on iPhone/iPad/Mac), with push notifications

## Users and roles
- **Admins (parents):** Dan, Lauren
- **Kids:** Olivia (13), Claire (11). George (5) added later as a regular kid account.
- Everyone has a private login. Nothing is public.

## Launch version (all ships together before go-live)

### 1. Goals and plans
- Parents can create goals for any kid. Kids can create their own; these go live after parent approval.
- Each goal has a plan:
  - Recurring activities: daily, specific weekdays, or N times per week
  - Milestones with target dates
- Tracking types: done / not done, time spent, or count.
- Visibility: parents always see all kid goals. Kids set each goal to Shared (siblings can see) or Private.

### 2. Daily tracking
- "Today" screen per person: due, done, streaks, today's quote.
- Per-goal status: on track / slipping / off track.
- Check-offs count immediately. Parents can override any check-off (undo or adjust time/count).

### 3. Nudges
- Reminder at a time each person chooses if an activity isn't done.
- "Falling behind" alert to the kid; parents are copied after repeated misses.
- Weekly summary for parents.
- No notifications after 9pm.

### 4. Gamification and rewards
- Points for check-offs, bonuses for streaks and milestones, badges.
- Default point values provided; adjustable in admin settings.
- Admin-managed reward store: parents define rewards and their point cost (money, screen time, movie pick, etc.).
- Kids request a reward; points are deducted only when a parent approves. Full point history.
- Daily motivational quote, mixing general quotes and Bible verses.

### 5. Calendar
- Read-only view combining Apple Calendar (via iCloud calendar sharing) and Noblesville school calendars.
- Events are still created in Apple Calendar.

### 6. School lunch menus
- Automatically pulls the monthly menus:
  - Noblesville West Middle: Olivia, Claire
  - Hazel Dell Elementary: George
- Shown per kid per day on the Today screen, plus a weekly view for meal planning.
- Source: https://www.noblesvilleschools.org/departments/food-services/menus-more
- To verify first: how menus are published. Fallback if PDF-only: extract from the PDF, with a screen for correcting misreads.

### 7. Lists
- Shared grocery list with live updates and check-off.
- Custom lists: anyone (kids included) can create a list and choose who it's shared with.
  - Example: packing list from Mom, shared with the girls.
  - Example: Christmas list from a kid, shared with parents. Parents can mark items "bought" without the kid seeing.
- Personal to-do lists with optional due dates and reminders.

## Later phases
- Family challenges (whole family working toward one goal)
- AI plan builder (suggests a plan from a goal)
- George's account

## Technical approach (approved)
- **App:** Next.js (React + TypeScript), installable on the Home Screen, with web push notifications
- **Database, logins, live sync:** Supabase (Dan has an account). Access rules enforce visibility:
  parents see all; siblings see only goals marked Shared.
- **Hosting:** Vercel (free personal tier); deploys automatically from GitHub
- **Logins:** everyone, kids included, signs in with their own email address
- **Lunch menus:** monthly GitHub Actions job reads the public menu page (West Middle, Hazel Dell)
- **Calendars:** district Google Calendar feed + Apple calendars via iCloud public share links
- **Quotes:** built-in list of quotes and Bible verses; parents can add more
- Expected cost: about $0/month (optional custom domain about $12/year)
- Claude writes the code and explains it; Dan helps test and troubleshoot.

## Screens (approved)
Bottom tabs: **Today**, **Goals**, **Rewards**, **Lists**, **Calendar**.
Behind the profile icon: **Parent dashboard** (progress, approvals, overrides, admin settings)
and **My settings** (reminder times, notifications, profile).

## Research findings (Nov 11, 2026)
- **School calendar: confirmed.** Noblesville publishes a public Google Calendar feed
  (district_calendar@nobl.k12.in.us, ~720 events incl. early release / late arrival / no-school days).
  The app can subscribe to it directly. School-specific calendars (West Middle, Hazel Dell) not yet checked.
- **Lunch menus: source identified, import method not yet settled.** Menus are on millerscafe.org,
  run by the "School Nutrition And Fitness" platform (also the "Web Menus by School Nutrition" app).
  West Middle School and Hazel Dell Elementary are both listed. The menu data comes from the
  platform's data service, which isn't a documented public feed.
  **Decision:** the app reads the public menu page once a month, like a browser would.
  Backup: upload a photo or paste of the menu and the app fills it in.

## First build steps
1. Allow noblesvilleschools.org (and any menu service it uses) in the build environment's network settings; check how the menu and calendar sources are published.
2. Set up the code repository (GitHub) so work persists between sessions.
3. Agree on the tech stack and the screens, then start building.

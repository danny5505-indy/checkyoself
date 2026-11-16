import Link from "next/link";
import { Card } from "@/components/page-header";
import { ChevronRight, ShieldIcon } from "@/components/icons";
import { TodayItem } from "@/components/goals/today-item";
import { TrackBadge } from "@/components/goals/badges";
import { requireMember } from "@/lib/auth";
import { loadCheckIns, loadVisibleGoals } from "@/lib/goals/data";
import { todayISO } from "@/lib/goals/dates";
import {
  amountsFor,
  dayRatio,
  doneThisWeek,
  goalProgress,
  isDueToday,
  streak,
} from "@/lib/goals/progress";
import { loadRedemptions } from "@/lib/points/data";
import { loadDueTodos } from "@/lib/lists/data";
import { DueTodos } from "@/components/lists/due-todos";
import { shortDay } from "@/lib/goals/dates";
import { quoteOfTheDay } from "@/lib/quotes";
import { greeting, longDate } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { MenuLine } from "@/components/calendar/menu-card";
import { loadEvents } from "@/lib/calendar/data";
import { eventsOnDay, timeLabel } from "@/lib/calendar/days";
import { loadFamily } from "@/lib/family";
import { loadMenus } from "@/lib/menus/data";
import { levelOf } from "@/lib/schools";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const { profile, family } = await requireMember();
  const today = todayISO();
  const quote = quoteOfTheDay();

  const weekday = ![0, 6].includes(new Date(`${today}T12:00:00Z`).getUTCDay());
  const isParent = profile.role === "parent";

  // Everything at once: one round of database calls instead of several in a row.
  const [allGoals, members, checkIns, dueTodos, { events }, menus, requests] = await Promise.all([
    loadVisibleGoals(),
    loadFamily(),
    loadCheckIns(today, { profileId: profile.id }),
    loadDueTodos(profile.id, today),
    loadEvents(family.id, new Date(`${today}T00:00:00-05:00`), new Date(`${today}T23:59:59-05:00`)),
    weekday ? loadMenus(["elementary", "middle", "high"], today, today) : Promise.resolve([]),
    isParent ? loadRedemptions({ status: "requested" }) : Promise.resolve([]),
  ]);
  const myGoals = allGoals.filter((g) => g.owner_id === profile.id);
  const active = myGoals.filter((g) => g.status === "active");
  const pending = myGoals.filter((g) => g.status === "pending" || g.status === "declined");
  // A kid sees their own lunch; parents see each kid's.
  const lunchKids = members.filter((m) => levelOf(m.school) && (isParent || m.id === profile.id));
  const todaysEvents = eventsOnDay(events, today);

  const items = active.flatMap((goal) =>
    goal.activities
      .map((activity) => ({ goal, activity, amounts: amountsFor(activity.id, checkIns) }))
      .filter(({ activity, amounts }) => isDueToday(activity, amounts, today)),
  );
  const isDone = (i: (typeof items)[number]) => dayRatio(i.activity, i.amounts.get(today)) >= 1;
  const todo = items.filter((i) => !isDone(i));
  const done = items.filter(isDone);

  const goalApprovals = profile.role === "parent" ? allGoals.filter((g) => g.status === "pending").length : 0;
  const rewardRequests = requests.length;
  const pendingApprovals = goalApprovals + rewardRequests;
  const waitingText = [
    goalApprovals && `${goalApprovals} ${goalApprovals === 1 ? "goal" : "goals"}`,
    rewardRequests && `${rewardRequests} reward ${rewardRequests === 1 ? "request" : "requests"}`,
  ]
    .filter(Boolean)
    .join(" and ");

  const renderItem = ({ goal, activity, amounts }: (typeof items)[number]) => (
    <TodayItem
      key={activity.id}
      activity={activity}
      goal={{ id: goal.id, title: goal.title, emoji: goal.emoji }}
      day={today}
      amount={amounts.get(today)}
      weekProgress={
        activity.schedule === "per_week"
          ? { done: doneThisWeek(activity, amounts, today), target: activity.times_per_week ?? 1 }
          : undefined
      }
      streak={streak(activity, amounts, today)}
    />
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-muted">{longDate()}</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {greeting()}, {profile.display_name}!
        </h1>
      </div>

      <Card className="border-brand/30 bg-brand/5">
        <blockquote>
          <p className="text-lg font-medium leading-snug text-ink">“{quote.text}”</p>
          <footer className="mt-2 text-sm text-muted">— {quote.source}</footer>
        </blockquote>
      </Card>

      {(todaysEvents.length > 0 || (weekday && lunchKids.length > 0)) && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold text-ink">Today</h2>
            <Link href="/calendar" className="text-sm font-semibold text-brand-strong">
              Calendar →
            </Link>
          </div>
          {todaysEvents.length > 0 ? (
            <ul className="space-y-1.5">
              {todaysEvents.map((e) => (
                <li key={e.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} aria-hidden="true" />
                  <span className="w-14 shrink-0 text-muted">{timeLabel(e)}</span>
                  <span className="min-w-0 text-ink">{e.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing on the calendar today.</p>
          )}
          {weekday && lunchKids.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              {lunchKids.map((k) => (
                <MenuLine
                  key={k.id}
                  menu={menus.find((m) => m.level === levelOf(k.school))}
                  label={
                    <span className="mr-1 inline-flex items-center gap-1 align-middle">
                      <span aria-hidden="true">🍽</span>
                      {profile.role === "parent" ? (
                        <>
                          <Avatar name={k.display_name} color={k.color} size="sm" />
                          <span className="sr-only">{k.display_name}&apos;s lunch:</span>
                        </>
                      ) : (
                        <span className="font-medium text-muted">Lunch:</span>
                      )}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {profile.role === "parent" && (
        <Link href="/parent" className="block">
          <Card className="flex items-center gap-3 transition hover:border-brand/50">
            <ShieldIcon className="h-6 w-6 text-brand-strong" />
            <div className="flex-1">
              <p className="font-semibold text-ink">Parent dashboard</p>
              <p className="text-sm text-muted">
                {pendingApprovals > 0
                  ? `${waitingText} waiting for your approval`
                  : "Kids' progress, approvals and family settings"}
              </p>
            </div>
            {pendingApprovals > 0 && (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-danger px-1.5 text-xs font-bold text-white">
                {pendingApprovals}
              </span>
            )}
            <ChevronRight className="h-5 w-5 text-muted" />
          </Card>
        </Link>
      )}

      {items.length > 0 ? (
        <section aria-labelledby="todo-heading" className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 id="todo-heading" className="text-lg font-bold text-ink">
              Today&apos;s plan
            </h2>
            <p className="text-sm font-medium text-muted">
              {done.length} of {items.length} done
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(done.length / items.length) * 100}%` }}
            />
          </div>
          {todo.length === 0 && (
            <Card className="text-center">
              <p className="text-2xl" aria-hidden="true">🎉</p>
              <p className="font-semibold text-ink">All done for today. Way to check yo self!</p>
            </Card>
          )}
          {/* One list, so an item keeps its "+10" message when it moves down to Done. */}
          <ul className="space-y-2">
            {[
              ...todo.map(renderItem),
              ...(done.length
                ? [
                    <li key="done-heading" className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted">
                      Done
                    </li>,
                  ]
                : []),
              ...done.map(renderItem),
            ]}
          </ul>
        </section>
      ) : (
        <Card className="text-center">
          <p className="text-2xl" aria-hidden="true">🎯</p>
          <p className="font-semibold text-ink">
            {active.length ? "Nothing scheduled today. Enjoy it!" : "No goals yet"}
          </p>
          {!active.length && (
            <>
              <p className="mt-1 text-sm text-muted">Set a goal and build a plan to get there.</p>
              <Link
                href="/goals/new"
                className="mt-3 inline-block rounded-xl bg-brand px-4 py-2 font-semibold text-white"
              >
                Create a goal
              </Link>
            </>
          )}
        </Card>
      )}

      <DueTodos
        todos={dueTodos.map((t) => ({
          id: t.id,
          text: t.text,
          due_date: t.due_date!,
          overdue: t.due_date! < today,
          dueLabel: shortDay(t.due_date!),
          listId: t.lists.id,
          listTitle: t.lists.title,
          listEmoji: t.lists.emoji,
        }))}
      />

      {active.length > 0 && (
        <section aria-labelledby="goals-heading" className="space-y-2">
          <h2 id="goals-heading" className="text-lg font-bold text-ink">
            Your goals
          </h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {active.map((g) => (
              <li key={g.id}>
                <Link href={`/goals/${g.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span aria-hidden="true">{g.emoji}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{g.title}</span>
                  <TrackBadge status={goalProgress(g, checkIns, today).status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <p className="text-sm text-muted">
          {pending.length} of your goals {pending.length === 1 ? "is" : "are"} waiting on a parent.{" "}
          <Link href="/goals" className="font-semibold text-brand-strong underline">
            See goals
          </Link>
        </p>
      )}
    </div>
  );
}

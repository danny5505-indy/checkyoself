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
import { quoteOfTheDay } from "@/lib/quotes";
import { greeting, longDate } from "@/lib/time";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const { profile } = await requireMember();
  const today = todayISO();
  const quote = quoteOfTheDay();

  const allGoals = await loadVisibleGoals();
  const myGoals = allGoals.filter((g) => g.owner_id === profile.id);
  const active = myGoals.filter((g) => g.status === "active");
  const pending = myGoals.filter((g) => g.status === "pending" || g.status === "declined");
  const checkIns = await loadCheckIns(today, { profileId: profile.id });

  const items = active.flatMap((goal) =>
    goal.activities
      .map((activity) => ({ goal, activity, amounts: amountsFor(activity.id, checkIns) }))
      .filter(({ activity, amounts }) => isDueToday(activity, amounts, today)),
  );
  const isDone = (i: (typeof items)[number]) => dayRatio(i.activity, i.amounts.get(today)) >= 1;
  const todo = items.filter((i) => !isDone(i));
  const done = items.filter(isDone);

  const goalApprovals = profile.role === "parent" ? allGoals.filter((g) => g.status === "pending").length : 0;
  const rewardRequests =
    profile.role === "parent" ? (await loadRedemptions({ status: "requested" })).length : 0;
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

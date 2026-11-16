import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { GoalStatusBadge, PrivateBadge, TrackBadge } from "@/components/goals/badges";
import { GoalActions, ReviewButtons } from "@/components/goals/goal-actions";
import { HistoryGrid } from "@/components/goals/history-grid";
import { MilestoneList } from "@/components/goals/milestone-list";
import { Card } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { loadFamily } from "@/lib/family";
import { loadCheckIns, loadGoal } from "@/lib/goals/data";
import { addDays, friendlyDate, shortDay, todayISO, weekday } from "@/lib/goals/dates";
import {
  amountsFor,
  describeSchedule,
  describeTarget,
  goalProgress,
  isScheduledOn,
  streak,
} from "@/lib/goals/progress";
import { WEEKDAY_SHORT } from "@/lib/goals/types";

export const metadata = { title: "Goal" };

const HISTORY = 14;

export default async function GoalPage({ params }: PageProps<"/goals/[id]">) {
  const { id } = await params;
  const { profile } = await requireMember();
  const [goal, family] = await Promise.all([loadGoal(id), loadFamily()]);
  if (!goal) notFound();

  const today = todayISO();
  const owner = family.find((p) => p.id === goal.owner_id);
  const checkIns = await loadCheckIns(today, { activityIds: goal.activities.map((a) => a.id) });
  const progress = goalProgress(goal, checkIns, today);

  const isParent = profile.role === "parent";
  const isOwner = goal.owner_id === profile.id;
  const canEdit = isParent || isOwner;
  const overrideMode = isParent && !isOwner;
  const reviewer = family.find((p) => p.id === goal.reviewed_by);

  const days = Array.from({ length: HISTORY }, (_, i) => addDays(today, i - (HISTORY - 1)));
  const dateLabels: Record<string, string> = {};
  for (const m of goal.milestones) if (m.due_date) dateLabels[m.due_date] = friendlyDate(m.due_date);

  const activeActivities = goal.activities.filter((a) => !a.archived);

  return (
    <div className="space-y-4">
      <Link href="/goals" className="text-sm font-semibold text-brand-strong">
        ← Goals
      </Link>

      <header className="flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-surface text-3xl ring-1 ring-line" aria-hidden="true">
          {goal.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink">{goal.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {owner && (
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <Avatar name={owner.display_name} color={owner.color} size="sm" />
                {isOwner ? "Your goal" : `${owner.display_name}'s goal`}
              </span>
            )}
            {goal.status === "active" ? <TrackBadge status={progress.status} /> : <GoalStatusBadge status={goal.status} />}
            {goal.visibility === "private" && <PrivateBadge />}
          </div>
        </div>
      </header>

      {goal.status === "pending" && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          {isParent ? (
            <>
              <p className="mb-3 font-semibold text-ink">
                {owner?.display_name} wants to start this goal. Look over the plan below, then:
              </p>
              <ReviewButtons goalId={goal.id} ownerName={owner?.display_name ?? "them"} />
            </>
          ) : (
            <p className="text-ink">Waiting for a parent to approve this goal. You can still edit it.</p>
          )}
        </Card>
      )}
      {goal.status === "declined" && (
        <Card className="border-danger/40 bg-danger/5">
          <p className="font-semibold text-ink">
            {reviewer ? `${reviewer.display_name} asked for changes` : "A parent asked for changes"}
          </p>
          {goal.review_note && <p className="mt-1 text-ink">“{goal.review_note}”</p>}
          {isOwner && (
            <p className="mt-2 text-sm text-muted">Edit the goal and send it again when you&apos;re ready.</p>
          )}
        </Card>
      )}

      {(goal.why || goal.target_date) && (
        <Card>
          {goal.why && <p className="text-ink">{goal.why}</p>}
          {goal.target_date && (
            <p className={`text-sm text-muted ${goal.why ? "mt-2" : ""}`}>
              🎯 Target: <span className="font-semibold text-ink">{friendlyDate(goal.target_date)}</span>
            </p>
          )}
        </Card>
      )}

      {goal.status === "active" && progress.rate !== null && (
        <Card className="flex items-center gap-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-sm font-bold text-ink"
            style={{
              background: `conic-gradient(var(--brand) ${Math.round(progress.rate * 360)}deg, var(--line) 0deg)`,
            }}
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-surface">
              {Math.round(progress.rate * 100)}%
            </span>
          </div>
          <div>
            <p className="font-semibold text-ink">Last 7 days</p>
            <p className="text-sm text-muted">
              {progress.status === "on_track" && "Right on plan. Keep it up!"}
              {progress.status === "slipping" &&
                (progress.overdueMilestones
                  ? "A milestone date has passed. Time to catch up."
                  : "A few days missed. You can get back on track.")}
              {progress.status === "off_track" && "Behind plan. Pick one thing and do it today."}
            </p>
          </div>
        </Card>
      )}

      {activeActivities.length > 0 && (
        <section className="space-y-3" aria-labelledby="plan-heading">
          <h2 id="plan-heading" className="text-lg font-bold text-ink">
            The plan
          </h2>
          {activeActivities.map((a) => {
            const amounts = amountsFor(a.id, checkIns);
            const s = streak(a, amounts, today);
            const amountRecord: Record<string, number> = {};
            for (const d of days) {
              const v = amounts.get(d);
              if (v) amountRecord[d] = v;
            }
            const adjustedDays = checkIns
              .filter((c) => c.activity_id === a.id && c.adjusted_by && days.includes(c.day))
              .map((c) => c.day);
            return (
              <Card key={a.id}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{a.title}</p>
                    <p className="text-sm text-muted">
                      {describeSchedule(a)}
                      {a.tracking !== "check" && ` · ${describeTarget(a)}`}
                    </p>
                  </div>
                  {s.count > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                      🔥 {s.count} {s.unit}
                      {s.count === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <HistoryGrid
                  activity={a}
                  amounts={amountRecord}
                  adjustedDays={adjustedDays}
                  overrideMode={overrideMode}
                  cells={days.map((d) => ({
                    day: d,
                    label: d === today ? "Today" : WEEKDAY_SHORT[weekday(d)].slice(0, 2),
                    dateLabel: shortDay(d),
                    scheduled: a.schedule === "weekdays" ? isScheduledOn(a, d) : true,
                    editable:
                      goal.status !== "pending" &&
                      (isParent || (isOwner && goal.status === "active" && d >= addDays(today, -1))),
                  }))}
                />
              </Card>
            );
          })}
          <p className="text-xs text-muted">
            {isParent
              ? "Tap any day to fix a check-in. Changes you make to someone else's progress are marked with an orange dot."
              : isOwner
                ? "Forgot to check in yesterday? Tap yesterday to fill it in."
                : null}
          </p>
        </section>
      )}

      {goal.milestones.length > 0 && (
        <section className="space-y-3" aria-labelledby="ms-heading">
          <h2 id="ms-heading" className="text-lg font-bold text-ink">
            Milestones{" "}
            <span className="text-base font-medium text-muted">
              {progress.milestonesDone}/{goal.milestones.length}
            </span>
          </h2>
          <Card>
            <MilestoneList
              milestones={goal.milestones}
              canEdit={canEdit && goal.status === "active"}
              today={today}
              dateLabels={dateLabels}
            />
          </Card>
        </section>
      )}

      <GoalActions goalId={goal.id} status={goal.status} isParent={isParent} isOwner={isOwner} />
    </div>
  );
}

// Pure functions that turn a plan + check-ins into "what's due", streaks and status.
// No database access here, so it's easy to test.
import { addDays, dayOf, weekStart, weekday } from "./dates";
import type { Activity, CheckIn, GoalWithPlan } from "./types";
import { WEEKDAY_SHORT } from "./types";

export type DayAmounts = Map<string, number>; // day -> amount

export function amountsFor(activityId: string, checkIns: CheckIn[]): DayAmounts {
  const map: DayAmounts = new Map();
  for (const c of checkIns) if (c.activity_id === activityId) map.set(c.day, c.amount);
  return map;
}

// How much of one day's target was met: 0..1.
export function dayRatio(activity: Activity, amount: number | undefined): number {
  if (!amount) return 0;
  if (activity.tracking === "check" || !activity.target_amount) return 1;
  return Math.min(1, amount / activity.target_amount);
}

export function isScheduledOn(activity: Activity, day: string): boolean {
  if (activity.schedule === "daily") return true;
  if (activity.schedule === "weekdays") return activity.weekdays.includes(weekday(day));
  return true; // per_week: any day can count
}

// Days in the current week (Mon–Sun) with the target fully met.
export function doneThisWeek(activity: Activity, amounts: DayAmounts, today: string): number {
  let n = 0;
  for (let d = weekStart(today); d <= today; d = addDays(d, 1)) {
    if (dayRatio(activity, amounts.get(d)) >= 1) n++;
  }
  return n;
}

// Should this show on Today? Done items still show (as done) so they can be undone.
export function isDueToday(activity: Activity, amounts: DayAmounts, today: string): boolean {
  if (activity.archived) return false;
  if (activity.schedule !== "per_week") return isScheduledOn(activity, today);
  if (amounts.has(today)) return true;
  return doneThisWeek(activity, amounts, today) < (activity.times_per_week ?? 1);
}

export function describeSchedule(activity: Activity): string {
  if (activity.schedule === "daily") return "Every day";
  if (activity.schedule === "per_week") {
    const n = activity.times_per_week ?? 1;
    return `${n} ${n === 1 ? "day" : "days"} a week`;
  }
  const days = [...activity.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) return "Weekdays";
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "Weekends";
  return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

export function describeTarget(activity: Activity): string {
  if (activity.tracking === "minutes") return `${activity.target_amount} min`;
  if (activity.tracking === "count") return `${activity.target_amount} ${activity.unit || "times"}`;
  return "Done";
}

export function formatAmount(activity: Activity, amount: number): string {
  if (activity.tracking === "minutes") return `${amount} min`;
  if (activity.tracking === "count") return `${amount} ${activity.unit || ""}`.trim();
  return "Done";
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

export type Streak = { count: number; unit: "day" | "week" };

export function streak(activity: Activity, amounts: DayAmounts, today: string): Streak {
  // Start from creation, or earlier if someone (e.g. a parent) filled in older days.
  let firstDay = dayOf(activity.created_at);
  for (const d of amounts.keys()) if (d < firstDay) firstDay = d;

  if (activity.schedule === "per_week") {
    const target = activity.times_per_week ?? 1;
    let count = 0;
    let week = weekStart(today);
    // The current week counts once it's met; an unfinished week doesn't break the streak.
    if (doneThisWeek(activity, amounts, today) >= target) count++;
    for (let i = 0; i < 104; i++) {
      week = addDays(week, -7);
      if (addDays(week, 6) < firstDay) break;
      let done = 0;
      for (let d = week; d <= addDays(week, 6); d = addDays(d, 1)) {
        if (dayRatio(activity, amounts.get(d)) >= 1) done++;
      }
      if (done >= target) count++;
      else break;
    }
    return { count, unit: "week" };
  }

  let count = 0;
  let day = today;
  // Today counts if done; if not done yet, the streak is still alive.
  if (isScheduledOn(activity, today) && dayRatio(activity, amounts.get(today)) >= 1) count++;
  for (let i = 0; i < 730; i++) {
    day = addDays(day, -1);
    if (day < firstDay) break;
    if (!isScheduledOn(activity, day)) continue;
    if (dayRatio(activity, amounts.get(day)) >= 1) count++;
    else break;
  }
  return { count, unit: "day" };
}

// ---------------------------------------------------------------------------
// On-track status (last 7 days)
// ---------------------------------------------------------------------------

export type TrackStatus = "on_track" | "slipping" | "off_track" | "new";

type Window = { expected: number; achieved: number };

function activityWindow(activity: Activity, amounts: DayAmounts, today: string): Window {
  const firstDay = dayOf(activity.created_at);
  const start = addDays(today, -6) > firstDay ? addDays(today, -6) : firstDay;
  // Today only counts once it's done, so mornings don't look bad.
  const todayDone = dayRatio(activity, amounts.get(today)) > 0;
  const end = todayDone ? today : addDays(today, -1);
  if (end < start) return { expected: 0, achieved: todayDone ? 1 : 0 };

  if (activity.schedule === "per_week") {
    let days = 0;
    let achieved = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      days++;
      achieved += dayRatio(activity, amounts.get(d));
    }
    const expected = ((activity.times_per_week ?? 1) * days) / 7;
    return { expected, achieved: Math.min(achieved, expected) };
  }

  let expected = 0;
  let achieved = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isScheduledOn(activity, d)) continue;
    expected++;
    achieved += dayRatio(activity, amounts.get(d));
  }
  return { expected, achieved };
}

export type GoalProgress = {
  status: TrackStatus;
  rate: number | null; // 0..1 over the last 7 days
  overdueMilestones: number;
  milestonesDone: number;
};

export function goalProgress(goal: GoalWithPlan, checkIns: CheckIn[], today: string): GoalProgress {
  let expected = 0;
  let achieved = 0;
  for (const a of goal.activities) {
    if (a.archived) continue;
    const w = activityWindow(a, amountsFor(a.id, checkIns), today);
    expected += w.expected;
    achieved += w.achieved;
  }
  const overdueMilestones = goal.milestones.filter(
    (m) => !m.completed_at && m.due_date && m.due_date < today,
  ).length;
  const milestonesDone = goal.milestones.filter((m) => m.completed_at).length;

  if (expected < 1) {
    return { status: overdueMilestones ? "slipping" : "new", rate: null, overdueMilestones, milestonesDone };
  }
  const rate = achieved / expected;
  let status: TrackStatus = rate >= 0.8 ? "on_track" : rate >= 0.5 ? "slipping" : "off_track";
  if (status === "on_track" && overdueMilestones > 0) status = "slipping";
  return { status, rate, overdueMilestones, milestonesDone };
}

export const STATUS_LABEL: Record<TrackStatus, string> = {
  on_track: "On track",
  slipping: "Slipping",
  off_track: "Off track",
  new: "Just started",
};

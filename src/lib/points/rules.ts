// Pure rules for which points a run of check-ins earns. No database access, so it's testable.
import { addDays } from "@/lib/goals/dates";
import { dayRatio, doneThisWeek, streak, type DayAmounts } from "@/lib/goals/progress";
import type { Activity } from "@/lib/goals/types";
import { STREAK_BONUS_DAYS, STREAK_BONUS_WEEKS, type PointSettings } from "./settings";

export type Desired = { kind: "check_in" | "streak_bonus"; day: string; amount: number };

// Which points an activity should have earned on each day from `from` to today.
export function desiredActivityPoints(
  activity: Activity,
  amounts: DayAmounts,
  from: string,
  today: string,
  settings: PointSettings,
): { desired: Desired[]; bestStreak: { day: number; week: number } } {
  const desired: Desired[] = [];
  const best = { day: 0, week: 0 };
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (dayRatio(activity, amounts.get(d)) < 1) continue;
    if (settings.points_per_check_in > 0) {
      desired.push({ kind: "check_in", day: d, amount: settings.points_per_check_in });
    }
    const s = streak(activity, amounts, d);
    if (s.unit === "day") {
      best.day = Math.max(best.day, s.count);
      if (s.count > 0 && s.count % STREAK_BONUS_DAYS === 0 && settings.streak_bonus > 0) {
        desired.push({ kind: "streak_bonus", day: d, amount: settings.streak_bonus });
      }
    } else {
      best.week = Math.max(best.week, s.count);
      // Award on the day that completes the week's target.
      const completesWeek = doneThisWeek(activity, amounts, d) === (activity.times_per_week ?? 1);
      if (completesWeek && s.count > 0 && s.count % STREAK_BONUS_WEEKS === 0 && settings.streak_bonus > 0) {
        desired.push({ kind: "streak_bonus", day: d, amount: settings.streak_bonus });
      }
    }
  }
  return { desired, bestStreak: best };
}


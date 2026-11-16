// Pure rules for when notifications go out. No database access, so it's testable.
import { addDays, weekday } from "@/lib/goals/dates";
import { dayRatio, isScheduledOn, type DayAmounts } from "@/lib/goals/progress";
import type { Activity } from "@/lib/goals/types";
import { FAMILY_TIME_ZONE } from "@/lib/time";

export const QUIET_START = 21; // 9 pm
export const QUIET_END = 7; // 7 am
export const WEEKLY_SUMMARY_HOUR = 19; // Sunday 7 pm
export const MISSED_DAYS_ALERT = 3;

// Family-local clock time as minutes since midnight.
export function localMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_TIME_ZONE,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return get("hour") * 60 + get("minute");
}

export function isQuietTime(minutes: number): boolean {
  return minutes >= QUIET_START * 60 || minutes < QUIET_END * 60;
}

// "19:00" or "19:00:00" -> 1140
export function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

// The daily reminder is due once its time has passed (outside quiet hours).
// Sending at most once a day is handled by the notification log.
export function reminderDue(reminderTime: string, minutes: number): boolean {
  return !isQuietTime(minutes) && minutes >= parseTime(reminderTime);
}

export function weeklySummaryDue(today: string, minutes: number): boolean {
  return weekday(today) === 0 && !isQuietTime(minutes) && minutes >= WEEKLY_SUMMARY_HOUR * 60;
}

// How many scheduled days in a row were missed, counting back from yesterday.
// Returns the count and the first missed day (used to alert only once per run of misses).
export function missedInARow(
  activity: Activity,
  amounts: DayAmounts,
  today: string,
  firstDay: string,
): { count: number; since: string | null } {
  if (activity.schedule === "per_week") return { count: 0, since: null };
  let count = 0;
  let since: string | null = null;
  for (let d = addDays(today, -1), i = 0; d >= firstDay && i < 60; d = addDays(d, -1), i++) {
    if (!isScheduledOn(activity, d)) continue;
    if (dayRatio(activity, amounts.get(d)) >= 1) break;
    count++;
    since = d;
  }
  return { count, since };
}

export function listNames(names: string[], max = 3): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

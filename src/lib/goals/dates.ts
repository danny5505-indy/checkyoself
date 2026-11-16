// Calendar-day helpers. Days are "YYYY-MM-DD" strings in the family's time zone,
// and all arithmetic is done in UTC so daylight saving never shifts a day.
import { familyNow } from "@/lib/time";

export function todayISO(date = new Date()): string {
  const { year, month, day } = familyNow(date);
  return toISO(Date.UTC(year, month - 1, day));
}

function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function toMs(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  return toISO(toMs(day) + n * 86_400_000);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / 86_400_000);
}

// 0 = Sunday … 6 = Saturday
export function weekday(day: string): number {
  return new Date(toMs(day)).getUTCDay();
}

// Weeks run Monday to Sunday.
export function weekStart(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

// The family-local calendar day of a timestamp like "2026-11-16T14:03:00Z".
export function dayOf(timestamp: string): string {
  return todayISO(new Date(timestamp));
}

export function shortDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(toMs(day)));
}

export function friendlyDate(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(toMs(day)));
}

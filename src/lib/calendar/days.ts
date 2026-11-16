import { todayISO } from "@/lib/goals/dates";
import { FAMILY_TIME_ZONE } from "@/lib/time";
import type { CalendarEvent } from "./ics";

// Is this event on the given family-local day?
export function isOnDay(e: CalendarEvent, day: string): boolean {
  if (e.allDay) return e.start <= day && day < e.end;
  const start = todayISO(new Date(e.start));
  const end = todayISO(new Date(new Date(e.end).getTime() - 1));
  return start <= day && day <= end;
}

export function eventsOnDay<T extends CalendarEvent>(events: T[], day: string): T[] {
  return events
    .filter((e) => isOnDay(e, day))
    .sort((a, b) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
}

export function timeLabel(e: CalendarEvent): string {
  if (e.allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", { timeZone: FAMILY_TIME_ZONE, hour: "numeric", minute: "2-digit" })
    .format(new Date(e.start))
    .replace(":00", "")
    .replace(" ", "")
    .toLowerCase();
}

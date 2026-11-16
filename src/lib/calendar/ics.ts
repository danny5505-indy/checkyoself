// Reads iCalendar (.ics) feeds, such as iCloud or Google calendars, and expands
// repeating events into the individual occurrences within a date range.
import ICAL from "ical.js";

export type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  allDay: boolean;
  // All-day: "YYYY-MM-DD" (end is exclusive). Timed: ISO timestamps.
  start: string;
  end: string;
};

const MAX_OCCURRENCES = 1000;

function toValue(t: ICAL.Time): string {
  if (t.isDate) {
    return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
  }
  return t.toJSDate().toISOString();
}

// `from` and `to` are Dates; events overlapping [from, to) are returned.
export function parseIcs(text: string, from: Date, to: Date): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(tz);
  }

  const vevents = root.getAllSubcomponents("vevent");
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const v of vevents) {
    const ev = new ICAL.Event(v);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters.set(ev.uid, ev);
  }
  // Moved or edited single occurrences of a repeating event.
  for (const ex of exceptions) masters.get(ex.uid)?.relateException(ex);

  const fromT = ICAL.Time.fromJSDate(from, true);
  const toT = ICAL.Time.fromJSDate(to, true);
  const out: CalendarEvent[] = [];

  const push = (uid: string, start: ICAL.Time, end: ICAL.Time, summary: string, location: string | null) => {
    // all-day events with no end last one day
    if (start.compare(toT) >= 0) return;
    if (end.compare(fromT) <= 0 && !(start.isDate && start.compare(fromT) >= 0)) return;
    out.push({
      id: `${uid}|${toValue(start)}`,
      title: summary || "(No title)",
      location: location || null,
      allDay: start.isDate,
      start: toValue(start),
      end: toValue(end),
    });
  };

  for (const ev of masters.values()) {
    const status = String(ev.component.getFirstPropertyValue("status") ?? "").toUpperCase();
    if (status === "CANCELLED") continue;

    if (!ev.isRecurring()) {
      const end = ev.endDate ?? ev.startDate.clone();
      push(ev.uid, ev.startDate, end, ev.summary, ev.location);
      continue;
    }

    const it = ev.iterator();
    let next: ICAL.Time | null;
    let count = 0;
    while ((next = it.next()) && count < MAX_OCCURRENCES) {
      if (next.compare(toT) >= 0) break;
      const d = ev.getOccurrenceDetails(next);
      if (d.endDate.compare(fromT) <= 0) continue;
      count++;
      const item = d.item;
      const itemStatus = String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase();
      if (itemStatus === "CANCELLED") continue;
      push(ev.uid, d.startDate, d.endDate, item.summary, item.location);
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start));
}

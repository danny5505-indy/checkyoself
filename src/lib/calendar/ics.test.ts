import { describe, expect, it } from "vitest";
import { parseIcs } from "./ics";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VTIMEZONE
TZID:America/Indiana/Indianapolis
BEGIN:STANDARD
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:no-school
DTSTART;VALUE=DATE:20261126
DTEND;VALUE=DATE:20261128
SUMMARY:Thanksgiving Break - No School
END:VEVENT
BEGIN:VEVENT
UID:practice
DTSTART;TZID=America/Indiana/Indianapolis:20261102T170000
DTEND;TZID=America/Indiana/Indianapolis:20261102T183000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=20
EXDATE;TZID=America/Indiana/Indianapolis:20261118T170000
SUMMARY:Soccer practice
LOCATION:Field 3
END:VEVENT
BEGIN:VEVENT
UID:practice
RECURRENCE-ID;TZID=America/Indiana/Indianapolis:20261123T170000
DTSTART;TZID=America/Indiana/Indianapolis:20261123T180000
DTEND;TZID=America/Indiana/Indianapolis:20261123T193000
SUMMARY:Soccer practice (moved)
END:VEVENT
BEGIN:VEVENT
UID:cancelled
DTSTART:20261120T150000Z
DTEND:20261120T160000Z
STATUS:CANCELLED
SUMMARY:Cancelled thing
END:VEVENT
END:VCALENDAR`;

const range = (a: string, b: string) => parseIcs(ICS, new Date(`${a}T05:00:00Z`), new Date(`${b}T05:00:00Z`));

describe("parseIcs", () => {
  it("reads all-day events as dates", () => {
    const e = range("2026-11-26", "2026-11-27").find((x) => x.title.startsWith("Thanksgiving"));
    expect(e).toMatchObject({ allDay: true, start: "2026-11-26", end: "2026-11-28" });
  });

  it("expands weekly repeats inside the range only", () => {
    const week = range("2026-11-09", "2026-11-16").filter((x) => x.title.startsWith("Soccer"));
    expect(week).toHaveLength(2); // Mon 9th and Wed 11th
    expect(week[0].location).toBe("Field 3");
    // 5pm Indianapolis = 22:00 UTC in November
    expect(week[0].start).toBe("2026-11-09T22:00:00.000Z");
  });

  it("skips excluded dates", () => {
    const wed = range("2026-11-18", "2026-11-19").filter((x) => x.title.startsWith("Soccer"));
    expect(wed).toHaveLength(0);
  });

  it("uses the moved version of a single occurrence", () => {
    const mon = range("2026-11-23", "2026-11-24").filter((x) => x.title.startsWith("Soccer"));
    expect(mon).toHaveLength(1);
    expect(mon[0].title).toBe("Soccer practice (moved)");
    expect(mon[0].start).toBe("2026-11-23T23:00:00.000Z");
  });

  it("leaves out cancelled events", () => {
    expect(range("2026-11-20", "2026-11-21").some((x) => x.title === "Cancelled thing")).toBe(false);
  });
});

// The family's time zone. Servers run in UTC, so dates and greetings use this explicitly.
export const FAMILY_TIME_ZONE = "America/Indiana/Indianapolis";

export function familyNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { hour: get("hour"), year: get("year"), month: get("month"), day: get("day") };
}

export function greeting(date = new Date()) {
  const { hour } = familyNow(date);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function longDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

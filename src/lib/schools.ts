// Noblesville Schools buildings, and which lunch menu each one uses.
// The district publishes one lunch menu per level (elementary / middle / high).
export type SchoolLevel = "elementary" | "middle" | "high";

export const SCHOOLS: Record<string, { name: string; level: SchoolLevel }> = {
  hazel_dell: { name: "Hazel Dell Elementary", level: "elementary" },
  hinkle_creek: { name: "Hinkle Creek Elementary", level: "elementary" },
  noble_crossing: { name: "Noble Crossing Elementary", level: "elementary" },
  north: { name: "North Elementary", level: "elementary" },
  promise_road: { name: "Promise Road Elementary", level: "elementary" },
  stony_creek: { name: "Stony Creek Elementary", level: "elementary" },
  white_river: { name: "White River Elementary", level: "elementary" },
  east_middle: { name: "Noblesville East Middle School", level: "middle" },
  west_middle: { name: "Noblesville West Middle School", level: "middle" },
  high_school: { name: "Noblesville High School", level: "high" },
};

export const LEVEL_LABEL: Record<SchoolLevel, string> = {
  elementary: "Elementary",
  middle: "Middle School",
  high: "High School",
};

export function levelOf(school: string | null | undefined): SchoolLevel | null {
  return school && SCHOOLS[school] ? SCHOOLS[school].level : null;
}

// The district's public calendar (early releases, late arrivals, no-school days).
export const DISTRICT_CALENDAR = {
  name: "Noblesville Schools",
  url: "https://calendar.google.com/calendar/ical/district_calendar%40nobl.k12.in.us/public/basic.ics",
  color: "#b45309",
};

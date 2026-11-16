import { describe, expect, it } from "vitest";
import { addDays, weekStart } from "./dates";
import { describeSchedule, doneThisWeek, goalProgress, isDueToday, streak } from "./progress";
import type { Activity, CheckIn, GoalWithPlan } from "./types";

// Wednesday, Nov 18 2026
const TODAY = "2026-11-18";

function activity(patch: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    goal_id: "g1",
    title: "Practice",
    tracking: "check",
    target_amount: null,
    unit: null,
    schedule: "daily",
    weekdays: [],
    times_per_week: null,
    sort_order: 0,
    archived: false,
    created_at: "2026-10-01T12:00:00Z",
    ...patch,
  };
}

function amounts(days: string[], amount = 1) {
  return new Map(days.map((d) => [d, amount]));
}

function checkIns(days: string[], amount = 1, activityId = "a1"): CheckIn[] {
  return days.map((day, i) => ({
    id: `c${i}`,
    activity_id: activityId,
    profile_id: "p1",
    day,
    amount,
    created_by: "p1",
    adjusted_by: null,
    adjusted_at: null,
  }));
}

const lastN = (n: number, from = TODAY) => Array.from({ length: n }, (_, i) => addDays(from, -i));

describe("dates", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-18")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sunday
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
  });
  it("adds days across month ends and DST", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });
});

describe("streak", () => {
  it("counts consecutive days including today", () => {
    expect(streak(activity(), amounts(lastN(5)), TODAY)).toEqual({ count: 5, unit: "day" });
  });
  it("isn't broken just because today isn't done yet", () => {
    const days = lastN(4, addDays(TODAY, -1));
    expect(streak(activity(), amounts(days), TODAY).count).toBe(4);
  });
  it("breaks on a missed day", () => {
    const days = [TODAY, addDays(TODAY, -1), addDays(TODAY, -3)];
    expect(streak(activity(), amounts(days), TODAY).count).toBe(2);
  });
  it("skips days that aren't scheduled", () => {
    // Mon/Wed/Fri. Today is Wed; Mon done, last Fri done.
    const a = activity({ schedule: "weekdays", weekdays: [1, 3, 5] });
    const days = ["2026-11-18", "2026-11-16", "2026-11-13", "2026-11-11"];
    expect(streak(a, amounts(days), TODAY).count).toBe(4);
  });
  it("only counts full days for minute targets", () => {
    const a = activity({ tracking: "minutes", target_amount: 15 });
    const m = new Map([
      [TODAY, 15],
      [addDays(TODAY, -1), 10],
    ]);
    expect(streak(a, m, TODAY).count).toBe(1);
  });
  it("counts days filled in before the activity was created", () => {
    const a = activity({ created_at: `${TODAY}T15:00:00Z` });
    expect(streak(a, amounts([TODAY, addDays(TODAY, -1)]), TODAY).count).toBe(2);
  });
  it("counts weeks for days-a-week activities", () => {
    const a = activity({ schedule: "per_week", times_per_week: 2 });
    // last week: Mon + Thu; the week before: Tue + Wed; this week: nothing yet
    const days = ["2026-11-09", "2026-11-12", "2026-11-03", "2026-11-04"];
    expect(streak(a, amounts(days), TODAY)).toEqual({ count: 2, unit: "week" });
  });
});

describe("what's due today", () => {
  it("days-a-week activities disappear once the week is done", () => {
    const a = activity({ schedule: "per_week", times_per_week: 2 });
    const m = amounts(["2026-11-16", "2026-11-17"]);
    expect(doneThisWeek(a, m, TODAY)).toBe(2);
    expect(isDueToday(a, m, TODAY)).toBe(false);
  });
  it("but still show if checked in today, so it can be undone", () => {
    const a = activity({ schedule: "per_week", times_per_week: 2 });
    expect(isDueToday(a, amounts(["2026-11-16", TODAY]), TODAY)).toBe(true);
  });
  it("weekday activities show only on their days", () => {
    const a = activity({ schedule: "weekdays", weekdays: [1, 5] });
    expect(isDueToday(a, new Map(), TODAY)).toBe(false); // Wednesday
    expect(describeSchedule(a)).toBe("Mon, Fri");
  });
});

describe("on-track status", () => {
  const goal = (acts: Activity[]): GoalWithPlan => ({
    id: "g1",
    family_id: "f1",
    owner_id: "p1",
    title: "Goal",
    why: "",
    emoji: "🎯",
    target_date: null,
    visibility: "shared",
    status: "active",
    created_by: "p1",
    reviewed_by: null,
    review_note: null,
    completed_at: null,
    created_at: "2026-10-01T12:00:00Z",
    activities: acts,
    milestones: [],
  });

  it("is on track when every day of the last week is done", () => {
    expect(goalProgress(goal([activity()]), checkIns(lastN(7)), TODAY).status).toBe("on_track");
  });
  it("doesn't count today against you until it's done", () => {
    const days = lastN(6, addDays(TODAY, -1));
    expect(goalProgress(goal([activity()]), checkIns(days), TODAY).status).toBe("on_track");
  });
  it("is slipping at around half", () => {
    const days = [addDays(TODAY, -1), addDays(TODAY, -2), addDays(TODAY, -3), addDays(TODAY, -4)];
    expect(goalProgress(goal([activity()]), checkIns(days), TODAY).status).toBe("slipping");
  });
  it("is off track when little is done", () => {
    expect(goalProgress(goal([activity()]), checkIns([addDays(TODAY, -5)]), TODAY).status).toBe("off_track");
  });
  it("is 'just started' for a brand-new goal", () => {
    const fresh = activity({ created_at: `${TODAY}T15:00:00Z` });
    expect(goalProgress(goal([fresh]), [], TODAY).status).toBe("new");
  });
  it("judges days-a-week activities by the weekly pace", () => {
    const a = activity({ schedule: "per_week", times_per_week: 3 });
    const days = [addDays(TODAY, -1), addDays(TODAY, -3), addDays(TODAY, -5)];
    expect(goalProgress(goal([a]), checkIns(days), TODAY).status).toBe("on_track");
  });
  it("an overdue milestone turns on-track into slipping", () => {
    const g = goal([activity()]);
    g.milestones = [
      { id: "m1", goal_id: "g1", title: "M", due_date: addDays(TODAY, -2), sort_order: 0, completed_at: null, completed_by: null },
    ];
    expect(goalProgress(g, checkIns(lastN(7)), TODAY).status).toBe("slipping");
  });
});

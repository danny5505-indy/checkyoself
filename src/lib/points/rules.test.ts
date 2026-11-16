import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/goals/dates";
import type { Activity } from "@/lib/goals/types";
import { desiredActivityPoints } from "./rules";
import { DEFAULT_SETTINGS } from "./settings";

const TODAY = "2026-11-18"; // Wednesday

const activity = (patch: Partial<Activity> = {}): Activity => ({
  id: "a1", goal_id: "g1", title: "Practice", tracking: "check", target_amount: null, unit: null,
  schedule: "daily", weekdays: [], times_per_week: null, sort_order: 0, archived: false,
  created_at: "2026-09-01T12:00:00Z", ...patch,
});
const run = (n: number) => new Map(Array.from({ length: n }, (_, i) => [addDays(TODAY, -i), 1]));
const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

describe("points rules", () => {
  it("awards check-in points for each completed day", () => {
    const { desired } = desiredActivityPoints(activity(), run(3), addDays(TODAY, -2), TODAY, DEFAULT_SETTINGS);
    expect(desired.filter((d) => d.kind === "check_in")).toHaveLength(3);
    expect(sum(desired)).toBe(30);
  });

  it("adds a streak bonus on day 7 and day 14", () => {
    const { desired } = desiredActivityPoints(activity(), run(14), addDays(TODAY, -13), TODAY, DEFAULT_SETTINGS);
    const bonuses = desired.filter((d) => d.kind === "streak_bonus");
    expect(bonuses.map((b) => b.day)).toEqual([addDays(TODAY, -7), TODAY]);
    expect(sum(desired)).toBe(14 * 10 + 2 * 25);
  });

  it("gives nothing for a partly done minutes target", () => {
    const a = activity({ tracking: "minutes", target_amount: 20 });
    const { desired } = desiredActivityPoints(a, new Map([[TODAY, 10]]), TODAY, TODAY, DEFAULT_SETTINGS);
    expect(desired).toEqual([]);
  });

  it("gives a weekly-plan bonus after 4 weeks in a row, on the day the week is met", () => {
    const a = activity({ schedule: "per_week", times_per_week: 2 });
    // Mon + Tue in each of the last four weeks (this week: Nov 16 + 17)
    const days = ["2026-10-26", "2026-10-27", "2026-11-02", "2026-11-03", "2026-11-09", "2026-11-10", "2026-11-16", "2026-11-17"];
    const { desired } = desiredActivityPoints(a, new Map(days.map((d) => [d, 1])), "2026-10-26", TODAY, DEFAULT_SETTINGS);
    expect(desired.filter((d) => d.kind === "streak_bonus").map((d) => d.day)).toEqual(["2026-11-17"]);
  });

  it("respects settings that turn points off", () => {
    const off = { ...DEFAULT_SETTINGS, points_per_check_in: 0, streak_bonus: 0 };
    expect(desiredActivityPoints(activity(), run(14), addDays(TODAY, -13), TODAY, off).desired).toEqual([]);
  });

  it("reports the best streak for badges", () => {
    const { bestStreak } = desiredActivityPoints(activity(), run(9), addDays(TODAY, -8), TODAY, DEFAULT_SETTINGS);
    expect(bestStreak.day).toBe(9);
  });
});

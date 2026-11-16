import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/goals/types";
import { isQuietTime, listNames, localMinutes, missedInARow, reminderDue, weeklySummaryDue } from "./rules";

const activity = (patch: Partial<Activity> = {}): Activity => ({
  id: "a1", goal_id: "g1", title: "Spanish", tracking: "check", target_amount: null, unit: null,
  schedule: "daily", weekdays: [], times_per_week: null, sort_order: 0, archived: false,
  created_at: "2026-10-01T12:00:00Z", ...patch,
});

describe("notification rules", () => {
  it("is quiet from 9 pm to 7 am", () => {
    expect(isQuietTime(21 * 60)).toBe(true);
    expect(isQuietTime(23 * 60 + 30)).toBe(true);
    expect(isQuietTime(6 * 60 + 59)).toBe(true);
    expect(isQuietTime(7 * 60)).toBe(false);
    expect(isQuietTime(20 * 60 + 59)).toBe(false);
  });

  it("reads the family's local time", () => {
    // 23:30 UTC on Nov 18 is 6:30 pm in Indianapolis (EST)
    expect(localMinutes(new Date("2026-11-18T23:30:00Z"))).toBe(18 * 60 + 30);
  });

  it("sends the daily reminder once its time has passed, but never in quiet hours", () => {
    expect(reminderDue("19:00:00", 18 * 60 + 59)).toBe(false);
    expect(reminderDue("19:00:00", 19 * 60)).toBe(true);
    expect(reminderDue("19:00:00", 20 * 60 + 10)).toBe(true); // a late run still sends
    expect(reminderDue("19:00:00", 21 * 60 + 5)).toBe(false);
  });

  it("sends the weekly summary on Sunday evening only", () => {
    expect(weeklySummaryDue("2026-11-22", 19 * 60)).toBe(true); // Sunday
    expect(weeklySummaryDue("2026-11-22", 18 * 60)).toBe(false);
    expect(weeklySummaryDue("2026-11-21", 19 * 60)).toBe(false); // Saturday
  });

  it("counts missed days in a row, back from yesterday", () => {
    const amounts = new Map([["2026-11-14", 1]]);
    // today Nov 18: missed 17, 16, 15 → 3, since the 15th
    expect(missedInARow(activity(), amounts, "2026-11-18", "2026-10-01")).toEqual({ count: 3, since: "2026-11-15" });
  });

  it("ignores days the activity isn't scheduled", () => {
    const mwf = activity({ schedule: "weekdays", weekdays: [1, 3, 5] });
    // today Wed Nov 18; Mon 16 missed, Fri 13 missed, Wed 11 done
    const amounts = new Map([["2026-11-11", 1]]);
    expect(missedInARow(mwf, amounts, "2026-11-18", "2026-10-01").count).toBe(2);
  });

  it("doesn't count days before the activity existed", () => {
    expect(missedInARow(activity(), new Map(), "2026-11-18", "2026-11-17").count).toBe(1);
  });

  it("shortens long lists", () => {
    expect(listNames(["A", "B"])).toBe("A, B");
    expect(listNames(["A", "B", "C", "D", "E"])).toBe("A, B, C and 2 more");
  });
});

import "server-only";
// The every-15-minutes check: daily reminders, falling-behind alerts, weekly summary.
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, dayOf, todayISO, weekStart } from "@/lib/goals/dates";
import { amountsFor, dayRatio, goalProgress, isDueToday } from "@/lib/goals/progress";
import type { CheckIn, GoalWithPlan } from "@/lib/goals/types";
import { listNames, localMinutes, MISSED_DAYS_ALERT, missedInARow, reminderDue, weeklySummaryDue } from "./rules";
import { sendToProfile } from "./send";

type Prefs = { profile_id: string; daily_reminder: boolean; reminder_time: string; weekly_summary: boolean };
const DEFAULT_PREFS = { daily_reminder: true, reminder_time: "19:00", weekly_summary: true };

export async function runNudges(now = new Date()) {
  const admin = createAdminClient();
  const minutes = localMinutes(now);
  const today = todayISO(now);
  const report = { reminders: 0, behind: 0, weekly: 0 };

  // Only people with at least one device can get anything.
  const { data: subs } = await admin.from("push_subscriptions").select("profile_id");
  const withDevices = [...new Set((subs ?? []).map((s) => s.profile_id as string))];
  if (!withDevices.length) return report;

  const [{ data: profiles }, { data: prefRows }] = await Promise.all([
    admin.from("profiles").select("id, family_id, display_name, role"),
    admin.from("notification_prefs").select("profile_id, daily_reminder, reminder_time, weekly_summary"),
  ]);
  const people = (profiles ?? []) as { id: string; family_id: string; display_name: string; role: "parent" | "kid" }[];
  const prefsOf = (id: string) => ({ ...DEFAULT_PREFS, ...((prefRows ?? []) as Prefs[]).find((p) => p.profile_id === id) });

  // Goals and recent check-ins for the families involved.
  const familyIds = [...new Set(people.filter((p) => withDevices.includes(p.id)).map((p) => p.family_id))];
  const { data: goalRows } = await admin
    .from("goals")
    .select("*, activities(*), milestones(*)")
    .in("family_id", familyIds)
    .eq("status", "active");
  const goals = (goalRows ?? []) as GoalWithPlan[];
  const ownerIds = [...new Set(goals.map((g) => g.owner_id))];
  const { data: checkInRows } = ownerIds.length
    ? await admin
        .from("check_ins")
        .select("id, activity_id, profile_id, day, amount, created_by, adjusted_by, adjusted_at")
        .in("profile_id", ownerIds)
        .gte("day", addDays(today, -70))
    : { data: [] };
  const checkIns = (checkInRows ?? []) as CheckIn[];

  for (const person of people) {
    const prefs = prefsOf(person.id);
    const theirGoals = goals.filter((g) => g.owner_id === person.id);
    const theirCheckIns = checkIns.filter((c) => c.profile_id === person.id);

    // --- Daily reminder + falling behind (at their reminder time)
    if (withDevices.includes(person.id) && prefs.daily_reminder && reminderDue(prefs.reminder_time, minutes)) {
      const open: string[] = [];
      const behind: { title: string; count: number }[] = [];
      for (const g of theirGoals) {
        for (const a of g.activities.filter((x) => !x.archived)) {
          const amounts = amountsFor(a.id, theirCheckIns);
          if (isDueToday(a, amounts, today) && dayRatio(a, amounts.get(today)) < 1) open.push(a.title);
          const missed = missedInARow(a, amounts, today, dayOf(a.created_at));
          if (missed.count >= MISSED_DAYS_ALERT && missed.since) {
            behind.push({ title: a.title, count: missed.count });
          }
        }
      }
      if (open.length) {
        const nudge = behind.find((b) => open.includes(b.title));
        const r = await sendToProfile(
          person.id,
          {
            title: open.length === 1 ? "1 thing left on today's plan" : `${open.length} things left on today's plan`,
            body: nudge
              ? `${listNames(open)}. You've missed ${nudge.title} ${nudge.count} days in a row. Today's a great day to get back on track!`
              : `${listNames(open)}. You've got this!`,
            url: "/",
            tag: "daily",
          },
          { now, once: { kind: "daily", key: today } },
        );
        if (r.sent) report.reminders++;
      }
    }

    // --- Falling behind: parents get a heads-up at their reminder time, once per
    // run of misses on a kid's activity (whether or not the kid has notifications on).
    if (person.role === "parent" && withDevices.includes(person.id) && reminderDue(prefs.reminder_time, minutes)) {
      const kids = people.filter((p) => p.family_id === person.family_id && p.role === "kid");
      for (const kid of kids) {
        const kidCheckIns = checkIns.filter((c) => c.profile_id === kid.id);
        for (const g of goals.filter((x) => x.owner_id === kid.id)) {
          for (const a of g.activities.filter((x) => !x.archived)) {
            const missed = missedInARow(a, amountsFor(a.id, kidCheckIns), today, dayOf(a.created_at));
            if (missed.count < MISSED_DAYS_ALERT || !missed.since) continue;
            const r = await sendToProfile(
              person.id,
              {
                title: `${kid.display_name} is falling behind`,
                body: `${kid.display_name} has missed ${a.title} ${missed.count} days in a row.`,
                url: `/goals/${g.id}`,
                tag: `behind-${a.id}`,
              },
              { now, once: { kind: "behind", key: `${a.id}:${missed.since}` } },
            );
            if (r.sent) report.behind++;
          }
        }
      }
    }

    // --- Weekly summary for parents (Sunday evening)
    if (person.role === "parent" && withDevices.includes(person.id) && prefs.weekly_summary && weeklySummaryDue(today, minutes)) {
      const kids = people.filter((p) => p.family_id === person.family_id && p.role === "kid");
      const lines: string[] = [];
      let slipping = 0;
      for (const kid of kids) {
        const kidGoals = goals.filter((g) => g.owner_id === kid.id);
        if (!kidGoals.length) continue;
        const kidCheckIns = checkIns.filter((c) => c.profile_id === kid.id);
        const progress = kidGoals.map((g) => goalProgress(g, kidCheckIns, today));
        const rates = progress.map((p) => p.rate).filter((r): r is number => r !== null);
        slipping += progress.filter((p) => p.status === "slipping" || p.status === "off_track").length;
        if (rates.length) lines.push(`${kid.display_name} ${Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100)}%`);
      }
      if (lines.length) {
        const r = await sendToProfile(
          person.id,
          {
            title: "This week in Check Yo Self",
            body: `${lines.join(" · ")}${slipping ? `. ${slipping} ${slipping === 1 ? "goal needs" : "goals need"} attention.` : ". Everyone's on track!"}`,
            url: "/parent",
            tag: "weekly",
          },
          { now, once: { kind: "weekly", key: weekStart(today) } },
        );
        if (r.sent) report.weekly++;
      }
    }
  }
  return report;
}

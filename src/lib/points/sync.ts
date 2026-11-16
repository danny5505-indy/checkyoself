import "server-only";
// Keeps the points ledger in step with what actually happened.
//
// These run on the server with the secret key, after a check-in, milestone or
// goal changes. They read the real data and add, update or remove point rows so
// the ledger always matches, whether a check-off was added, undone or fixed by a parent.
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, todayISO } from "@/lib/goals/dates";
import type { DayAmounts } from "@/lib/goals/progress";
import type { Activity } from "@/lib/goals/types";
import { BADGES, type Badge, type BadgeStats } from "./badges";
import { desiredActivityPoints, type Desired } from "./rules";
import { DEFAULT_SETTINGS, type PointSettings } from "./settings";

type Admin = ReturnType<typeof createAdminClient>;

export type SyncResult = { delta: number; badges: Badge[] };

// How far back a single change can ripple (a parent fixing an old day changes later streaks).
const MAX_RESYNC_DAYS = 60;

async function settingsFor(admin: Admin, familyId: string): Promise<PointSettings> {
  const { data } = await admin
    .from("family_settings")
    .select("points_per_check_in, streak_bonus, milestone_points, goal_points")
    .eq("family_id", familyId)
    .maybeSingle<PointSettings>();
  return data ?? DEFAULT_SETTINGS;
}

// Call after any check-in change for this activity on `day`.
export async function syncActivityPoints(activityId: string, day: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: activity } = await admin
    .from("activities")
    .select("*, goals!inner(owner_id, family_id)")
    .eq("id", activityId)
    .maybeSingle<Activity & { goals: { owner_id: string; family_id: string } }>();
  if (!activity) return { delta: 0, badges: [] };
  const { owner_id: profileId, family_id: familyId } = activity.goals;

  const today = todayISO();
  const from = day > addDays(today, -MAX_RESYNC_DAYS) ? day : addDays(today, -MAX_RESYNC_DAYS);

  const [settings, checkInsRes, existingRes] = await Promise.all([
    settingsFor(admin, familyId),
    admin.from("check_ins").select("day, amount").eq("activity_id", activityId).gte("day", addDays(today, -800)),
    admin
      .from("point_events")
      .select("id, kind, day, amount")
      .eq("activity_id", activityId)
      .in("kind", ["check_in", "streak_bonus"])
      .gte("day", from),
  ]);
  const amounts: DayAmounts = new Map((checkInsRes.data ?? []).map((c) => [c.day as string, c.amount as number]));
  const { desired, bestStreak } = desiredActivityPoints(activity, amounts, from, today, settings);

  const existing = (existingRes.data ?? []) as { id: string; kind: Desired["kind"]; day: string; amount: number }[];
  const key = (k: string, d: string) => `${k}|${d}`;
  const want = new Map(desired.map((x) => [key(x.kind, x.day), x]));
  const have = new Map(existing.map((x) => [key(x.kind, x.day), x]));

  let delta = 0;
  const toDelete = existing.filter((x) => !want.has(key(x.kind, x.day)));
  for (const x of toDelete) delta -= x.amount;
  if (toDelete.length) await admin.from("point_events").delete().in("id", toDelete.map((x) => x.id));

  for (const x of desired) {
    const current = have.get(key(x.kind, x.day));
    if (!current) {
      const { error } = await admin.from("point_events").insert({
        family_id: familyId,
        profile_id: profileId,
        amount: x.amount,
        kind: x.kind,
        activity_id: activityId,
        day: x.day,
        note: x.kind === "streak_bonus" ? `Streak bonus: ${activity.title}` : activity.title,
      });
      if (!error) delta += x.amount; // a duplicate from a double tap is ignored
    }
    // Points already earned keep their amount, even if a parent later changes the settings.
  }

  const badges = await awardBadges(admin, profileId, bestStreak);
  return { delta, badges };
}

// Call after a milestone is ticked or unticked.
export async function syncMilestonePoints(milestoneId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: m } = await admin
    .from("milestones")
    .select("id, title, completed_at, goals!inner(owner_id, family_id)")
    .eq("id", milestoneId)
    .maybeSingle<{ id: string; title: string; completed_at: string | null; goals: { owner_id: string; family_id: string } }>();
  if (!m) return { delta: 0, badges: [] };
  const settings = await settingsFor(admin, m.goals.family_id);
  const delta = await ensureOneOff(admin, {
    match: { kind: "milestone", milestone_id: m.id },
    wanted: Boolean(m.completed_at) && settings.milestone_points > 0,
    row: {
      family_id: m.goals.family_id,
      profile_id: m.goals.owner_id,
      amount: settings.milestone_points,
      kind: "milestone",
      milestone_id: m.id,
      note: `Milestone: ${m.title}`,
    },
  });
  const badges = await awardBadges(admin, m.goals.owner_id);
  return { delta, badges };
}

export async function syncGoalMilestones(goalId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("milestones").select("id").eq("goal_id", goalId);
  for (const m of data ?? []) await syncMilestonePoints(m.id as string);
}

// Call after a goal's status changes.
export async function syncGoalPoints(goalId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: g } = await admin
    .from("goals")
    .select("id, title, emoji, status, owner_id, family_id")
    .eq("id", goalId)
    .maybeSingle<{ id: string; title: string; emoji: string; status: string; owner_id: string; family_id: string }>();
  if (!g) return { delta: 0, badges: [] };
  const settings = await settingsFor(admin, g.family_id);
  const delta = await ensureOneOff(admin, {
    match: { kind: "goal_completed", goal_id: g.id },
    wanted: g.status === "completed" && settings.goal_points > 0,
    row: {
      family_id: g.family_id,
      profile_id: g.owner_id,
      amount: settings.goal_points,
      kind: "goal_completed",
      goal_id: g.id,
      note: `Goal reached: ${g.emoji} ${g.title}`,
    },
  });
  const badges = await awardBadges(admin, g.owner_id);
  return { delta, badges };
}

async function ensureOneOff(
  admin: Admin,
  opts: { match: Record<string, string>; wanted: boolean; row: Record<string, unknown> },
): Promise<number> {
  let query = admin.from("point_events").select("id, amount");
  for (const [k, v] of Object.entries(opts.match)) query = query.eq(k, v);
  const { data: existing } = await query.maybeSingle<{ id: string; amount: number }>();
  if (opts.wanted && !existing) {
    const { error } = await admin.from("point_events").insert(opts.row);
    return error ? 0 : (opts.row.amount as number);
  }
  if (!opts.wanted && existing) {
    await admin.from("point_events").delete().eq("id", existing.id);
    return -existing.amount;
  }
  return 0;
}

// Awards any badges the person now qualifies for. Returns the newly earned ones.
export async function awardBadges(
  admin: Admin,
  profileId: string,
  streaks: { day: number; week: number } = { day: 0, week: 0 },
): Promise<Badge[]> {
  const [earnedRes, checkInsRes, pointsRes, milestonesRes, goalsRes, rewardsRes] = await Promise.all([
    admin.from("badges_earned").select("badge").eq("profile_id", profileId),
    admin.from("check_ins").select("id", { count: "exact", head: true }).eq("profile_id", profileId),
    admin.from("point_events").select("amount").eq("profile_id", profileId).gt("amount", 0),
    admin
      .from("milestones")
      .select("id, goals!inner(owner_id)", { count: "exact", head: true })
      .eq("goals.owner_id", profileId)
      .not("completed_at", "is", null),
    admin.from("goals").select("id", { count: "exact", head: true }).eq("owner_id", profileId).eq("status", "completed"),
    admin.from("redemptions").select("id", { count: "exact", head: true }).eq("profile_id", profileId).eq("status", "approved"),
  ]);
  const have = new Set((earnedRes.data ?? []).map((b) => b.badge as string));
  const stats: BadgeStats = {
    checkIns: checkInsRes.count ?? 0,
    bestDayStreak: streaks.day,
    bestWeekStreak: streaks.week,
    milestones: milestonesRes.count ?? 0,
    goals: goalsRes.count ?? 0,
    pointsEarned: (pointsRes.data ?? []).reduce((sum, p) => sum + (p.amount as number), 0),
    rewards: rewardsRes.count ?? 0,
  };
  const fresh = BADGES.filter((b) => !have.has(b.key) && b.earned(stats));
  if (!fresh.length) return [];
  const { data: inserted } = await admin
    .from("badges_earned")
    .upsert(
      fresh.map((b) => ({ profile_id: profileId, badge: b.key })),
      { onConflict: "profile_id,badge", ignoreDuplicates: true },
    )
    .select("badge");
  const newKeys = new Set((inserted ?? []).map((b) => b.badge as string));
  return fresh.filter((b) => newKeys.has(b.key));
}

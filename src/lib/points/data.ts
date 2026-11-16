import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, type PointSettings } from "./settings";

export type PointEvent = {
  id: string;
  profile_id: string;
  amount: number;
  kind: "check_in" | "streak_bonus" | "milestone" | "goal_completed" | "redemption" | "adjustment";
  day: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type Reward = {
  id: string;
  title: string;
  emoji: string;
  cost: number;
  details: string;
  active: boolean;
  sort_order: number;
};

export type Redemption = {
  id: string;
  profile_id: string;
  reward_id: string | null;
  reward_title: string;
  reward_emoji: string;
  cost: number;
  status: "requested" | "approved" | "declined";
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
  created_at: string;
};

export async function loadBalance(profileId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("point_balance", { target: profileId });
  return (data as number | null) ?? 0;
}

// Balances for everyone the signed-in person may see (just themselves for kids).
export async function loadBalances(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("point_events").select("profile_id, amount");
  const map = new Map<string, number>();
  for (const e of data ?? []) map.set(e.profile_id as string, (map.get(e.profile_id as string) ?? 0) + (e.amount as number));
  return map;
}

export async function loadPointEvents(profileId: string, limit = 40): Promise<PointEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("point_events")
    .select("id, profile_id, amount, kind, day, note, created_by, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PointEvent[]>();
  return data ?? [];
}

export async function loadBadges(profileId: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("badges_earned").select("badge, earned_at").eq("profile_id", profileId);
  return new Map((data ?? []).map((b) => [b.badge as string, b.earned_at as string]));
}

export async function loadRewards(): Promise<Reward[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rewards")
    .select("id, title, emoji, cost, details, active, sort_order")
    .order("sort_order")
    .order("cost")
    .returns<Reward[]>();
  return data ?? [];
}

export async function loadRedemptions(opts: { profileId?: string; status?: Redemption["status"] } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("redemptions")
    .select("id, profile_id, reward_id, reward_title, reward_emoji, cost, status, decided_by, decided_at, note, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (opts.profileId) q = q.eq("profile_id", opts.profileId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q.returns<Redemption[]>();
  return data ?? [];
}

export async function loadSettings(familyId: string): Promise<PointSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("family_settings")
    .select("points_per_check_in, streak_bonus, milestone_points, goal_points")
    .eq("family_id", familyId)
    .maybeSingle<PointSettings>();
  return data ?? DEFAULT_SETTINGS;
}

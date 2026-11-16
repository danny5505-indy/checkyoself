"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { notifyApprovals, parentsOf } from "@/lib/push/send";
import { z } from "zod";
import { requireMember, requireParent } from "@/lib/auth";
import { awardBadges } from "@/lib/points/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

type Result = { error?: string; success?: string };
const uuid = z.string().uuid();

function friendly(message: string): string {
  if (/Not enough points/i.test(message)) return "They don't have enough points for this anymore.";
  if (/already decided/i.test(message)) return "Someone already took care of this request.";
  if (/below zero/i.test(message)) return "That would take their points below zero.";
  if (/isn't available/i.test(message)) return "That reward isn't available anymore.";
  return message;
}

// ---------------------------------------------------------------------------
// Requests (anyone) and decisions (parents)
// ---------------------------------------------------------------------------

export async function requestReward(rewardId: string): Promise<Result> {
  const { profile } = await requireMember();
  if (!uuid.safeParse(rewardId).success) return { error: "Something went wrong." };
  const supabase = await createClient();

  const [{ data: reward }, { data: balance }, { data: open }] = await Promise.all([
    supabase.from("rewards").select("cost, title, active").eq("id", rewardId).maybeSingle(),
    supabase.rpc("point_balance", { target: profile.id }),
    supabase.from("redemptions").select("cost").eq("profile_id", profile.id).eq("status", "requested"),
  ]);
  if (!reward?.active) return { error: "That reward isn't available anymore." };
  const reserved = (open ?? []).reduce((s, r) => s + (r.cost as number), 0);
  const available = ((balance as number | null) ?? 0) - reserved;
  if (available < (reward.cost as number)) {
    return { error: `You need ${(reward.cost as number) - available} more points for this.` };
  }

  const { error } = await supabase
    .from("redemptions")
    .insert({ family_id: profile.family_id, profile_id: profile.id, reward_id: rewardId, reward_title: "", reward_emoji: "", cost: 0 });
  if (error) return { error: friendly(error.message) };
  after(async () =>
    notifyApprovals(await parentsOf(profile.family_id, profile.id), {
      title: `${profile.display_name} wants a reward`,
      body: `${reward.title} (${reward.cost} points)`,
      url: "/rewards",
      tag: "reward-requests",
    }),
  );
  refresh();
  return { success: `Requested! A parent will approve "${reward.title}".` };
}

export async function cancelRequest(redemptionId: string): Promise<Result> {
  await requireMember();
  if (!uuid.safeParse(redemptionId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("redemptions").delete().eq("id", redemptionId).select("id");
  if (error || !data?.length) return { error: "This request can't be cancelled." };
  refresh();
  return {};
}

export async function approveRedemption(redemptionId: string): Promise<Result> {
  await requireParent();
  if (!uuid.safeParse(redemptionId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_redemption", { target: redemptionId });
  if (error) return { error: friendly(error.message) };

  const { data: r } = await supabase
    .from("redemptions")
    .select("profile_id, reward_title, reward_emoji")
    .eq("id", redemptionId)
    .single();
  if (r) {
    await awardBadges(createAdminClient(), r.profile_id as string);
    after(() =>
      notifyApprovals([r.profile_id as string], {
        title: "Reward approved! 🎁",
        body: `${r.reward_emoji} ${r.reward_title} is yours.`,
        url: "/rewards",
        tag: `reward-${redemptionId}`,
      }),
    );
  }
  refresh();
  return { success: "Approved. Points deducted." };
}

export async function declineRedemption(redemptionId: string, reason: string): Promise<Result> {
  await requireParent();
  if (!uuid.safeParse(redemptionId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_redemption", { target: redemptionId, reason });
  if (error) return { error: friendly(error.message) };
  const { data: r } = await supabase.from("redemptions").select("profile_id, reward_title").eq("id", redemptionId).single();
  if (r) {
    after(() =>
      notifyApprovals([r.profile_id as string], {
        title: "Not this time",
        body: `${r.reward_title}${reason.trim() ? `: "${reason.trim().slice(0, 100)}"` : ""}`,
        url: "/rewards",
        tag: `reward-${redemptionId}`,
      }),
    );
  }
  refresh();
  return { success: "Declined." };
}

export async function adjustPoints(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireParent();
  const profileId = String(formData.get("profile_id") ?? "");
  const direction = formData.get("direction") === "take" ? -1 : 1;
  const amount = Math.round(Number(formData.get("amount") ?? 0));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!uuid.safeParse(profileId).success) return { error: "Something went wrong." };
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return { error: "Enter a number of points from 1 to 10,000." };
  if (!reason) return { error: "Add a short reason so they know what it's for." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_points", { target: profileId, change: direction * amount, reason });
  if (error) return { error: friendly(error.message) };
  if (direction > 0) await awardBadges(createAdminClient(), profileId);
  refresh();
  return { success: direction > 0 ? `Gave ${amount} points.` : `Took away ${amount} points.` };
}

// ---------------------------------------------------------------------------
// Reward store and point settings (parents)
// ---------------------------------------------------------------------------

const rewardSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Give the reward a name").max(60),
  emoji: z.string().min(1).max(8),
  cost: z.coerce.number().int().min(1, "Cost must be at least 1 point").max(100000),
  details: z.string().trim().max(200).default(""),
});

export async function saveReward(_prev: FormState, formData: FormData): Promise<FormState> {
  const { family } = await requireParent();
  const parsed = rewardSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    emoji: formData.get("emoji") || "🎁",
    cost: formData.get("cost"),
    details: formData.get("details") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("rewards").update(fields).eq("id", id)
    : await supabase.from("rewards").insert({ ...fields, family_id: family.id });
  if (error) return { error: `Couldn't save: ${error.message}` };
  refresh();
  return { success: id ? "Saved." : `Added "${fields.title}".` };
}

export async function setRewardActive(rewardId: string, active: boolean): Promise<Result> {
  await requireParent();
  if (!uuid.safeParse(rewardId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.from("rewards").update({ active }).eq("id", rewardId);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteReward(rewardId: string): Promise<Result> {
  await requireParent();
  if (!uuid.safeParse(rewardId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.from("rewards").delete().eq("id", rewardId);
  if (error) return { error: error.message };
  refresh();
  return {};
}

const settingsSchema = z.object({
  points_per_check_in: z.coerce.number().int().min(0).max(1000),
  streak_bonus: z.coerce.number().int().min(0).max(10000),
  milestone_points: z.coerce.number().int().min(0).max(10000),
  goal_points: z.coerce.number().int().min(0).max(100000),
});

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { family } = await requireParent();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Use whole numbers (0 turns that kind of points off)." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("family_settings")
    .upsert({ family_id: family.id, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: `Couldn't save: ${error.message}` };
  refresh();
  return { success: "Saved. New amounts apply from now on." };
}

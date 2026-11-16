"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember, requireParent } from "@/lib/auth";
import { loadGoal } from "@/lib/goals/data";
import { goalInput } from "@/lib/goals/schema";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

type ActionResult = { error?: string; success?: string };

const uuid = z.string().uuid();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ---------------------------------------------------------------------------
// Create / edit a goal and its plan
// ---------------------------------------------------------------------------

export async function saveGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireMember();
  const isParent = profile.role === "parent";

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Something went wrong reading the form. Please try again." };
  }
  const parsed = goalInput.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const input = parsed.data;
  if (input.activities.length === 0 && input.milestones.length === 0) {
    return { error: "Add at least one activity or milestone to your plan." };
  }
  if (!isParent && input.owner_id !== profile.id) {
    return { error: "You can only create goals for yourself." };
  }

  const supabase = await createClient();
  const fields = {
    title: input.title,
    why: input.why,
    emoji: input.emoji,
    target_date: input.target_date,
    visibility: input.visibility,
  };

  let goalId = input.id;

  if (!goalId) {
    const { data, error } = await supabase
      .from("goals")
      .insert({ ...fields, owner_id: input.owner_id, family_id: profile.family_id })
      .select("id")
      .single();
    if (error || !data) return { error: `Couldn't create the goal: ${error?.message}` };
    goalId = data.id as string;
  } else {
    const existing = await loadGoal(goalId);
    if (!existing) return { error: "That goal doesn't exist anymore." };
    if (!isParent && existing.owner_id !== profile.id) {
      return { error: "Only the goal's owner or a parent can change it." };
    }
    // A kid editing a declined goal sends it back for approval.
    const resubmit = !isParent && existing.status === "declined";
    const { error } = await supabase
      .from("goals")
      .update(resubmit ? { ...fields, status: "pending" } : fields)
      .eq("id", goalId);
    if (error) return { error: `Couldn't save the goal: ${error.message}` };

    // Activities removed from the form: delete if never used, otherwise archive (keeps history).
    const keepIds = new Set(input.activities.map((a) => a.id).filter(Boolean));
    const removed = existing.activities.filter((a) => !a.archived && !keepIds.has(a.id));
    if (removed.length) {
      const { data: used } = await supabase
        .from("check_ins")
        .select("activity_id")
        .in("activity_id", removed.map((a) => a.id));
      const usedIds = new Set((used ?? []).map((u) => u.activity_id as string));
      const toArchive = removed.filter((a) => usedIds.has(a.id)).map((a) => a.id);
      const toDelete = removed.filter((a) => !usedIds.has(a.id)).map((a) => a.id);
      if (toArchive.length) await supabase.from("activities").update({ archived: true }).in("id", toArchive);
      if (toDelete.length) await supabase.from("activities").delete().in("id", toDelete);
    }
    const keepMilestones = new Set(input.milestones.map((m) => m.id).filter(Boolean));
    const removedMilestones = existing.milestones.filter((m) => !keepMilestones.has(m.id)).map((m) => m.id);
    if (removedMilestones.length) await supabase.from("milestones").delete().in("id", removedMilestones);

    // Ignore ids that don't belong to this goal.
    const ownActivity = new Set(existing.activities.map((a) => a.id));
    const ownMilestone = new Map(existing.milestones.map((m) => [m.id, m]));
    input.activities = input.activities.map((a) => (a.id && ownActivity.has(a.id) ? a : { ...a, id: undefined }));
    input.milestones = input.milestones.map((m) => (m.id && ownMilestone.has(m.id) ? m : { ...m, id: undefined }));

    // Keep the original completion time of milestones that were already done.
    for (const m of input.milestones) {
      const before = m.id ? ownMilestone.get(m.id) : undefined;
      (m as { completed_at?: string | null }).completed_at = m.done
        ? (before?.completed_at ?? new Date().toISOString())
        : null;
    }
  }

  // Save activities in order.
  for (const [i, a] of input.activities.entries()) {
    const row = {
      title: a.title,
      tracking: a.tracking,
      target_amount: a.target_amount,
      unit: a.unit,
      schedule: a.schedule,
      weekdays: a.weekdays,
      times_per_week: a.times_per_week,
      sort_order: i,
      archived: false,
    };
    const { error } = a.id
      ? await supabase.from("activities").update(row).eq("id", a.id)
      : await supabase.from("activities").insert({ ...row, goal_id: goalId });
    if (error) return { error: `Couldn't save "${a.title}": ${error.message}` };
  }

  for (const [i, m] of input.milestones.entries()) {
    const completed_at =
      (m as { completed_at?: string | null }).completed_at ?? (m.done ? new Date().toISOString() : null);
    const row = { title: m.title, due_date: m.due_date, sort_order: i, completed_at };
    const { error } = m.id
      ? await supabase.from("milestones").update(row).eq("id", m.id)
      : await supabase.from("milestones").insert({ ...row, goal_id: goalId });
    if (error) return { error: `Couldn't save "${m.title}": ${error.message}` };
  }

  redirect(`/goals/${goalId}`);
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

// Sets one day's total for an activity. amount = null removes the check-in.
export async function setCheckIn(
  activityId: string,
  day: string,
  amount: number | null,
): Promise<ActionResult> {
  await requireMember();
  if (!uuid.safeParse(activityId).success || !isoDay.safeParse(day).success) {
    return { error: "Something went wrong. Please try again." };
  }
  const supabase = await createClient();

  if (amount === null || amount <= 0) {
    const { error } = await supabase.from("check_ins").delete().eq("activity_id", activityId).eq("day", day);
    if (error) return { error: friendlyDbError(error.message) };
  } else {
    const value = Math.min(10000, Math.round(amount));
    const { error } = await supabase
      .from("check_ins")
      .upsert({ activity_id: activityId, day, amount: value }, { onConflict: "activity_id,day" });
    if (error) return { error: friendlyDbError(error.message) };
  }
  refresh();
  return {};
}

function friendlyDbError(message: string): string {
  if (/today or yesterday/i.test(message)) return "You can only check in for today or yesterday.";
  if (/active goals/i.test(message)) return "This goal isn't active right now.";
  if (/row-level security|permission/i.test(message)) return "You can't change this one.";
  if (/only be removed by a parent/i.test(message)) return "Ask a parent to change older days.";
  return `Couldn't save: ${message}`;
}

// ---------------------------------------------------------------------------
// Milestones, approvals, status
// ---------------------------------------------------------------------------

export async function toggleMilestone(milestoneId: string, done: boolean): Promise<ActionResult> {
  await requireMember();
  if (!uuid.safeParse(milestoneId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq("id", milestoneId)
    .select("id");
  if (error || !data?.length) return { error: "You can't change this milestone." };
  refresh();
  return {};
}

export async function reviewGoal(
  goalId: string,
  decision: "approve" | "decline",
  note: string,
): Promise<ActionResult> {
  await requireParent();
  if (!uuid.safeParse(goalId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      status: decision === "approve" ? "active" : "declined",
      review_note: note.trim().slice(0, 300) || null,
    })
    .eq("id", goalId);
  if (error) return { error: `Couldn't save: ${error.message}` };
  refresh();
  return { success: decision === "approve" ? "Approved." : "Sent back." };
}

export async function setGoalStatus(
  goalId: string,
  status: "active" | "completed" | "archived",
): Promise<ActionResult> {
  await requireParent();
  if (!uuid.safeParse(goalId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.from("goals").update({ status }).eq("id", goalId);
  if (error) return { error: `Couldn't save: ${error.message}` };
  refresh();
  return {};
}

export async function deleteGoal(goalId: string): Promise<ActionResult> {
  await requireMember();
  if (!uuid.safeParse(goalId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").delete().eq("id", goalId).select("id");
  if (error || !data?.length) return { error: "You can't delete this goal." };
  redirect("/goals");
}

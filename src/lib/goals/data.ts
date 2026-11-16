import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "./dates";
import type { CheckIn, GoalWithPlan, Milestone } from "./types";

const GOAL_SELECT = "*, activities(*), milestones(*)";
export const HISTORY_DAYS = 120;

function sortPlan(goal: GoalWithPlan): GoalWithPlan {
  goal.activities.sort((a, b) => a.sort_order - b.sort_order);
  goal.milestones.sort(
    (a: Milestone, b: Milestone) =>
      a.sort_order - b.sort_order || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
  );
  return goal;
}

// Every goal the signed-in person may see (database rules do the filtering).
export async function loadVisibleGoals(): Promise<GoalWithPlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_SELECT)
    .order("created_at", { ascending: true })
    .returns<GoalWithPlan[]>();
  if (error) throw new Error(`Couldn't load goals: ${error.message}`);
  return (data ?? []).map(sortPlan);
}

export async function loadGoal(id: string): Promise<GoalWithPlan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(GOAL_SELECT)
    .eq("id", id)
    .maybeSingle<GoalWithPlan>();
  return data ? sortPlan(data) : null;
}

// Check-ins the signed-in person may see, from `days` ago until today.
export async function loadCheckIns(
  today: string,
  opts: { profileId?: string; activityIds?: string[]; days?: number } = {},
): Promise<CheckIn[]> {
  if (opts.activityIds && opts.activityIds.length === 0) return [];
  const supabase = await createClient();
  let query = supabase
    .from("check_ins")
    .select("id, activity_id, profile_id, day, amount, created_by, adjusted_by, adjusted_at")
    .gte("day", addDays(today, -(opts.days ?? HISTORY_DAYS)))
    .lte("day", today);
  if (opts.profileId) query = query.eq("profile_id", opts.profileId);
  if (opts.activityIds) query = query.in("activity_id", opts.activityIds);
  const { data, error } = await query.returns<CheckIn[]>();
  if (error) throw new Error(`Couldn't load check-ins: ${error.message}`);
  return data ?? [];
}

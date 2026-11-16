export type GoalStatus = "pending" | "active" | "completed" | "archived" | "declined";
export type GoalVisibility = "shared" | "private";
export type TrackingType = "check" | "minutes" | "count";
export type ScheduleType = "daily" | "weekdays" | "per_week";

export type Activity = {
  id: string;
  goal_id: string;
  title: string;
  tracking: TrackingType;
  target_amount: number | null;
  unit: string | null;
  schedule: ScheduleType;
  weekdays: number[];
  times_per_week: number | null;
  sort_order: number;
  archived: boolean;
  created_at: string;
};

export type Milestone = {
  id: string;
  goal_id: string;
  title: string;
  due_date: string | null;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
};

export type Goal = {
  id: string;
  family_id: string;
  owner_id: string;
  title: string;
  why: string;
  emoji: string;
  target_date: string | null;
  visibility: GoalVisibility;
  status: GoalStatus;
  created_by: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  completed_at: string | null;
  created_at: string;
};

export type GoalWithPlan = Goal & { activities: Activity[]; milestones: Milestone[] };

export type CheckIn = {
  id: string;
  activity_id: string;
  profile_id: string;
  day: string; // YYYY-MM-DD
  amount: number;
  created_by: string | null;
  adjusted_by: string | null;
  adjusted_at: string | null;
};

export const GOAL_EMOJIS = [
  "🎯", "📖", "🙏", "✝️", "🇪🇸", "📚", "✏️", "🧠", "🎹", "🎸", "🎻", "🎨",
  "⚽", "🏀", "🏐", "🎾", "🏊", "🏃", "⛸️", "🥋", "💪", "🧘", "🧹", "💰",
] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

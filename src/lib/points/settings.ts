export type PointSettings = {
  points_per_check_in: number;
  streak_bonus: number;
  milestone_points: number;
  goal_points: number;
};

export const DEFAULT_SETTINGS: PointSettings = {
  points_per_check_in: 10,
  streak_bonus: 25,
  milestone_points: 50,
  goal_points: 200,
};

// Streak bonus every 7 days in a row (daily / certain-days activities),
// or every 4 weeks in a row (days-a-week activities).
export const STREAK_BONUS_DAYS = 7;
export const STREAK_BONUS_WEEKS = 4;

// Badge definitions. Earned badges are stored in the badges_earned table.

export type BadgeStats = {
  checkIns: number;
  bestDayStreak: number;
  bestWeekStreak: number;
  milestones: number;
  goals: number;
  pointsEarned: number;
  rewards: number;
};

export type Badge = {
  key: string;
  emoji: string;
  name: string;
  description: string;
  earned: (s: BadgeStats) => boolean;
};

export const BADGES: Badge[] = [
  { key: "first_check", emoji: "✅", name: "First check", description: "Check off your first activity", earned: (s) => s.checkIns >= 1 },
  { key: "streak_7", emoji: "🔥", name: "On fire", description: "7 days in a row", earned: (s) => s.bestDayStreak >= 7 },
  { key: "weeks_4", emoji: "📅", name: "Steady", description: "4 weeks in a row on a weekly plan", earned: (s) => s.bestWeekStreak >= 4 },
  { key: "checks_50", emoji: "🧱", name: "Building habits", description: "50 check-ins", earned: (s) => s.checkIns >= 50 },
  { key: "first_milestone", emoji: "🪜", name: "Step up", description: "Finish your first milestone", earned: (s) => s.milestones >= 1 },
  { key: "streak_30", emoji: "🌋", name: "Unstoppable", description: "30 days in a row", earned: (s) => s.bestDayStreak >= 30 },
  { key: "points_500", emoji: "⭐", name: "Rising star", description: "Earn 500 points", earned: (s) => s.pointsEarned >= 500 },
  { key: "first_goal", emoji: "🏆", name: "Goal getter", description: "Reach a goal", earned: (s) => s.goals >= 1 },
  { key: "first_reward", emoji: "🎁", name: "Treat yo self", description: "Cash in your first reward", earned: (s) => s.rewards >= 1 },
  { key: "checks_250", emoji: "🏰", name: "Habit castle", description: "250 check-ins", earned: (s) => s.checkIns >= 250 },
  { key: "streak_100", emoji: "💯", name: "Legend", description: "100 days in a row", earned: (s) => s.bestDayStreak >= 100 },
  { key: "points_2000", emoji: "🌟", name: "Superstar", description: "Earn 2,000 points", earned: (s) => s.pointsEarned >= 2000 },
];

export const BADGE_BY_KEY = new Map(BADGES.map((b) => [b.key, b]));

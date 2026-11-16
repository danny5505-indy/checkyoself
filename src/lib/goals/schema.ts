import { z } from "zod";

// Validation for the goal form. The database checks the same rules again.
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

export const activityInput = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Give each activity a name").max(80),
    tracking: z.enum(["check", "minutes", "count"]),
    target_amount: z.number().int().min(1).max(10000).nullable(),
    unit: z.string().trim().max(30).nullable(),
    schedule: z.enum(["daily", "weekdays", "per_week"]),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    times_per_week: z.number().int().min(1).max(7).nullable(),
  })
  .superRefine((a, ctx) => {
    if (a.tracking !== "check" && !a.target_amount) {
      ctx.addIssue({ code: "custom", message: `Set a daily target for "${a.title}"` });
    }
    if (a.schedule === "weekdays" && a.weekdays.length === 0) {
      ctx.addIssue({ code: "custom", message: `Pick at least one day for "${a.title}"` });
    }
    if (a.schedule === "per_week" && !a.times_per_week) {
      ctx.addIssue({ code: "custom", message: `Choose how many days a week for "${a.title}"` });
    }
  })
  .transform((a) => ({
    ...a,
    target_amount: a.tracking === "check" ? null : a.target_amount,
    unit: a.tracking === "count" ? a.unit || null : null,
    weekdays: a.schedule === "weekdays" ? [...new Set(a.weekdays)] : [],
    times_per_week: a.schedule === "per_week" ? a.times_per_week : null,
  }));

export const milestoneInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Give each milestone a name").max(120),
  due_date: day.nullable(),
  done: z.boolean().default(false),
});

export const goalInput = z.object({
  id: z.string().uuid().optional(),
  owner_id: z.string().uuid(),
  title: z.string().trim().min(1, "Give your goal a name").max(80),
  why: z.string().trim().max(500),
  emoji: z.string().min(1).max(8),
  target_date: day.nullable(),
  visibility: z.enum(["shared", "private"]),
  activities: z.array(activityInput).max(20),
  milestones: z.array(milestoneInput).max(30),
});

export type GoalInput = z.input<typeof goalInput>;
export type ActivityInput = z.input<typeof activityInput>;
export type MilestoneInput = z.input<typeof milestoneInput>;

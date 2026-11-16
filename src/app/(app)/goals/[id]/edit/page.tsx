import { notFound, redirect } from "next/navigation";
import { GoalForm } from "@/components/goals/goal-form";
import { PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { loadFamily } from "@/lib/family";
import { loadGoal } from "@/lib/goals/data";

export const metadata = { title: "Edit goal" };

export default async function EditGoalPage({ params }: PageProps<"/goals/[id]/edit">) {
  const { id } = await params;
  const { profile } = await requireMember();
  const goal = await loadGoal(id);
  if (!goal) notFound();
  if (profile.role !== "parent" && goal.owner_id !== profile.id) redirect(`/goals/${id}`);
  const family = await loadFamily();

  const resubmit = profile.role !== "parent" && goal.status === "declined";

  return (
    <>
      <PageHeader title="Edit goal" />
      <GoalForm
        me={profile}
        family={family}
        submitLabel={resubmit ? "Send for approval again" : "Save changes"}
        initial={{
          id: goal.id,
          owner_id: goal.owner_id,
          title: goal.title,
          why: goal.why,
          emoji: goal.emoji,
          target_date: goal.target_date,
          visibility: goal.visibility,
          activities: goal.activities
            .filter((a) => !a.archived)
            .map((a) => ({
              id: a.id,
              title: a.title,
              tracking: a.tracking,
              target_amount: a.target_amount,
              unit: a.unit,
              schedule: a.schedule,
              weekdays: a.weekdays.length ? a.weekdays : [1, 2, 3, 4, 5],
              times_per_week: a.times_per_week ?? 3,
            })),
          milestones: goal.milestones.map((m) => ({
            id: m.id,
            title: m.title,
            due_date: m.due_date,
            done: Boolean(m.completed_at),
          })),
        }}
      />
    </>
  );
}

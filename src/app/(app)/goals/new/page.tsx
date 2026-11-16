import { GoalForm } from "@/components/goals/goal-form";
import { PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { loadFamily } from "@/lib/family";

export const metadata = { title: "New goal" };

export default async function NewGoalPage() {
  const { profile } = await requireMember();
  const family = await loadFamily();
  return (
    <>
      <PageHeader title="New goal" subtitle="Decide where you're going, then plan how to get there." />
      <GoalForm me={profile} family={family} submitLabel={profile.role === "parent" ? "Create goal" : "Send for approval"} />
    </>
  );
}

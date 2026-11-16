import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ChevronRight } from "@/components/icons";
import type { GoalProgress } from "@/lib/goals/progress";
import type { GoalWithPlan } from "@/lib/goals/types";
import type { Profile } from "@/lib/types";
import { GoalStatusBadge, PrivateBadge, TrackBadge } from "./badges";

export function GoalCard({
  goal,
  progress,
  owner,
  showOwner = false,
}: {
  goal: GoalWithPlan;
  progress: GoalProgress;
  owner?: Profile;
  showOwner?: boolean;
}) {
  const activeCount = goal.activities.filter((a) => !a.archived).length;
  const milestoneCount = goal.milestones.length;
  return (
    <Link
      href={`/goals/${goal.id}`}
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/50"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-canvas text-2xl" aria-hidden="true">
        {goal.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{goal.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {goal.status === "active" ? <TrackBadge status={progress.status} /> : <GoalStatusBadge status={goal.status} />}
          {goal.visibility === "private" && <PrivateBadge />}
          <span className="text-xs text-muted">
            {activeCount} {activeCount === 1 ? "activity" : "activities"}
            {milestoneCount > 0 && ` · ${progress.milestonesDone}/${milestoneCount} milestones`}
          </span>
        </div>
      </div>
      {showOwner && owner && <Avatar name={owner.display_name} color={owner.color} size="sm" />}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
    </Link>
  );
}

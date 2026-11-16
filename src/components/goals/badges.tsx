import type { TrackStatus } from "@/lib/goals/progress";
import { STATUS_LABEL } from "@/lib/goals/progress";
import type { GoalStatus } from "@/lib/goals/types";

const TRACK_STYLE: Record<TrackStatus, string> = {
  on_track: "bg-brand/12 text-brand-strong",
  slipping: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  off_track: "bg-danger/12 text-danger",
  new: "bg-line/70 text-muted",
};

export function TrackBadge({ status }: { status: TrackStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${TRACK_STYLE[status]}`}>
      <span aria-hidden="true">{status === "on_track" ? "●" : status === "new" ? "○" : "▲"}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

const GOAL_STATUS: Partial<Record<GoalStatus, { label: string; style: string }>> = {
  pending: { label: "Waiting for approval", style: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  declined: { label: "Needs changes", style: "bg-danger/12 text-danger" },
  completed: { label: "Completed 🎉", style: "bg-brand/12 text-brand-strong" },
  archived: { label: "Archived", style: "bg-line/70 text-muted" },
};

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const s = GOAL_STATUS[status];
  if (!s) return null;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${s.style}`}>{s.label}</span>;
}

export function PrivateBadge() {
  return (
    <span className="inline-flex rounded-full bg-line/70 px-2 py-0.5 text-xs font-semibold text-muted">
      🔒 Private
    </span>
  );
}

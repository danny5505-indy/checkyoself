"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleMilestone } from "@/app/(app)/goals/actions";
import type { Milestone } from "@/lib/goals/types";

export function MilestoneList({
  milestones,
  canEdit,
  today,
  dateLabels,
}: {
  milestones: Milestone[];
  canEdit: boolean;
  today: string;
  dateLabels: Record<string, string>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    milestones,
    (state, change: { id: string; done: boolean }) =>
      state.map((m) => (m.id === change.id ? { ...m, completed_at: change.done ? "now" : null } : m)),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <ul className="space-y-2">
        {optimistic.map((m) => {
          const done = Boolean(m.completed_at);
          const overdue = !done && m.due_date && m.due_date < today;
          return (
            <li key={m.id}>
              <label className={`flex items-start gap-3 ${canEdit ? "cursor-pointer" : ""}`}>
                <input
                  type="checkbox"
                  checked={done}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setError(null);
                    startTransition(async () => {
                      setOptimistic({ id: m.id, done: next });
                      const r = await toggleMilestone(m.id, next);
                      if (r.error) setError(r.error);
                    });
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
                />
                <span className="min-w-0">
                  <span className={`block font-medium ${done ? "text-muted line-through" : "text-ink"}`}>
                    {m.title}
                  </span>
                  {m.due_date && (
                    <span className={`text-xs ${overdue ? "font-semibold text-danger" : "text-muted"}`}>
                      {overdue ? "Overdue · " : "By "}
                      {dateLabels[m.due_date]}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteGoal, reviewGoal, setGoalStatus } from "@/app/(app)/goals/actions";
import type { GoalStatus } from "@/lib/goals/types";

const btn = "rounded-xl px-4 py-2 font-semibold transition disabled:opacity-60";

export function ReviewButtons({ goalId, ownerName }: { goalId: string; ownerName: string }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const decide = (decision: "approve" | "decline") =>
    startTransition(async () => {
      const r = await reviewGoal(goalId, decision, note);
      setMessage(r.error ?? r.success ?? null);
    });

  return (
    <div className="space-y-2">
      {showNote && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            What should {ownerName} change? (optional)
          </span>
          <textarea
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-16 w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-brand"
          />
        </label>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => decide("approve")} className={`${btn} flex-1 bg-brand text-white`}>
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => (showNote ? decide("decline") : setShowNote(true))}
          className={`${btn} flex-1 border border-line bg-surface text-ink`}
        >
          {showNote ? "Send back" : "Needs changes"}
        </button>
      </div>
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}

export function GoalActions({
  goalId,
  status,
  isParent,
  isOwner,
}: {
  goalId: string;
  status: GoalStatus;
  isParent: boolean;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canEdit = isParent || isOwner;
  const canDelete = isParent || (isOwner && (status === "pending" || status === "declined"));

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canEdit && status !== "completed" && status !== "archived" && (
          <Link href={`/goals/${goalId}/edit`} className={`${btn} border border-line bg-surface text-ink`}>
            Edit goal &amp; plan
          </Link>
        )}
        {isParent && status === "active" && (
          <button type="button" disabled={pending} onClick={() => run(() => setGoalStatus(goalId, "completed"))} className={`${btn} bg-brand text-white`}>
            Mark goal reached 🎉
          </button>
        )}
        {isParent && status === "active" && (
          <button type="button" disabled={pending} onClick={() => run(() => setGoalStatus(goalId, "archived"))} className={`${btn} border border-line bg-surface text-ink`}>
            Archive
          </button>
        )}
        {isParent && (status === "completed" || status === "archived") && (
          <button type="button" disabled={pending} onClick={() => run(() => setGoalStatus(goalId, "active"))} className={`${btn} border border-line bg-surface text-ink`}>
            Make active again
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Delete this goal and all its progress? This can't be undone.")) {
                run(() => deleteGoal(goalId));
              }
            }}
            className={`${btn} border border-danger/40 bg-surface text-danger`}
          >
            Delete
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

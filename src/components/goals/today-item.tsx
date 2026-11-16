"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setCheckIn } from "@/app/(app)/goals/actions";
import { CheckMark } from "@/components/logo";
import type { Activity } from "@/lib/goals/types";

type Props = {
  activity: Activity;
  goal: { id: string; title: string; emoji: string };
  day: string;
  amount: number | undefined;
  weekProgress?: { done: number; target: number };
  streak: { count: number; unit: "day" | "week" };
};

const QUICK = { minutes: [5, 10, 15], count: [1, 5, 10] } as const;

export function TodayItem({ activity, goal, day, amount, weekProgress, streak }: Props) {
  const [optimisticAmount, setOptimisticAmount] = useOptimistic(amount);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const target = activity.target_amount ?? 1;
  const current = optimisticAmount ?? 0;
  const done = activity.tracking === "check" ? current > 0 : current >= target;
  const partial = !done && current > 0;
  const unitLabel = activity.tracking === "minutes" ? "min" : activity.unit || "";

  function save(next: number | null) {
    setError(null);
    startTransition(async () => {
      setOptimisticAmount(next && next > 0 ? next : undefined);
      const result = await setCheckIn(activity.id, day, next);
      if (result.error) setError(result.error);
    });
  }

  function toggle() {
    if (done) save(null);
    else save(activity.tracking === "check" ? 1 : target);
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? `Mark ${activity.title} not done` : `Mark ${activity.title} done`}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition active:scale-95 ${
            done
              ? "border-brand bg-brand text-white"
              : partial
                ? "border-brand bg-brand/15 text-brand-strong"
                : "border-line bg-surface text-transparent hover:border-brand/60"
          }`}
        >
          <CheckMark className="h-6 w-6" />
        </button>

        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${done ? "text-muted line-through decoration-2" : "text-ink"}`}>
            {activity.title}
          </p>
          <p className="truncate text-xs text-muted">
            <Link href={`/goals/${goal.id}`} className="hover:underline">
              {goal.emoji} {goal.title}
            </Link>
            {weekProgress && ` · ${weekProgress.done}/${weekProgress.target} this week`}
            {streak.count > 1 && ` · 🔥 ${streak.count}-${streak.unit} streak`}
          </p>
        </div>

        {activity.tracking !== "check" && (
          <button
            type="button"
            onClick={() => {
              setDraft(current ? String(current) : "");
              setEditing((v) => !v);
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-right text-sm font-semibold text-ink hover:bg-canvas"
            aria-expanded={editing}
            aria-label={`Log ${unitLabel || "amount"} for ${activity.title}`}
          >
            {current}/{target}
            <span className="block text-[11px] font-medium text-muted">{unitLabel}</span>
          </button>
        )}
      </div>

      {editing && activity.tracking !== "check" && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="flex flex-wrap gap-2">
            {QUICK[activity.tracking].map((n) => (
              <button
                key={n}
                type="button"
                disabled={pending}
                onClick={() => {
                  const next = current + n;
                  setDraft(String(next));
                  save(next);
                }}
                className="rounded-full border border-line px-3 py-1 text-sm font-semibold text-ink hover:border-brand"
              >
                +{n}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(draft);
              save(Number.isFinite(n) && n > 0 ? n : null);
              setEditing(false);
            }}
          >
            <label className="sr-only" htmlFor={`amt-${activity.id}`}>
              Total {unitLabel} today
            </label>
            <input
              id={`amt-${activity.id}`}
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
              placeholder={`Total ${unitLabel} today`}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-brand"
            />
            <button type="submit" className="rounded-xl bg-brand px-4 font-semibold text-white">
              Save
            </button>
          </form>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

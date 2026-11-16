"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setCheckIn } from "@/app/(app)/goals/actions";
import type { Activity } from "@/lib/goals/types";

type Cell = {
  day: string;
  label: string; // e.g. "Mon"
  dateLabel: string; // e.g. "Mon, Nov 16"
  scheduled: boolean;
  editable: boolean;
};

export function HistoryGrid({
  activity,
  cells,
  amounts,
  adjustedDays,
  overrideMode,
}: {
  activity: Activity;
  cells: Cell[];
  amounts: Record<string, number>;
  adjustedDays: string[];
  overrideMode: boolean; // a parent editing someone else's progress
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    amounts,
    (state, change: { day: string; amount: number | null }) => {
      const next = { ...state };
      if (change.amount) next[change.day] = change.amount;
      else delete next[change.day];
      return next;
    },
  );
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const target = activity.target_amount ?? 1;
  const ratio = (day: string) => {
    const a = optimistic[day];
    if (!a) return 0;
    return activity.tracking === "check" ? 1 : Math.min(1, a / target);
  };

  function save(day: string, amount: number | null) {
    setError(null);
    startTransition(async () => {
      setOptimistic({ day, amount });
      const result = await setCheckIn(activity.id, day, amount);
      if (result.error) setError(result.error);
    });
    setOpen(null);
  }

  const openCell = cells.find((c) => c.day === open);
  const unit = activity.tracking === "minutes" ? "minutes" : activity.unit || "count";

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c) => {
          const r = ratio(c.day);
          const adjusted = adjustedDays.includes(c.day);
          const content = (
            <>
              <span className="text-[10px] font-medium text-muted">{c.label}</span>
              <span
                className={`relative grid h-8 w-full place-items-center rounded-lg text-xs font-bold ${
                  r >= 1
                    ? "bg-brand text-white"
                    : r > 0
                      ? "bg-brand/30 text-brand-strong"
                      : c.scheduled
                        ? "bg-line/80 text-transparent"
                        : "bg-transparent text-transparent ring-1 ring-inset ring-line"
                }`}
              >
                {r >= 1 ? "✓" : r > 0 ? Math.round(r * 100) + "%" : "·"}
                {adjusted && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                )}
              </span>
            </>
          );
          const title = `${c.dateLabel}: ${optimistic[c.day] ? (activity.tracking === "check" ? "done" : `${optimistic[c.day]} ${unit}`) : "not done"}${adjusted ? " (adjusted by a parent)" : ""}`;
          return c.editable ? (
            <button
              key={c.day}
              type="button"
              disabled={pending}
              title={title}
              aria-label={`${title}. Tap to change.`}
              onClick={() => {
                setDraft(optimistic[c.day] ? String(optimistic[c.day]) : String(target));
                setOpen(open === c.day ? null : c.day);
              }}
              className={`flex flex-col items-center gap-1 rounded-lg p-0.5 ${open === c.day ? "ring-2 ring-brand" : ""}`}
            >
              {content}
            </button>
          ) : (
            <div key={c.day} title={title} aria-label={title} className="flex flex-col items-center gap-1 p-0.5">
              {content}
            </div>
          );
        })}
      </div>

      {openCell && (
        <div className="mt-3 space-y-2 rounded-xl bg-canvas p-3">
          <p className="text-sm font-semibold text-ink">
            {openCell.dateLabel}
            {overrideMode && <span className="font-normal text-muted"> · parent adjustment</span>}
          </p>
          {activity.tracking === "check" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => save(openCell.day, 1)}
                className="flex-1 rounded-xl bg-brand py-2 font-semibold text-white"
              >
                Mark done
              </button>
              <button
                type="button"
                onClick={() => save(openCell.day, null)}
                className="flex-1 rounded-xl border border-line bg-surface py-2 font-semibold text-ink"
              >
                Not done
              </button>
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(draft);
                save(openCell.day, n > 0 ? n : null);
              }}
            >
              <label className="sr-only" htmlFor={`h-${activity.id}`}>
                {unit}
              </label>
              <input
                id={`h-${activity.id}`}
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-brand"
                placeholder={unit}
              />
              <button type="submit" className="rounded-xl bg-brand px-4 font-semibold text-white">
                Save
              </button>
              <button
                type="button"
                onClick={() => save(openCell.day, null)}
                className="rounded-xl border border-line bg-surface px-3 font-semibold text-ink"
              >
                Clear
              </button>
            </form>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

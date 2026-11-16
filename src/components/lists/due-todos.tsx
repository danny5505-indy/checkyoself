"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setItemDone } from "@/app/(app)/lists/actions";
import { CheckMark } from "@/components/logo";

type Todo = { id: string; text: string; due_date: string; overdue: boolean; dueLabel: string; listId: string; listTitle: string; listEmoji: string };

export function DueTodos({ todos }: { todos: Todo[] }) {
  const [done, markDone] = useOptimistic<string[], string>([], (state, id) => [...state, id]);
  const [, startTransition] = useTransition();
  const visible = todos.filter((t) => !done.includes(t.id));
  if (!visible.length) return null;
  return (
    <section aria-labelledby="todos-heading" className="space-y-2">
      <h2 id="todos-heading" className="text-lg font-bold text-ink">
        To-dos due
      </h2>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {visible.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              aria-label={`Check ${t.text}`}
              onClick={() =>
                startTransition(async () => {
                  markDone(t.id);
                  await setItemDone(t.id, true);
                })
              }
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 border-line text-transparent hover:border-brand/60"
            >
              <CheckMark className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ink">{t.text}</p>
              <p className="text-xs text-muted">
                <span className={t.overdue ? "font-semibold text-danger" : ""}>
                  {t.overdue ? `Overdue · ${t.dueLabel}` : "Due today"}
                </span>
                {" · "}
                <Link href={`/lists/${t.listId}`} className="hover:underline">
                  {t.listEmoji} {t.listTitle}
                </Link>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

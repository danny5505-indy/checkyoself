"use client";

import { useActionState, useState, useTransition } from "react";
import { createList, deleteList, updateList } from "@/app/(app)/lists/actions";
import { Avatar } from "@/components/avatar";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { KIND_INFO, LIST_EMOJIS, type List, type ListKind } from "@/lib/lists/types";

type Member = { id: string; display_name: string; color: string; role: "parent" | "kid" };

export function ListForm({
  others,
  list,
  shares = [],
}: {
  others: Member[];
  list?: List;
  shares?: string[];
}) {
  const [state, action] = useActionState(list ? updateList : createList, undefined);
  const [kind, setKind] = useState<ListKind>(list?.kind ?? "checklist");
  const [emoji, setEmoji] = useState(list?.emoji ?? "📝");
  const [shared, setShared] = useState<string[]>(shares);
  const [perPerson, setPerPerson] = useState(list?.per_person ?? false);

  const isGrocery = kind === "grocery";

  return (
    <form action={action} className="space-y-5">
      {list && <input type="hidden" name="list_id" value={list.id} />}
      <input type="hidden" name="emoji" value={emoji} />
      <input type="hidden" name="kind" value={kind} />
      {shared.map((id) => (
        <input key={id} type="hidden" name="shares" value={id} />
      ))}
      {perPerson && <input type="hidden" name="per_person" value="on" />}

      {!list && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">What kind of list?</legend>
          <div className="grid gap-2">
            {(["checklist", "wishlist", "todo"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  if (emoji === "📝" || emoji === "🎁" || emoji === "📌") setEmoji(k === "wishlist" ? "🎁" : k === "todo" ? "📌" : "📝");
                }}
                className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                  kind === k ? "border-brand bg-brand/5" : "border-line bg-surface"
                }`}
              >
                <span className="text-2xl" aria-hidden="true">{KIND_INFO[k].emoji}</span>
                <span>
                  <span className="block font-semibold text-ink">{KIND_INFO[k].label}</span>
                  <span className="block text-sm text-muted">{KIND_INFO[k].blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <Field
        label="Name"
        name="title"
        maxLength={60}
        defaultValue={list?.title}
        placeholder={kind === "wishlist" ? "Christmas list" : kind === "todo" ? "My to-dos" : "Beach trip packing"}
        required
      />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Icon</legend>
        <div className="flex flex-wrap gap-1.5">
          {(isGrocery ? ["🛒", ...LIST_EMOJIS] : LIST_EMOJIS).map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={emoji === e}
              aria-label={`Icon ${e}`}
              onClick={() => setEmoji(e)}
              className={`grid h-10 w-10 place-items-center rounded-xl border text-xl ${
                emoji === e ? "border-brand bg-brand/10" : "border-transparent bg-canvas"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>

      {!isGrocery && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">Share with</legend>
          <p className="mb-2 text-xs text-muted">
            {kind === "wishlist"
              ? "They can see your list and secretly mark things bought. You'll never see what's marked."
              : "They can see the list and add or check off items."}
          </p>
          <div className="flex flex-wrap gap-2">
            {others.map((m) => {
              const on = shared.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setShared(on ? shared.filter((x) => x !== m.id) : [...shared, m.id])}
                  className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 font-medium ${
                    on ? "border-brand bg-brand/10 text-brand-strong" : "border-line text-ink"
                  }`}
                >
                  <Avatar name={m.display_name} color={m.color} size="sm" />
                  {m.display_name}
                </button>
              );
            })}
            {others.length === 0 && <p className="text-sm text-muted">Add family members first to share lists.</p>}
          </div>
          {kind === "wishlist" && others.some((m) => m.role === "parent") && (
            <button
              type="button"
              onClick={() => setShared([...new Set([...shared, ...others.filter((m) => m.role === "parent").map((m) => m.id)])])}
              className="mt-2 text-sm font-semibold text-brand-strong"
            >
              + Share with parents
            </button>
          )}
        </fieldset>
      )}

      {kind === "checklist" && (
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
          <input
            type="checkbox"
            checked={perPerson}
            onChange={(e) => setPerPerson(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[var(--brand)]"
          />
          <span>
            <span className="block font-semibold text-ink">Everyone checks off their own copy</span>
            <span className="block text-sm text-muted">
              Great for packing lists: each person ticks their own items and you see everyone&apos;s progress.
            </span>
          </span>
        </label>
      )}

      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">{list ? "Save list" : "Create list"}</SubmitButton>
    </form>
  );
}

export function DeleteListButton({ listId }: { listId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Delete this list and everything on it?")) {
            startTransition(async () => {
              const r = await deleteList(listId);
              if (r?.error) setError(r.error);
            });
          }
        }}
        className="w-full rounded-xl border border-danger/40 bg-surface px-4 py-2.5 font-semibold text-danger"
      >
        Delete list
      </button>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

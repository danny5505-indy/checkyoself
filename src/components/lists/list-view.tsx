"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import {
  addItem,
  clearDone,
  deleteItem,
  setClaim,
  setItemDone,
  updateItem,
  type ItemFields,
} from "@/app/(app)/lists/actions";
import { Avatar } from "@/components/avatar";
import { CheckMark } from "@/components/logo";
import type { List, ListItem } from "@/lib/lists/types";
import { browserClient } from "@/lib/supabase/client";

type Member = { id: string; display_name: string; color: string };

type Props = {
  list: List;
  items: ListItem[];
  meId: string;
  members: Member[];
  canEditItems: boolean;
  isOwner: boolean;
  checks: { item_id: string; profile_id: string }[];
  claims: { item_id: string; claimed_by: string }[];
  checkers: string[]; // who checks off their own copy (per-person lists)
  today: string;
  dueLabels: Record<string, string>;
};

const input =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";

// Re-fetches the page when someone else changes this list.
function useLiveList(listId: string) {
  const router = useRouter();
  useEffect(() => {
    const supabase = browserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    (async () => {
      // Sign the live connection in first, or the database rules send it nothing.
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`list-${listId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "list_items", filter: `list_id=eq.${listId}` }, refreshSoon)
        .on("postgres_changes", { event: "*", schema: "public", table: "item_checks" }, refreshSoon)
        .subscribe();
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [listId, router]);
}

type Change =
  | { type: "toggle"; id: string; done: boolean }
  | { type: "add"; item: ListItem }
  | { type: "remove"; id: string }
  | { type: "claim"; id: string; claimed: boolean }
  | { type: "clear" };

export function ListView(props: Props) {
  const { list, meId, members, canEditItems, isOwner, today } = props;
  useLiveList(list.id);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const myChecks = new Set(props.checks.filter((c) => c.profile_id === meId).map((c) => c.item_id));
  const baseItems = props.items.map((i) => ({ ...i, done: list.per_person ? myChecks.has(i.id) : i.done }));
  const [items, apply] = useOptimistic(baseItems, (state, change: Change) => {
    switch (change.type) {
      case "toggle":
        return state.map((i) => (i.id === change.id ? { ...i, done: change.done } : i));
      case "add":
        return [...state, change.item];
      case "remove":
        return state.filter((i) => i.id !== change.id);
      case "clear":
        return state.filter((i) => !i.done);
      default:
        return state;
    }
  });
  const [claims, applyClaim] = useOptimistic(
    props.claims,
    (state, change: { id: string; claimed: boolean }) =>
      change.claimed
        ? [...state, { item_id: change.id, claimed_by: meId }]
        : state.filter((c) => !(c.item_id === change.id && c.claimed_by === meId)),
  );

  const run = (optimistic: () => void, action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      optimistic();
      const r = await action();
      if (r.error) setError(r.error);
    });
  };

  const memberById = new Map(members.map((m) => [m.id, m]));
  const isWishViewer = list.kind === "wishlist" && !isOwner;
  const checkable = list.kind !== "wishlist";

  // Order: open items first (to-dos by due date), then done items.
  const sorted = [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (list.kind === "todo") return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    return 0;
  });
  const open = sorted.filter((i) => !i.done || !checkable);
  const done = checkable ? sorted.filter((i) => i.done) : [];

  return (
    <div className="space-y-4">
      {list.per_person && props.checkers.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Progress">
          {props.checkers.map((id) => {
            const m = memberById.get(id);
            if (!m) return null;
            const count = id === meId ? items.filter((i) => i.done).length : props.checks.filter((c) => c.profile_id === id).length;
            return (
              <span key={id} className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm">
                <Avatar name={m.display_name} color={m.color} size="sm" />
                <span className="font-semibold text-ink">
                  {id === meId ? "You" : m.display_name}
                </span>
                <span className="text-muted">
                  {count}/{items.length}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {canEditItems && (
        <AddItemForm
          list={list}
          onAdd={(fields) =>
            run(
              () =>
                apply({
                  type: "add",
                  item: {
                    id: `temp-${Math.random()}`,
                    list_id: list.id,
                    text: fields.text,
                    quantity: fields.quantity ?? null,
                    notes: fields.notes ?? null,
                    link: fields.link ?? null,
                    due_date: fields.due_date ?? null,
                    done: false,
                    done_by: null,
                    added_by: meId,
                    sort_order: 0,
                    created_at: new Date().toISOString(),
                  },
                }),
              () => addItem(list.id, fields),
            )
          }
        />
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center text-muted">
          {canEditItems ? "Nothing here yet. Add the first item above." : "Nothing on this list yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {[...open, ...done].flatMap((item, index) => {
            const showDoneHeading = checkable && done.length > 0 && index === open.length;
            const claim = claims.find((c) => c.item_id === item.id);
            const whoChecked = list.per_person
              ? props.checks.filter((c) => c.item_id === item.id && c.profile_id !== meId).map((c) => memberById.get(c.profile_id))
              : [];
            return [
              showDoneHeading ? (
                <li key="done-heading" className="flex items-center justify-between bg-canvas px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {list.kind === "grocery" ? "In the cart" : "Done"} · {done.length}
                  </span>
                  {!list.per_person && canEditItems && (
                    <button
                      type="button"
                      onClick={() => run(() => apply({ type: "clear" }), () => clearDone(list.id))}
                      className="text-xs font-semibold text-brand-strong"
                    >
                      Clear {list.kind === "grocery" ? "cart" : "done"}
                    </button>
                  )}
                </li>
              ) : null,
              <ItemRow
                key={item.id}
                item={item}
                list={list}
                checkable={checkable}
                canEdit={canEditItems && !item.id.startsWith("temp-")}
                addedBy={item.added_by && item.added_by !== meId && list.kind === "grocery" ? memberById.get(item.added_by) : undefined}
                whoChecked={whoChecked.filter((m): m is Member => Boolean(m))}
                overdue={list.kind === "todo" && !item.done && !!item.due_date && item.due_date < today}
                dueLabel={item.due_date ? props.dueLabels[item.due_date] : undefined}
                onToggle={() =>
                  run(() => apply({ type: "toggle", id: item.id, done: !item.done }), () => setItemDone(item.id, !item.done))
                }
                onDelete={() => run(() => apply({ type: "remove", id: item.id }), () => deleteItem(item.id))}
                onSave={(fields) => run(() => {}, () => updateItem(item.id, fields))}
                wish={
                  isWishViewer
                    ? {
                        claimedBy: claim ? memberById.get(claim.claimed_by) : undefined,
                        mine: claim?.claimed_by === meId,
                        onClaim: (claimed: boolean) =>
                          run(() => applyClaim({ id: item.id, claimed }), () => setClaim(item.id, claimed)),
                      }
                    : undefined
                }
              />,
            ].filter(Boolean);
          })}
        </ul>
      )}

      {isWishViewer && (
        <p className="text-xs text-muted">
          🤫 {memberById.get(list.owner_id)?.display_name ?? "The owner"} can&apos;t see what&apos;s been marked bought.
        </p>
      )}
      {list.kind === "wishlist" && isOwner && (
        <p className="text-xs text-muted">Add links so people know exactly what you mean.</p>
      )}
    </div>
  );
}

function AddItemForm({ list, onAdd }: { list: List; onAdd: (fields: ItemFields) => void }) {
  const [text, setText] = useState("");
  const [quantity, setQuantity] = useState("");
  const [due, setDue] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const textRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd({ text, quantity, due_date: due, link, notes });
        setText("");
        setQuantity("");
        setLink("");
        setNotes("");
        textRef.current?.focus();
      }}
    >
      <div className="flex gap-2">
        <input
          ref={textRef}
          aria-label="New item"
          className={input}
          value={text}
          maxLength={200}
          placeholder={
            { grocery: "Add milk, eggs…", checklist: "Add an item", wishlist: "Something you'd love", todo: "Add a to-do" }[list.kind]
          }
          onChange={(e) => setText(e.target.value)}
        />
        {list.kind === "grocery" && (
          <input
            aria-label="Quantity"
            className={`${input} w-24`}
            value={quantity}
            maxLength={30}
            placeholder="Qty"
            onChange={(e) => setQuantity(e.target.value)}
          />
        )}
        <button type="submit" className="shrink-0 rounded-xl bg-brand px-4 font-semibold text-white" aria-label="Add">
          Add
        </button>
      </div>
      {list.kind === "todo" && (
        <label className="flex items-center gap-2 text-sm text-muted">
          Due
          <input type="date" aria-label="Due date" className={`${input} w-auto py-1.5`} value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      )}
      {list.kind === "wishlist" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input aria-label="Link (optional)" className={input} value={link} maxLength={500} placeholder="Link (optional)" onChange={(e) => setLink(e.target.value)} />
          <input aria-label="Size, color, notes (optional)" className={input} value={notes} maxLength={300} placeholder="Size, color, notes (optional)" onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}
    </form>
  );
}

function ItemRow({
  item,
  list,
  checkable,
  canEdit,
  addedBy,
  whoChecked,
  overdue,
  dueLabel,
  onToggle,
  onDelete,
  onSave,
  wish,
}: {
  item: ListItem;
  list: List;
  checkable: boolean;
  canEdit: boolean;
  addedBy?: Member;
  whoChecked: Member[];
  overdue: boolean;
  dueLabel?: string;
  onToggle: () => void;
  onDelete: () => void;
  onSave: (fields: ItemFields) => void;
  wish?: { claimedBy?: Member; mine: boolean; onClaim: (claimed: boolean) => void };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ItemFields>({
    text: item.text,
    quantity: item.quantity,
    notes: item.notes,
    link: item.link,
    due_date: item.due_date,
  });

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        {checkable && (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={item.done}
            aria-label={item.done ? `Uncheck ${item.text}` : `Check ${item.text}`}
            className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition active:scale-95 ${
              item.done ? "border-brand bg-brand text-white" : "border-line text-transparent hover:border-brand/60"
            }`}
          >
            <CheckMark className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className={`break-words ${item.done && checkable ? "text-muted line-through" : "text-ink"}`}>
            {item.text}
            {item.quantity && <span className="ml-2 rounded-md bg-canvas px-1.5 py-0.5 text-xs font-semibold text-muted">{item.quantity}</span>}
          </p>
          {(item.notes || item.link || dueLabel || addedBy || whoChecked.length > 0) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {dueLabel && <span className={overdue ? "font-semibold text-danger" : ""}>{overdue ? "Overdue · " : "Due "}{dueLabel}</span>}
              {item.notes && <span>{item.notes}</span>}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-strong underline">
                  Open link
                </a>
              )}
              {addedBy && <span>added by {addedBy.display_name}</span>}
              {whoChecked.length > 0 && <span>✓ {whoChecked.map((m) => m.display_name).join(", ")}</span>}
            </div>
          )}
        </div>
        {wish && (
          wish.claimedBy ? (
            wish.mine ? (
              <button type="button" onClick={() => wish.onClaim(false)} className="shrink-0 rounded-lg bg-brand/12 px-2 py-1 text-xs font-semibold text-brand-strong">
                You bought it · Undo
              </button>
            ) : (
              <span className="shrink-0 rounded-lg bg-canvas px-2 py-1 text-xs font-semibold text-muted">
                Bought by {wish.claimedBy.display_name}
              </span>
            )
          ) : (
            <button type="button" onClick={() => wish.onClaim(true)} className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink hover:border-brand">
              Mark bought
            </button>
          )
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label={`Edit ${item.text}`}
            aria-expanded={editing}
            className="shrink-0 rounded-lg px-1.5 text-lg leading-none text-muted hover:text-ink"
          >
            ⋯
          </button>
        )}
      </div>

      {editing && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            setEditing(false);
          }}
        >
          <input aria-label="Item" className={input} value={draft.text} maxLength={200} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          {list.kind === "grocery" && (
            <input aria-label="Quantity" className={input} value={draft.quantity ?? ""} maxLength={30} placeholder="Quantity" onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
          )}
          {list.kind === "todo" && (
            <input type="date" aria-label="Due date" className={input} value={draft.due_date ?? ""} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
          )}
          {list.kind === "wishlist" && (
            <>
              <input aria-label="Link" className={input} value={draft.link ?? ""} maxLength={500} placeholder="Link" onChange={(e) => setDraft({ ...draft, link: e.target.value })} />
              <input aria-label="Notes" className={input} value={draft.notes ?? ""} maxLength={300} placeholder="Notes" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </>
          )}
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-xl bg-brand py-2 font-semibold text-white">
              Save
            </button>
            <button type="button" onClick={onDelete} className="rounded-xl border border-danger/40 px-4 py-2 font-semibold text-danger">
              Delete
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

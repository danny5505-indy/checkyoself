import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ChevronRight } from "@/components/icons";
import { Card, PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { loadFamily } from "@/lib/family";
import { ensureGroceryList, loadLists, type ListSummary } from "@/lib/lists/data";
import { KIND_INFO } from "@/lib/lists/types";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Lists" };

function ListCard({ list, owner, showOwner }: { list: ListSummary; owner?: Profile; showOwner: boolean }) {
  const remaining =
    list.kind === "wishlist"
      ? `${list.total} ${list.total === 1 ? "idea" : "ideas"}`
      : list.total === 0
        ? "Empty"
        : list.open === 0
          ? "All done ✓"
          : `${list.open} to go`;
  return (
    <Link href={`/lists/${list.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/50">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-canvas text-2xl" aria-hidden="true">
        {list.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{list.title}</p>
        <p className="text-sm text-muted">
          {KIND_INFO[list.kind].label} · {remaining}
          {list.per_person && " · everyone checks their own"}
        </p>
      </div>
      {showOwner && owner && <Avatar name={owner.display_name} color={owner.color} size="sm" />}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
    </Link>
  );
}

export default async function ListsPage() {
  const { profile, family } = await requireMember();
  await ensureGroceryList(family.id, profile.id);
  const [lists, members] = await Promise.all([loadLists(), loadFamily()]);
  const byId = new Map(members.map((m) => [m.id, m]));

  const grocery = lists.find((l) => l.kind === "grocery");
  const mine = lists.filter((l) => l.kind !== "grocery" && l.owner_id === profile.id);
  const sharedWithMe = lists.filter((l) => l.kind !== "grocery" && l.owner_id !== profile.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Lists" subtitle="Groceries, packing lists, wish lists and to-dos." />
        <Link href="/lists/new" className="shrink-0 rounded-xl bg-brand px-4 py-2 font-semibold text-white">
          + New list
        </Link>
      </div>

      {grocery && (
        <Link
          href={`/lists/${grocery.id}`}
          className="flex items-center gap-4 rounded-2xl border border-brand/30 bg-brand/5 p-4 transition hover:border-brand"
        >
          <span className="text-4xl" aria-hidden="true">{grocery.emoji}</span>
          <div className="flex-1">
            <p className="text-lg font-bold text-ink">{grocery.title}</p>
            <p className="text-sm text-muted">
              {grocery.open === 0 ? "Nothing needed right now" : `${grocery.open} ${grocery.open === 1 ? "item" : "items"} to get`} · shared with everyone
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted" />
        </Link>
      )}

      <section className="space-y-2" aria-labelledby="mine">
        <h2 id="mine" className="text-lg font-bold text-ink">
          My lists
        </h2>
        {mine.length ? (
          <ul className="space-y-2">
            {mine.map((l) => (
              <li key={l.id}>
                <ListCard list={l} showOwner={false} />
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-muted">
              No lists yet. Make a packing list, a Christmas list or your own to-dos with{" "}
              <span className="font-semibold text-ink">+ New list</span>.
            </p>
          </Card>
        )}
      </section>

      {sharedWithMe.length > 0 && (
        <section className="space-y-2" aria-labelledby="shared">
          <h2 id="shared" className="text-lg font-bold text-ink">
            Shared with me
          </h2>
          <ul className="space-y-2">
            {sharedWithMe.map((l) => (
              <li key={l.id}>
                <ListCard list={l} owner={byId.get(l.owner_id)} showOwner />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

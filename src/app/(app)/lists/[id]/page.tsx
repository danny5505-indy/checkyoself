import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { DeleteListButton, ListForm } from "@/components/lists/list-form";
import { ListView } from "@/components/lists/list-view";
import { Card } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { loadFamily } from "@/lib/family";
import { shortDay, todayISO } from "@/lib/goals/dates";
import { loadList } from "@/lib/lists/data";

export const metadata = { title: "List" };

export default async function ListPage({ params }: PageProps<"/lists/[id]">) {
  const { id } = await params;
  const { profile } = await requireMember();
  const detail = await loadList(id);
  if (!detail) notFound();
  const { list, shares, items, checks, claims } = detail;
  const members = await loadFamily();
  const owner = members.find((m) => m.id === list.owner_id);
  const isOwner = list.owner_id === profile.id;
  const canEditItems = list.kind !== "wishlist" || isOwner;

  // People with access (for per-person progress and the "shared with" line).
  const withAccess = list.shared_with_all ? members.map((m) => m.id) : [list.owner_id, ...shares];
  const dueLabels: Record<string, string> = {};
  for (const i of items) if (i.due_date) dueLabels[i.due_date] = shortDay(i.due_date);

  const sharedNames = members.filter((m) => shares.includes(m.id)).map((m) => m.display_name);

  return (
    <div className="space-y-4">
      <Link href="/lists" className="text-sm font-semibold text-brand-strong">
        ← Lists
      </Link>
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface text-3xl ring-1 ring-line" aria-hidden="true">
          {list.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink">{list.title}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            {list.shared_with_all ? (
              "Shared with the whole family"
            ) : isOwner ? (
              sharedNames.length ? `Shared with ${sharedNames.join(", ")}` : "Only you can see this"
            ) : (
              <>
                {owner && <Avatar name={owner.display_name} color={owner.color} size="sm" />}
                {owner?.display_name}&apos;s list
              </>
            )}
          </p>
        </div>
      </header>

      <ListView
        list={list}
        items={items}
        meId={profile.id}
        members={members.map((m) => ({ id: m.id, display_name: m.display_name, color: m.color }))}
        canEditItems={canEditItems}
        isOwner={isOwner}
        checks={checks}
        claims={claims}
        checkers={list.per_person ? withAccess : []}
        today={todayISO()}
        dueLabels={dueLabels}
      />

      {isOwner && (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted">
            <span className="group-open:hidden">⚙️ List settings</span>
            <span className="hidden group-open:inline">Hide settings</span>
          </summary>
          <Card className="mt-3 space-y-4">
            <ListForm others={members.filter((m) => m.id !== profile.id)} list={list} shares={shares} />
            {list.kind !== "grocery" && <DeleteListButton listId={list.id} />}
          </Card>
        </details>
      )}
    </div>
  );
}

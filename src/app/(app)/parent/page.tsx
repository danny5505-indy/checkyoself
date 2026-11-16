import { Avatar } from "@/components/avatar";
import Link from "next/link";
import { GoalStatusBadge, TrackBadge } from "@/components/goals/badges";
import { ReviewButtons } from "@/components/goals/goal-actions";
import { Card, PageHeader } from "@/components/page-header";
import { requireParent } from "@/lib/auth";
import { loadCheckIns, loadVisibleGoals } from "@/lib/goals/data";
import { todayISO } from "@/lib/goals/dates";
import { amountsFor, dayRatio, describeSchedule, goalProgress, isDueToday } from "@/lib/goals/progress";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { AddMemberForm, FamilyNameForm, MemberEditor } from "./forms";

export const metadata = { title: "Parent dashboard" };

export default async function ParentPage() {
  const { family, profile: me } = await requireParent();
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, family_id, display_name, role, color, created_at")
    .order("role", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Profile[]>();

  const today = todayISO();
  const goals = await loadVisibleGoals();
  const checkIns = await loadCheckIns(today, { days: 14 });
  const waiting = goals.filter((g) => g.status === "pending");
  const kids = (members ?? []).filter((m) => m.role === "kid");
  const nameOf = (id: string) => (members ?? []).find((m) => m.id === id)?.display_name ?? "Someone";

  return (
    <div className="space-y-4">
      <PageHeader title="Parent dashboard" subtitle={family.name} />

      {waiting.length > 0 && (
        <section className="space-y-2" aria-labelledby="waiting">
          <h2 id="waiting" className="text-lg font-bold text-ink">
            Waiting for your approval
          </h2>
          {waiting.map((g) => (
            <Card key={g.id} className="border-amber-500/40">
              <Link href={`/goals/${g.id}`} className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden="true">{g.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{g.title}</p>
                  <p className="text-sm text-muted">
                    {nameOf(g.owner_id)} ·{" "}
                    {g.activities.map((a) => `${a.title} (${describeSchedule(a).toLowerCase()})`).join(", ") ||
                      "Milestones only"}
                  </p>
                </div>
              </Link>
              <div className="mt-3">
                <ReviewButtons goalId={g.id} ownerName={nameOf(g.owner_id)} />
              </div>
            </Card>
          ))}
        </section>
      )}

      {kids.length > 0 && (
        <section className="space-y-2" aria-labelledby="glance">
          <h2 id="glance" className="text-lg font-bold text-ink">
            Kids at a glance
          </h2>
          {kids.map((kid) => {
            const theirs = goals.filter((g) => g.owner_id === kid.id && ["active", "declined"].includes(g.status));
            const due = theirs
              .filter((g) => g.status === "active")
              .flatMap((g) => g.activities.map((a) => ({ a, amounts: amountsFor(a.id, checkIns) })))
              .filter(({ a, amounts }) => isDueToday(a, amounts, today));
            const doneCount = due.filter(({ a, amounts }) => dayRatio(a, amounts.get(today)) >= 1).length;
            return (
              <Card key={kid.id}>
                <div className="flex items-center gap-3">
                  <Avatar name={kid.display_name} color={kid.color} />
                  <div className="flex-1">
                    <p className="font-semibold text-ink">{kid.display_name}</p>
                    <p className="text-sm text-muted">
                      {due.length ? `${doneCount} of ${due.length} done today` : "Nothing due today"}
                    </p>
                  </div>
                </div>
                {theirs.length > 0 ? (
                  <ul className="mt-3 divide-y divide-line">
                    {theirs.map((g) => (
                      <li key={g.id}>
                        <Link href={`/goals/${g.id}`} className="flex items-center gap-2 py-2">
                          <span aria-hidden="true">{g.emoji}</span>
                          <span className="min-w-0 flex-1 truncate text-ink">{g.title}</span>
                          {g.status === "active" ? (
                            <TrackBadge status={goalProgress(g, checkIns, today).status} />
                          ) : (
                            <GoalStatusBadge status={g.status} />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    No goals yet.{" "}
                    <Link href="/goals/new" className="font-semibold text-brand-strong underline">
                      Create one
                    </Link>
                  </p>
                )}
              </Card>
            );
          })}
        </section>
      )}

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Family members</h2>
        <ul className="divide-y divide-line">
          {(members ?? []).map((m) => (
            <li key={m.id} className="py-3 first:pt-0 last:pb-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <Avatar name={m.display_name} color={m.color} />
                  <div className="flex-1">
                    <p className="font-medium text-ink">
                      {m.display_name}
                      {m.id === me.id && <span className="text-muted"> (you)</span>}
                    </p>
                    <p className="text-sm text-muted">{m.role === "parent" ? "Parent" : "Kid"}</p>
                  </div>
                  <span className="text-sm font-medium text-brand-strong group-open:hidden">Edit</span>
                  <span className="hidden text-sm font-medium text-muted group-open:inline">Close</span>
                </summary>
                <div className="mt-4">
                  <MemberEditor member={m} isMe={m.id === me.id} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-ink">Add a family member</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Choose a starting password and share it with them. They can change it in My settings.
        </p>
        <AddMemberForm />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Family name</h2>
        <FamilyNameForm name={family.name} />
      </Card>
    </div>
  );
}

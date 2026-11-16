import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { GoalCard } from "@/components/goals/goal-card";
import { Card, PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { loadFamily } from "@/lib/family";
import { loadCheckIns, loadVisibleGoals } from "@/lib/goals/data";
import { todayISO } from "@/lib/goals/dates";
import { goalProgress } from "@/lib/goals/progress";
import type { GoalWithPlan } from "@/lib/goals/types";

export const metadata = { title: "Goals" };

const ORDER: Record<string, number> = { declined: 0, pending: 1, active: 2, completed: 3, archived: 4 };

export default async function GoalsPage() {
  const { profile } = await requireMember();
  const today = todayISO();
  const [goals, family] = await Promise.all([loadVisibleGoals(), loadFamily()]);
  const checkIns = await loadCheckIns(today, { days: 14 });
  const byId = new Map(family.map((p) => [p.id, p]));

  const sorted = [...goals].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const current = (g: GoalWithPlan) => g.status !== "completed" && g.status !== "archived";
  const mine = sorted.filter((g) => g.owner_id === profile.id);
  const others = family.filter((p) => p.id !== profile.id);

  const card = (g: GoalWithPlan) => (
    <li key={g.id}>
      <GoalCard goal={g} progress={goalProgress(g, checkIns, today)} owner={byId.get(g.owner_id)} />
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Goals" subtitle="Your goals and the plans to reach them." />
        <Link href="/goals/new" className="shrink-0 rounded-xl bg-brand px-4 py-2 font-semibold text-white">
          + New goal
        </Link>
      </div>

      <section className="space-y-2" aria-labelledby="mine">
        <h2 id="mine" className="text-lg font-bold text-ink">
          My goals
        </h2>
        {mine.filter(current).length ? (
          <ul className="space-y-2">{mine.filter(current).map(card)}</ul>
        ) : (
          <Card>
            <p className="text-muted">
              No goals yet. Tap <span className="font-semibold text-ink">+ New goal</span> to set one.
              {profile.role === "kid" && " A parent will approve it before it starts."}
            </p>
          </Card>
        )}
      </section>

      {others.map((person) => {
        const theirs = sorted.filter((g) => g.owner_id === person.id && current(g));
        if (!theirs.length) return null;
        return (
          <section key={person.id} className="space-y-2" aria-label={`${person.display_name}'s goals`}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Avatar name={person.display_name} color={person.color} size="sm" />
              {person.display_name}
            </h2>
            <ul className="space-y-2">{theirs.map(card)}</ul>
          </section>
        );
      })}

      {sorted.some((g) => !current(g)) && (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted">
            <span className="group-open:hidden">Show completed and archived goals</span>
            <span className="hidden group-open:inline">Hide completed and archived goals</span>
          </summary>
          <ul className="mt-3 space-y-2">
            {sorted.filter((g) => !current(g)).map((g) => (
              <li key={g.id}>
                <GoalCard
                  goal={g}
                  progress={goalProgress(g, checkIns, today)}
                  owner={byId.get(g.owner_id)}
                  showOwner={g.owner_id !== profile.id}
                />
              </li>
            ))}
          </ul>
        </details>
      )}

      {profile.role === "kid" && (
        <p className="text-xs text-muted">
          You see your brother&apos;s and sisters&apos; goals only when they&apos;re shared. Parents can see all goals.
        </p>
      )}
    </div>
  );
}

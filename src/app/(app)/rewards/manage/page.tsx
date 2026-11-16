import Link from "next/link";
import { Card, PageHeader } from "@/components/page-header";
import { RewardForm, RewardRowActions, SettingsForm, SuggestionPicker } from "@/components/rewards/manage-forms";
import { requireParent } from "@/lib/auth";
import { loadRewards, loadSettings } from "@/lib/points/data";

export const metadata = { title: "Manage rewards" };

export default async function ManageRewardsPage() {
  const { family } = await requireParent();
  const [rewards, settings] = await Promise.all([loadRewards(), loadSettings(family.id)]);

  return (
    <div className="space-y-5">
      <Link href="/rewards" className="text-sm font-semibold text-brand-strong">
        ← Rewards
      </Link>
      <PageHeader title="Manage rewards" subtitle="Set up the reward store and how many points things are worth." />

      <section className="space-y-2" aria-labelledby="store">
        <h2 id="store" className="text-lg font-bold text-ink">
          Reward store
        </h2>
        {rewards.length > 0 ? (
          <ul className="space-y-2">
            {rewards.map((r) => (
              <li key={r.id}>
                <Card className={r.active ? "" : "opacity-70"}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">{r.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{r.title}</p>
                        <p className="text-sm text-muted">
                          ⭐ {r.cost.toLocaleString()} {!r.active && "· hidden"}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-brand-strong group-open:hidden">Edit</span>
                      <span className="hidden text-sm font-medium text-muted group-open:inline">Close</span>
                    </summary>
                    <div className="mt-4 space-y-4">
                      <RewardForm reward={r} />
                      <RewardRowActions reward={r} />
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No rewards yet. Add your first one below.</p>
        )}
      </section>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Add a reward</h2>
        <SuggestionPicker existing={rewards.map((r) => r.title.toLowerCase())} />
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-ink">Points</h2>
        <p className="mb-3 text-sm text-muted">How many points each thing earns.</p>
        <SettingsForm settings={settings} />
      </Card>
    </div>
  );
}

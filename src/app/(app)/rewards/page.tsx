import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Card, PageHeader } from "@/components/page-header";
import { CancelRequestButton, DecideButtons, RequestButton } from "@/components/rewards/reward-buttons";
import { requireMember } from "@/lib/auth";
import { loadFamily } from "@/lib/family";
import { BADGES } from "@/lib/points/badges";
import {
  loadBadges,
  loadBalances,
  loadPointEvents,
  loadRedemptions,
  loadRewards,
  loadSettings,
  type PointEvent,
} from "@/lib/points/data";

export const metadata = { title: "Rewards" };

const KIND_LABEL: Record<PointEvent["kind"], string> = {
  check_in: "Check-off",
  streak_bonus: "Streak bonus",
  milestone: "Milestone",
  goal_completed: "Goal reached",
  redemption: "Reward",
  adjustment: "From a parent",
};

const STATUS_STYLE = {
  requested: { label: "Waiting for a parent", style: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  approved: { label: "Approved", style: "bg-brand/12 text-brand-strong" },
  declined: { label: "Not this time", style: "bg-line/70 text-muted" },
} as const;

function when(ts: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    month: "short",
    day: "numeric",
  }).format(new Date(ts));
}

export default async function RewardsPage() {
  const { profile, family } = await requireMember();
  const isParent = profile.role === "parent";

  const [balances, rewards, myRequests, events, badges, settings, familyMembers, waiting] = await Promise.all([
    loadBalances(),
    loadRewards(),
    loadRedemptions({ profileId: profile.id }),
    loadPointEvents(profile.id),
    loadBadges(profile.id),
    loadSettings(family.id),
    loadFamily(),
    isParent ? loadRedemptions({ status: "requested" }) : Promise.resolve([]),
  ]);

  const balance = balances.get(profile.id) ?? 0;
  const reserved = myRequests.filter((r) => r.status === "requested").reduce((s, r) => s + r.cost, 0);
  const available = balance - reserved;
  const store = rewards.filter((r) => r.active);
  const nameOf = (id: string) => familyMembers.find((m) => m.id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Rewards" subtitle="Earn points and spend them on rewards." />
        {isParent && (
          <Link href="/rewards/manage" className="shrink-0 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink">
            Manage
          </Link>
        )}
      </div>

      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-transparent text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Your points</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight text-ink">
          <span aria-hidden="true">⭐ </span>
          {balance.toLocaleString()}
        </p>
        {reserved > 0 && (
          <p className="mt-1 text-sm text-muted">
            {reserved.toLocaleString()} set aside for requests · {available.toLocaleString()} to spend
          </p>
        )}
      </Card>

      {isParent && waiting.length > 0 && (
        <section className="space-y-2" aria-labelledby="waiting">
          <h2 id="waiting" className="text-lg font-bold text-ink">
            Requests waiting for you
          </h2>
          {waiting.map((r) => {
            const who = nameOf(r.profile_id);
            return (
              <Card key={r.id} className="border-amber-500/40">
                <div className="mb-3 flex items-center gap-3">
                  {who && <Avatar name={who.display_name} color={who.color} size="sm" />}
                  <p className="flex-1 text-ink">
                    <span className="font-semibold">{who?.display_name}</span> wants {r.reward_emoji}{" "}
                    <span className="font-semibold">{r.reward_title}</span>
                  </p>
                  <span className="text-sm font-bold text-ink">{r.cost} pts</span>
                </div>
                <p className="mb-2 text-xs text-muted">
                  They have {(balances.get(r.profile_id) ?? 0).toLocaleString()} points.
                </p>
                <DecideButtons redemptionId={r.id} name={who?.display_name ?? "them"} />
              </Card>
            );
          })}
        </section>
      )}

      <section className="space-y-2" aria-labelledby="store">
        <h2 id="store" className="text-lg font-bold text-ink">
          Reward store
        </h2>
        {store.length ? (
          <ul className="grid grid-cols-2 gap-2">
            {store.map((r) => (
              <li key={r.id} className="flex flex-col rounded-2xl border border-line bg-surface p-3">
                <span className="text-3xl" aria-hidden="true">
                  {r.emoji}
                </span>
                <p className="mt-1 font-semibold leading-tight text-ink">{r.title}</p>
                {r.details && <p className="mt-0.5 text-xs text-muted">{r.details}</p>}
                <p className="mb-2 mt-1 text-sm font-bold text-amber-700 dark:text-amber-300">⭐ {r.cost.toLocaleString()}</p>
                <div className="mt-auto">
                  <RequestButton rewardId={r.id} shortBy={Math.max(0, r.cost - available)} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-muted">
              {isParent ? (
                <>
                  No rewards yet.{" "}
                  <Link href="/rewards/manage" className="font-semibold text-brand-strong underline">
                    Set up the reward store
                  </Link>
                </>
              ) : (
                "No rewards yet. Ask a parent to set up the reward store."
              )}
            </p>
          </Card>
        )}
      </section>

      {myRequests.length > 0 && (
        <section className="space-y-2" aria-labelledby="mine">
          <h2 id="mine" className="text-lg font-bold text-ink">
            My requests
          </h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {myRequests.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl" aria-hidden="true">
                  {r.reward_emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{r.reward_title}</p>
                  <p className="text-xs text-muted">
                    {r.cost} pts · {when(r.created_at)}
                    {r.note && ` · “${r.note}”`}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status].style}`}>
                  {STATUS_STYLE[r.status].label}
                </span>
                {r.status === "requested" && <CancelRequestButton redemptionId={r.id} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2" aria-labelledby="badges">
        <h2 id="badges" className="text-lg font-bold text-ink">
          Badges <span className="text-base font-medium text-muted">{badges.size}/{BADGES.length}</span>
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          {BADGES.map((b) => {
            const earned = badges.get(b.key);
            return (
              <li
                key={b.key}
                className={`rounded-2xl border p-2 text-center ${
                  earned ? "border-amber-500/40 bg-amber-500/10" : "border-line bg-surface opacity-60"
                }`}
              >
                <span className={`block text-3xl ${earned ? "" : "grayscale"}`} aria-hidden="true">
                  {earned ? b.emoji : "🔒"}
                </span>
                <p className="mt-1 text-xs font-bold text-ink">{b.name}</p>
                <p className="text-[11px] leading-tight text-muted">{earned ? `Earned ${when(earned)}` : b.description}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <Card>
        <h2 className="font-semibold text-ink">How to earn points</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>✅ Finish an activity: <span className="font-semibold text-ink">+{settings.points_per_check_in}</span></li>
          <li>🔥 Every 7 days in a row (or 4 weeks on a weekly plan): <span className="font-semibold text-ink">+{settings.streak_bonus}</span></li>
          <li>🪜 Finish a milestone: <span className="font-semibold text-ink">+{settings.milestone_points}</span></li>
          <li>🏆 Reach a goal: <span className="font-semibold text-ink">+{settings.goal_points}</span></li>
        </ul>
      </Card>

      {events.length > 0 && (
        <section className="space-y-2" aria-labelledby="history">
          <h2 id="history" className="text-lg font-bold text-ink">
            Points history
          </h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{e.note || KIND_LABEL[e.kind]}</p>
                  <p className="text-xs text-muted">
                    {KIND_LABEL[e.kind]} · {when(e.created_at)}
                  </p>
                </div>
                <span className={`text-sm font-bold ${e.amount > 0 ? "text-brand-strong" : "text-danger"}`}>
                  {e.amount > 0 ? `+${e.amount}` : e.amount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

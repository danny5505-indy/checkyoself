import Link from "next/link";
import { Card, ComingSoon } from "@/components/page-header";
import { ChevronRight, ShieldIcon } from "@/components/icons";
import { requireMember } from "@/lib/auth";
import { quoteOfTheDay } from "@/lib/quotes";
import { greeting, longDate } from "@/lib/time";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const { profile } = await requireMember();
  const quote = quoteOfTheDay();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted">{longDate()}</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {greeting()}, {profile.display_name}!
        </h1>
      </div>

      <Card className="border-brand/30 bg-brand/5">
        <blockquote>
          <p className="text-lg font-medium leading-snug text-ink">“{quote.text}”</p>
          <footer className="mt-2 text-sm text-muted">— {quote.source}</footer>
        </blockquote>
      </Card>

      {profile.role === "parent" && (
        <Link href="/parent" className="block">
          <Card className="flex items-center gap-3 transition hover:border-brand/50">
            <ShieldIcon className="h-6 w-6 text-brand-strong" />
            <div className="flex-1">
              <p className="font-semibold text-ink">Parent dashboard</p>
              <p className="text-sm text-muted">Add family members and manage settings</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Card>
        </Link>
      )}

      <ComingSoon
        stage={2}
        items={[
          "What's due today from your goal plans",
          "Check things off right here",
          "Streaks and on-track status",
        ]}
      />
    </div>
  );
}

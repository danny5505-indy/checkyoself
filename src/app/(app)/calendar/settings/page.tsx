import Link from "next/link";
import { AddCalendarForm, MenuFixForm, RemoveCalendarButton } from "@/components/calendar/settings-forms";
import { Card, PageHeader } from "@/components/page-header";
import { requireParent } from "@/lib/auth";
import { ensureDistrictCalendar, loadSources } from "@/lib/calendar/data";
import { todayISO } from "@/lib/goals/dates";
import { lastMenuUpdate } from "@/lib/menus/data";

export const metadata = { title: "Calendar settings" };

export default async function CalendarSettingsPage() {
  const { family } = await requireParent();
  await ensureDistrictCalendar(family.id);
  const [sources, menuUpdated] = await Promise.all([loadSources(), lastMenuUpdate()]);

  return (
    <div className="space-y-5">
      <Link href="/calendar" className="text-sm font-semibold text-brand-strong">
        ← Calendar
      </Link>
      <PageHeader title="Calendar settings" subtitle="Which calendars show up, and school lunch menus." />

      <section className="space-y-2" aria-labelledby="cals">
        <h2 id="cals" className="text-lg font-bold text-ink">
          Calendars
        </h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{s.name}</p>
                <p className="text-xs text-muted">{s.kind === "school" ? "School" : "Family"}</p>
              </div>
              <RemoveCalendarButton id={s.id} name={s.name} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Only parents can see these links.</p>
      </section>

      <Card>
        <h2 className="font-semibold text-ink">Add an Apple calendar</h2>
        <ol className="mb-4 mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>On your iPhone, open the Calendar app and tap <span className="font-medium text-ink">Calendars</span>.</li>
          <li>Tap the <span className="font-medium text-ink">ⓘ</span> next to the calendar.</li>
          <li>Turn on <span className="font-medium text-ink">Public Calendar</span>, tap <span className="font-medium text-ink">Share Link…</span>, then <span className="font-medium text-ink">Copy</span>.</li>
          <li>Paste the link below.</li>
        </ol>
        <AddCalendarForm />
      </Card>

      <Card>
        <h2 className="font-semibold text-ink">School lunch menus</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          {menuUpdated
            ? `Menus last updated automatically on ${new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", month: "long", day: "numeric" }).format(new Date(menuUpdated))}.`
            : "Menus haven't been imported yet. They update automatically each week."}{" "}
          If a day is wrong or missing, fix it here. Your change won&apos;t be overwritten by the automatic update.
        </p>
        <MenuFixForm defaultDay={todayISO()} />
      </Card>
    </div>
  );
}

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { MenuLine } from "@/components/calendar/menu-card";
import { PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { ensureDistrictCalendar, loadEvents } from "@/lib/calendar/data";
import { eventsOnDay, timeLabel } from "@/lib/calendar/days";
import { loadFamily } from "@/lib/family";
import { addDays, shortDay, todayISO, weekStart } from "@/lib/goals/dates";
import { loadMenus } from "@/lib/menus/data";
import { levelOf, type SchoolLevel } from "@/lib/schools";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Calendar" };

// Midnight at the start of a family-local day, as a Date (close enough for feed ranges).
const dayStart = (day: string) => new Date(`${day}T00:00:00-05:00`);

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { profile, family } = await requireMember();
  const params = await searchParams;
  const today = todayISO();
  const requested = typeof params.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : today;
  const start = weekStart(requested);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  await ensureDistrictCalendar(family.id);
  const family_members = await loadFamily();
  // Kids grouped by which lunch menu they get.
  const byLevel = new Map<SchoolLevel, Profile[]>();
  for (const m of family_members) {
    const level = levelOf(m.school);
    if (level) byLevel.set(level, [...(byLevel.get(level) ?? []), m]);
  }
  // A kid sees their own lunch; parents see everyone's.
  const visibleLevels = [...byLevel.entries()].filter(
    ([, kids]) => profile.role === "parent" || kids.some((k) => k.id === profile.id),
  );

  const [{ events, failed }, menus] = await Promise.all([
    loadEvents(family.id, dayStart(start), dayStart(addDays(start, 7))),
    loadMenus(visibleLevels.map(([l]) => l), start, addDays(start, 6)),
  ]);

  const weekLabel = `${shortDay(start).replace(/^\w+, /, "")} – ${shortDay(addDays(start, 6)).replace(/^\w+, /, "")}`;
  const navClass = "rounded-xl border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Calendar" subtitle="Family and school events, plus school lunch." />
        {profile.role === "parent" && (
          <Link href="/calendar/settings" className="shrink-0 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink">
            Settings
          </Link>
        )}
      </div>

      <nav className="flex items-center justify-between gap-2" aria-label="Week">
        <Link href={`/calendar?week=${addDays(start, -7)}`} className={navClass} aria-label="Previous week">
          ←
        </Link>
        <div className="text-center">
          <p className="font-bold text-ink">{weekLabel}</p>
          {start !== weekStart(today) && (
            <Link href="/calendar" className="text-xs font-semibold text-brand-strong">
              Back to this week
            </Link>
          )}
        </div>
        <Link href={`/calendar?week=${addDays(start, 7)}`} className={navClass} aria-label="Next week">
          →
        </Link>
      </nav>

      {failed.length > 0 && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-ink">
          Couldn&apos;t load: {failed.join(", ")}. {profile.role === "parent" ? "Check the link in Settings." : "Let a parent know."}
        </p>
      )}

      <ol className="space-y-3">
        {days.map((day) => {
          const dayEvents = eventsOnDay(events, day);
          const isToday = day === today;
          const weekend = [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
          return (
            <li
              key={day}
              className={`rounded-2xl border bg-surface p-4 ${isToday ? "border-brand ring-1 ring-brand/30" : "border-line"}`}
            >
              <h2 className="mb-2 flex items-center gap-2 font-bold text-ink">
                {shortDay(day)}
                {isToday && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">Today</span>}
              </h2>

              {dayEvents.length > 0 ? (
                <ul className="space-y-1.5">
                  {dayEvents.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} aria-hidden="true" />
                      <span className="w-14 shrink-0 text-muted">{timeLabel(e)}</span>
                      <span className="min-w-0 text-ink">
                        {e.title}
                        {e.location && <span className="block text-xs text-muted">{e.location}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No events</p>
              )}

              {!weekend && visibleLevels.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-line pt-3">
                  {visibleLevels.map(([level, kids]) => (
                    <MenuLine
                      key={level}
                      menu={menus.find((m) => m.level === level && m.day === day)}
                      label={
                        <span className="mr-1 inline-flex items-center gap-1 align-middle">
                          <span aria-hidden="true">🍽</span>
                          {kids.map((k) => (
                            <span key={k.id} title={k.display_name}>
                              <Avatar name={k.display_name} color={k.color} size="sm" />
                            </span>
                          ))}
                          <span className="sr-only">Lunch for {kids.map((k) => k.display_name).join(" and ")}:</span>
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-muted">
        Calendars refresh about once an hour. Lunch menus come from Noblesville Schools.
      </p>
    </div>
  );
}

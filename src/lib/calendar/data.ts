import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DISTRICT_CALENDAR } from "@/lib/schools";
import { parseIcs, type CalendarEvent } from "./ics";

export type CalendarSource = {
  id: string;
  name: string;
  url: string;
  kind: "school" | "family";
  color: string;
};

export type SourcedEvent = CalendarEvent & { sourceName: string; color: string; kind: "school" | "family" };

// Feeds are re-downloaded in the background once their stored copy is this old.
const STALE_MINUTES = 60;
// Stored range: a month back to a year ahead.
const KEEP_BACK_DAYS = 31;
const KEEP_AHEAD_DAYS = 366;

type Admin = ReturnType<typeof createAdminClient>;

async function download(url: string): Promise<string | null> {
  try {
    const res = await fetch(url.replace(/^webcal:\/\//i, "https://"), {
      headers: { "user-agent": "CheckYoSelf family calendar" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.includes("BEGIN:VCALENDAR") ? text : null;
  } catch {
    return null;
  }
}

// Downloads one feed and stores its parsed events. Keeps the old copy if the download fails.
export async function refreshFeed(admin: Admin, source: CalendarSource, text?: string): Promise<CalendarEvent[] | null> {
  const body = text ?? (await download(source.url));
  if (!body) {
    await admin.from("calendar_feed_cache").update({ ok: false, fetched_at: new Date().toISOString() }).eq("source_id", source.id);
    return null;
  }
  let events: CalendarEvent[];
  try {
    const now = Date.now();
    events = parseIcs(body, new Date(now - KEEP_BACK_DAYS * 864e5), new Date(now + KEEP_AHEAD_DAYS * 864e5));
  } catch {
    return null;
  }
  await admin
    .from("calendar_feed_cache")
    .upsert({ source_id: source.id, events, ok: true, fetched_at: new Date().toISOString() });
  return events;
}

// Refreshes every feed older than `maxAgeMinutes` (used by the 15-minute scheduler).
export async function refreshStaleFeeds(maxAgeMinutes = STALE_MINUTES) {
  const admin = createAdminClient();
  const [{ data: sources }, { data: cache }] = await Promise.all([
    admin.from("calendar_sources").select("id, name, url, kind, color").returns<CalendarSource[]>(),
    admin.from("calendar_feed_cache").select("source_id, fetched_at"),
  ]);
  const fetchedAt = new Map((cache ?? []).map((c) => [c.source_id as string, new Date(c.fetched_at as string).getTime()]));
  const cutoff = Date.now() - maxAgeMinutes * 60_000;
  const stale = (sources ?? []).filter((s) => (fetchedAt.get(s.id) ?? 0) < cutoff);
  await Promise.all(stale.map((s) => refreshFeed(admin, s)));
  return stale.length;
}

// Parents only (database rules): the sources with their private links.
export async function loadSources(): Promise<CalendarSource[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_sources")
    .select("id, name, url, kind, color")
    .order("created_at")
    .returns<CalendarSource[]>();
  return data ?? [];
}

// Adds the district calendar the first time a family uses the calendar. Returns it if added.
export async function ensureDistrictCalendar(familyId: string): Promise<CalendarSource | null> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("calendar_sources")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);
  if ((count ?? 0) > 0) return null;
  const { data } = await admin
    .from("calendar_sources")
    .insert({ family_id: familyId, kind: "school", ...DISTRICT_CALENDAR })
    .select("id, name, url, kind, color")
    .single<CalendarSource>();
  return data ?? null;
}

// Everyone in the family: events from all sources, read from the stored copies.
// The caller must already have checked that the signed-in person belongs to `familyId`.
export async function loadEvents(familyId: string, from: Date, to: Date): Promise<{ events: SourcedEvent[]; failed: string[] }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_sources")
    .select("id, name, url, kind, color, calendar_feed_cache(events, ok, fetched_at)")
    .eq("family_id", familyId)
    .returns<(CalendarSource & { calendar_feed_cache: { events: CalendarEvent[]; ok: boolean; fetched_at: string } | null })[]>();
  let sources = data ?? [];

  if (!sources.length) {
    // First visit: add the district calendar and use the returned row directly.
    const added = await ensureDistrictCalendar(familyId);
    if (added) sources = [{ ...added, calendar_feed_cache: null }];
  }

  const failed: string[] = [];
  const stale: CalendarSource[] = [];
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const fromDay = fromIso.slice(0, 10);
  const toDay = toIso.slice(0, 10);

  const results = await Promise.all(
    sources.map(async ({ calendar_feed_cache: cached, ...source }) => {
      let events = cached?.events ?? null;
      if (!events) {
        // Never downloaded yet (e.g. just added): fetch it now, once.
        events = await refreshFeed(admin, source);
        if (!events) {
          failed.push(source.name);
          return [];
        }
      } else {
        if (!cached?.ok) failed.push(source.name);
        if (Date.now() - new Date(cached!.fetched_at).getTime() > STALE_MINUTES * 60_000) stale.push(source);
      }
      return events
        .filter((e) => (e.allDay ? e.end > fromDay && e.start <= toDay : e.end > fromIso && e.start < toIso))
        // The district feed includes school board meetings; families don't need those.
        .filter((e) => !(source.kind === "school" && /school board/i.test(e.title)))
        .map((e) => ({ ...e, id: `${source.id}|${e.id}`, sourceName: source.name, color: source.color, kind: source.kind }));
    }),
  );

  // Refresh old copies after the page has been sent, so nobody waits for it.
  if (stale.length) after(() => Promise.all(stale.map((s) => refreshFeed(createAdminClient(), s))));

  return { events: results.flat(), failed };
}

import "server-only";
import { cacheLife } from "next/cache";
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

// Downloads a feed, cached on the server for about an hour.
async function fetchFeed(url: string): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  try {
    const res = await fetch(url.replace(/^webcal:\/\//i, "https://"), {
      headers: { "user-agent": "CheckYoSelf family calendar" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Adds the district calendar the first time a family opens the calendar.
export async function ensureDistrictCalendar(familyId: string) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("calendar_sources")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);
  if ((count ?? 0) > 0) return;
  await admin.from("calendar_sources").insert({ family_id: familyId, kind: "school", ...DISTRICT_CALENDAR });
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

// Everyone in the family: events from all sources. The caller must already have
// checked that the signed-in person belongs to `familyId`.
export async function loadEvents(familyId: string, from: Date, to: Date): Promise<{ events: SourcedEvent[]; failed: string[] }> {
  const admin = createAdminClient();
  const { data: sources } = await admin
    .from("calendar_sources")
    .select("id, name, url, kind, color")
    .eq("family_id", familyId)
    .returns<CalendarSource[]>();

  const failed: string[] = [];
  const results = await Promise.all(
    (sources ?? []).map(async (s) => {
      const text = await fetchFeed(s.url);
      if (!text) {
        failed.push(s.name);
        return [];
      }
      try {
        return parseIcs(text, from, to)
          // The district feed includes school board meetings; families don't need those.
          .filter((e) => !(s.kind === "school" && /school board/i.test(e.title)))
          .map((e) => ({ ...e, id: `${s.id}|${e.id}`, sourceName: s.name, color: s.color, kind: s.kind }));
      } catch {
        failed.push(s.name);
        return [];
      }
    }),
  );
  return { events: results.flat(), failed };
}

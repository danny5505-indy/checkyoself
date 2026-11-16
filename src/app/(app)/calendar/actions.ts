"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

const sourceSchema = z.object({
  name: z.string().trim().min(1, "Give the calendar a name").max(40),
  url: z
    .string()
    .trim()
    .max(1000)
    .regex(/^(https?|webcal):\/\/\S+$/i, "Paste the full calendar link (it starts with webcal:// or https://)"),
  kind: z.enum(["school", "family"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function addCalendar(_prev: FormState, formData: FormData): Promise<FormState> {
  const { family } = await requireParent();
  const parsed = sourceSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
    kind: formData.get("kind") || "family",
    color: formData.get("color") || "#4f46e5",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  // Make sure the link works before saving it.
  try {
    const res = await fetch(parsed.data.url.replace(/^webcal:\/\//i, "https://"), { signal: AbortSignal.timeout(10_000) });
    const text = res.ok ? await res.text() : "";
    if (!text.includes("BEGIN:VCALENDAR")) {
      return { error: "That link didn't return a calendar. Check that the calendar is set to Public and the link is complete." };
    }
  } catch {
    return { error: "Couldn't reach that calendar link. Check it and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("calendar_sources").insert({ ...parsed.data, family_id: family.id });
  if (error) return { error: `Couldn't save: ${error.message}` };
  refresh();
  return { success: `Added "${parsed.data.name}".` };
}

export async function removeCalendar(sourceId: string): Promise<{ error?: string }> {
  await requireParent();
  if (!z.string().uuid().safeParse(sourceId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_sources").delete().eq("id", sourceId);
  if (error) return { error: error.message };
  refresh();
  return {};
}

// A parent types in (or fixes) one day's lunch menu, e.g. if the automatic import fails.
export async function saveMenuDay(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireParent();
  const day = String(formData.get("day") ?? "");
  const level = String(formData.get("level") ?? "");
  const text = String(formData.get("items") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Pick a date." };
  if (!["elementary", "middle", "high"].includes(level)) return { error: "Pick a school level." };

  // One item per line; a blank line starts a new group (the first group is the main dish).
  const groups = text
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((l) => l.trim().slice(0, 120)).filter(Boolean))
    .filter((g) => g.length)
    .slice(0, 10);
  if (!groups.length && !note) return { error: "Type at least one menu item, or a note like 'No school'." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("school_menus")
    .upsert(
      { level, meal: "lunch", day, groups, note, source: "manual", updated_at: new Date().toISOString() },
      { onConflict: "level,meal,day" },
    );
  if (error) return { error: `Couldn't save: ${error.message}` };
  refresh();
  return { success: "Saved. It shows on Today and the Calendar right away." };
}

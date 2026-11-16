import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SchoolLevel } from "@/lib/schools";

export type MenuDay = {
  level: SchoolLevel;
  day: string;
  groups: string[][];
  note: string | null;
  source: "auto" | "manual";
  updated_at: string;
};

export async function loadMenus(levels: SchoolLevel[], from: string, to: string): Promise<MenuDay[]> {
  if (!levels.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("school_menus")
    .select("level, day, groups, note, source, updated_at")
    .eq("meal", "lunch")
    .in("level", levels)
    .gte("day", from)
    .lte("day", to)
    .returns<MenuDay[]>();
  return data ?? [];
}

export async function lastMenuUpdate(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("school_menus")
    .select("updated_at")
    .eq("source", "auto")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.updated_at as string | undefined) ?? null;
}

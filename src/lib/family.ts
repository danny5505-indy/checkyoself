import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Everyone in the signed-in person's family: parents first, then by when they joined.
export async function loadFamily(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, family_id, display_name, role, color, created_at")
    .order("role", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Profile[]>();
  if (error) throw new Error(`Couldn't load the family: ${error.message}`);
  return data ?? [];
}

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Family, Profile } from "@/lib/types";

// The signed-in person's profile and family. Cached for the duration of one request.
export const getCurrentMember = cache(async () => {
  // Session checks compare token expiry with the clock, so mark this as request-time work.
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, display_name, role, color, created_at")
    .eq("id", userId)
    .single<Profile>();
  if (!profile) return null;

  const { data: family } = await supabase
    .from("families")
    .select("id, name")
    .eq("id", profile.family_id)
    .single<Family>();

  return {
    profile,
    family: family ?? { id: profile.family_id, name: "Our Family" },
    email: (claims.claims.email as string | undefined) ?? "",
  };
});

// Use at the top of pages that need a signed-in member.
export async function requireMember() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return member;
}

// Use at the top of parent-only pages and actions.
export async function requireParent() {
  const member = await requireMember();
  if (member.profile.role !== "parent") redirect("/");
  return member;
}

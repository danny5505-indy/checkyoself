"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLORS, type FormState } from "@/lib/types";

export async function updateMyProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireMember();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const color = String(formData.get("color") ?? "");

  const values = { display_name: displayName, color };
  if (!displayName || displayName.length > 40) {
    return { error: "Enter a name up to 40 characters.", values };
  }
  if (!PROFILE_COLORS.includes(color as (typeof PROFILE_COLORS)[number])) {
    return { error: "Pick one of the colors.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, color })
    .eq("id", profile.id);
  if (error) return { error: "Couldn't save your profile. Try again.", values };

  revalidatePath("/", "layout");
  return { success: "Saved." };
}

export async function changeMyPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requireMember();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");

  if (next.length < 8) return { error: "Use a new password with at least 8 characters." };

  const supabase = await createClient();
  const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
  if (checkError) return { error: "Your current password isn't right." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: `Couldn't change your password: ${error.message}` };

  return { success: "Password changed." };
}

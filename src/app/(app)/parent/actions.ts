"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLORS, type FamilyRole, type FormState } from "@/lib/types";

const MIN_PASSWORD = 8;

function parseRole(value: FormDataEntryValue | null): FamilyRole | null {
  return value === "parent" || value === "kid" ? value : null;
}

// Confirms the person being changed is in the parent's own family.
async function assertSameFamily(familyId: string, memberId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", memberId)
    .eq("family_id", familyId)
    .maybeSingle();
  return Boolean(data);
}

export async function addMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { family } = await requireParent();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));
  const color = String(formData.get("color") ?? PROFILE_COLORS[0]);
  const values = { display_name: displayName, email, role: role ?? "kid", color };

  if (!displayName || displayName.length > 40) return { error: "Enter a name up to 40 characters.", values };
  if (!email.includes("@")) return { error: "Enter a valid email address.", values };
  if (!role) return { error: "Choose Parent or Kid.", values };
  if (password.length < MIN_PASSWORD) {
    return { error: `The starting password needs at least ${MIN_PASSWORD} characters.`, values };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { family_id: family.id, role, display_name: displayName, color },
  });
  if (error) {
    const taken = /already been registered|already exists/i.test(error.message);
    return {
      error: taken ? "Someone already uses that email." : `Couldn't add them: ${error.message}`,
      values,
    };
  }

  revalidatePath("/parent");
  return {
    success: `${displayName} is added. They can sign in with ${email} and the password you chose.`,
  };
}

export async function updateMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { family, profile: me } = await requireParent();
  const memberId = String(formData.get("member_id") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const role = parseRole(formData.get("role"));

  if (!(await assertSameFamily(family.id, memberId))) return { error: "That person isn't in your family." };
  if (!displayName || displayName.length > 40) return { error: "Enter a name up to 40 characters." };
  if (!role) return { error: "Choose Parent or Kid." };
  if (memberId === me.id && role !== "parent") {
    return { error: "You can't remove your own parent role. Ask the other parent." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, role })
    .eq("id", memberId);
  if (error) return { error: `Couldn't save: ${error.message}` };

  revalidatePath("/", "layout");
  return { success: "Saved." };
}

export async function resetMemberPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { family } = await requireParent();
  const memberId = String(formData.get("member_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!(await assertSameFamily(family.id, memberId))) return { error: "That person isn't in your family." };
  if (password.length < MIN_PASSWORD) {
    return { error: `The new password needs at least ${MIN_PASSWORD} characters.` };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(memberId, { password });
  if (error) return { error: `Couldn't reset the password: ${error.message}` };

  return { success: "Password reset. Let them know the new one." };
}

export async function renameFamily(_prev: FormState, formData: FormData): Promise<FormState> {
  const { family } = await requireParent();
  const name = String(formData.get("family_name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Enter a family name up to 60 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("families").update({ name }).eq("id", family.id);
  if (error) return { error: `Couldn't rename: ${error.message}` };

  revalidatePath("/", "layout");
  return { success: "Saved." };
}

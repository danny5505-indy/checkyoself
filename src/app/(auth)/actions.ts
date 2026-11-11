"use server";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/lib/types";

const MIN_PASSWORD = 8;

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const values = { email };
  if (!email || !password) return { error: "Enter your email and password.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "That email and password don't match. Try again.", values };

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// True until the first family has been set up.
export async function needsSetup(): Promise<boolean> {
  await connection();
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("families")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`Could not check setup status: ${error.message}`);
  return (count ?? 0) === 0;
}

// Creates the first parent account and the family. Only works once.
export async function setUpFamily(_prev: FormState, formData: FormData): Promise<FormState> {
  const familyName = String(formData.get("family_name") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const values = { family_name: familyName, display_name: displayName, email };
  if (!familyName || !displayName || !email) return { error: "Please fill in every field.", values };
  if (password.length < MIN_PASSWORD) {
    return { error: `Use a password with at least ${MIN_PASSWORD} characters.`, values };
  }
  if (!(await needsSetup())) return { error: "This family is already set up. Please sign in." };

  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { family_name: familyName, display_name: displayName, color: "#059669" },
  });
  if (createError) return { error: `Couldn't create the account: ${createError.message}`, values };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: "Account created, but signing in failed. Try signing in." };

  redirect("/");
}

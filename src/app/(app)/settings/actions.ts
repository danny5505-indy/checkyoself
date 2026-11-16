"use server";

import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToProfile } from "@/lib/push/send";
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

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function saveSubscription(sub: unknown, device: string): Promise<{ error?: string }> {
  const { profile } = await requireMember();
  const parsed = subscriptionSchema.safeParse(sub);
  if (!parsed.success) return { error: "This device couldn't be set up for notifications." };
  // A device can belong to only one person; if someone else signed in here before, move it.
  const admin = createAdminClient();
  await admin.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").insert({
    profile_id: profile.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    device: device.slice(0, 80),
  });
  if (error) return { error: `Couldn't save: ${error.message}` };
  refresh();
  return {};
}

export async function removeSubscription(endpoint: string): Promise<{ error?: string }> {
  await requireMember();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  refresh();
  return {};
}

export async function saveNotificationPrefs(_prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireMember();
  const time = String(formData.get("reminder_time") ?? "19:00");
  if (!/^(0[7-9]|1\d|20):(00|15|30|45)$/.test(time)) return { error: "Pick a time between 7:00 am and 8:45 pm." };
  const supabase = await createClient();
  const { error } = await supabase.from("notification_prefs").upsert({
    profile_id: profile.id,
    daily_reminder: formData.get("daily_reminder") === "on",
    reminder_time: time,
    approvals: formData.get("approvals") === "on",
    weekly_summary: formData.get("weekly_summary") === "on",
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: `Couldn't save: ${error.message}` };
  refresh();
  return { success: "Saved." };
}

export async function sendTestNotification(): Promise<{ error?: string; success?: string }> {
  const { profile } = await requireMember();
  const result = await sendToProfile(
    profile.id,
    { title: "Check Yo Self ✅", body: `Notifications are working, ${profile.display_name}!`, url: "/settings", tag: "test" },
    { ignoreQuietHours: true },
  );
  if (result.skipped === "not-configured") return { error: "Notifications aren't set up on the server yet." };
  if (result.skipped === "no-devices") return { error: "Turn on notifications on this device first." };
  if (!result.sent) return { error: "Couldn't deliver to your devices. Try turning notifications off and on again." };
  return { success: `Sent to ${result.sent} ${result.sent === 1 ? "device" : "devices"}.` };
}

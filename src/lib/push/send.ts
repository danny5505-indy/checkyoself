import "server-only";
import { sendNotification, type PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isQuietTime, localMinutes } from "./rules";

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

// Sends to every device a person has turned on.
// - `once`: log key; if this kind+key was already sent to them, nothing is sent.
// - Quiet hours (9 pm – 7 am) are respected unless `ignoreQuietHours` (the test button).
export async function sendToProfile(
  profileId: string,
  message: PushMessage,
  opts: { once?: { kind: string; key: string }; ignoreQuietHours?: boolean; now?: Date } = {},
): Promise<{ sent: number; skipped?: "quiet" | "already-sent" | "no-devices" | "not-configured" }> {
  if (!pushConfigured()) return { sent: 0, skipped: "not-configured" };
  if (!opts.ignoreQuietHours && isQuietTime(localMinutes(opts.now))) return { sent: 0, skipped: "quiet" };

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", profileId);
  if (!subs?.length) return { sent: 0, skipped: "no-devices" };

  if (opts.once) {
    // The unique index makes this the "only once" check.
    const { error } = await admin
      .from("notification_log")
      .insert({ profile_id: profileId, kind: opts.once.kind, key: opts.once.key });
    if (error) return { sent: 0, skipped: "already-sent" };
  }

  const payload = JSON.stringify({ ...message, url: message.url ?? "/" });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      const subscription: PushSubscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await sendNotification(subscription, payload, {
          TTL: 60 * 60 * 6,
          urgency: "normal",
          vapidDetails: {
            subject: process.env.VAPID_SUBJECT || "https://checkyoself.vercel.app",
            publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            privateKey: process.env.VAPID_PRIVATE_KEY!,
          },
        });
        sent++;
        await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // The device unsubscribed or the app was removed: forget it.
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("Push failed", status, (e as Error).message);
      }
    }),
  );
  return { sent };
}

// Event notifications (approvals etc.), honoring each person's "approvals" setting.
export async function notifyApprovals(profileIds: string[], message: PushMessage) {
  if (!profileIds.length || !pushConfigured()) return;
  const admin = createAdminClient();
  const { data: prefs } = await admin
    .from("notification_prefs")
    .select("profile_id, approvals")
    .in("profile_id", profileIds);
  const off = new Set((prefs ?? []).filter((p) => !p.approvals).map((p) => p.profile_id as string));
  await Promise.all(profileIds.filter((id) => !off.has(id)).map((id) => sendToProfile(id, message)));
}

export async function parentsOf(familyId: string, except?: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").eq("family_id", familyId).eq("role", "parent");
  return (data ?? []).map((p) => p.id as string).filter((id) => id !== except);
}

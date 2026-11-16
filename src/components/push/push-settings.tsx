"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  removeSubscription,
  saveNotificationPrefs,
  saveSubscription,
  sendTestNotification,
} from "@/app/(app)/settings/actions";
import { FormMessage, SubmitButton } from "@/components/form";

type Prefs = { daily_reminder: boolean; reminder_time: string; approvals: boolean; weekly_summary: boolean };

type Status = "loading" | "unsupported" | "needs-install" | "blocked" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  return "Computer";
}

// 7:00 am to 8:45 pm in 15-minute steps.
const TIMES = Array.from({ length: (21 - 7) * 4 }, (_, i) => {
  const h = 7 + Math.floor(i / 4);
  const m = (i % 4) * 15;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const label = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  return { value, label };
});

export function PushSettings({ prefs, isParent, deviceCount }: { prefs: Prefs; isParent: boolean; deviceCount: number }) {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [state, action] = useActionState(saveNotificationPrefs, undefined);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhones only offer notifications to apps added to the Home Screen.
        setStatus(isIos() && !isInstalled() ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setStatus("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  function turnOn() {
    setMessage(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "blocked" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          }));
        const r = await saveSubscription(sub.toJSON(), deviceName());
        if (r.error) setMessage({ ok: false, text: r.error });
        else {
          setStatus("on");
          setMessage({ ok: true, text: "Notifications are on for this device." });
        }
      } catch {
        setMessage({ ok: false, text: "Couldn't turn on notifications on this device." });
      }
    });
  }

  function turnOff() {
    setMessage(null);
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    });
  }

  function test() {
    setMessage(null);
    startTransition(async () => {
      const r = await sendTestNotification();
      setMessage(r.error ? { ok: false, text: r.error } : { ok: true, text: r.success ?? "Sent." });
    });
  }

  const btn = "w-full rounded-xl px-4 py-2.5 font-semibold transition disabled:opacity-60";

  return (
    <div className="space-y-4">
      {status === "needs-install" && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-ink">
          On iPhone and iPad, notifications only work in the Home Screen app. Add Check Yo Self to your Home Screen
          (steps below), open it from the icon, then come back here.
        </p>
      )}
      {status === "unsupported" && (
        <p className="text-sm text-muted">This browser doesn&apos;t support notifications. Try Safari on iPhone (from the Home Screen icon) or Chrome.</p>
      )}
      {status === "blocked" && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-ink">
          Notifications are blocked for this app. On iPhone: Settings → Notifications → Check Yo Self → Allow Notifications.
        </p>
      )}
      {status === "off" && (
        <button type="button" disabled={pending || !VAPID_PUBLIC_KEY} onClick={turnOn} className={`${btn} bg-brand text-white`}>
          {pending ? "Turning on…" : "🔔 Turn on notifications on this device"}
        </button>
      )}
      {status === "on" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-brand-strong">🔔 Notifications are on for this device.</p>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={test} className={`${btn} border border-line bg-surface text-ink`}>
              Send a test
            </button>
            <button type="button" disabled={pending} onClick={turnOff} className={`${btn} border border-line bg-surface text-muted`}>
              Turn off here
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className={`text-sm ${message.ok ? "text-brand-strong" : "text-danger"}`}>
          {message.text}
        </p>
      )}
      {deviceCount > 0 && (
        <p className="text-xs text-muted">
          On for {deviceCount} {deviceCount === 1 ? "device" : "devices"} of yours.
        </p>
      )}

      {/* Keyed by the saved values so the form shows them right after saving. */}
      <form
        key={`${prefs.reminder_time}-${prefs.daily_reminder}-${prefs.approvals}-${prefs.weekly_summary}`}
        action={action}
        className="space-y-3 border-t border-line pt-4"
      >
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium text-ink">Daily reminder</span>
            <span className="block text-xs text-muted">If anything on today&apos;s plan isn&apos;t done yet</span>
          </span>
          <input type="checkbox" name="daily_reminder" defaultChecked={prefs.daily_reminder} className="h-5 w-5 accent-[var(--brand)]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Remind me at</span>
          <select
            name="reminder_time"
            defaultValue={prefs.reminder_time.slice(0, 5)}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-brand"
          >
            {TIMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium text-ink">Approvals</span>
            <span className="block text-xs text-muted">
              {isParent ? "When a kid asks for a goal or reward" : "When a parent approves your goal or reward"}
            </span>
          </span>
          <input type="checkbox" name="approvals" defaultChecked={prefs.approvals} className="h-5 w-5 accent-[var(--brand)]" />
        </label>
        {isParent ? (
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-medium text-ink">Weekly summary</span>
              <span className="block text-xs text-muted">Sunday evening: how each kid&apos;s week went</span>
            </span>
            <input type="checkbox" name="weekly_summary" defaultChecked={prefs.weekly_summary} className="h-5 w-5 accent-[var(--brand)]" />
          </label>
        ) : (
          <input type="hidden" name="weekly_summary" value={prefs.weekly_summary ? "on" : ""} />
        )}
        <p className="text-xs text-muted">
          {isParent
            ? "You'll also hear if a kid misses an activity 3 days in a row. "
            : ""}
          No notifications between 9 pm and 7 am.
        </p>
        <FormMessage state={state} />
        <SubmitButton variant="secondary">Save notification settings</SubmitButton>
      </form>
    </div>
  );
}

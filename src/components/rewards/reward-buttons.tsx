"use client";

import { useState, useTransition } from "react";
import {
  approveRedemption,
  cancelRequest,
  declineRedemption,
  requestReward,
} from "@/app/(app)/rewards/actions";

const btn = "rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50";

export function RequestButton({ rewardId, shortBy }: { rewardId: string; shortBy: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-1">
      {message?.ok ? null : shortBy > 0 ? (
        <p className="text-sm font-medium text-muted">Need {shortBy} more</p>
      ) : (
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await requestReward(rewardId);
            setMessage(r.error ? { ok: false, text: r.error } : { ok: true, text: r.success ?? "Requested!" });
          })
        }
        className={`${btn} w-full bg-brand text-white`}
      >
        {pending ? "Requesting…" : "Request"}
      </button>
      )}
      {message && (
        <p role="status" className={`text-xs ${message.ok ? "text-brand-strong" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

export function CancelRequestButton({ redemptionId }: { redemptionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await cancelRequest(redemptionId)))}
      className="text-sm font-medium text-danger"
    >
      Cancel
    </button>
  );
}

export function DecideButtons({ redemptionId, name }: { redemptionId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  return (
    <div className="space-y-2">
      {declining && (
        <input
          aria-label={`Reason for ${name} (optional)`}
          placeholder="Reason (optional)"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-brand"
        />
      )}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => approveRedemption(redemptionId))} className={`${btn} flex-1 bg-brand text-white`}>
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => (declining ? run(() => declineRedemption(redemptionId, reason)) : setDeclining(true))}
          className={`${btn} flex-1 border border-line bg-surface text-ink`}
        >
          {declining ? "Decline" : "Not now"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

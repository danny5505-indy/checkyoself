"use client";

import { useActionState } from "react";
import { adjustPoints } from "@/app/(app)/rewards/actions";
import { FormMessage, SubmitButton } from "@/components/form";

export function AdjustPointsForm({ profileId, name }: { profileId: string; name: string }) {
  const [state, action] = useActionState(adjustPoints, undefined);
  const input =
    "w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-brand";
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <div className="flex gap-2">
        <select name="direction" aria-label="Give or take" className={`${input} w-28`} defaultValue="give">
          <option value="give">Give</option>
          <option value="take">Take</option>
        </select>
        <input name="amount" aria-label="Points" inputMode="numeric" placeholder="Points" className={`${input} w-24`} required />
        <input name="reason" aria-label="Reason" placeholder="Reason" maxLength={120} className={input} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Saving…">
        Update {name}&apos;s points
      </SubmitButton>
    </form>
  );
}

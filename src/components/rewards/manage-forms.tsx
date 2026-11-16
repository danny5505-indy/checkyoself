"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteReward, saveReward, saveSettings, setRewardActive } from "@/app/(app)/rewards/actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { Reward } from "@/lib/points/data";
import type { PointSettings } from "@/lib/points/settings";

const REWARD_EMOJIS = ["🎁", "💵", "📱", "🎮", "🎬", "🍕", "🍦", "🌙", "🛍️", "🎟️", "📚", "🏖️"];

export const SUGGESTIONS = [
  { title: "$5", emoji: "💵", cost: 500, details: "Cash or added to savings" },
  { title: "30 min screen time", emoji: "📱", cost: 150, details: "" },
  { title: "Pick the movie", emoji: "🎬", cost: 200, details: "Family movie night choice" },
  { title: "Pick dinner", emoji: "🍕", cost: 250, details: "" },
  { title: "Stay up 30 min late", emoji: "🌙", cost: 200, details: "Weekends only" },
  { title: "Ice cream trip", emoji: "🍦", cost: 300, details: "" },
];

export function RewardForm({ reward, prefill }: { reward?: Reward; prefill?: (typeof SUGGESTIONS)[number] }) {
  const [state, action] = useActionState(saveReward, undefined);
  const start = reward ?? prefill;
  const [emoji, setEmoji] = useState(start?.emoji ?? "🎁");
  return (
    <form action={action} className="space-y-3">
      {reward && <input type="hidden" name="id" value={reward.id} />}
      <input type="hidden" name="emoji" value={emoji} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Icon">
        {REWARD_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={emoji === e}
            aria-label={`Icon ${e}`}
            onClick={() => setEmoji(e)}
            className={`grid h-9 w-9 place-items-center rounded-lg border text-lg ${
              emoji === e ? "border-brand bg-brand/10" : "border-transparent bg-canvas"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <Field label="Reward" name="title" maxLength={60} defaultValue={start?.title} required />
      <Field label="Cost in points" name="cost" inputMode="numeric" defaultValue={start?.cost} required />
      <Field label="Details (optional)" name="details" maxLength={200} defaultValue={start?.details} />
      <FormMessage state={state} />
      <SubmitButton>{reward ? "Save" : "Add reward"}</SubmitButton>
    </form>
  );
}

export function SuggestionPicker({ existing }: { existing: string[] }) {
  const [picked, setPicked] = useState<(typeof SUGGESTIONS)[number] | null>(null);
  const available = SUGGESTIONS.filter((s) => !existing.includes(s.title.toLowerCase()));
  return (
    <div className="space-y-3">
      {available.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Start from an idea:</p>
          <div className="flex flex-wrap gap-1.5">
            {available.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setPicked(s)}
                className={`rounded-full px-3 py-1 text-sm ${
                  picked?.title === s.title ? "bg-brand text-white" : "bg-canvas text-ink hover:bg-line"
                }`}
              >
                {s.emoji} {s.title} · {s.cost}
              </button>
            ))}
          </div>
        </div>
      )}
      <RewardForm key={picked?.title ?? "blank"} prefill={picked ?? undefined} />
    </div>
  );
}

export function RewardRowActions({ reward }: { reward: Reward }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-3 text-sm font-medium">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await setRewardActive(reward.id, !reward.active)))}
        className="text-ink"
      >
        {reward.active ? "Hide from store" : "Show in store"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete "${reward.title}"? Past requests keep their history.`)) {
            startTransition(async () => void (await deleteReward(reward.id)));
          }
        }}
        className="text-danger"
      >
        Delete
      </button>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: PointSettings }) {
  const [state, action] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Finishing an activity" name="points_per_check_in" inputMode="numeric" defaultValue={settings.points_per_check_in} required />
      <Field
        label="Streak bonus"
        name="streak_bonus"
        inputMode="numeric"
        defaultValue={settings.streak_bonus}
        hint="Every 7 days in a row, or every 4 weeks in a row on a days-a-week plan."
        required
      />
      <Field label="Finishing a milestone" name="milestone_points" inputMode="numeric" defaultValue={settings.milestone_points} required />
      <Field label="Reaching a goal" name="goal_points" inputMode="numeric" defaultValue={settings.goal_points} required />
      <p className="text-xs text-muted">Set any of these to 0 to turn it off. Points already earned don&apos;t change.</p>
      <FormMessage state={state} />
      <SubmitButton>Save point values</SubmitButton>
    </form>
  );
}

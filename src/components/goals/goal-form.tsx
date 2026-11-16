"use client";

import { useActionState, useState } from "react";
import { saveGoal } from "@/app/(app)/goals/actions";
import { Avatar } from "@/components/avatar";
import { FormMessage, SubmitButton } from "@/components/form";
import type { ActivityInput, GoalInput, MilestoneInput } from "@/lib/goals/schema";
import { GOAL_EMOJIS, WEEKDAY_SHORT } from "@/lib/goals/types";
import type { Profile } from "@/lib/types";

type Row<T> = T & { key: string };

const newKey = () => Math.random().toString(36).slice(2);

// Drops the React list key before sending a row to the server.
function withoutKey<T>(row: Row<T>): T {
  const copy: Partial<Row<T>> = { ...row };
  delete copy.key;
  return copy as T;
}

const blankActivity = (): Row<ActivityInput> => ({
  key: newKey(),
  title: "",
  tracking: "check",
  target_amount: null,
  unit: null,
  schedule: "daily",
  weekdays: [1, 2, 3, 4, 5],
  times_per_week: 3,
});

const EXAMPLES: { label: string; activity: Omit<ActivityInput, "weekdays"> & { weekdays?: number[] } }[] = [
  { label: "📖 Bible time, 15 min a day", activity: { title: "Bible time", tracking: "minutes", target_amount: 15, unit: null, schedule: "daily", times_per_week: null } },
  { label: "🇪🇸 Spanish, 5 days a week", activity: { title: "Spanish practice", tracking: "minutes", target_amount: 15, unit: null, schedule: "per_week", times_per_week: 5 } },
  { label: "🏀 50 free throws", activity: { title: "Free throws", tracking: "count", target_amount: 50, unit: "free throws", schedule: "per_week", times_per_week: 4 } },
  { label: "🎹 Practice 20 min, weekdays", activity: { title: "Practice", tracking: "minutes", target_amount: 20, unit: null, schedule: "weekdays", weekdays: [1, 2, 3, 4, 5], times_per_week: null } },
];

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-xl bg-canvas p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
            value === o.value ? "bg-surface text-brand-strong shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ActivityEditor({
  value,
  onChange,
  onRemove,
  index,
}: {
  value: Row<ActivityInput>;
  onChange: (v: Row<ActivityInput>) => void;
  onRemove: () => void;
  index: number;
}) {
  const set = (patch: Partial<ActivityInput>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="space-y-3 rounded-2xl border border-line p-3">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-semibold text-muted">Activity {index + 1}</legend>
        <button type="button" onClick={onRemove} className="text-sm font-medium text-danger">
          Remove
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">What will you do?</span>
        <input
          className={inputClass}
          value={value.title}
          maxLength={80}
          placeholder="e.g. Read my Bible"
          onChange={(e) => set({ title: e.target.value })}
        />
      </label>

      <div>
        <span className="mb-1 block text-sm font-medium text-ink">How do you track it?</span>
        <Segmented
          label="How do you track it?"
          value={value.tracking}
          onChange={(tracking) =>
            set({
              tracking,
              target_amount: tracking === "check" ? null : value.target_amount ?? (tracking === "minutes" ? 15 : 10),
            })
          }
          options={[
            { value: "check", label: "Done ✓" },
            { value: "minutes", label: "Minutes" },
            { value: "count", label: "Count" },
          ]}
        />
      </div>

      {value.tracking !== "check" && (
        <div className="flex gap-2">
          <label className="block w-28">
            <span className="mb-1 block text-sm font-medium text-ink">Each day</span>
            <input
              className={inputClass}
              inputMode="numeric"
              value={value.target_amount ?? ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                set({ target_amount: n > 0 ? Math.min(n, 10000) : null });
              }}
            />
          </label>
          {value.tracking === "count" ? (
            <label className="block flex-1">
              <span className="mb-1 block text-sm font-medium text-ink">Of what?</span>
              <input
                className={inputClass}
                value={value.unit ?? ""}
                maxLength={30}
                placeholder="e.g. free throws, pages"
                onChange={(e) => set({ unit: e.target.value })}
              />
            </label>
          ) : (
            <p className="self-end pb-3 text-muted">minutes</p>
          )}
        </div>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium text-ink">How often?</span>
        <Segmented
          label="How often?"
          value={value.schedule}
          onChange={(schedule) => set({ schedule })}
          options={[
            { value: "daily", label: "Every day" },
            { value: "weekdays", label: "Certain days" },
            { value: "per_week", label: "Days a week" },
          ]}
        />
      </div>

      {value.schedule === "weekdays" && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which days">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = value.weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set({ weekdays: on ? value.weekdays.filter((x) => x !== d) : [...value.weekdays, d] })
                }
                className={`w-12 rounded-lg border py-1.5 text-sm font-semibold ${
                  on ? "border-brand bg-brand/10 text-brand-strong" : "border-line text-muted"
                }`}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            );
          })}
        </div>
      )}

      {value.schedule === "per_week" && (
        <label className="flex items-center gap-2">
          <select
            className={`${inputClass} w-20`}
            value={value.times_per_week ?? 3}
            onChange={(e) => set({ times_per_week: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-ink">days a week (any days)</span>
        </label>
      )}
    </fieldset>
  );
}

export function GoalForm({
  me,
  family,
  initial,
  submitLabel,
}: {
  me: Profile;
  family: Profile[];
  initial?: GoalInput;
  submitLabel: string;
}) {
  const isParent = me.role === "parent";
  const [state, action] = useActionState(saveGoal, undefined);

  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? me.id);
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🎯");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [why, setWhy] = useState(initial?.why ?? "");
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? "");
  const [visibility, setVisibility] = useState<"shared" | "private">(initial?.visibility ?? "shared");
  const [activities, setActivities] = useState<Row<ActivityInput>[]>(
    initial?.activities.map((a) => ({ ...a, key: a.id ?? newKey() })) ?? [blankActivity()],
  );
  const [milestones, setMilestones] = useState<Row<MilestoneInput>[]>(
    initial?.milestones.map((m) => ({ ...m, key: m.id ?? newKey() })) ?? [],
  );

  const payload: GoalInput = {
    id: initial?.id,
    owner_id: ownerId,
    title,
    why,
    emoji,
    target_date: targetDate || null,
    visibility,
    activities: activities.map(withoutKey),
    milestones: milestones.map(withoutKey),
  };

  const editingOther = initial?.id ? initial.owner_id !== me.id : false;
  const owner = family.find((p) => p.id === ownerId);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      {isParent && !initial?.id && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Whose goal is this?</legend>
          <div className="flex flex-wrap gap-2">
            {family.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={ownerId === p.id}
                onClick={() => setOwnerId(p.id)}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 font-medium ${
                  ownerId === p.id ? "border-brand bg-brand/10 text-brand-strong" : "border-line text-ink"
                }`}
              >
                <Avatar name={p.display_name} color={p.color} size="sm" />
                {p.id === me.id ? "Me" : p.display_name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {editingOther && owner && (
        <p className="text-sm text-muted">This is {owner.display_name}&apos;s goal.</p>
      )}

      <section className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Goal</span>
          <input
            className={inputClass}
            value={title}
            maxLength={80}
            placeholder="e.g. Become conversational in Spanish"
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Pick an icon</legend>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={emoji === e}
                aria-label={`Icon ${e}`}
                onClick={() => setEmoji(e)}
                className={`grid h-10 w-10 place-items-center rounded-xl border text-xl ${
                  emoji === e ? "border-brand bg-brand/10" : "border-transparent bg-canvas"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Why does it matter? (optional)</span>
          <textarea
            className={`${inputClass} min-h-20`}
            value={why}
            maxLength={500}
            placeholder="This shows up when you need a reminder."
            onChange={(e) => setWhy(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Target date (optional)</span>
          <input
            type="date"
            className={inputClass}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium text-ink">Who can see it?</span>
          <Segmented
            label="Who can see it?"
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: "shared", label: "Shared with family" },
              { value: "private", label: "🔒 Private" },
            ]}
          />
          <p className="mt-1 text-xs text-muted">
            {visibility === "shared"
              ? "Everyone in the family can see this goal and cheer you on."
              : "Only you and your parents can see this goal."}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-ink">The plan</h2>
          <p className="text-sm text-muted">What will you do regularly to reach this goal?</p>
        </div>
        {activities.map((a, i) => (
          <ActivityEditor
            key={a.key}
            index={i}
            value={a}
            onChange={(v) => setActivities((rows) => rows.map((r) => (r.key === a.key ? v : r)))}
            onRemove={() => setActivities((rows) => rows.filter((r) => r.key !== a.key))}
          />
        ))}
        <button
          type="button"
          onClick={() => setActivities((rows) => [...rows, blankActivity()])}
          className="w-full rounded-xl border border-dashed border-line py-2.5 font-semibold text-brand-strong hover:border-brand"
        >
          + Add an activity
        </button>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Or start from an example:</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() =>
                  setActivities((rows) => [
                    ...rows.filter((r) => r.title.trim() !== ""),
                    { ...blankActivity(), ...ex.activity, weekdays: ex.activity.weekdays ?? [1, 2, 3, 4, 5], key: newKey() },
                  ])
                }
                className="rounded-full bg-canvas px-3 py-1 text-sm text-ink hover:bg-line"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Milestones (optional)</h2>
          <p className="text-sm text-muted">Big steps along the way, with a date to aim for.</p>
        </div>
        {milestones.map((m, i) => (
          <div key={m.key} className="space-y-2 rounded-2xl border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted">Milestone {i + 1}</span>
              <button
                type="button"
                onClick={() => setMilestones((rows) => rows.filter((r) => r.key !== m.key))}
                className="text-sm font-medium text-danger"
              >
                Remove
              </button>
            </div>
            <input
              aria-label={`Milestone ${i + 1} name`}
              className={inputClass}
              value={m.title}
              maxLength={120}
              placeholder="e.g. Finish Duolingo Unit 4"
              onChange={(e) =>
                setMilestones((rows) => rows.map((r) => (r.key === m.key ? { ...r, title: e.target.value } : r)))
              }
            />
            <div className="flex items-center gap-3">
              <input
                type="date"
                aria-label={`Milestone ${i + 1} date`}
                className={inputClass}
                value={m.due_date ?? ""}
                onChange={(e) =>
                  setMilestones((rows) =>
                    rows.map((r) => (r.key === m.key ? { ...r, due_date: e.target.value || null } : r)),
                  )
                }
              />
              {m.id && (
                <label className="flex shrink-0 items-center gap-1.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={Boolean(m.done)}
                    onChange={(e) =>
                      setMilestones((rows) => rows.map((r) => (r.key === m.key ? { ...r, done: e.target.checked } : r)))
                    }
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  Done
                </label>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setMilestones((rows) => [...rows, { key: newKey(), title: "", due_date: null, done: false }])
          }
          className="w-full rounded-xl border border-dashed border-line py-2.5 font-semibold text-brand-strong hover:border-brand"
        >
          + Add a milestone
        </button>
      </section>

      {!isParent && !initial?.id && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-ink">
          A parent will look at your goal and approve it. Then it shows up on your Today screen.
        </p>
      )}

      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}

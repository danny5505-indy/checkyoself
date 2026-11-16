"use client";

import { useActionState, useTransition } from "react";
import { addCalendar, removeCalendar, saveMenuDay } from "@/app/(app)/calendar/actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";

const COLORS = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#9333ea", "#475569"];
const select =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-brand";

export function AddCalendarForm() {
  const [state, action] = useActionState(addCalendar, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Name" name="name" maxLength={40} placeholder="Family Calendar" defaultValue={state?.values?.name} required />
      <Field
        label="Calendar link"
        name="url"
        placeholder="webcal://p01-caldav.icloud.com/published/…"
        autoComplete="off"
        required
      />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Type</span>
        <select name="kind" className={select} defaultValue="family">
          <option value="family">Family</option>
          <option value="school">School</option>
        </select>
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Color</legend>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} defaultChecked={i === 0} className="peer sr-only" />
              <span
                className="block h-8 w-8 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-ink"
                style={{ backgroundColor: c }}
              />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton pendingText="Checking the link…">Add calendar</SubmitButton>
    </form>
  );
}

export function RemoveCalendarButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Remove "${name}" from the app? (It isn't deleted from Apple Calendar.)`)) {
          startTransition(async () => void (await removeCalendar(id)));
        }
      }}
      className="text-sm font-medium text-danger"
    >
      Remove
    </button>
  );
}

export function MenuFixForm({ defaultDay }: { defaultDay: string }) {
  const [state, action] = useActionState(saveMenuDay, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium text-ink">Date</span>
          <input type="date" name="day" defaultValue={defaultDay} className={select} required />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium text-ink">Menu</span>
          <select name="level" className={select} defaultValue="middle">
            <option value="elementary">Elementary</option>
            <option value="middle">Middle School</option>
            <option value="high">High School</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Menu items</span>
        <textarea
          name="items"
          rows={5}
          placeholder={"Rotini & Meat Sauce w/ Garlic Knot\n\nGreen Beans\nFruit Choices"}
          className={`${select} font-normal`}
        />
        <span className="mt-1 block text-xs text-muted">
          One item per line. The first lines are the main dish; leave a blank line before sides.
        </span>
      </label>
      <Field label="Note (optional)" name="note" maxLength={200} placeholder="e.g. No school" />
      <FormMessage state={state} />
      <SubmitButton>Save menu for this day</SubmitButton>
    </form>
  );
}

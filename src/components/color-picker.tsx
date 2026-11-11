import { PROFILE_COLORS } from "@/lib/types";

export function ColorPicker({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">Color</legend>
      <div className="flex flex-wrap gap-2">
        {PROFILE_COLORS.map((c) => (
          <label key={c} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={c}
              defaultChecked={c === (defaultValue ?? PROFILE_COLORS[0])}
              className="peer sr-only"
            />
            <span
              className="block h-9 w-9 rounded-full ring-offset-2 ring-offset-surface transition peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand"
              style={{ backgroundColor: c }}
            />
            <span className="sr-only">{c}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

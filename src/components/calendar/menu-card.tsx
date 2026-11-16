import type { MenuDay } from "@/lib/menus/data";

// "A--Corn Dog" reads better as "A: Corn Dog".
const tidy = (line: string) => line.replace(/^([A-Z])\s*--\s*/, "$1: ");

// One day's lunch: the main dish(es) up front, everything else tucked away.
export function MenuLine({ menu, label }: { menu?: MenuDay; label?: React.ReactNode }) {
  if (!menu) {
    return (
      <p className="text-sm text-muted">
        {label} <span className="italic">No menu posted</span>
      </p>
    );
  }
  if (menu.note && !menu.groups.length) {
    return (
      <p className="text-sm text-ink">
        {label} <span className="font-medium">{menu.note}</span>
      </p>
    );
  }
  const [main, ...rest] = menu.groups;
  return (
    <div className="text-sm">
      <p className="text-ink">
        {label} <span className="font-semibold">{main?.map(tidy).join(" · ")}</span>
      </p>
      {menu.note && <p className="text-xs text-muted">{menu.note}</p>}
      {rest.length > 0 && (
        <details className="mt-0.5">
          <summary className="cursor-pointer text-xs font-medium text-muted">More options</summary>
          <ul className="mt-1 space-y-1 text-xs text-muted">
            {rest.map((g, i) => (
              <li key={i}>{g.map(tidy).join(" · ")}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

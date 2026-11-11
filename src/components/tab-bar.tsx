"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, GoalsIcon, ListsIcon, RewardsIcon, TodayIcon } from "@/components/icons";

const TABS = [
  { href: "/", label: "Today", Icon: TodayIcon },
  { href: "/goals", label: "Goals", Icon: GoalsIcon },
  { href: "/rewards", label: "Rewards", Icon: RewardsIcon },
  { href: "/lists", label: "Lists", Icon: ListsIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                  active ? "text-brand-strong" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

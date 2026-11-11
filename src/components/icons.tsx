// Small outline icons for the tab bar and header.
type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export const TodayIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </svg>
);
export const GoalsIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);
export const RewardsIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3l2.7 5.5 6 .9-4.35 4.2 1 6L12 16.8 6.6 19.6l1-6L3.3 9.4l6-.9z" />
  </svg>
);
export const ListsIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth={3} />
  </svg>
);
export const CalendarIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
export const ChevronRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const ShieldIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6z" />
  </svg>
);

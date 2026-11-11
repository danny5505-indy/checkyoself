export function CheckMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">
        <CheckMark className="h-6 w-6" />
      </span>
      <span className="text-lg font-bold tracking-tight text-ink">Check Yo Self</span>
    </div>
  );
}

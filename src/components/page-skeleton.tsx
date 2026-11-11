export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading" role="status">
      <div className="h-4 w-32 rounded bg-line" />
      <div className="h-7 w-56 rounded bg-line" />
      <div className="h-28 rounded-2xl bg-line/70" />
      <div className="h-40 rounded-2xl bg-line/70" />
    </div>
  );
}

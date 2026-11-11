export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>
      {children}
    </section>
  );
}

// Placeholder for features that arrive in a later build stage.
export function ComingSoon({ stage, items }: { stage: number; items: string[] }) {
  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-strong">
        Coming in stage {stage}
      </p>
      <ul className="mt-3 space-y-2 text-ink">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-muted">•</span>
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

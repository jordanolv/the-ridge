import type { ReactNode } from 'react';

export function Card({ children, className = '', delay = 0, flush = false }: { children: ReactNode; className?: string; delay?: number; flush?: boolean }) {
  return (
    <section className={`glass animate-rise ${flush ? 'overflow-hidden' : 'p-5'} ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </section>
  );
}

export function CardTitle({ icon, children, aside }: { icon?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/60">
        {icon}
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function ProgressBar({ value, max, className = 'from-glow-cyan to-glow-violet' }: { value: number; max: number; className?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ${className}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, aside }: { title: string; subtitle: string; aside?: ReactNode }) {
  return (
    <header className="animate-rise flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
        <p className="text-white/55">{subtitle}</p>
      </div>
      {aside}
    </header>
  );
}

export function LoadFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="font-semibold">Impossible de charger cette section.</p>
      <button onClick={onRetry} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5">
        Réessayer
      </button>
    </Card>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.06] ${className}`} />;
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
      {options.map(option => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          aria-pressed={option.id === value}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            option.id === value ? 'bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]' : 'text-white/55 hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Kpi({ icon, label, value, detail, delay }: { icon: ReactNode; label: string; value: string; detail?: ReactNode; delay: number }) {
  return (
    <Card delay={delay} className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
        {icon}
        {label}
      </p>
      <p className="truncate text-3xl font-black tracking-tight">{value}</p>
      {detail && <div className="text-sm text-white/55">{detail}</div>}
    </Card>
  );
}

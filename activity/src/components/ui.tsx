import type { ReactNode } from 'react';

export function Card({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <section className={`glass animate-rise p-5 ${className}`} style={{ animationDelay: `${delay}ms` }}>
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

import type { Section } from '../navigation';
import { Card } from '../components/ui';

export function ComingSoon({ section }: { section: Section }) {
  const Icon = section.icon;
  return (
    <div className="flex flex-col gap-5">
      <header className="animate-rise">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">{section.label}</h1>
        <p className="text-white/55">{section.tagline}</p>
      </header>
      <Card className="flex min-h-72 flex-col items-center justify-center gap-3 text-center" delay={80}>
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-glow-violet/30 to-glow-cyan/20 animate-float">
          <Icon size={30} className="text-glow-violet" />
        </div>
        <p className="text-lg font-semibold">En cours d'aménagement</p>
        <p className="max-w-sm text-sm text-white/55">Cette section arrive bientôt dans le camp de base.</p>
      </Card>
    </div>
  );
}

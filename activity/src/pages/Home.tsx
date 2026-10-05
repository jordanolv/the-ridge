import { Coins, Flame, Mountain, Package, PartyPopper, Sparkles, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import type { ExpeditionTierName, HomeSummary } from '../../../src/features/activity/activity.types';
import { Avatar } from '../components/Avatar';
import { Badge, Card, CardTitle, ProgressBar } from '../components/ui';
import { formatNumber, greeting, percentChange, plural } from '../lib/format';
import type { SectionId } from '../navigation';

const TIERS: { id: ExpeditionTierName; label: string; color: string }[] = [
  { id: 'sentier', label: 'Sentier', color: 'bg-tier-sentier' },
  { id: 'falaise', label: 'Falaise', color: 'bg-tier-falaise' },
  { id: 'sommet', label: 'Sommet', color: 'bg-tier-sommet' },
];

const today = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function Kpi({ icon, label, value, detail, delay }: { icon: React.ReactNode; label: string; value: string; detail?: React.ReactNode; delay: number }) {
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

export function Home({ home, onNavigate }: { home: HomeSummary; onNavigate: (id: SectionId) => void }) {
  const { user, profile, peakHunters } = home;
  const packCount = TIERS.reduce((total, tier) => total + peakHunters.packs[tier.id], 0);
  const trend = profile ? percentChange(profile.weeklyPoints, profile.lastWeekPoints) : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="animate-rise flex flex-wrap items-center gap-4">
        <div className="animate-float">
          <Avatar userId={user.id} name={user.displayName} size={64} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm capitalize text-white/55">{today()}</p>
          <h1 className="truncate text-3xl font-black tracking-tight md:text-4xl">
            {greeting()}, <span className="text-gradient">{user.displayName}</span>
          </h1>
        </div>
      </header>

      {!profile && (
        <Card className="border-glow-violet/30">
          <p className="font-semibold">Ton profil n'existe pas encore.</p>
          <p className="text-sm text-white/60">Écris un message sur le serveur ou passe en vocal : il se crée tout seul.</p>
        </Card>
      )}

      {profile && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Kpi delay={60} icon={<Coins size={14} />} label="Solde" value={`${formatNumber(profile.money)} RC`} detail="RidgeCoins" />
          <Kpi
            delay={120}
            icon={<Sparkles size={14} />}
            label="Niveau"
            value={String(profile.level)}
            detail={
              <div className="mt-1 flex flex-col gap-1.5">
                <ProgressBar value={profile.xp.current} max={profile.xp.required} className="from-amber-400 to-yellow-200" />
                <span>
                  {formatNumber(profile.xp.current)} / {formatNumber(profile.xp.required)} XP
                </span>
              </div>
            }
          />
          <Kpi delay={180} icon={<Flame size={14} />} label="Série active" value={plural(profile.streak, 'jour')} detail={profile.streak > 0 ? 'Continue comme ça !' : 'Passe sur le serveur pour la lancer'} />
          <Kpi
            delay={240}
            icon={<Zap size={14} />}
            label="Activité de la semaine"
            value={`${formatNumber(profile.weeklyPoints)} pts`}
            detail={
              trend === null ? (
                'Première semaine comptée'
              ) : (
                <span className={`flex items-center gap-1 ${trend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {trend >= 0 ? '+' : ''}
                  {trend} % vs semaine dernière
                </span>
              )
            }
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card delay={300} className="flex flex-col">
          <CardTitle icon={<Package size={16} />} aside={packCount > 0 && <Badge className="text-glow-cyan">{packCount} à ouvrir</Badge>}>
            Packs
          </CardTitle>
          <div className="flex flex-1 flex-col gap-3">
            {TIERS.map(tier => (
              <div key={tier.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tier.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{tier.label}</p>
                  <p className="truncate text-xs text-white/45">{plural(peakHunters.expeditions[tier.id], 'expédition')} en attente</p>
                </div>
                <p className="text-right">
                  <span className="text-2xl font-black">{peakHunters.packs[tier.id]}</span>
                  <span className="ml-1 text-xs text-white/45">{peakHunters.packs[tier.id] > 1 ? 'packs' : 'pack'}</span>
                </p>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate('packs')} className="mt-4 rounded-xl bg-gradient-to-r from-glow-violet to-glow-cyan py-2.5 font-semibold text-night-950 transition hover:brightness-110">
            Ouvrir mes packs
          </button>
        </Card>

        <Card delay={360} className="flex flex-col">
          <CardTitle icon={<Mountain size={16} />}>Collection</CardTitle>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight">{peakHunters.owned}</span>
            <span className="text-white/50">/ {peakHunters.total} sommets</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={peakHunters.owned} max={peakHunters.total} />
          </div>
          <div className="mt-5 flex flex-col gap-2.5">
            {peakHunters.byRarity.map(rarity => (
              <div key={rarity.id} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-white/70">{rarity.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${(rarity.owned / Math.max(1, rarity.total)) * 100}%`, backgroundColor: rarity.color }} />
                </div>
                <span className="w-14 text-right font-semibold tabular-nums">
                  {rarity.owned}/{rarity.total}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-5">
            <div className="mb-1.5 flex justify-between text-sm text-white/55">
              <span>Fragments</span>
              <span className="font-semibold text-white/80">
                {peakHunters.fragments} / {peakHunters.fragmentsPerExpedition}
              </span>
            </div>
            <ProgressBar value={peakHunters.fragments} max={peakHunters.fragmentsPerExpedition} className="from-emerald-300 to-glow-cyan" />
          </div>
        </Card>

        <Card delay={420} className="flex flex-col">
          <CardTitle icon={<PartyPopper size={16} />}>Soirées</CardTitle>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center">
            <PartyPopper size={36} className="text-glow-pink/70" />
            <p className="font-semibold">Aucune soirée en cours</p>
            <p className="text-sm text-white/55">Les soirées vocales du serveur apparaîtront ici, en direct.</p>
          </div>
          <button onClick={() => onNavigate('parties')} className="mt-4 rounded-xl border border-white/15 py-2.5 font-semibold text-white/80 transition hover:bg-white/5">
            Voir les soirées
          </button>
        </Card>
      </div>
    </div>
  );
}

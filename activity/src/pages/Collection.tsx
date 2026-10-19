import { Globe2, LayoutGrid, Mountain, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { CollectionMountain, CollectionSummary, RarityInfo } from '../../../src/features/activity/activity.types';
import { CollectionMap } from '../components/collection/CollectionMap';
import { MountainCard } from '../components/collection/MountainCard';
import { MountainDetail } from '../components/collection/MountainDetail';
import { Card, LoadFailure, PageHeader, ProgressBar, Segmented, Skeleton } from '../components/ui';
import { fetchCollection } from '../lib/api';
import { plural } from '../lib/format';
import type { Session } from '../lib/session';
import { useResource } from '../lib/use-resource';

type Ownership = 'all' | 'owned' | 'missing';
type SortKey = 'altitude' | 'rarity' | 'recent' | 'name';
type View = 'grid' | 'globe';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'altitude', label: 'Altitude' },
  { id: 'rarity', label: 'Rareté' },
  { id: 'recent', label: 'Découverte récente' },
  { id: 'name', label: 'Nom' },
];

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function sorter(sort: SortKey, rarityOrder: Map<string, number>): (a: CollectionMountain, b: CollectionMountain) => number {
  switch (sort) {
    case 'altitude':
      return (a, b) => b.elevation - a.elevation;
    case 'rarity':
      return (a, b) => (rarityOrder.get(a.rarity) ?? 9) - (rarityOrder.get(b.rarity) ?? 9) || b.elevation - a.elevation;
    case 'recent':
      return (a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0) || b.elevation - a.elevation;
    case 'name':
      return (a, b) => a.label.localeCompare(b.label, 'fr');
  }
}

function RarityFilter({ rarity, owned, total, active, onToggle }: { rarity: RarityInfo; owned: number; total: number; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      className={`flex min-w-0 flex-col gap-2 rounded-xl border px-3 py-2.5 text-left transition ${active ? 'border-white/30 bg-white/10' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]'}`}
    >
      <span className="flex w-full items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 truncate font-medium">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: rarity.color }} />
          {rarity.label}
        </span>
        <span className="font-semibold tabular-nums text-white/80">
          {owned}/{total}
        </span>
      </span>
      <span className="block h-1 w-full overflow-hidden rounded-full bg-white/10">
        <span className="block h-full rounded-full" style={{ width: `${(owned / Math.max(1, total)) * 100}%`, backgroundColor: rarity.color }} />
      </span>
    </button>
  );
}

function CollectionContent({ collection, mapboxToken }: { collection: CollectionSummary; mapboxToken: string | null }) {
  const [rarityFilter, setRarityFilter] = useState<Set<string>>(new Set());
  const [ownership, setOwnership] = useState<Ownership>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('altitude');
  const [view, setView] = useState<View>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const rarities = useMemo(() => new Map(collection.rarities.map(r => [r.id, r])), [collection]);
  const rarityOrder = useMemo(() => new Map(collection.rarities.map((r, index) => [r.id, index])), [collection]);
  const owned = collection.mountains.filter(m => m.unlockedAt !== null).length;

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    return collection.mountains
      .filter(m => rarityFilter.size === 0 || rarityFilter.has(m.rarity))
      .filter(m => ownership === 'all' || (ownership === 'owned') === (m.unlockedAt !== null))
      .filter(m => !needle || normalize(`${m.label} ${m.countries.join(' ')}`).includes(needle))
      .sort(sorter(sort, rarityOrder));
  }, [collection, rarityFilter, ownership, query, sort, rarityOrder]);

  const selectedIndex = visible.findIndex(m => m.id === selectedId);
  const selected = selectedIndex >= 0 ? visible[selectedIndex] : null;

  const toggleRarity = (id: string) =>
    setRarityFilter(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const open = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  const step = useCallback(
    (offset: -1 | 1) => {
      if (visible.length === 0) return;
      const index = (Math.max(0, selectedIndex) + offset + visible.length) % visible.length;
      setSelectedId(visible[index].id);
    },
    [visible, selectedIndex],
  );

  const closeDetail = useCallback(() => setDetailOpen(false), []);

  return (
    <>
      <Card delay={60} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight">{owned}</span>
            <span className="text-white/50">/ {collection.mountains.length} sommets</span>
          </p>
          <p className="mb-3 text-sm text-white/55">{Math.round((owned / Math.max(1, collection.mountains.length)) * 100)} % du monde exploré</p>
          <ProgressBar value={owned} max={collection.mountains.length} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {collection.rarities.map(rarity => {
            const ofRarity = collection.mountains.filter(m => m.rarity === rarity.id);
            return (
              <RarityFilter
                key={rarity.id}
                rarity={rarity}
                owned={ofRarity.filter(m => m.unlockedAt !== null).length}
                total={ofRarity.length}
                active={rarityFilter.has(rarity.id)}
                onToggle={() => toggleRarity(rarity.id)}
              />
            );
          })}
        </div>
      </Card>

      <div className="animate-rise flex flex-wrap items-center gap-2.5" style={{ animationDelay: '120ms' }}>
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 focus-within:border-glow-violet/60">
          <Search size={16} className="text-white/45" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Chercher un sommet ou un pays"
            className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
          />
        </label>
        <Segmented<Ownership>
          value={ownership}
          onChange={setOwnership}
          options={[
            { id: 'all', label: 'Tous' },
            { id: 'owned', label: 'Découverts' },
            { id: 'missing', label: 'Manquants' },
          ]}
        />
        <select
          value={sort}
          onChange={event => setSort(event.target.value as SortKey)}
          aria-label="Trier par"
          className="rounded-xl border border-white/10 bg-night-900 px-3 py-2 text-sm text-white/80 outline-none"
        >
          {SORTS.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {mapboxToken && (
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { id: 'grid', label: <><LayoutGrid size={15} /> Grille</> },
              { id: 'globe', label: <><Globe2 size={15} /> Globe</> },
            ]}
          />
        )}
      </div>

      <p className="-mb-2 text-sm text-white/50">{plural(visible.length, 'sommet')}</p>

      {view === 'globe' && mapboxToken ? (
        <div className="glass animate-rise relative h-[62vh] min-h-96 overflow-hidden">
          <CollectionMap token={mapboxToken} mountains={visible} rarities={rarities} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="pointer-events-none absolute left-3 top-3 flex gap-3 rounded-full bg-night-950/70 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-glow-violet" /> Découvert
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400/70" /> Manquant
            </span>
          </div>
          {selected && (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-night-950/80 p-2.5 shadow-xl backdrop-blur-xl sm:bottom-auto sm:left-auto sm:right-3 sm:top-3 sm:w-96">
              <img src={selected.thumbnail} alt="" className={`h-16 w-28 shrink-0 rounded-lg object-cover ${selected.unlockedAt ? '' : 'brightness-50 grayscale'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {selected.label} {selected.flags.join(' ')}
                </p>
                <p className="truncate text-xs text-white/55">
                  {rarities.get(selected.rarity)?.label} · {selected.altitude}
                </p>
                <button onClick={() => setDetailOpen(true)} className="mt-1 text-sm font-semibold text-glow-cyan hover:underline">
                  Voir la fiche
                </button>
              </div>
            </div>
          )}
        </div>
      ) : visible.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Mountain size={32} className="text-white/30" />
          <p className="font-semibold">Aucun sommet ne correspond</p>
          <p className="text-sm text-white/50">Change de filtre ou de recherche.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {visible.map(mountain => (
            <MountainCard key={mountain.id} mountain={mountain} rarity={rarities.get(mountain.rarity)!} onSelect={() => open(mountain.id)} />
          ))}
        </div>
      )}

      {detailOpen && selected && (
        <MountainDetail mountain={selected} rarity={rarities.get(selected.rarity)!} position={{ index: selectedIndex, total: visible.length }} onClose={closeDetail} onStep={step} />
      )}
    </>
  );
}

export function Collection({ session }: { session: Session }) {
  const load = useCallback(() => fetchCollection(session), [session]);
  const { resource, reload } = useResource(load);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Collection" subtitle="Tous les sommets de Peak Hunters, sur la grille ou sur le globe." />
      {resource.status === 'loading' && (
        <>
          <Skeleton className="h-40" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3]" />
            ))}
          </div>
        </>
      )}
      {resource.status === 'error' && <LoadFailure onRetry={reload} />}
      {resource.status === 'ready' && <CollectionContent collection={resource.data} mapboxToken={session.config.mapboxToken} />}
    </div>
  );
}

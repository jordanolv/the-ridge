import type { ActivityUser } from '../../../src/features/activity/activity.types';
import { SECTIONS, type SectionId } from '../navigation';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

interface NavigationProps {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  user: ActivityUser;
}

export function Sidebar({ active, onSelect, user }: NavigationProps) {
  return (
    <aside className="glass m-3 hidden w-60 shrink-0 flex-col p-4 md:flex">
      <div className="flex items-center gap-3 px-2 pb-6 pt-1">
        <Logo />
        <div>
          <p className="text-lg font-black leading-tight tracking-tight">The Ridge</p>
          <p className="text-xs text-white/50">Camp de base</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const selected = id === active;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                selected ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18} className={selected ? 'text-glow-violet' : 'transition group-hover:text-glow-cyan'} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
        <Avatar userId={user.id} name={user.displayName} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.displayName}</p>
          <p className="truncate text-xs text-white/50">@{user.username}</p>
        </div>
      </div>
    </aside>
  );
}

export function BottomNav({ active, onSelect }: Omit<NavigationProps, 'user'>) {
  return (
    <nav className="glass fixed inset-x-2 bottom-2 z-20 flex justify-around p-1.5 md:hidden">
      {SECTIONS.map(({ id, label, icon: Icon }) => {
        const selected = id === active;
        return (
          <button key={id} onClick={() => onSelect(id)} className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ${selected ? 'bg-white/10 text-white' : 'text-white/55'}`}>
            <Icon size={20} className={selected ? 'text-glow-violet' : ''} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

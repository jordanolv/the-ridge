import { Logo } from './Logo';

export function SplashScreen() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-5">
        <div className="animate-float">
          <Logo size={72} />
        </div>
        <p className="text-gradient text-lg font-bold">Ouverture du camp de base…</p>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-glow-cyan to-glow-violet" />
        </div>
      </div>
      <style>{'@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }'}</style>
    </div>
  );
}

export function ErrorScreen({ message, detail, onRetry }: { message: string; detail?: string; onRetry: () => void }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="glass flex max-w-sm flex-col items-center gap-3 p-8 text-center">
        <Logo size={48} />
        <p className="text-lg font-bold">Impossible d'ouvrir le camp de base</p>
        <p className="text-sm text-white/60">{message}</p>
        {detail && <p className="break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-white/45">{detail}</p>}
        <button onClick={onRetry} className="mt-2 rounded-xl bg-gradient-to-r from-glow-violet to-glow-cyan px-5 py-2 font-semibold text-night-950">
          Réessayer
        </button>
      </div>
    </div>
  );
}

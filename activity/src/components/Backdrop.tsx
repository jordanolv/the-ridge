import { brandUrl } from '../lib/api';

/** Le fond du thème classique, assombri : le même décor que la carte /me. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1b1f4a_0%,_#070814_70%)]" />
      <img src={brandUrl('background')} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-70" onError={e => e.currentTarget.remove()} />
      <div className="absolute inset-0 bg-gradient-to-b from-night-950/10 via-night-950/45 to-night-950/85" />
    </div>
  );
}

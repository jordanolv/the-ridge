import type { RefObject } from 'react';

/** Le CSS de Mapbox, hors couche Tailwind, impose `position: relative` au conteneur : on le place via un parent. */
export function MapFrame({ container, ready }: { container: RefObject<HTMLDivElement | null>; ready: boolean }) {
  return (
    <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <div ref={container} className="h-full w-full" />
    </div>
  );
}

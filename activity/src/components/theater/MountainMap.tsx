import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import cspWorkerUrl from 'mapbox-gl/dist/mapbox-gl-csp-worker.js?url';

export type LngLat = [number, number];

export type CameraShot =
  | { id: string; kind: 'globe'; center: LngLat; duration: number }
  | { id: string; kind: 'fly'; center: LngLat; elevation: number; bearing: number; duration: number }
  | { id: string; kind: 'orbit'; degrees: number; duration: number }
  | { id: string; kind: 'overview'; points: LngLat[]; duration: number };

export interface SummitMarker {
  id: string;
  position: LngLat;
  color: string;
}

/** Plus le sommet est haut, plus la caméra recule : à pitch égal, elle finirait dans la pente. */
const summitZoom = (elevation: number) => (elevation >= 6000 ? 10.9 : elevation >= 3000 ? 11.6 : 12.3);
const SUMMIT_PITCH = 66;
const GLOBE_ZOOM = 1.35;

/**
 * La CSP d'une Activity bloque les domaines de Mapbox : tout repasse par le serveur du bot.
 * L'URL est absolue parce que les tuiles sont demandées depuis le worker de la carte.
 */
function throughProxy(url: string) {
  const match = /^https:\/\/([a-z0-9-]+)\.mapbox\.com\/(.*)$/.exec(url);
  return { url: match ? `${location.origin}/api/activity/mapbox/${match[1]}/${match[2]}` : url };
}

const linear = (t: number) => t;

function frame(map: MapboxMap, shot: CameraShot): void {
  const bottom = map.getContainer().clientHeight * 0.32;

  switch (shot.kind) {
    case 'globe':
      map.jumpTo({ center: [shot.center[0] - 50, shot.center[1] * 0.5], zoom: GLOBE_ZOOM, pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
      map.easeTo({ center: [shot.center[0] - 20, shot.center[1] * 0.6], duration: shot.duration, easing: linear });
      break;
    case 'fly':
      map.flyTo({ center: shot.center, zoom: summitZoom(shot.elevation), pitch: SUMMIT_PITCH, bearing: shot.bearing, duration: shot.duration, curve: 1.7, essential: true, padding: { top: 0, bottom, left: 0, right: 0 } });
      break;
    case 'orbit':
      map.easeTo({ bearing: map.getBearing() + shot.degrees, duration: shot.duration, easing: linear, essential: true });
      break;
    case 'overview': {
      if (shot.points.length === 0) break;
      const lngs = shot.points.map(p => p[0]);
      const lats = shot.points.map(p => p[1]);
      const padding = { top: 90, bottom, left: 60, right: 60 };
      const camera = map.cameraForBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding, maxZoom: 4 });
      map.flyTo({ ...camera, zoom: Math.max(GLOBE_ZOOM, camera?.zoom ?? GLOBE_ZOOM), pitch: 0, bearing: 0, duration: shot.duration, curve: 1.4, essential: true, padding });
      break;
    }
  }
}

function markerElement(color: string): HTMLElement {
  const element = document.createElement('div');
  element.className = 'summit-marker';
  element.style.setProperty('--marker-color', color);
  return element;
}

export function MountainMap({ token, shot, markers }: { token: string; shot: CameraShot; markers: SummitMarker[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const placed = useRef(new Map<string, Marker>());
  const markerClass = useRef<typeof Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void import('mapbox-gl')
      .then(({ default: mapboxgl }) => {
        if (cancelled || !container.current) return;
        mapboxgl.workerUrl = cspWorkerUrl;
        markerClass.current = mapboxgl.Marker;

        const instance = new mapboxgl.Map({
          container: container.current,
          accessToken: token,
          style: 'mapbox://styles/mapbox/satellite-v9',
          projection: 'globe',
          center: [shot.kind === 'globe' ? shot.center[0] - 50 : 0, 20],
          zoom: GLOBE_ZOOM,
          interactive: false,
          attributionControl: false,
          transformRequest: throughProxy,
        });
        map.current = instance;

        instance.on('style.load', () => {
          instance.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
          instance.setTerrain({ source: 'mapbox-dem', exaggeration: 1.35 });
          instance.setFog({
            color: 'rgb(120, 140, 190)',
            'high-color': 'rgb(36, 32, 92)',
            'horizon-blend': 0.06,
            'space-color': 'rgb(5, 6, 18)',
            'star-intensity': 0.7,
          });
          setReady(true);
        });
        instance.on('error', event => console.warn('[mapbox]', event.error));
      })
      .catch(error => {
        console.warn('[mapbox]', error);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      placed.current.clear();
    };
    // La carte est créée une fois par ouverture ; les plans suivants passent par `frame`.
  }, [token]);

  useEffect(() => {
    if (ready && map.current) frame(map.current, shot);
    // Un plan n'est joué qu'une fois, à son arrivée : son id suffit.
  }, [ready, shot.id]);

  useEffect(() => {
    const instance = map.current;
    const Marker = markerClass.current;
    if (!ready || !instance || !Marker) return;

    const wanted = new Set(markers.map(m => m.id));
    for (const [id, marker] of placed.current) {
      if (wanted.has(id)) continue;
      marker.remove();
      placed.current.delete(id);
    }
    for (const summit of markers) {
      if (placed.current.has(summit.id)) continue;
      placed.current.set(summit.id, new Marker({ element: markerElement(summit.color) }).setLngLat(summit.position).addTo(instance));
    }
  }, [ready, markers]);

  if (failed) return null;
  // Le CSS de Mapbox, hors couche Tailwind, impose `position: relative` au conteneur : on le place via un parent.
  return (
    <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <div ref={container} className="h-full w-full" />
    </div>
  );
}

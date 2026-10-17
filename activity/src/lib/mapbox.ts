import type { Map as MapboxMap } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import cspWorkerUrl from 'mapbox-gl/dist/mapbox-gl-csp-worker.js?url';

export type LngLat = [number, number];

export const SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-v9';
export const GLOBE_ZOOM = 1.35;

/**
 * La CSP d'une Activity bloque les domaines de Mapbox : tout repasse par le serveur du bot.
 * L'URL est absolue parce que les tuiles sont demandées depuis le worker de la carte.
 */
export function throughProxy(url: string) {
  const match = /^https:\/\/([a-z0-9-]+)\.mapbox\.com\/(.*)$/.exec(url);
  return { url: match ? `${location.origin}/api/activity/mapbox/${match[1]}/${match[2]}` : url };
}

export async function loadMapbox() {
  const { default: mapboxgl } = await import('mapbox-gl');
  mapboxgl.workerUrl = cspWorkerUrl;
  return mapboxgl;
}

export function addTerrainAndSky(map: MapboxMap): void {
  map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.35 });
  map.setFog({
    color: 'rgb(120, 140, 190)',
    'high-color': 'rgb(36, 32, 92)',
    'horizon-blend': 0.06,
    'space-color': 'rgb(5, 6, 18)',
    'star-intensity': 0.7,
  });
}

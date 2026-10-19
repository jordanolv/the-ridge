import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import type { CollectionMountain, RarityInfo } from '../../../../src/features/activity/activity.types';
import { GLOBE_ZOOM, SATELLITE_STYLE, addTerrainAndSky, loadMapbox, throughProxy } from '../../lib/mapbox';
import { MapFrame } from '../MapFrame';

const SOURCE = 'summits';
const MISSING_COLOR = '#94a3b8';
const SUMMIT_ZOOM = 11.2;

interface CollectionMapProps {
  token: string;
  mountains: CollectionMountain[];
  rarities: Map<string, RarityInfo>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function toGeoJson(mountains: CollectionMountain[], rarities: Map<string, RarityInfo>, selectedId: string | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: mountains
      .filter(m => m.lat !== null && m.lng !== null)
      .map(m => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [m.lng!, m.lat!] },
        properties: {
          id: m.id,
          owned: m.unlockedAt !== null,
          selected: m.id === selectedId,
          color: m.unlockedAt !== null ? (rarities.get(m.rarity)?.color ?? '#ffffff') : MISSING_COLOR,
        },
      })),
  };
}

function addSummitLayers(map: MapboxMap): void {
  map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'summits-missing',
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'owned'], false],
    paint: { 'circle-radius': 3.5, 'circle-color': MISSING_COLOR, 'circle-opacity': 0.6, 'circle-stroke-width': 1, 'circle-stroke-color': '#0c0f24' },
  });
  map.addLayer({
    id: 'summits-owned',
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'owned'], true],
    paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
  });
  map.addLayer({
    id: 'summits-selected',
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'selected'], true],
    paint: { 'circle-radius': 13, 'circle-color': 'transparent', 'circle-stroke-width': 3, 'circle-stroke-color': ['get', 'color'] },
  });
}

export function CollectionMap({ token, mountains, rarities, selectedId, onSelect }: CollectionMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const select = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  select.current = onSelect;

  useEffect(() => {
    let cancelled = false;

    void loadMapbox()
      .then(mapboxgl => {
        if (cancelled || !container.current) return;
        const instance = new mapboxgl.Map({
          container: container.current,
          accessToken: token,
          style: SATELLITE_STYLE,
          projection: 'globe',
          center: [20, 30],
          zoom: GLOBE_ZOOM,
          attributionControl: false,
          transformRequest: throughProxy,
        });
        map.current = instance;

        instance.on('style.load', () => {
          addTerrainAndSky(instance);
          addSummitLayers(instance);
          setReady(true);
        });
        for (const layer of ['summits-owned', 'summits-missing']) {
          instance.on('click', layer, event => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') select.current(id);
          });
          instance.on('mouseenter', layer, () => (instance.getCanvas().style.cursor = 'pointer'));
          instance.on('mouseleave', layer, () => (instance.getCanvas().style.cursor = ''));
        }
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
    };
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    (map.current?.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJson(mountains, rarities, selectedId));
  }, [ready, mountains, rarities, selectedId]);

  useEffect(() => {
    const selected = mountains.find(m => m.id === selectedId);
    if (!ready || !map.current) return;
    if (selected?.lat == null || selected.lng == null) {
      map.current.flyTo({ center: map.current.getCenter(), zoom: GLOBE_ZOOM, pitch: 0, bearing: 0, duration: 2200, essential: true });
      return;
    }
    map.current.flyTo({ center: [selected.lng, selected.lat], zoom: SUMMIT_ZOOM, pitch: 62, bearing: -20, duration: 4200, curve: 1.6, essential: true });
    // Seul un changement de sommet déplace la caméra, pas un changement de filtre.
  }, [ready, selectedId]);

  if (failed) return <p className="grid h-full place-items-center text-sm text-white/50">La carte n'a pas pu se charger.</p>;

  return <MapFrame container={container} ready={ready} />;
}

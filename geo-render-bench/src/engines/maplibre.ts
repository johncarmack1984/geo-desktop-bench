import maplibregl, {
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl';
import type { ViewState } from '../bench/camera';
import type { PointData } from '../data';
import type { Engine } from './types';

// No basemap tiles — just a background + the point source — so the number
// reflects MapLibre's own geometry pipeline (client-side tiling via geojson-vt
// + circle rendering), not network tile fetches.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0b1020' } },
  ],
};

export class MapLibreEngine implements Engine {
  readonly name = 'MapLibre';
  private map: maplibregl.Map | null = null;

  mount(container: HTMLElement, initial: ViewState): Promise<void> {
    const map = new maplibregl.Map({
      container,
      style: STYLE,
      center: [initial.longitude, initial.latitude],
      zoom: initial.zoom,
      bearing: initial.bearing,
      pitch: initial.pitch,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    this.map = map;
    return new Promise((resolve) => {
      map.on('load', () => {
        map.addSource('pts', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'points',
          type: 'circle',
          source: 'pts',
          paint: {
            'circle-radius': 2,
            'circle-color': '#89b4fa',
            'circle-stroke-width': 0,
          },
        });
        resolve();
      });
    });
  }

  setData(data: PointData): Promise<void> {
    const map = this.map;
    if (!map) throw new Error('maplibre not mounted');
    return new Promise((resolve) => {
      // 'idle' fires once tiling + rendering have fully settled — our ttfr.
      map.once('idle', () => resolve());
      const src = map.getSource('pts') as GeoJSONSource;
      src.setData(data.toGeoJSON() as Parameters<GeoJSONSource['setData']>[0]);
    });
  }

  applyView(view: ViewState): void {
    this.map?.jumpTo({
      center: [view.longitude, view.latitude],
      zoom: view.zoom,
      bearing: view.bearing,
      pitch: view.pitch,
    });
  }

  destroy(): void {
    this.map?.remove();
    this.map = null;
  }
}

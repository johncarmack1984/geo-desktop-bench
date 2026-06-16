import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';

// Register the pmtiles:// protocol so MapLibre streams vector tiles by byte-range
// straight from the single-file archive — no tile server. THIS is the right way
// to feed MapLibre at scale, vs the GeoJSON source that stalls past ~1M features.
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// Dark theme over the Protomaps v4 layers present in the Firenze archive. No
// glyphs → no labels, but fully offline (labels would need bundled fonts).
const style: StyleSpecification = {
  version: 8,
  sources: {
    protomaps: { type: 'vector', url: 'pmtiles:///firenze.pmtiles' },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0b1020' } },
    {
      id: 'earth',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'earth',
      paint: { 'fill-color': '#11162a' },
    },
    {
      id: 'landcover',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'landcover',
      paint: { 'fill-color': '#152038', 'fill-opacity': 0.5 },
    },
    {
      id: 'landuse',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'landuse',
      paint: { 'fill-color': '#17223d' },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'water',
      paint: { 'fill-color': '#244a6b' },
    },
    {
      id: 'roads',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      paint: { 'line-color': '#46517a', 'line-width': 1 },
    },
    {
      id: 'buildings',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'buildings',
      paint: { 'fill-color': '#2f3a5e', 'fill-opacity': 0.9 },
    },
  ],
};

const map = new maplibregl.Map({
  container: 'map',
  style,
  center: [11.2558, 43.7696], // Florence
  zoom: 14,
  pitch: 45,
  attributionControl: false,
});

const hud = document.getElementById('hud') as HTMLElement;

// Spin continuously so we render every frame, and read out the FPS / frame time.
let last = performance.now();
let acc = 0;
let frames = 0;
function tick(now: number): void {
  const dt = now - last;
  last = now;
  acc += dt;
  frames++;
  if (acc >= 500) {
    const ms = acc / frames;
    hud.textContent = `MapLibre + PMTiles · Firenze vector tiles (no server)\n${(1000 / ms).toFixed(0)} fps · ${ms.toFixed(1)} ms/frame`;
    acc = 0;
    frames = 0;
  }
  map.setBearing((now / 80) % 360);
  requestAnimationFrame(tick);
}
map.on('load', () => requestAnimationFrame(tick));

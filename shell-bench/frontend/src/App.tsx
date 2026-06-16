import { ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { useEffect, useRef, useState } from 'react';
import { bridge, type Pt } from './bridge';

// Stream the PMTiles vector basemap by byte-range — no tile server.
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// Firenze basemap (Protomaps v4 layers), dark, no labels (fully offline).
const STYLE: StyleSpecification = {
  version: 8,
  sources: { protomaps: { type: 'vector', url: 'pmtiles:///firenze.pmtiles' } },
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
      paint: { 'fill-color': '#2f3a5e', 'fill-opacity': 0.85 },
    },
  ],
};

// Query a bbox over Florence — DuckDB synthesizes points across Tuscany and
// filters to this box, so the results land on the basemap.
const BBOX = { west: 11.15, south: 43.72, east: 11.35, north: 43.84 };

// 1000 echo round-trips over the shell's IPC bridge; reports to native stdout.
async function runIpcBench(): Promise<string> {
  const N = 1000;
  const payload = 'x'.repeat(64);
  await bridge.echo(payload); // warm
  const t0 = performance.now();
  for (let i = 0; i < N; i++) await bridge.echo(payload);
  const total = performance.now() - t0;
  const line = `${bridge.host}: ${N} echoes · ${((total / N) * 1000).toFixed(1)} µs/call · ${total.toFixed(1)} ms total`;
  bridge.reportResult(line);
  return line;
}

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [ipc, setIpc] = useState('measuring IPC…');
  const [q, setQ] = useState('click to query DuckDB →');

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const map = new maplibregl.Map({
      container: el,
      style: STYLE,
      center: [11.2558, 43.7696], // Florence
      zoom: 13,
      pitch: 45,
      attributionControl: false,
    });
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    // deck.gl's MapboxOverlay is typed against mapbox-gl's IControl; MapLibre's is
    // structurally compatible.
    map.addControl(overlay as unknown as maplibregl.IControl);
    overlayRef.current = overlay;
    map.on('load', () => {
      requestAnimationFrame(() => bridge.reportReady());
      void runIpcBench().then(setIpc);
    });
    return () => map.remove();
  }, []);

  async function queryDuck(): Promise<void> {
    setQ('querying DuckDB…');
    const pts = await bridge.query(
      BBOX.west,
      BBOX.south,
      BBOX.east,
      BBOX.north,
      50000,
    );
    overlayRef.current?.setProps({
      layers: [
        new ScatterplotLayer<Pt>({
          id: 'duckdb',
          data: pts,
          getPosition: (d) => [d.lon, d.lat] as [number, number],
          getFillColor: [166, 227, 161] as [number, number, number],
          radiusUnits: 'pixels',
          getRadius: 2,
          radiusMinPixels: 1.5,
          opacity: 0.8,
        }),
      ],
    });
    setQ(
      pts.length
        ? `${pts.length.toLocaleString()} pts from DuckDB → deck.gl over PMTiles`
        : 'no rows (DuckDB runs only in the Tauri shell)',
    );
  }

  return (
    <>
      <div ref={mapRef} id="map" />
      <div id="hud">
        <div>
          shell-bench · host: <b>{bridge.host}</b>
        </div>
        <button type="button" onClick={() => void runIpcBench().then(setIpc)}>
          run IPC bench (1k echoes)
        </button>
        <div className="mono">{ipc}</div>
        <button type="button" onClick={() => void queryDuck()}>
          query DuckDB (Rust) → deck.gl
        </button>
        <div className="mono">{q}</div>
      </div>
    </>
  );
}

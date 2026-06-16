import { ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import * as duckdb from '@duckdb/duckdb-wasm';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';

// Same Firenze PMTiles basemap as the desktop capstone — streamed by byte-range,
// no tile server.
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

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

// Same query as the Rust capstone: synthesize a Tuscany point cloud in-DB, filter
// to a Florence bbox — but here DuckDB runs as WASM in a web worker.
const SQL = `SELECT lon, lat FROM (
  SELECT 10.5 + random() * 1.5 AS lon, 43.0 + random() * 1.5 AS lat FROM range(1000000)
) WHERE lon BETWEEN 11.15 AND 11.35 AND lat BETWEEN 43.72 AND 43.84 LIMIT 50000`;

interface Pt {
  lon: number;
  lat: number;
}

const hud = document.getElementById('hud') as HTMLElement;
const btn = document.getElementById('run') as HTMLButtonElement;

const map = new maplibregl.Map({
  container: 'map',
  style: STYLE,
  center: [11.2558, 43.7696], // Florence
  zoom: 13,
  pitch: 45,
  attributionControl: false,
});
const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
map.addControl(overlay as unknown as maplibregl.IControl);

// Load the DuckDB-WASM CDN bundle; wrap the cross-origin worker in a blob URL.
async function initDuckDB(): Promise<duckdb.AsyncDuckDBConnection> {
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  if (!bundle.mainWorker) throw new Error('no duckdb-wasm worker bundle');
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: 'text/javascript',
    }),
  );
  const db = new duckdb.AsyncDuckDB(
    new duckdb.ConsoleLogger(),
    new Worker(workerUrl),
  );
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? undefined);
  URL.revokeObjectURL(workerUrl);
  return db.connect();
}

let conn: duckdb.AsyncDuckDBConnection | null = null;

async function run(): Promise<void> {
  btn.disabled = true;
  try {
    if (!conn) {
      hud.textContent = 'loading DuckDB-WASM…';
      conn = await initDuckDB();
    }
    hud.textContent = 'querying DuckDB-WASM…';
    const t0 = performance.now();
    const result = await conn.query(SQL);
    const ms = performance.now() - t0;
    const pts = (result.toArray() as Pt[]).map((r) => ({
      lon: r.lon,
      lat: r.lat,
    }));
    overlay.setProps({
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
    hud.textContent = `${pts.length.toLocaleString()} pts · DuckDB-WASM ${ms.toFixed(0)} ms → deck.gl over PMTiles`;
  } catch (err) {
    hud.textContent = `error: ${(err as Error).message}`;
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener('click', () => void run());
map.on('load', () => {
  hud.textContent = 'basemap ready — click “query DuckDB-WASM”';
});

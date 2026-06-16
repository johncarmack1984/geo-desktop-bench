import 'maplibre-gl/dist/maplibre-gl.css';
import { CAMERA_PATH_DURATION_MS, sampleCameraPath } from './bench/camera';
import {
  captureFrames,
  detectRefreshHz,
  type FrameStats,
  summarize,
} from './bench/harness';
import { downloadJSON, renderResults } from './bench/results';
import { makePoints } from './data';
import { DeckEngine } from './engines/deckgl';
import { MapLibreEngine } from './engines/maplibre';
import type { Engine } from './engines/types';
import { WebGL2Engine } from './engines/webgl2';

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;
const mapEl = $('map');
const hud = $('hud');
const engineSel = $<HTMLSelectElement>('engine');
const pointsSel = $<HTMLSelectElement>('points');
const repsInput = $<HTMLInputElement>('reps');
const runBtn = $<HTMLButtonElement>('run');
const sweepBtn = $<HTMLButtonElement>('sweep');
const downloadBtn = $<HTMLButtonElement>('download');
const resultsEl = $('results');

// Past this, building object GeoJSON for MapLibre is multi-GB and stalls the main
// thread for tens of seconds — the realistic ceiling of the GeoJSON source path.
const MAPLIBRE_MAX_POINTS = 3_000_000;
const WARMUP_MS = 1200;
const SWEEP_SIZES = [100_000, 1_000_000, 3_000_000, 10_000_000];

const results: FrameStats[] = [];
let busy = false;

const ENGINES: Record<string, { label: string; make: () => Engine }> = {
  webgl2: { label: 'WebGL2 (raw)', make: () => new WebGL2Engine() },
  deckgl: { label: 'deck.gl', make: () => new DeckEngine() },
  maplibre: { label: 'MapLibre', make: () => new MapLibreEngine() },
};
const labelFor = (engineName: string): string =>
  ENGINES[engineName]?.label ?? engineName;
const makeEngine = (engineName: string): Engine => ENGINES[engineName].make();
const setHud = (text: string): void => {
  hud.textContent = text;
};

async function runOne(
  engineName: string,
  points: number,
  reps: number,
): Promise<FrameStats> {
  const label = labelFor(engineName);

  if (engineName === 'maplibre' && points > MAPLIBRE_MAX_POINTS) {
    return {
      engine: label,
      points,
      reps,
      refreshHz: 60,
      meanFps: Number.NaN,
      p50: Number.NaN,
      p95: Number.NaN,
      p99: Number.NaN,
      maxMs: Number.NaN,
      jankPct: Number.NaN,
      ttfrMs: Number.NaN,
      frameCount: 0,
      skipped: `skipped — ${points.toLocaleString()} GeoJSON features exceed MapLibre's main-thread tiling budget; use vector tiles (see data/)`,
    };
  }

  mapEl.replaceChildren();
  setHud(`${label} · ${points.toLocaleString()} pts\nbuilding data…`);
  const data = makePoints(points);

  const engine = makeEngine(engineName);
  await engine.mount(mapEl, sampleCameraPath(0));

  setHud(
    `${label} · ${points.toLocaleString()} pts\nuploading + first render…`,
  );
  const t0 = performance.now();
  await engine.setData(data);
  const ttfrMs = performance.now() - t0;

  // Warm-up: shaders compiled, tiles built, JIT hot — discard these timings.
  setHud(`${label} · ${points.toLocaleString()} pts\nwarm-up…`);
  await captureFrames(WARMUP_MS, (t) => engine.applyView(sampleCameraPath(t)));

  const all: number[] = [];
  let refreshHz = 60;
  for (let rep = 0; rep < reps; rep++) {
    let lastHudAt = 0;
    const intervals = await captureFrames(CAMERA_PATH_DURATION_MS, (t, dt) => {
      engine.applyView(sampleCameraPath(t));
      if (performance.now() - lastHudAt > 250) {
        lastHudAt = performance.now();
        setHud(
          `${label} · ${points.toLocaleString()} pts\nrep ${rep + 1}/${reps} · ${(t * 100).toFixed(0)}%\n~${(1000 / dt).toFixed(0)} fps · ttfr ${ttfrMs.toFixed(0)}ms`,
        );
      }
    });
    if (rep === 0) refreshHz = detectRefreshHz(intervals);
    all.push(...intervals);
  }

  engine.destroy();
  return summarize(label, points, reps, refreshHz, ttfrMs, all);
}

function finish(): void {
  renderResults(resultsEl, results);
  downloadBtn.disabled = results.length === 0;
}

async function guarded(fn: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  runBtn.disabled = true;
  sweepBtn.disabled = true;
  try {
    await fn();
    setHud(
      `done — ${results.length} result(s)\nsee table below, or download json`,
    );
  } catch (err) {
    setHud(`error: ${(err as Error).message}`);
    console.error(err);
  } finally {
    busy = false;
    runBtn.disabled = false;
    sweepBtn.disabled = false;
  }
}

runBtn.addEventListener('click', () =>
  guarded(async () => {
    results.push(
      await runOne(
        engineSel.value,
        Number(pointsSel.value),
        Number(repsInput.value),
      ),
    );
    finish();
  }),
);

sweepBtn.addEventListener('click', () =>
  guarded(async () => {
    const reps = Number(repsInput.value);
    for (const engineName of Object.keys(ENGINES)) {
      for (const points of SWEEP_SIZES) {
        results.push(await runOne(engineName, points, reps));
        finish();
      }
    }
  }),
);

downloadBtn.addEventListener('click', () => downloadJSON(results));

setHud('idle — pick a config and hit run\n(or “sweep” for the full matrix)');

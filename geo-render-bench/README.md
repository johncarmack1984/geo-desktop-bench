# geo-render-bench

Apples-to-apples **geospatial rendering** benchmark: how fast can the two dominant
web map engines draw the *same* synthetic point cloud, driven by the *same*
deterministic camera path? Vanilla TypeScript (no React) so the numbers reflect the
rendering engine, not framework reconciliation.

- **WebGL2 (raw)** (`src/engines/webgl2.ts`) — hand-written shader, one `GL_POINTS`
  draw call from a mercator VBO. The throughput **ceiling**: read deck.gl's overhead
  against it. (2D mercator; ignores pitch, but driven by the same ViewState.)
- **deck.gl** (`@deck.gl/core` + `ScatterplotLayer`) — one GPU draw call from binary
  attributes; built for millions of points.
- **MapLibre GL** (`circle` layer over a GeoJSON source) — client-side tiling via
  geojson-vt; built for vector tiles, not raw mega-point sets.

```bash
pnpm install
pnpm dev      # http://localhost:5173 → "run" (one config) or "sweep" (full matrix)
pnpm build    # tsc --noEmit && vite build
pnpm check    # biome
```

## What it measures

Pick an engine + point count (100k–10M) + reps, or **sweep** the whole matrix. Per run:

| metric | meaning |
|---|---|
| fps | mean frames/sec over the path |
| p50 / p95 / p99 | frame-time percentiles (ms) — the real story |
| max | worst single frame (ms) |
| jank% | frames slower than 1.5× the display refresh |
| ttfr | time-to-first-render: data upload → first settled frame (ms) |

Results render in-page (color-coded) and download as JSON (with UA / DPR / viewport).

## Methodology (and why it's honest)

- **Deterministic camera** (`src/bench/camera.ts`): a fixed web-mercator fly path
  (pan + zoom + rotate + tilt), identical for every engine and size. No user input.
- **Warm-up discarded** (~1.2s) before timing — shader compile, tiling, JIT.
- **Frame-time is primary, not FPS.** requestAnimationFrame is capped at the display
  refresh (60Hz, or 120Hz ProMotion on an M2 Max), so a fast engine just pins the cap
  and `fps` tells you nothing. The signal is the tail: **p95/p99 frame time + jank%**.
  Green rows = refresh-capped (headroom to spare); red = GPU-bound.
- **ttfr semantics differ slightly by engine** (deck: first `onAfterRender` after
  upload; MapLibre: `idle` after re-tiling) — both mean "data is on screen and
  settled." Documented, not hidden.
- **MapLibre is capped at 3M points.** Past that, building object GeoJSON is multi-GB
  and stalls the main thread for tens of seconds — that asymmetry *is* the finding:
  for mega-point sets use deck.gl's binary path or vector tiles, not a GeoJSON source.

## macOS gotcha that links to shell-bench

deck.gl/luma 9.3 can target **WebGPU** but default to WebGL2. Embed this in a **Tauri**
app and its macOS **WKWebView** gates/limits WebGPU, so you're on WebGL2; **Electron**'s
bundled Chromium gives full WebGPU. Same code, different ceiling depending on the shell
— quantify it with `../shell-bench`.

## data/ — the data-path bench

`data/` benchmarks how points *reach* the renderer: DuckDB-spatial query latency,
PMTiles server-less reads, Martin tile-server throughput. See `data/README.md`.
(Verified sample, 1M points, M2 Max: plain `lon/lat BETWEEN` bbox ≈ **1.5 ms** vs
`ST_Within` + R-tree ≈ **39 ms** — spatial predicates earn their cost on complex
geometry, not axis-aligned rectangles.)

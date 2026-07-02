# geo-desktop-bench

Benchmarks for the fastest geospatial desktop stack (rendering engines, desktop shells, and the data path), measured on an Apple M2 Max, with a live report and demos at [geobench.johncarmack.com](https://geobench.johncarmack.com).

Sits alongside [`stormdeck`](https://github.com/johncarmack1984/stormdeck) (deck.gl + martin) in the same geo/Tauri/deck.gl line of work.

## Headline results

| question | answer |
|---|---|
| **Render engine** | ≤1M points: deck.gl = WebGL2 = MapLibre, all 120 fps. @10M: WebGL2-raw ~97 fps, deck.gl ~40 fps, MapLibre dies on load (9.5 s ttfr @1M GeoJSON). |
| **Native render** | maplibre-rs (wgpu→Metal, **no webview**) draws the Firenze basemap at **p50 1.66 ms, uncapped, 0 jank**, ~5× under the 8.33 ms cap a webview engine can't beat. Sidesteps the WKWebView WebGPU gate. Experimental: fill+line only, bridged via martin. |
| **Desktop shell** | Tauri **3.2 MB** / ~97 MB RSS vs Electron **275 MB** / ~438 MB. Electron wins per-call IPC (52 µs vs 217 µs). |
| **Data path** | DuckDB-spatial bbox **1.5 ms** (plain) / 39 ms (`ST_Within`) over 1M; PMTiles **0.57 ms/tile** cold, server-less. |

**Verdict:** Tauri + deck.gl + DuckDB/PMTiles. Single-file, server-less, offline-capable.

## Layout

```
geo-render-bench/   deck.gl vs MapLibre vs raw-WebGL2 render bench + data-path bench (DuckDB/PMTiles/Martin)
                    └─ also serves the PMTiles basemap demo (pmtiles.html)
shell-bench/        Tauri vs Electron (size/RSS/startup/IPC) + the desktop capstone
                    (DuckDB-on-Rust → deck.gl over a PMTiles basemap)
web-capstone/       the capstone in the browser: DuckDB-WASM → deck.gl over PMTiles
site/               the published report landing page + build that assembles the live demos
infra/              Terraform (S3 + CloudFront + ACM) for geobench.johncarmack.com
```

## Run locally

```sh
# render bench (+ PMTiles demo at /pmtiles.html)
pnpm -C geo-render-bench install && pnpm -C geo-render-bench dev        # :45173

# data-path bench (DuckDB ran here: 1M pts, sub-ms queries)
pnpm -C geo-render-bench/data install && pnpm -C geo-render-bench/data duckdb

# desktop capstone (Tauri): DuckDB-on-Rust → deck.gl over PMTiles
pnpm -C shell-bench/tauri dev

# web capstone (browser): DuckDB-WASM
pnpm -C web-capstone install && pnpm -C web-capstone dev
```

Sample basemap data (`firenze.pmtiles`, ~6 MB Protomaps) is fetched by
`scripts/fetch-sample-data.sh` (kept out of git).

## Deploy

The report + live demos publish to `geobench.johncarmack.com` (S3 + CloudFront, AWS CDK).
See [`infra/DEPLOY.md`](infra/DEPLOY.md): `pnpm -C site build` then `pnpm -C infra run deploy`.
CDK provisions the bucket/cert/CloudFront/DNS and uploads the site via BucketDeployment.

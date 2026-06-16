# data-path bench

Three ways to get geo data to the renderer, each measured on its own terms. The
render bench (`../`) answers *"how fast can we draw N points"*; this answers
*"how fast can we fetch/serve/query them"*. Pick the path that matches how a real
app ships data.

```
pnpm install          # one native dep (DuckDB); pmtiles + autocannon are pure JS
```

Runs with Node 24 (strips the TS types) or Bun. Results land in `results/`.

## 1. DuckDB + spatial — embedded query latency

In-process analytical DB. No server, no network. Synthesizes N points in-DB,
builds a `GEOMETRY` column + R-tree, then times four representative queries
(bbox via `ST_Within`, bbox via plain range, k-NN via `ST_Distance`, grid
aggregate). This is the path for a **Tauri app with the DB on the Rust side**.

```
pnpm duckdb            # 1,000,000 points
pnpm duckdb 10000000   # 10M
```

## 2. PMTiles — server-less archive reads

A single-file tile archive, range-read off disk (or a CDN with HTTP range). No tile
server process. Reports **cold** (read + decompress) and **warm** (cached) `getZxy`
latency over the real tiles near the archive center.

```
# ~6MB Protomaps Firenze sample (no extra tooling needed):
curl -L -o firenze.pmtiles "https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles"
pnpm pmtiles firenze.pmtiles
# verified (Firenze, z14, 16 tiles): cold p50 ~0.57ms · warm p50 ~0.49ms per tile
```

## 3. Martin — Rust tile server

Vector tiles served from PMTiles or PostGIS by the Martin server (Rust/axum).
The path when many clients hit a shared backend. Start Martin, then measure with
autocannon.

```
cargo install martin
martin --config martin/config.yaml          # serves ./martin/pts.pmtiles
pnpm martin:latency "http://localhost:3000/pts/{z}/{x}/{y}"
```

## Reading the numbers

- DuckDB times are **query latency** — embedded, so there's no network or
  serialization floor; the spatial-index vs. plain-range rows show when
  `ST_Within` + R-tree actually beats a bare `lon/lat BETWEEN`.
- PMTiles is **decode latency only** (local file) — add your storage/CDN RTT for
  the real-world figure.
- Martin is **end-to-end HTTP** under concurrency — the one number that includes
  a network hop, so it's not comparable head-to-head with the other two; it
  answers a different question (throughput under load, not single-query cost).

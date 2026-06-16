// DuckDB + spatial: how fast can an embedded, in-process analytical DB answer
// geo queries over N synthetic points? This is the "no tile server, no network"
// data path — ideal for a Tauri app shipping the DB inside its Rust side.
//
//   node duckdb-bench.ts [N]      (default 1,000,000 — Node 24 strips the types)
//   bun  duckdb-bench.ts [N]

import { mkdirSync, writeFileSync } from 'node:fs';
import { DuckDBInstance } from '@duckdb/node-api';

const N = Number(process.argv[2] ?? 1_000_000);
const RUNS = 5;

const instance = await DuckDBInstance.create(':memory:');
const conn = await instance.connect();
await conn.run('INSTALL spatial; LOAD spatial;');
await conn.run('SELECT setseed(0.42);'); // reproducible random()

const version = String(
  (await conn.runAndReadAll('SELECT version()')).getRows()[0][0],
);

// Synthesize the same continental-US point cloud as the render bench, entirely
// in-DB (no JS row loop) so build time reflects DuckDB, not Node.
const tBuild = performance.now();
await conn.run(`
  CREATE TABLE pts AS
  SELECT -125 + random() * 59 AS lon, 24 + random() * 25 AS lat
  FROM range(${N});
`);
await conn.run('ALTER TABLE pts ADD COLUMN geom GEOMETRY;');
await conn.run('UPDATE pts SET geom = ST_Point(lon, lat);');
let indexed = true;
try {
  await conn.run('CREATE INDEX pts_rtree ON pts USING RTREE (geom);');
} catch {
  indexed = false; // older spatial builds gate the R-tree behind a setting
}
const buildMs = performance.now() - tBuild;

const QUERIES = [
  {
    name: 'bbox count · ST_Within',
    sql: 'SELECT count(*) FROM pts WHERE ST_Within(geom, ST_MakeEnvelope(-100, 35, -90, 42))',
  },
  {
    name: 'bbox count · lon/lat range',
    sql: 'SELECT count(*) FROM pts WHERE lon BETWEEN -100 AND -90 AND lat BETWEEN 35 AND 42',
  },
  {
    name: 'k-nearest 50 · ST_Distance',
    sql: 'SELECT lon, lat, ST_Distance(geom, ST_Point(-98, 39)) AS d FROM pts ORDER BY d LIMIT 50',
  },
  {
    name: 'grid aggregate · 1°',
    sql: 'SELECT floor(lon) gx, floor(lat) gy, count(*) c FROM pts GROUP BY gx, gy',
  },
];

async function timeQuery(sql: string): Promise<number> {
  (await conn.runAndReadAll(sql)).getRows(); // warm
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    (await conn.runAndReadAll(sql)).getRows();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

const rows: Array<{ query: string; medianMs: number }> = [];
for (const q of QUERIES) {
  rows.push({
    query: q.name,
    medianMs: Number((await timeQuery(q.sql)).toFixed(3)),
  });
}

console.log(
  `\nDuckDB ${version} · spatial · ${N.toLocaleString()} points · RTREE=${indexed}`,
);
console.log(`build (synth + geom + index): ${buildMs.toFixed(0)} ms\n`);
console.table(rows);

mkdirSync('results', { recursive: true });
const out = `results/duckdb-${N}.json`;
writeFileSync(
  out,
  JSON.stringify(
    { version, n: N, indexed, buildMs, runs: RUNS, queries: rows },
    null,
    2,
  ),
);
console.log(`\nwrote ${out}`);
process.exit(0);

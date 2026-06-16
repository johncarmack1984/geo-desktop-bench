// PMTiles: open a single-file tile archive and decode tiles by z/x/y — the
// "server-less" data path (range reads straight off disk/CDN, no tile server).
//
//   node pmtiles-bench.ts <archive.pmtiles>
//   bun  pmtiles-bench.ts <archive.pmtiles>
//
// Sample archive (~6MB, no extra tooling): the Protomaps Firenze demo —
//   curl -L -o firenze.pmtiles "https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles"
// or build one from GeoJSON/FlatGeobuf with `tippecanoe` + `pmtiles convert`.

import type { FileHandle } from 'node:fs/promises';
import { open } from 'node:fs/promises';
import { PMTiles, type RangeResponse, type Source } from 'pmtiles';

const path = process.argv[2];
if (!path) {
  console.error('usage: node pmtiles-bench.ts <archive.pmtiles>');
  console.error('(see the header comment for how to obtain a sample archive)');
  process.exit(1);
}

// Minimal node file-backed Source — the pmtiles reader ships a browser fetch
// source by default, so we feed it byte ranges from the local file instead.
class FileSource implements Source {
  fh: FileHandle;
  key: string;
  constructor(fh: FileHandle, key: string) {
    this.fh = fh;
    this.key = key;
  }
  getKey(): string {
    return this.key;
  }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const buf = Buffer.alloc(length);
    await this.fh.read(buf, 0, length, offset);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + length) };
  }
}

const fh = await open(path, 'r');
const archive = new PMTiles(new FileSource(fh, path));
const header = await archive.getHeader();
console.log(`\nPMTiles ${path}`);
console.log(
  `zoom ${header.minZoom}–${header.maxZoom} · center [${header.centerLon.toFixed(2)}, ${header.centerLat.toFixed(2)}]`,
);

// Sample at a HIGH zoom near the center, where even a small extract has a dense
// grid of real tiles (sampling low zoom mostly hits empty space → misleading).
const z = Math.min(header.maxZoom, 14);
const n = 2 ** z;
const cx = Math.floor(((header.centerLon + 180) / 360) * n);
const latRad = (header.centerLat * Math.PI) / 180;
const cy = Math.floor(
  ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
);

const SPAN = 12; // a (2·SPAN+1)² block of tiles around the center
const tiles: Array<[number, number, number]> = [];
for (let dx = -SPAN; dx <= SPAN; dx++) {
  for (let dy = -SPAN; dy <= SPAN; dy++) {
    const x = cx + dx;
    const y = cy + dy;
    if (x >= 0 && y >= 0 && x < n && y < n) tiles.push([z, x, y]);
  }
}

// Cold pass: each distinct tile fetched once — range read + decompress.
const cold: number[] = [];
const present: Array<[number, number, number]> = [];
for (const [tz, tx, ty] of tiles) {
  const t = performance.now();
  const tile = await archive.getZxy(tz, tx, ty);
  const dt = performance.now() - t;
  if (tile) {
    cold.push(dt);
    present.push([tz, tx, ty]);
  }
}

// Warm pass: re-fetch the tiles that existed — now served from the lib's cache.
const warm: number[] = [];
for (const [tz, tx, ty] of present) {
  const t = performance.now();
  await archive.getZxy(tz, tx, ty);
  warm.push(performance.now() - t);
}

const pct = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((q / 100) * s.length))];
};

console.log(
  `\nz${z} · sampled ${tiles.length} tiles · ${present.length} present`,
);
if (present.length === 0) {
  console.log(
    'no tiles found at the sampled location — try a different archive/zoom',
  );
} else {
  console.log(
    `cold getZxy (read+decode)  p50 ${pct(cold, 50).toFixed(3)}ms  p95 ${pct(cold, 95).toFixed(3)}ms  max ${Math.max(...cold).toFixed(3)}ms`,
  );
  console.log(
    `warm getZxy (cached)       p50 ${pct(warm, 50).toFixed(3)}ms  p95 ${pct(warm, 95).toFixed(3)}ms`,
  );
}

await fh.close();
process.exit(0);

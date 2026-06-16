// Latency/throughput of a running Martin tile server (Rust). Start Martin first
// (see README + martin/config.yaml), then point this at a tile-URL template:
//
//   node martin-latency.ts "http://localhost:3000/pts/{z}/{x}/{y}"
//   bun  martin-latency.ts "http://localhost:3000/pts/{z}/{x}/{y}"

import autocannon from 'autocannon';

const tmpl = process.argv[2] ?? 'http://localhost:3000/pts/{z}/{x}/{y}';
// One representative tile (z6 over the US); adjust if your source covers elsewhere.
const url = tmpl.replace('{z}', '6').replace('{x}', '16').replace('{y}', '24');

console.log(`\nhammering ${url} for 10s @ 50 connections…`);
const r = await autocannon({ url, connections: 50, duration: 10 });

console.log(`\nreq/sec    avg ${r.requests.average.toFixed(0)}`);
console.log(
  `latency    p50 ${r.latency.p50}ms  p97.5 ${r.latency.p97_5}ms  max ${r.latency.max}ms`,
);
console.log(
  `throughput ${(r.throughput.average / 1e6).toFixed(1)} MB/s · 2xx ${r['2xx']} · non-2xx ${r.non2xx}`,
);
process.exit(0);

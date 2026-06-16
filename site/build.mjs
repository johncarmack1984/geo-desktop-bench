// Assemble the published site/dist: the report at /, and the live demos under
// subpaths. Run from site/:  node build.mjs
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

console.log('› building render bench (+ pmtiles demo)…');
run('pnpm -C ../geo-render-bench build');
console.log('› building web capstone…');
run('pnpm -C ../web-capstone build');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

cpSync('index.html', 'dist/index.html'); // the report
cpSync('../geo-render-bench/dist', 'dist/render', { recursive: true }); // /render/ + /render/pmtiles.html
cpSync('../web-capstone/dist', 'dist/capstone', { recursive: true }); // /capstone/

// PMTiles basemap at the SITE ROOT — the demos request `pmtiles:///firenze.pmtiles`
// (origin-absolute), so it must live at /firenze.pmtiles regardless of subpath.
cpSync('../geo-render-bench/public/firenze.pmtiles', 'dist/firenze.pmtiles');

console.log('\n› assembled site/dist:');
run("find dist -maxdepth 2 -not -path '*/assets/*' | sort");

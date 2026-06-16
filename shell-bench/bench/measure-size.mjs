// Artifact sizes for the shell comparison. Build each first (see README), then
// run from the shell-bench/ root:
//   node bench/measure-size.mjs

import { execSync } from 'node:child_process';

const du = (p) => {
  try {
    return execSync(`du -sh "${p}" 2>/dev/null`).toString().split('\t')[0] || 'n/a';
  } catch {
    return 'n/a';
  }
};

const targets = [
  ['frontend bundle (dist)', 'frontend/dist'],
  ['Tauri binary (stripped)', 'tauri/src-tauri/target/release/shell-bench-tauri'],
  ['Tauri .app', 'tauri/src-tauri/target/release/bundle/macos/shell-bench-tauri.app'],
  ['Tauri .dmg dir', 'tauri/src-tauri/target/release/bundle/dmg'],
  ['Electron runtime', 'electron/node_modules/electron/dist'],
  ['Electron .app (packed)', 'electron/dist/mac-arm64/shell-bench-electron.app'],
  ['Electron dist (all)', 'electron/dist'],
];

console.log('\nartifact sizes (build each first — see README):');
for (const [label, p] of targets) {
  console.log(`  ${label.padEnd(26)} ${du(p)}`);
}
process.exit(0);

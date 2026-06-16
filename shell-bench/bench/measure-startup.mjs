// Cold-start + memory for a built shell. Spawns the app, waits for its STARTUP_MS
// line (main → renderer first frame), samples RSS across the process tree over K
// launches, and reports medians. macOS / Linux. Needs a GUI session.
//
//   node bench/measure-startup.mjs tauri    ./tauri/src-tauri/target/release/shell-bench-tauri
//   node bench/measure-startup.mjs electron  npx electron electron
//
// CAVEAT (macOS): Tauri's WKWebView runs its WebContent in a system-hosted process
// that is NOT a child of the app, so the RSS here UNDERCOUNTS Tauri. Cross-check in
// Activity Monitor (sum the app + the com.apple.WebKit.WebContent processes).

import { execSync, spawn } from 'node:child_process';

const [, , label, ...cmd] = process.argv;
if (!label || cmd.length === 0) {
  console.error('usage: node bench/measure-startup.mjs <label> <launch command...>');
  process.exit(1);
}

const LAUNCHES = 5;

const rssKB = (pid) => {
  try {
    return Number(execSync(`ps -o rss= -p ${pid}`).toString().trim()) || 0;
  } catch {
    return 0;
  }
};

// BFS the process subtree so Electron helpers / child processes are counted.
const tree = (root) => {
  const all = [root];
  let frontier = [root];
  while (frontier.length) {
    const next = [];
    for (const p of frontier) {
      const kids = execSync(`pgrep -P ${p} 2>/dev/null || true`)
        .toString()
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(Number);
      for (const k of kids) {
        all.push(k);
        next.push(k);
      }
    }
    frontier = next;
  }
  return all;
};

const treeRssMB = (root) => tree(root).reduce((s, p) => s + rssKB(p), 0) / 1024;

function once() {
  return new Promise((resolve) => {
    const child = spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', 'pipe', 'inherit'] });
    const killTree = () => {
      for (const p of tree(child.pid)) {
        try {
          process.kill(p, 'SIGKILL');
        } catch {
          /* already gone */
        }
      }
    };
    let peak = 0;
    const sampler = setInterval(() => {
      const m = treeRssMB(child.pid);
      if (m > peak) peak = m;
    }, 100);
    // Safety net: if the window never renders (no GUI session/GPU), don't hang.
    const timeout = setTimeout(() => {
      clearInterval(sampler);
      killTree();
      resolve({ error: 'timeout — no STARTUP_MS (window may not have rendered)' });
    }, 15000);
    child.stdout.on('data', (buf) => {
      const m = /STARTUP_MS=([\d.]+)/.exec(buf.toString());
      if (!m) return;
      const startupMs = Number(m[1]);
      const idleRssMB = treeRssMB(child.pid);
      setTimeout(() => {
        clearTimeout(timeout);
        clearInterval(sampler);
        killTree();
        resolve({ startupMs, idleRssMB, peakRssMB: Math.max(peak, idleRssMB) });
      }, 1500);
    });
    child.on('error', (e) => {
      clearTimeout(timeout);
      clearInterval(sampler);
      resolve({ error: String(e) });
    });
  });
}

const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const runs = [];
for (let i = 0; i < LAUNCHES; i++) {
  process.stderr.write(`launch ${i + 1}/${LAUNCHES}\r`);
  runs.push(await once());
}

const ok = runs.filter((r) => !r.error && Number.isFinite(r.startupMs));
console.log(`\n${label}:`);
if (!ok.length) {
  console.log('  no successful launches — needs a GUI session and a built app');
  process.exit(0);
}
console.log(`  startup (main→first frame)  ${med(ok.map((r) => r.startupMs)).toFixed(0)} ms`);
console.log(`  idle RSS (process tree)     ${med(ok.map((r) => r.idleRssMB)).toFixed(0)} MB`);
console.log(`  peak RSS (process tree)     ${med(ok.map((r) => r.peakRssMB)).toFixed(0)} MB`);
process.exit(0);

// Launch a built shell, let it auto-run the in-app IPC bench, capture the
// IPC_RESULT line the native side prints to stdout, then kill. macOS/Linux, GUI session.
//   node bench/measure-ipc.mjs <launch command...>

import { execSync, spawn } from 'node:child_process';

const cmd = process.argv.slice(2);
if (!cmd.length) {
  console.error('usage: node bench/measure-ipc.mjs <launch command...>');
  process.exit(1);
}

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

const child = spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', 'pipe', 'inherit'] });
const killTree = () => {
  for (const p of tree(child.pid)) {
    try {
      process.kill(p, 'SIGKILL');
    } catch {
      /* gone */
    }
  }
};

const timer = setTimeout(() => {
  killTree();
  console.log('no IPC_RESULT captured (window may not have rendered)');
  process.exit(0);
}, 20000);

let buf = '';
child.stdout.on('data', (d) => {
  buf += d.toString();
  const m = /IPC_RESULT (.+)/.exec(buf);
  if (!m) return;
  clearTimeout(timer);
  console.log(m[1].trim());
  killTree();
  process.exit(0);
});
child.on('error', (e) => {
  clearTimeout(timer);
  console.log(`error: ${e}`);
  process.exit(0);
});

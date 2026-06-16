# shell-bench

Apples-to-apples **desktop shell** benchmark: the *same* React + MapLibre frontend
(`frontend/`) embedded in **Tauri 2** (Rust core + system WKWebView) and **Electron**
(bundled Chromium + Node). The frontend is byte-identical in both, so the only
variable measured is the shell.

```
frontend/   shared React + MapLibre app (built once → dist/, embedded by both shells)
tauri/      Tauri 2.x shell (src-tauri/ = Rust)
electron/   Electron shell (main.js + preload.js)
bench/      measurement scripts (startup, RSS, size)
```

## Build & run

```bash
# 1. shared frontend — both shells embed its dist/
pnpm -C frontend install && pnpm -C frontend build

# 2a. Tauri — dev (hot reload) or a release build
pnpm -C tauri install
pnpm -C tauri dev
pnpm -C tauri tauri icon src-tauri/icons/icon.png   # once: real multi-res icons (placeholder is 1x1)
pnpm -C tauri build                                  # → tauri/src-tauri/target/release/bundle/ (.app, .dmg)

# 2b. Electron — run, and/or package for the size number
pnpm -C electron install
pnpm -C electron start            # dev run
pnpm -C electron run appdir       # → electron/dist/mac-arm64/…app (unpacked, unsigned, fast)
                                  # (use `run` — `pnpm pack` alone hits pnpm's built-in tarball cmd)
```

## Measure (from the shell-bench/ root, in a GUI session)

```bash
# cold-start + RSS, median of 5 launches
node bench/measure-startup.mjs tauri    ./tauri/src-tauri/target/release/shell-bench-tauri
node bench/measure-startup.mjs electron ./electron/node_modules/.bin/electron electron

# artifact sizes
node bench/measure-size.mjs
```

IPC is measured **inside the app**: click "run IPC bench (1k echoes)" — it reports
µs/call round-trip (Tauri command vs Electron `ipcRenderer.invoke`) and logs
`IPC_RESULT …` to the shell's stdout.

## The four metric families

| family | how | rough expectation |
|---|---|---|
| **shell efficiency** | `measure-size.mjs` | Tauri: single-digit-MB binary; Electron: ~150–250MB packaged |
| | `measure-startup.mjs` (RSS) | Tauri lower idle RSS; Electron higher (multi-process Chromium) |
| **startup** | main→first-frame, each shell prints to stdout | Tauri usually faster cold |
| **IPC** | 1k echo round-trips in-app | both sub-ms/call; compares bridge cost |
| **frontend build/dev** | `pnpm -C frontend build` / `dev` | shared — identical for both shells |

## Caveats (read before trusting a number)

- **macOS RSS undercounts Tauri.** WKWebView's WebContent runs in a *system-hosted*
  process, not a child of the app, so `measure-startup.mjs` (which sums the process
  tree) misses it — the comparison is biased *toward* Tauri. Cross-check in Activity
  Monitor: sum the app + the `com.apple.WebKit.WebContent` processes. Electron's
  helpers *are* children, so its tree RSS is closer to complete.
- **Startup is main()→first-frame**, not click-to-pixel — there's no uniform
  cross-shell way to time the latter without OS instrumentation. Both shells measure
  the same span, so the *delta* is fair even if the absolute is optimistic.
- **Electron "size" comes from `pnpm -C electron run appdir`** (electron-builder,
  unpacked `.app`, unsigned — fast for a size read); `measure-size.mjs` looks under
  `electron/dist/mac-arm64/`. For a signed `.dmg`, `pnpm -C electron run dist`.
  Measured here: Tauri **3.2 MB** binary vs Electron **275 MB** `.app` (~86×).
- **Tauri distributables need icons + signing.** Run `tauri icon` (the shipped one is
  1×1) before `tauri build`; unsigned `.app`s warn on first launch.
- **WebGPU**: same note as `../geo-render-bench` — WKWebView (Tauri) gates WebGPU,
  Chromium (Electron) doesn't. If your real frontend is GPU-heavy (deck.gl), that gap
  can dominate everything else measured here.

## Verified vs. yours to run

Checked on build: the shared frontend (install + build + Biome), the JS shells + bench
scripts (syntax), and the Tauri Rust (`cargo check`). The native release builds and the
GUI measurements (startup / RSS / size) need your desktop session + native toolchains —
the commands above are exactly those steps.

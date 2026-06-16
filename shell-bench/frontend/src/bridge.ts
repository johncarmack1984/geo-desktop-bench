// Abstracts the three host environments so App.tsx is byte-identical everywhere.
// Detection order: Electron (preload-injected) → Tauri (global) → plain browser.

export type Host = 'tauri' | 'electron' | 'browser';

export interface Pt {
  lon: number;
  lat: number;
}

export interface ShellBridge {
  host: Host;
  echo: (msg: string) => Promise<string>;
  reportReady: () => void;
  // Hand a result string to the native side so it lands on the process stdout
  // (renderer/webview console.log does NOT reach the native process).
  reportResult: (line: string) => void;
  // Run a DuckDB spatial query on the native side (Tauri only). Other hosts have
  // no embedded DB, so they return [].
  query: (
    west: number,
    south: number,
    east: number,
    north: number,
    limit: number,
  ) => Promise<Pt[]>;
}

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (
          cmd: string,
          args?: Record<string, unknown>,
        ) => Promise<unknown>;
      };
    };
    shellBridge?: {
      echo: (msg: string) => Promise<string>;
      reportReady: () => void;
      reportIpc: (line: string) => void;
    };
  }
}

function detect(): ShellBridge {
  // Electron's preload exposes this via contextBridge. No DuckDB on this side.
  if (window.shellBridge) {
    const b = window.shellBridge;
    return {
      host: 'electron',
      echo: (msg) => b.echo(msg),
      reportReady: () => b.reportReady(),
      reportResult: (line) => b.reportIpc(line),
      query: () => Promise.resolve([]),
    };
  }
  // Tauri 2 with `withGlobalTauri` exposes invoke on the window.
  if (window.__TAURI__) {
    const { invoke } = window.__TAURI__.core;
    return {
      host: 'tauri',
      echo: (msg) => invoke('echo', { msg }) as Promise<string>,
      reportReady: () => {
        void invoke('frontend_ready');
      },
      reportResult: (line) => {
        void invoke('report_ipc', { line });
      },
      query: (west, south, east, north, limit) =>
        invoke('query', { west, south, east, north, limit }) as Promise<Pt[]>,
    };
  }
  // Plain browser (vite dev / preview): no native side.
  return {
    host: 'browser',
    echo: (msg) => Promise.resolve(msg),
    reportReady: () => {},
    reportResult: () => {},
    query: () => Promise.resolve([]),
  };
}

export const bridge: ShellBridge = detect();

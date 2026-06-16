import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so it works under a subpath (/capstone/) when deployed.
  base: './',
  // duckdb-wasm references its worker/wasm at runtime (CDN bundle) — don't pre-bundle it.
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
});

import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two entry points: the points benchmark (index.html) and the PMTiles basemap
// demo (pmtiles.html).
export default defineConfig({
  // Relative base so the build works when served under a subpath (e.g. /render/).
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        pmtiles: resolve(import.meta.dirname, 'pmtiles.html'),
      },
    },
  },
});

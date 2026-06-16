import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './' so built assets resolve under file:// (Electron) and Tauri's asset
// protocol — both shells load the static dist, not a dev server.
export default defineConfig({
  base: './',
  plugins: [react()],
});

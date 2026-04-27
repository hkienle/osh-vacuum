import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // Relative asset URLs so opening dist/*.html via file:// or deploying under a subpath works.
  base: './',
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        checklist: resolve(__dirname, 'build/index.html'),
      },
    },
  },
});

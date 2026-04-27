import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        checklist: resolve(__dirname, 'build/index.html'),
      },
    },
  },
});

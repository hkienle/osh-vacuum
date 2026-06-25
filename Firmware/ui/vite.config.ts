import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { deviceWsProxyPlugin } from './src/vite/deviceWsProxy'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), deviceWsProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
  build: {
    outDir:
      mode === 'esp32'
        ? path.resolve(__dirname, '../data')
        : path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
}))

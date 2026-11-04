import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // The default (`localhost`) bound only to ::1 on Windows, leaving 127.0.0.1:5173 unreachable.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Matches the `http` profile in TiendaZero-Api: src/TiendaZero.Api/Properties/launchSettings.json.
    // The Api picks the tenant from the Host header (docs/plan.md §4), so the proxy must pass the
    // browser's host (regate.localhost:5173) through. `changeOrigin: true`, which is what Vite's
    // string shorthand implies, would replace it with localhost:5043 and every call would 404.
    proxy: {
      '/api': { target: 'http://localhost:5043', changeOrigin: false },
      // Product photos, served by the Api until they move to Cloudflare R2.
      '/media': { target: 'http://localhost:5043', changeOrigin: false },
    },
  },
})

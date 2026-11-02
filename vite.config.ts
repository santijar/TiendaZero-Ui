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
    proxy: {
      '/api': 'http://localhost:5043',
    },
  },
})

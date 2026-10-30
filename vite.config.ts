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
    // Matches the `http` profile in TiendaZero-Api: src/TiendaZero.Api/Properties/launchSettings.json.
    proxy: {
      '/api': 'http://localhost:5043',
    },
  },
})

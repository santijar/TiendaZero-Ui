import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { isPlatformHost } from './lib/platform'
import router from './router'
import { useThemeStore } from './stores/theme'

// How long the first paint waits for the store's theme before showing the page in Nocturne's defaults.
const THEME_WAIT_MS = 2000

if (isPlatformHost()) {
  // The platform admin's tool (docs/plan.md §1) has its own app, loaded only here. A store's own site never
  // reaches this branch, so none of the platform code is ever requested by a shopper.
  const { mountPlatformApp } = await import('./platform/mount')
  mountPlatformApp('#app')
} else {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)

  // Apply the store's colors before the first paint, so it never flashes in another store's look. A slow or
  // failed theme must not keep the store from opening: App retries it, and the defaults are readable meanwhile.
  await Promise.race([
    useThemeStore(pinia)
      .ensureLoaded()
      .catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, THEME_WAIT_MS)),
  ])

  app.mount('#app')
}

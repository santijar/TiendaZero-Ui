import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { isPlatformHost } from './lib/platform'
import router from './router'

if (isPlatformHost()) {
  // The platform admin's tool (docs/plan.md §1) has its own app, loaded only here. A store's own site never
  // reaches this branch, so none of the platform code is ever requested by a shopper.
  const { mountPlatformApp } = await import('./platform/mount')
  mountPlatformApp('#app')
} else {
  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  app.mount('#app')
}

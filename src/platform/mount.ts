import { createApp } from 'vue'
import { createPinia } from 'pinia'

import PlatformApp from './PlatformApp.vue'
import { createPlatformRouter } from './router'

// The whole platform tool, loaded by main.ts only when the page is on the platform host. A store's own site
// never imports this file, so none of it reaches a shopper.
export function mountPlatformApp(selector: string) {
  const app = createApp(PlatformApp)
  app.use(createPinia())
  app.use(createPlatformRouter())
  app.mount(selector)
}

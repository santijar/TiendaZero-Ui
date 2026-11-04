import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'

import { usePlatformStore } from '@/stores/platform'
import HomeView from '@/views/HomeView.vue'

// The router of the platform host (docs/plan.md §1): a sign-in screen, then the storefront's own catalog screens
// in read-only preview. The route names are the storefront's, because its components navigate by name. There
// is no cart, checkout, account or admin here: a preview shows what shoppers see and lets nobody do anything.
// A factory, like the storefront's, so tests can build an isolated router per app.
export function createPlatformRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  const router = createRouter({
    history,
    routes: [
      {
        path: '/plataforma/ingresar',
        name: 'platform-login',
        component: () => import('./PlatformLoginView.vue'),
      },
      { path: '/', name: 'home', component: HomeView },
      {
        path: '/producto/:slug',
        name: 'product',
        component: () => import('@/views/ProductView.vue'),
        props: true,
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
      },
    ],
    scrollBehavior: () => ({ top: 0 }),
  })

  router.beforeEach(async (to) => {
    const platform = usePlatformStore()
    await platform.ready()
    if (!platform.isSignedIn)
      return to.name === 'platform-login' ? true : { name: 'platform-login' }
    if (to.name === 'platform-login') return { name: 'home' }
    // The bar needs the store list, and the preview needs a store chosen from it.
    if (platform.tenants.length === 0) await platform.loadTenants().catch(() => {})
    return true
  })

  return router
}

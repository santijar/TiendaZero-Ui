import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'

import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/order'
import HomeView from '@/views/HomeView.vue'

// A factory so tests can build an isolated router per app: vue-router runs guards in the context of
// the first app it was installed on, so a shared instance would leak one test's stores into the next.
export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  return createRouter({
    history,
    routes: [
      { path: '/', name: 'home', component: HomeView },
      {
        path: '/producto/:slug',
        name: 'product',
        component: () => import('@/views/ProductView.vue'),
        props: true,
      },
      {
        path: '/checkout',
        name: 'checkout',
        component: () => import('@/views/CheckoutView.vue'),
        beforeEnter: async () => {
          const cart = useCartStore()
          await cart.ensureLoaded()
          return cart.isEmpty ? { name: 'home' } : true
        },
      },
      {
        path: '/pedido-confirmado',
        name: 'order-confirmed',
        component: () => import('@/views/OrderConfirmedView.vue'),
        beforeEnter: () => (useOrderStore().lastOrder ? true : { name: 'home' }),
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
      },
    ],
    scrollBehavior: () => ({ top: 0 }),
  })
}

export default createAppRouter()

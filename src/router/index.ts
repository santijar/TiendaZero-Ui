import { createRouter, createWebHistory } from 'vue-router'

import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/order'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
      beforeEnter: () => (useCartStore().isEmpty ? { name: 'home' } : true),
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

export default router

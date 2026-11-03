import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import HomeView from '@/views/HomeView.vue'

// Sign-in and sign-up pages send an already signed-in shopper to their account.
async function signedOutOnly() {
  const auth = useAuthStore()
  await auth.ready()
  return auth.isSignedIn ? { name: 'account' } : true
}

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
        path: '/pedido/:number',
        name: 'order',
        component: () => import('@/views/OrderView.vue'),
        props: true,
      },
      {
        path: '/ingresar',
        name: 'login',
        component: () => import('@/views/auth/LoginView.vue'),
        beforeEnter: signedOutOnly,
      },
      {
        path: '/registrarse',
        name: 'register',
        component: () => import('@/views/auth/RegisterView.vue'),
        beforeEnter: signedOutOnly,
      },
      {
        path: '/recuperar',
        name: 'forgot-password',
        component: () => import('@/views/auth/ForgotPasswordView.vue'),
      },
      {
        path: '/restablecer',
        name: 'reset-password',
        component: () => import('@/views/auth/ResetPasswordView.vue'),
      },
      {
        path: '/cuenta',
        name: 'account',
        component: () => import('@/views/AccountView.vue'),
        beforeEnter: async (to) => {
          const auth = useAuthStore()
          await auth.ready()
          return auth.isSignedIn ? true : { name: 'login', query: { next: to.fullPath } }
        },
      },
      {
        // The store admin: its own shell (no storefront header or cart), for TenantAdmins only.
        path: '/admin',
        component: () => import('@/components/admin/AdminLayout.vue'),
        meta: { admin: true },
        beforeEnter: async (to) => {
          const auth = useAuthStore()
          await auth.ready()
          if (!auth.isSignedIn) return { name: 'login', query: { next: to.fullPath } }
          return auth.isAdmin
            ? true
            : { name: 'not-found', params: { pathMatch: to.path.slice(1).split('/') } }
        },
        children: [
          { path: '', redirect: { name: 'admin-orders' } },
          {
            path: 'pedidos',
            name: 'admin-orders',
            component: () => import('@/views/admin/AdminOrdersView.vue'),
          },
          {
            path: 'pedidos/:number',
            name: 'admin-order',
            component: () => import('@/views/admin/AdminOrderView.vue'),
            props: true,
          },
          {
            path: 'productos',
            name: 'admin-products',
            component: () => import('@/views/admin/AdminProductsView.vue'),
          },
          {
            path: 'productos/nuevo',
            name: 'admin-product-new',
            component: () => import('@/views/admin/AdminProductEditView.vue'),
          },
          {
            path: 'productos/:id(\\d+)',
            name: 'admin-product',
            component: () => import('@/views/admin/AdminProductEditView.vue'),
            props: (route) => ({ id: Number(route.params.id) }),
          },
          {
            path: 'catalogo',
            name: 'admin-taxonomy',
            component: () => import('@/views/admin/AdminTaxonomyView.vue'),
          },
        ],
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

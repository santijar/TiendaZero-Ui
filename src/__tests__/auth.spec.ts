import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, type Router } from 'vue-router'

import App from '../App.vue'
import { getCart } from '../api/cart'
import { safeNext } from '../lib/navigation'
import { createAppRouter } from '../router'
import { useAuthStore } from '../stores/auth'
import { useCartStore } from '../stores/cart'
import { useFavoritesStore } from '../stores/favorites'
import { PRODUCTS, stubApi, type FakeApi } from './fakeApi'

let api: FakeApi
let router: Router

// A fresh app per mount, like a page load. The fake Api (with its session "cookie") and
// localStorage persist across mounts within a test.
async function mountAt(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function fill(wrapper: VueWrapper, values: Record<string, string>) {
  for (const [id, value] of Object.entries(values)) await wrapper.find(`#${id}`).setValue(value)
}

async function submit(wrapper: VueWrapper) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

function addUser(email = 'ana@mail.com', password = 'camiseta26') {
  api.auth.users.set(email, { id: 'u1', name: 'Ana Gómez', password, favorites: [] })
}

describe('auth', () => {
  // Routes lazy-load their views; flushPromises doesn't wait for a first dynamic import, so load
  // them up front instead of depending on which test happens to import them first.
  beforeAll(async () => {
    await Promise.all([
      import('../views/AccountView.vue'),
      import('../views/auth/LoginView.vue'),
      import('../views/auth/RegisterView.vue'),
      import('../views/auth/ForgotPasswordView.vue'),
      import('../views/CheckoutView.vue'),
      import('../views/ProductView.vue'),
    ])
  })

  beforeEach(() => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => vi.unstubAllGlobals())

  it('registers, lands on the account page and keeps the guest cart', async () => {
    const wrapper = await mountAt('/producto/cam-titular')
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Agregar al carrito')!
      .trigger('click')
    await flushPromises()

    await router.push('/registrarse')
    await flushPromises()
    await fill(wrapper, {
      'reg-name': 'Ana Gómez',
      'reg-email': 'ana@mail.com',
      'reg-password': 'camiseta26',
    })
    await submit(wrapper)

    expect(router.currentRoute.value.name).toBe('account')
    expect(wrapper.text()).toContain('ana@mail.com')
    expect(wrapper.find('.account').attributes('aria-label')).toBe('Mi cuenta')
    expect(wrapper.find('.cart').text()).toBe('1')
    expect(api.carts.get('user:ana@mail.com')).toHaveLength(1)
    expect(localStorage.getItem('tiendazero.cartToken')).toBeNull()
  })

  it('shows the Api’s field errors on the register form', async () => {
    addUser()
    const wrapper = await mountAt('/registrarse')

    await fill(wrapper, {
      'reg-name': 'Ana',
      'reg-email': 'ana@mail.com',
      'reg-password': 'camiseta26',
    })
    await submit(wrapper)

    expect(wrapper.text()).toContain('Ya existe una cuenta con ese email.')
    expect(router.currentRoute.value.name).toBe('register')
  })

  it('shows the Api’s message for a wrong password', async () => {
    addUser()
    const wrapper = await mountAt('/ingresar')

    await fill(wrapper, { 'login-email': 'ana@mail.com', 'login-password': 'incorrecta1' })
    await submit(wrapper)

    expect(wrapper.find('[role="alert"]').text()).toBe('El email o la contraseña no son correctos.')
  })

  it('sends signed-out shoppers from the account page to sign-in, and back after', async () => {
    addUser()
    const wrapper = await mountAt('/cuenta')
    expect(router.currentRoute.value.fullPath).toBe('/ingresar?next=/cuenta')

    await fill(wrapper, { 'login-email': 'ana@mail.com', 'login-password': 'camiseta26' })
    await submit(wrapper)

    expect(router.currentRoute.value.name).toBe('account')
  })

  it('restores the session on page load from the refresh cookie', async () => {
    addUser()
    api.auth.state.session = 'ana@mail.com'

    const wrapper = await mountAt('/cuenta')

    expect(router.currentRoute.value.name).toBe('account')
    expect(wrapper.text()).toContain('ana@mail.com')
    expect(api.auth.state.refreshes).toBe(1)
  })

  it('renews an expired access token once and retries, even with concurrent requests', async () => {
    addUser()
    api.auth.state.session = 'ana@mail.com'
    await mountAt('/')
    api.auth.expireAccessTokens()
    const before = api.auth.state.refreshes

    const [a, b] = await Promise.all([getCart(null), getCart(null)])

    expect([a.count, b.count]).toEqual([0, 0])
    expect(api.auth.state.refreshes - before).toBe(1)
  })

  it('signs out: back to an empty guest cart and no favorites', async () => {
    addUser()
    api.auth.state.session = 'ana@mail.com'
    api.carts.set('user:ana@mail.com', [])
    const wrapper = await mountAt('/cuenta')
    await useCartStore().add(PRODUCTS[1]!, 'Único')
    await useFavoritesStore().toggle('bolso')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Cerrar sesión')!
      .trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('home')
    expect(useAuthStore().isSignedIn).toBe(false)
    expect(useCartStore().count).toBe(0)
    expect(useFavoritesStore().isFavorite('bolso')).toBe(false)
    expect(api.auth.state.session).toBeNull()
    expect(api.carts.get('user:ana@mail.com')).toHaveLength(1) // still in the account
  })

  it('saves favorites picked as a guest to the account at sign-in', async () => {
    addUser()
    await mountAt('/')
    await useFavoritesStore().toggle('bolso')

    await useAuthStore().signIn('ana@mail.com', 'camiseta26')

    expect(api.auth.users.get('ana@mail.com')!.favorites).toEqual(['bolso'])
    expect(useFavoritesStore().items.map((p) => p.slug)).toEqual(['bolso'])
  })

  it('prefills checkout with the account’s name and email', async () => {
    addUser()
    api.auth.state.session = 'ana@mail.com'
    await mountAt('/')
    await useCartStore().add(PRODUCTS[1]!, 'Único')

    const wrapper = await mountAt('/checkout')

    expect((wrapper.find('#co-name').element as HTMLInputElement).value).toBe('Ana Gómez')
    expect((wrapper.find('#co-email').element as HTMLInputElement).value).toBe('ana@mail.com')
  })

  it('confirms a reset request without revealing whether the email has an account', async () => {
    const wrapper = await mountAt('/recuperar')

    await fill(wrapper, { 'forgot-email': 'nadie@mail.com' })
    await submit(wrapper)

    expect(wrapper.find('[role="status"]').text()).toContain('Si hay una cuenta con nadie@mail.com')
  })
})

describe('safeNext', () => {
  it.each([
    ['/checkout', '/checkout'],
    ['/cuenta?tab=favoritos', '/cuenta?tab=favoritos'],
    ['https://evil.example', '/cuenta'],
    ['//evil.example', '/cuenta'],
    ['/\\evil.example', '/cuenta'],
    [undefined, '/cuenta'],
    [['/a', '/b'], '/cuenta'],
  ])('%s → %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected)
  })
})

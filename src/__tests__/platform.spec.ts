import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, type Router } from 'vue-router'

import PlatformApp from '../platform/PlatformApp.vue'
import { createPlatformRouter } from '../platform/router'
import { isPlatformHost, platformHost } from '../lib/platform'
import { INDIANS_PRODUCTS, PLATFORM_ADMIN, PRODUCTS, stubApi, type FakeApi } from './fakeApi'

let router: Router
let api: FakeApi

// Each mount is a fresh page load: new Pinia and router. The fake Api (with its refresh cookie) and
// sessionStorage persist across mounts within one test, like a browser tab.
async function mountAt(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  router = createPlatformRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(PlatformApp, {
    global: { plugins: [pinia, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

async function signIn(
  wrapper: VueWrapper,
  email = PLATFORM_ADMIN.email,
  password = PLATFORM_ADMIN.password,
) {
  await wrapper.find('#platform-email').setValue(email)
  await wrapper.find('#platform-password').setValue(password)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

function requestsTo(prefix: string) {
  return api.fetchMock.mock.calls.filter(([input]) => String(input).startsWith(prefix))
}

function lastOf<T>(items: T[]): T {
  return items[items.length - 1]!
}

function previewHeaderOf(call: Parameters<typeof fetch>) {
  return new Headers(call[1]?.headers).get('X-Preview-Tenant')
}

describe('the platform tool', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PLATFORM_HOST', 'localhost') // jsdom's own host
    api = stubApi()
    sessionStorage.clear()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe('knowing it is on the platform host', () => {
    it('is the platform host only when the page is served from the configured host', () => {
      expect(platformHost()).toBe('localhost')
      expect(isPlatformHost()).toBe(true)

      vi.stubEnv('VITE_PLATFORM_HOST', 'LOCALHOST')
      expect(isPlatformHost()).toBe(true) // host names are case-insensitive

      vi.stubEnv('VITE_PLATFORM_HOST', 'platform.localhost')
      expect(isPlatformHost()).toBe(false) // a store's own site

      vi.stubEnv('VITE_PLATFORM_HOST', '')
      expect(platformHost()).toBeNull()
      expect(isPlatformHost()).toBe(false) // a build with no platform tool
    })
  })

  describe('signing in', () => {
    it('sends a signed-out visitor to the sign-in screen and loads no catalog', async () => {
      const wrapper = await mountAt('/')

      expect(router.currentRoute.value.name).toBe('platform-login')
      expect(wrapper.find('h1').text()).toBe('Plataforma')
      expect(wrapper.find('.tenant-bar').exists()).toBe(false)
      expect(requestsTo('/api/products')).toHaveLength(0)
      expect(requestsTo('/api/categories')).toHaveLength(0)
    })

    it("shows the Api's message for wrong credentials and stays on the screen", async () => {
      const wrapper = await mountAt('/')

      await signIn(wrapper, PLATFORM_ADMIN.email, 'no-es-esa')

      expect(wrapper.find('[role="alert"]').text()).toBe(
        'El email o la contraseña no son correctos.',
      )
      expect(router.currentRoute.value.name).toBe('platform-login')
    })

    it('asks for both fields before calling the Api', async () => {
      const wrapper = await mountAt('/')

      await signIn(wrapper, '', '')

      expect(wrapper.find('[role="alert"]').text()).toBe('Ingresá tu email y tu contraseña.')
      expect(requestsTo('/api/platform/auth/login')).toHaveLength(0)
    })

    it('lands on a preview of the first store, with the store bar', async () => {
      const wrapper = await mountAt('/')

      await signIn(wrapper)

      expect(router.currentRoute.value.name).toBe('home')
      expect(wrapper.findAll('.tenant-pill').map((p) => p.text())).toEqual(['Regate', 'Indians'])
      expect(wrapper.find('.tenant-pill.active').text()).toBe('Regate')
      expect(wrapper.find('.tenant-bar').text()).toContain('regate.localhost')
      expect(wrapper.find('.tenant-bar').text()).toContain(PLATFORM_ADMIN.email)
      expect(wrapper.findAll('.grid > *')).toHaveLength(PRODUCTS.length)
    })

    it('restores the session and the chosen store after a reload', async () => {
      const first = await mountAt('/')
      await signIn(first)
      await first.findAll('.tenant-pill')[1]!.trigger('click')
      await flushPromises()
      first.unmount()

      const reloaded = await mountAt('/')

      expect(router.currentRoute.value.name).toBe('home')
      expect(reloaded.find('.tenant-pill.active').text()).toBe('Indians')
      expect(reloaded.findAll('.grid > *')).toHaveLength(INDIANS_PRODUCTS.length)
    })
  })

  describe('previewing a store', () => {
    it("names the store, and carries the admin's token, on every storefront request", async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)

      const catalogCalls = [...requestsTo('/api/products'), ...requestsTo('/api/categories')]
      expect(catalogCalls.length).toBeGreaterThan(0)
      for (const call of catalogCalls) {
        expect(previewHeaderOf(call)).toBe('regate')
        expect(new Headers(call[1]?.headers).get('Authorization')).toMatch(
          /^Bearer platform-token-/,
        )
      }
    })

    it("does not send the preview header to the platform's own endpoints", async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)

      for (const call of requestsTo('/api/platform/')) {
        expect(previewHeaderOf(call)).toBeNull()
      }
    })

    it("switches to another store's catalog from the bar", async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)

      await wrapper.findAll('.tenant-pill')[1]!.trigger('click')
      await flushPromises()

      expect(wrapper.find('.tenant-pill.active').text()).toBe('Indians')
      expect(wrapper.find('.tenant-bar').text()).toContain('indians.localhost')
      expect(wrapper.findAll('.grid > *')).toHaveLength(INDIANS_PRODUCTS.length)
      expect(wrapper.text()).toContain('Camiseta Béisbol CTG')
      expect(wrapper.text()).not.toContain('Camiseta Titular 26')
      expect(wrapper.findAll('.pill').map((p) => p.text())).toEqual(['Todo', 'Béisbol'])
      const last = lastOf(requestsTo('/api/products'))
      expect(previewHeaderOf(last)).toBe('indians')
    })

    it("starts the other store from a clean slate, not with the last store's filter", async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)
      await wrapper.findAll('.pill')[1]!.trigger('click') // Regate: Camisetas
      await flushPromises()

      await wrapper.findAll('.tenant-pill')[1]!.trigger('click')
      await flushPromises()

      const last = String(lastOf(requestsTo('/api/products'))[0])
      expect(last).not.toContain('category=')
    })

    it('renews an expired token and carries on', async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)
      api.platform.expireToken()

      await wrapper.findAll('.tenant-pill')[1]!.trigger('click')
      await flushPromises()

      expect(requestsTo('/api/platform/auth/refresh').length).toBeGreaterThan(0)
      expect(wrapper.findAll('.grid > *')).toHaveLength(INDIANS_PRODUCTS.length)
    })

    it('opens a product of the previewed store', async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)

      await router.push('/producto/cam-titular')
      await flushPromises()

      expect(wrapper.find('h1').text()).toBe('Camiseta Titular 26')
      const detail = lastOf(requestsTo('/api/products/cam-titular'))
      expect(previewHeaderOf(detail)).toBe('regate')
    })
  })

  describe('being read-only', () => {
    it('offers no cart, account, favorite or add-to-cart controls', async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)

      expect(wrapper.findAll('.card-item')).toHaveLength(PRODUCTS.length)
      expect(wrapper.find('[aria-label="Carrito"]').exists()).toBe(false)
      expect(wrapper.find('[aria-label="Ingresar"]').exists()).toBe(false)
      expect(wrapper.find('[aria-label="Mi cuenta"]').exists()).toBe(false)
      expect(wrapper.find('.fav').exists()).toBe(false)
      expect(wrapper.find('.quick').exists()).toBe(false)
      expect(wrapper.text()).toContain('Vista previa · solo lectura')
    })

    it('shows a product without a way to buy it', async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)

      await router.push('/producto/cam-titular')
      await flushPromises()

      expect(wrapper.text()).toContain('Vista previa de solo lectura')
      expect(wrapper.text()).not.toContain('Agregar al carrito')
      expect(wrapper.find('.fav').exists()).toBe(false)
    })

    it('never touches the shopper endpoints', async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)
      await router.push('/producto/cam-titular')
      await flushPromises()
      await wrapper.findAll('.tenant-pill')[1]!.trigger('click')
      await flushPromises()

      expect(requestsTo('/api/auth/')).toHaveLength(0)
      expect(requestsTo('/api/cart')).toHaveLength(0)
      expect(requestsTo('/api/account')).toHaveLength(0)
      expect(requestsTo('/api/orders')).toHaveLength(0)
      expect(requestsTo('/api/admin')).toHaveLength(0)
      // Only reads, apart from the platform admin's own sign-in.
      const writes = api.fetchMock.mock.calls
        .filter(([, init]) => init?.method && init.method !== 'GET')
        .map(([input]) => String(input))
      expect(writes.every((path) => path.startsWith('/api/platform/auth/'))).toBe(true)
    })

    it('has no cart, checkout, account or admin screens to navigate to', async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)

      for (const path of ['/checkout', '/cuenta', '/admin', '/ingresar', '/pedido/RG-20001']) {
        await router.push(path)
        await flushPromises()
        expect(router.currentRoute.value.name).toBe('not-found')
      }
    })
  })

  describe('signing out', () => {
    it('returns to the sign-in screen and closes the preview', async () => {
      const wrapper = await mountAt('/')
      await signIn(wrapper)

      await wrapper.find('.out').trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('platform-login')
      expect(wrapper.find('.tenant-bar').exists()).toBe(false)
      expect(requestsTo('/api/platform/auth/logout')).toHaveLength(1)

      await router.push('/')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('platform-login')
    })

    it('stays signed out after a reload', async () => {
      const first = await mountAt('/')
      await signIn(first)
      await first.find('.out').trigger('click')
      await flushPromises()
      first.unmount()

      await mountAt('/')

      expect(router.currentRoute.value.name).toBe('platform-login')
    })
  })
})

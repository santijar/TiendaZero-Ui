import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createMemoryHistory } from 'vue-router'

import App from '../App.vue'
import { createAppRouter } from '../router'
import { useCartStore } from '../stores/cart'
import {
  BOLSO_DETAIL,
  PRODUCTS,
  REGATE_THEME,
  TITULAR_DETAIL,
  stubApi,
  type FakeApi,
} from './fakeApi'

vi.mock('../lib/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/navigation')>()),
  leaveTo: vi.fn<(url: string) => void>(),
}))

// Read from disk (Vitest runs from the repo root): it does not return a stylesheet's source for an import.
const shareView = readFileSync(resolve(process.cwd(), 'src/views/admin/AdminShareView.vue'), 'utf8')

let api: FakeApi
const mounted: VueWrapper[] = []

async function mountAt(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

const grocery = () => {
  api.theme.current = { ...REGATE_THEME, storeKind: 'Grocery' }
  Object.assign(api.checkoutOptions, { cash: true, mercadoPago: false, transfer: false })
}

describe('what the screens of a store show when something is missing', () => {
  beforeAll(async () => {
    await Promise.all([import('../views/ProductView.vue'), import('../views/CheckoutView.vue')])
  })

  beforeEach(() => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    TITULAR_DETAIL.sizes.forEach((s) => (s.inStock = s.size !== 'S'))
    BOLSO_DETAIL.sizes[0]!.inStock = true
    vi.unstubAllGlobals()
  })

  describe('the photos of a product page', () => {
    it("shows a clothes store's three slots", async () => {
      const page = await mountAt('/producto/cam-titular')

      expect(page.findAll('.gallery .shot')).toHaveLength(3)
      expect(page.find('.gallery').text()).toContain('Espalda')
    })

    it('shows a grocery only its main photo, not "Detalle" or "Espalda"', async () => {
      grocery()
      const page = await mountAt('/producto/cam-titular')

      expect(page.findAll('.gallery .shot')).toHaveLength(1)
      expect(page.find('.gallery').text()).not.toContain('Espalda')
      expect(page.find('.gallery').text()).not.toContain('Detalle')
    })

    it('still shows the photos a grocery product really has', async () => {
      grocery()
      TITULAR_DETAIL.images = [
        { url: '/media/a.webp', alt: 'A' },
        { url: '/media/b.webp', alt: 'B' },
      ]
      try {
        const page = await mountAt('/producto/cam-titular')

        expect(page.findAll('.gallery .shot')).toHaveLength(2)
      } finally {
        TITULAR_DETAIL.images = [
          { url: '/media/products/cam-titular.webp', alt: 'Camiseta Titular 26' },
        ]
      }
    })
  })

  describe('a sold-out product', () => {
    const add = (page: VueWrapper) =>
      page
        .findAll('button')
        .find((b) => b.text() === 'Sin stock' || b.text() === 'Agregar al carrito')!

    it('says "Sin stock" and cannot be added, when every presentation is out', async () => {
      grocery()
      BOLSO_DETAIL.sizes[0]!.inStock = false
      const page = await mountAt('/producto/bolso')

      expect(add(page).text()).toBe('Sin stock')
      expect(add(page).attributes('disabled')).toBeDefined()
      await add(page).trigger('click')
      expect(useCartStore().isEmpty).toBe(true)
    })

    it('says the same at a clothes store when every size is out', async () => {
      TITULAR_DETAIL.sizes.forEach((s) => (s.inStock = false))
      const page = await mountAt('/producto/cam-titular')

      expect(add(page).text()).toBe('Sin stock')
      expect(add(page).attributes('disabled')).toBeDefined()
    })

    it('still offers to add a product that has some size in stock', async () => {
      const page = await mountAt('/producto/cam-titular')

      expect(add(page).text()).toBe('Agregar al carrito')
      expect(add(page).attributes('disabled')).toBeUndefined()
    })
  })

  describe('the shipping line of the checkout', () => {
    async function checkout() {
      await mountAt('/')
      await useCartStore().add(PRODUCTS[1]!, 'Único')
      return mountAt('/checkout')
    }

    it('asks for a zone, not "Gratis", while a store with zones has none picked', async () => {
      api.checkoutOptions.zones = [{ id: 'z1', name: 'Centro', cost: 600, minimumOrder: 0 }]
      const page = await checkout()
      expect(page.find('.totals').text()).toContain('Elegí tu zona')

      await page.find('#co-zone').setValue('z1')
      expect(page.find('.totals').text()).not.toContain('Elegí tu zona')
      expect(page.find('.totals').text()).toContain('$ 600')
    })

    it('does not ask for a zone for a pickup', async () => {
      api.checkoutOptions.zones = [{ id: 'z1', name: 'Centro', cost: 600, minimumOrder: 0 }]
      const page = await checkout()

      await page.find('input[name="del"][value="pickup"]').setValue()

      expect(page.find('.totals').text()).not.toContain('Elegí tu zona')
    })

    it('says "Gratis" at a store without zones, as before', async () => {
      const page = await checkout()

      expect(page.find('.totals').text()).toContain('Gratis')
    })
  })

  // jsdom does not print, so this guards the rule: on paper the poster's page background must be white whatever the
  // store's theme, or "background graphics" would print black text on the dark page.
  describe('the poster of the share screen', () => {
    it('forces a white page background in print', () => {
      const print = shareView.match(/@media print\s*\{([\s\S]*)\}\s*<\/style>/)
      expect(print, 'an unscoped @media print block').toBeTruthy()
      const rule = print![1]!.match(/([^{}]*)\{[^}]*background:\s*#fff\s*!important[^}]*\}/)
      expect(rule, 'a print rule with a white background').toBeTruthy()
      for (const selector of ['html', 'body', '#app', '.admin-shell', '.admin-main']) {
        expect(rule![1]).toContain(selector)
      }
    })
  })
})

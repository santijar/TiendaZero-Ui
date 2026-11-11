import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
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

const BRAND = 'La Independencia'
const grocery = () => {
  api.theme.current = { ...REGATE_THEME, storeKind: 'Grocery' }
  Object.assign(api.checkoutOptions, { cash: true, mercadoPago: false, transfer: false })
}

describe('a product brand', () => {
  beforeAll(async () => {
    await Promise.all([
      import('../components/admin/AdminLayout.vue'),
      import('../views/admin/AdminProductEditView.vue'),
      import('../views/ProductView.vue'),
      import('../views/CheckoutView.vue'),
      import('../views/OrderView.vue'),
    ])
  })

  beforeEach(() => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    PRODUCTS.forEach((p) => (p.brand = null))
    TITULAR_DETAIL.brand = null
    BOLSO_DETAIL.brand = null
    vi.unstubAllGlobals()
  })

  describe('on the storefront', () => {
    it('shows on the card in the line under the name, only for a product that has one', async () => {
      PRODUCTS[0]!.brand = BRAND

      const home = await mountAt('/')

      const cards = home.findAll('.card-item')
      expect(cards[0]!.find('.meta').text()).toBe(`${BRAND} · Camisetas · Negro`)
      expect(cards[1]!.find('.meta').text()).toBe('Accesorios · Negro')
    })

    it('keeps every card laid out the same, so the names of a row line up', async () => {
      PRODUCTS[0]!.brand = BRAND

      const home = await mountAt('/')

      // The brand adds no element of its own: each card is image, name, one line of detail, price.
      for (const card of home.findAll('.card-item')) {
        expect(card.find('.details').element.children).toHaveLength(3)
        expect(card.find('.brand').exists()).toBe(false)
      }
    })

    it("shows on the product page, and not when the store didn't say", async () => {
      TITULAR_DETAIL.brand = BRAND
      expect((await mountAt('/producto/cam-titular')).find('.panel .brand').text()).toBe(BRAND)

      TITULAR_DETAIL.brand = null
      expect((await mountAt('/producto/cam-titular')).find('.panel .brand').exists()).toBe(false)
    })

    it('replaces the color on a grocery card, and keeps it at a standard store', async () => {
      const standard = await mountAt('/')
      expect(standard.find('.card-item .meta').text()).toBe('Camisetas · Negro')

      grocery()
      const shop = await mountAt('/')
      expect(shop.find('.card-item .meta').text()).toBe('Camisetas')
    })
  })

  describe('in the cart, the checkout and the order', () => {
    async function withBrandedBolso() {
      PRODUCTS[1]!.brand = BRAND
      await mountAt('/')
      await useCartStore().add(PRODUCTS[1]!, 'Único')
    }

    it('names the brand in the cart drawer, with the size and color at a standard store', async () => {
      await withBrandedBolso()
      const page = await mountAt('/')
      useCartStore().open()
      await flushPromises()

      expect(page.find('.drawer .meta').text()).toBe(`${BRAND} · Talle Único · Negro`)
    })

    it('names only the brand in the cart drawer of a grocery, and nothing without one', async () => {
      grocery()
      await withBrandedBolso()
      const page = await mountAt('/')
      useCartStore().open()
      await flushPromises()
      expect(page.find('.drawer .meta').text()).toBe(BRAND)

      PRODUCTS[1]!.brand = null
      const cart = useCartStore()
      await cart.clear()
      await cart.add(PRODUCTS[1]!, 'Único')
      const bare = await mountAt('/')
      useCartStore().open()
      await flushPromises()
      expect(bare.find('.drawer .meta').exists()).toBe(false)
    })

    it('shows the brand on the checkout summary and on the placed order', async () => {
      grocery()
      await withBrandedBolso()
      const checkout = await mountAt('/checkout')
      expect(checkout.find('.summary .line-meta').text()).toBe(`${BRAND} · x1`)

      await checkout.find('#co-name').setValue('Ana')
      await checkout.find('#co-phone').setValue('11 5555-1234')
      await checkout.find('input[name="del"][value="pickup"]').setValue()
      await checkout.find('.confirm').trigger('click')
      await flushPromises()

      expect(checkout.find('.line-meta').text()).toBe(`${BRAND} · x1`)
    })

    it('keeps the standard wording when there is no brand', async () => {
      await mountAt('/')
      await useCartStore().add(PRODUCTS[1]!, 'Único')

      const checkout = await mountAt('/checkout')

      expect(checkout.find('.summary .line-meta').text()).toBe('Talle Único · x1')
    })
  })

  describe('in the admin', () => {
    function signInAsAdmin() {
      api.auth.users.set('admin@mail.com', {
        id: 'admin@mail.com',
        name: 'Admin',
        password: 'camiseta26',
        favorites: [],
        roles: ['TenantAdmin'],
      })
      api.auth.state.session = 'admin@mail.com'
    }

    const save = (wrapper: VueWrapper) =>
      wrapper
        .find('form')
        .trigger('submit')
        .then(() => flushPromises())

    it('saves the brand a product is given, trimmed, and shows it when the product is opened again', async () => {
      signInAsAdmin()
      const wrapper = await mountAt('/admin/productos/1')
      expect(wrapper.find<HTMLInputElement>('#p-brand').element.value).toBe('')

      await wrapper.find('#p-brand').setValue(`  ${BRAND}  `)
      await save(wrapper)

      expect(api.admin.state.saves.slice(-1)[0]!.brand).toBe(BRAND)
      const again = await mountAt('/admin/productos/1')
      expect(again.find<HTMLInputElement>('#p-brand').element.value).toBe(BRAND)
    })

    it('sends no brand when the box is emptied', async () => {
      signInAsAdmin()
      api.admin.state.product.brand = BRAND
      const wrapper = await mountAt('/admin/productos/1')

      await wrapper.find('#p-brand').setValue('   ')
      await save(wrapper)

      expect(api.admin.state.saves.slice(-1)[0]!.brand).toBeNull()
    })

    it("shows the Api's message next to a brand that is too long", async () => {
      signInAsAdmin()
      const wrapper = await mountAt('/admin/productos/1')

      await wrapper.find('#p-brand').setValue('a'.repeat(81))
      await save(wrapper)

      expect(wrapper.text()).toContain('La marca puede tener hasta 80 caracteres.')
      expect(api.admin.state.saves).toHaveLength(0)
    })

    it('names the brand on the order lines the owner prepares', async () => {
      signInAsAdmin()
      grocery()
      PRODUCTS[1]!.brand = BRAND
      await mountAt('/')
      await useCartStore().add(PRODUCTS[1]!, 'Único')
      const checkout = await mountAt('/checkout')
      await checkout.find('#co-name').setValue('Ana')
      await checkout.find('#co-phone').setValue('11 5555-1234')
      await checkout.find('input[name="del"][value="pickup"]').setValue()
      await checkout.find('.confirm').trigger('click')
      await flushPromises()

      const order = await mountAt('/admin/pedidos/RG-20001')

      expect(order.find('tbody tr td').text()).toContain(BRAND)
      expect(order.find('tbody tr td').text()).not.toContain('Negro')
    })
  })
})

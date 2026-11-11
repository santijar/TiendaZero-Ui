import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'

import App from '../App.vue'
import { createAppRouter } from '../router'
import { useCartStore } from '../stores/cart'
import { PRODUCTS, REGATE_THEME, stubApi, type FakeApi } from './fakeApi'

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

const grocery = () => {
  api.theme.current = { ...REGATE_THEME, storeKind: 'Grocery' }
  Object.assign(api.checkoutOptions, { cash: true, mercadoPago: false, transfer: false })
}

// The apparel wording a clothing store shows and a grocery must not.
const APPAREL = ['Talle', 'talle', 'Color ·', 'Guía de talles', 'Cambios gratis', 'Envío gratis']

describe('a grocery does not read like a clothing store', () => {
  beforeAll(async () => {
    await Promise.all([
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
    vi.unstubAllGlobals()
  })

  describe('the product page', () => {
    it('keeps the clothing wording at a standard store', async () => {
      const page = await mountAt('/producto/cam-titular')

      expect(page.text()).toContain('Color · Negro')
      expect(page.text()).toContain('Talle')
      expect(page.text()).toContain('Guía de talles')
      expect(page.text()).toContain('Envío gratis en todas las compras')
      expect(page.text()).toContain('Cambios gratis dentro de los 30 días')
      expect(page.text()).toContain('cuotas sin interés')
    })

    it('drops the color, the promises and the installments for a grocery', async () => {
      grocery()
      const page = await mountAt('/producto/cam-titular')

      for (const wording of [
        'Color ·',
        'Guía de talles',
        'Cambios gratis',
        'Envío gratis',
        'cuotas',
      ]) {
        expect(page.text()).not.toContain(wording)
      }
    })

    it('shows several variants as presentations, not sizes', async () => {
      grocery()
      const page = await mountAt('/producto/cam-titular')

      expect(page.find('.sizes-head').text()).toBe('Presentación')
      expect(page.find('[role="radiogroup"]').attributes('aria-label')).toBe('Presentación')
      const add = page.findAll('button').find((b) => b.text().includes('Agregar al carrito'))!
      await add.trigger('click')
      expect(page.text()).toContain('Elegí una presentación para continuar.')
    })

    it('hides the picker for a product with a single variant, which is picked for the shopper', async () => {
      grocery()
      const page = await mountAt('/producto/bolso')
      expect(page.find('.sizes').exists()).toBe(false)

      await page
        .findAll('button')
        .find((b) => b.text().includes('Agregar al carrito'))!
        .trigger('click')
      await flushPromises()

      expect(useCartStore().lines.map((l) => [l.slug, l.size])).toEqual([['bolso', 'Único']])
      expect(useCartStore().toast?.message).toBe(`${PRODUCTS[1]!.name} agregado`)
    })
  })

  describe('the cart', () => {
    async function openCart() {
      const page = await mountAt('/producto/bolso')
      await useCartStore().add(PRODUCTS[1]!, 'Único')
      useCartStore().open()
      await flushPromises()
      return page
    }

    it('says shipping depends on the zone, without installments or a free-shipping promise', async () => {
      grocery()
      const page = await openCart()

      const drawer = page.find('.drawer')
      expect(drawer.text()).toContain('Según tu zona')
      for (const wording of [...APPAREL, 'cuotas']) expect(drawer.text()).not.toContain(wording)
    })

    it('keeps its wording at a standard store', async () => {
      const page = await openCart()

      const drawer = page.find('.drawer')
      expect(drawer.text()).toContain('Talle Único')
      expect(drawer.text()).toContain('Tenés envío gratis en este pedido.')
      expect(drawer.text()).toContain('cuotas sin interés')
    })

    it('talks about the product, not the size, when stock runs out', async () => {
      grocery()
      await mountAt('/producto/cam-titular')
      const cart = useCartStore()
      // The fake store has two of the Titular in L.
      await cart.add(PRODUCTS[0]!, 'L')
      await cart.add(PRODUCTS[0]!, 'L')
      await cart.add(PRODUCTS[0]!, 'L')

      expect(cart.toast?.message).toBe('Solo quedan 2 unidades de este producto.')
    })

    it('still says "de este talle" at a standard store', async () => {
      await mountAt('/producto/cam-titular')
      const cart = useCartStore()
      await cart.add(PRODUCTS[0]!, 'L')
      await cart.add(PRODUCTS[0]!, 'L')
      await cart.add(PRODUCTS[0]!, 'L')

      expect(cart.toast?.message).toBe('Solo quedan 2 unidades de este talle.')
    })
  })

  describe('the checkout and the order page', () => {
    async function placeOrder() {
      await mountAt('/')
      await useCartStore().add(PRODUCTS[1]!, 'Único')
      const checkout = await mountAt('/checkout')
      await checkout.find('#co-name').setValue('Ana')
      await checkout.find('#co-phone').setValue('11 5555-1234')
      await checkout.find('input[name="del"][value="pickup"]').setValue()
      return checkout
    }

    it('shows the lines of the summary and of the order without a size', async () => {
      grocery()
      const checkout = await placeOrder()
      expect(checkout.find('.summary').text()).not.toContain('Talle')
      expect(checkout.find('.summary .line-meta').text()).toBe('x1')

      await checkout.find('.confirm').trigger('click')
      await flushPromises()

      expect(checkout.find('.line-meta').text()).toBe('x1')
      expect(checkout.text()).not.toContain('Talle')
    })

    it('keeps the size in the lines at a standard store', async () => {
      api.checkoutOptions.cash = true
      await mountAt('/')
      await useCartStore().add(PRODUCTS[1]!, 'Único')
      const checkout = await mountAt('/checkout')

      expect(checkout.find('.summary .line-meta').text()).toBe('Talle Único · x1')
    })
  })
})

import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, type Router } from 'vue-router'

import App from '../App.vue'
import { createAppRouter } from '../router'
import { useCartStore } from '../stores/cart'
import { PRODUCTS, REGATE_THEME, STOCK, stubApi, type FakeApi } from './fakeApi'

vi.mock('../lib/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/navigation')>()),
  leaveTo: vi.fn<(url: string) => void>(),
}))

let api: FakeApi
let router: Router

async function mountAt(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function signIn(email: string) {
  api.auth.users.set(email, {
    id: email,
    name: 'Ana',
    password: 'camiseta26',
    favorites: [],
    roles: ['Customer'],
  })
  api.auth.state.session = email
}

// Places a transfer order (the Bolso x1 and the Titular M x2) through the real checkout and returns its page.
async function placeOrder(delivery: 'home' | 'pickup' = 'pickup') {
  await mountAt('/')
  const cart = useCartStore()
  await cart.add(PRODUCTS[1]!, 'Único')
  await cart.add(PRODUCTS[0]!, 'M')
  await cart.add(PRODUCTS[0]!, 'M')
  const wrapper = await mountAt('/checkout')
  await wrapper.find('#co-name').setValue('Ana Pérez')
  await wrapper.find('#co-email').setValue('ana@mail.com')
  if (delivery === 'pickup') {
    await wrapper.find('input[name="del"][value="pickup"]').setValue()
  } else {
    await wrapper.find('#co-address').setValue('Calle 1')
    await wrapper.find('#co-zip').setValue('1000')
  }
  await wrapper.find('input[name="pay"][value="transfer"]').setValue()
  await wrapper.find('.confirm').trigger('click')
  await flushPromises()
  return wrapper
}

describe('WhatsApp and repeat order', () => {
  beforeAll(async () => {
    await Promise.all([
      import('../views/AccountView.vue'),
      import('../views/CheckoutView.vue'),
      import('../views/OrderView.vue'),
    ])
  })

  beforeEach(() => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    // The store's theme only matters for the account page's cart drawer, which needs no store kind.
    api.theme.current = REGATE_THEME
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete STOCK['cam-titular/M']
  })

  describe('the WhatsApp link on the order page', () => {
    const link = (wrapper: VueWrapper) =>
      wrapper.findAll('a').find((a) => a.text() === 'Enviar mi pedido por WhatsApp')

    function message(wrapper: VueWrapper): string {
      const url = new URL(link(wrapper)!.attributes('href')!)
      return url.searchParams.get('text')!
    }

    it('opens a chat with the store, with the order already written', async () => {
      api.checkoutOptions.whatsappNumber = '5491155551234'

      const wrapper = await placeOrder('home')

      const anchor = link(wrapper)!
      expect(anchor.attributes('href')).toMatch(/^https:\/\/wa\.me\/5491155551234\?text=/)
      expect(anchor.attributes('target')).toBe('_blank')
      expect(anchor.attributes('rel')).toBe('noopener')
      const text = message(wrapper)
      expect(text).toContain('Hola, hice el pedido RG-20001:')
      expect(text).toContain('• 2 × Camiseta Titular 26 · M')
      expect(text).toContain('• 1 × ')
      expect(text).toContain('Transferencia')
      expect(text).toContain('Envío a Calle 1')
      expect(text).toContain('Ana Pérez')
    })

    it('says a pickup is collected at the store, and names the zone of a delivery', async () => {
      api.checkoutOptions.whatsappNumber = '5491155551234'
      expect(message(await placeOrder('pickup'))).toContain('Retiro en el local')

      api.orders.orders.get('RG-20001')!.deliveryZone = 'Centro'
      api.orders.orders.get('RG-20001')!.delivery = 'home'
      api.orders.orders.get('RG-20001')!.shippingAddress = { street: 'Calle 1', postalCode: '' }
      const later = await mountAt('/pedido/RG-20001')
      expect(message(later)).toContain('Envío a Calle 1 (Centro)')
    })

    it('never puts the order access token in the message', async () => {
      api.checkoutOptions.whatsappNumber = '5491155551234'

      const wrapper = await placeOrder()

      expect(decodeURIComponent(link(wrapper)!.attributes('href')!)).not.toContain('order-token')
    })

    it('is not there when the store has no WhatsApp number', async () => {
      const wrapper = await placeOrder()

      expect(link(wrapper)).toBeUndefined()
    })

    it('is not there for an expired order', async () => {
      api.checkoutOptions.whatsappNumber = '5491155551234'
      await placeOrder()
      api.orders.orders.get('RG-20001')!.status = 'expired'

      const later = await mountAt('/pedido/RG-20001')

      expect(later.text()).toContain('El pedido venció')
      expect(link(later)).toBeUndefined()
    })

    it('does not stop the order page from loading if the options cannot be read', async () => {
      api.checkoutOptions.whatsappNumber = '5491155551234'
      await placeOrder()
      const real = globalThis.fetch
      vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).includes('/api/checkout-options')
          ? Promise.reject(new TypeError('network'))
          : real(input, init),
      )

      const later = await mountAt('/pedido/RG-20001')

      expect(later.text()).toContain('RG-20001')
      expect(link(later)).toBeUndefined()
    })
  })

  describe('repeating an order from the account page', () => {
    const repeatButton = (wrapper: VueWrapper) =>
      wrapper.find('button[aria-label="Repetir el pedido RG-20001"]')

    async function accountWithOrder() {
      signIn('ana@mail.com')
      await placeOrder()
      return mountAt('/cuenta')
    }

    it('puts every line of the order back in the cart, with its quantity, and opens it', async () => {
      const wrapper = await accountWithOrder()
      expect(useCartStore().isEmpty).toBe(true)

      await repeatButton(wrapper).trigger('click')
      await flushPromises()

      const cart = useCartStore()
      expect(cart.lines.map((l) => [l.slug, l.size, l.qty])).toEqual([
        ['bolso', 'Único', 1],
        ['cam-titular', 'M', 2],
      ])
      expect(cart.isOpen).toBe(true)
      expect(wrapper.text()).toContain('Sumamos 3 productos de RG-20001 al carrito.')
    })

    it('adds what stock allows and says what could not be added', async () => {
      const wrapper = await accountWithOrder()
      STOCK['cam-titular/M'] = 1

      await repeatButton(wrapper).trigger('click')
      await flushPromises()

      const cart = useCartStore()
      expect(cart.lines.map((l) => [l.slug, l.qty])).toEqual([
        ['bolso', 1],
        ['cam-titular', 1],
      ])
      expect(wrapper.text()).toContain('Camiseta Titular 26: solo pudimos sumar 1')
    })

    it('skips a product the store no longer sells, and still adds the others', async () => {
      const wrapper = await accountWithOrder()
      api.orders.orders.get('RG-20001')!.lines[0]!.productSlug = 'descontinuado'

      await repeatButton(wrapper).trigger('click')
      await flushPromises()

      expect(useCartStore().lines.map((l) => l.slug)).toEqual(['cam-titular'])
      expect(wrapper.text()).toContain(': ya no está disponible')
    })

    it('says so when nothing could be added, and leaves the cart closed', async () => {
      const wrapper = await accountWithOrder()
      for (const line of api.orders.orders.get('RG-20001')!.lines)
        line.productSlug = 'descontinuado'

      await repeatButton(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('No pudimos sumar nada de RG-20001')
      expect(useCartStore().isOpen).toBe(false)
    })

    it('adds to what is already in the cart instead of replacing it', async () => {
      const wrapper = await accountWithOrder()
      await useCartStore().add(PRODUCTS[0]!, 'S')

      await repeatButton(wrapper).trigger('click')
      await flushPromises()

      expect(useCartStore().lines.map((l) => [l.slug, l.size])).toEqual([
        ['cam-titular', 'S'],
        ['bolso', 'Único'],
        ['cam-titular', 'M'],
      ])
    })
  })
})

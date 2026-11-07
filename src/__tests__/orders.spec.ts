import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, type Router } from 'vue-router'

import App from '../App.vue'
import { leaveTo } from '../lib/navigation'
import { orderToken, rememberOrderToken } from '../lib/orderAccess'
import { createAppRouter } from '../router'
import { useCartStore } from '../stores/cart'
import { PRODUCTS, stubApi, type FakeApi } from './fakeApi'

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

// A guest with the Titular (M) and the Bolso in the cart, on the checkout page.
async function checkoutWithCart() {
  await mountAt('/')
  const cart = useCartStore()
  await cart.add(PRODUCTS[0]!, 'M')
  await cart.add(PRODUCTS[1]!, 'Único')
  return mountAt('/checkout')
}

async function fillAndConfirm(
  wrapper: VueWrapper,
  payment: 'mercadopago' | 'transfer' = 'mercadopago',
) {
  await wrapper.find('#co-name').setValue('Juan Pérez')
  await wrapper.find('#co-email').setValue('juan@mail.com')
  await wrapper.find('#co-address').setValue('Av. Corrientes 1234')
  await wrapper.find('#co-zip').setValue('1043')
  await wrapper.find(`input[name="pay"][value="${payment}"]`).setValue()
  await confirm(wrapper)
}

async function confirm(wrapper: VueWrapper) {
  await wrapper.find('.confirm').trigger('click')
  await flushPromises()
}

describe('checkout and orders', () => {
  beforeAll(async () => {
    await Promise.all([
      import('../views/AccountView.vue'),
      import('../views/CheckoutView.vue'),
      import('../views/OrderView.vue'),
      import('../views/auth/LoginView.vue'),
    ])
  })

  beforeEach(() => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    vi.mocked(leaveTo).mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('places a Mercado Pago order and sends the shopper to pay', async () => {
    const wrapper = await checkoutWithCart()

    await fillAndConfirm(wrapper)

    const [placed] = api.orders.state.placed
    expect(placed!.body).toEqual({
      email: 'juan@mail.com',
      name: 'Juan Pérez',
      delivery: 'home',
      address: { street: 'Av. Corrientes 1234', postalCode: '1043' },
      paymentMethod: 'mercadopago',
    })
    expect(placed!.idempotencyKey).toBeTruthy()
    expect(leaveTo).toHaveBeenCalledWith('https://mercadopago.example/checkout/RG-20001')
    expect(orderToken('RG-20001')).toBe('order-token-1')
    expect(useCartStore().isEmpty).toBe(true)
  })

  it('places a transfer order and shows where to transfer', async () => {
    const wrapper = await checkoutWithCart()

    await fillAndConfirm(wrapper, 'transfer')

    expect(leaveTo).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/pedido/RG-20001')
    const text = wrapper.text()
    expect(text).toContain('Transferí para confirmar')
    expect(text).toContain('REGATE.TIENDA.DEMO')
    expect(text).toContain('0000003100000000000000')
    expect(text).toContain('Transferencia −10%')
  })

  describe('what the store offers at checkout', () => {
    it("shows the store's own pickup point, with its hours", async () => {
      api.checkoutOptions.pickup = { name: 'Indians Centro', details: 'Mar a sáb · 11 a 18 h' }
      const wrapper = await checkoutWithCart()

      await wrapper.find('input[name="del"][value="pickup"]').setValue()

      expect(wrapper.find('.pickup').text()).toContain('Indians Centro')
      expect(wrapper.find('.pickup').text()).toContain('Mar a sáb · 11 a 18 h')
      expect(wrapper.text()).not.toContain('Showroom Regate')
    })

    it('hides the pickup option when the store has no pickup point', async () => {
      api.checkoutOptions.pickup = null
      const wrapper = await checkoutWithCart()

      expect(wrapper.find('input[name="del"][value="pickup"]').exists()).toBe(false)
      expect(wrapper.find('input[name="del"][value="home"]').exists()).toBe(true)
    })

    it('hides the transfer option when the store has no transfer details', async () => {
      api.checkoutOptions.transfer = false
      const wrapper = await checkoutWithCart()

      expect(wrapper.find('input[name="pay"][value="transfer"]').exists()).toBe(false)
      expect(wrapper.find('input[name="pay"][value="mercadopago"]').exists()).toBe(true)
    })

    it('offers both when the store has set them up', async () => {
      const wrapper = await checkoutWithCart()

      expect(wrapper.find('input[name="del"][value="pickup"]').exists()).toBe(true)
      expect(wrapper.find('input[name="pay"][value="transfer"]').exists()).toBe(true)
    })

    it('still lets the shopper buy, with home delivery and Mercado Pago, if the options cannot be read', async () => {
      const real = globalThis.fetch
      vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).includes('/api/checkout-options')
          ? Promise.reject(new TypeError('network'))
          : real(input, init),
      )
      const wrapper = await checkoutWithCart()

      expect(wrapper.find('input[name="del"][value="pickup"]').exists()).toBe(false)
      expect(wrapper.find('input[name="pay"][value="transfer"]').exists()).toBe(false)
      expect(wrapper.find('input[name="pay"][value="mercadopago"]').exists()).toBe(true)
    })
  })

  it('names the lines that ran out of stock and keeps the shopper on checkout', async () => {
    const wrapper = await checkoutWithCart()
    api.orders.state.refuse = {
      status: 409,
      body: { items: [{ productSlug: 'cam-titular', size: 'M', stock: 0 }] },
    }

    await fillAndConfirm(wrapper)

    expect(router.currentRoute.value.name).toBe('checkout')
    expect(wrapper.find('[role="alert"]').text()).toContain('Camiseta Titular 26 (talle M)')
  })

  it('retries with the same idempotency key', async () => {
    const wrapper = await checkoutWithCart()
    api.orders.state.refuse = { status: 500, body: {} }
    await fillAndConfirm(wrapper)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    api.orders.state.refuse = null
    await confirm(wrapper)

    const keys = api.orders.state.placed.map((p) => p.idempotencyKey)
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
    expect(leaveTo).toHaveBeenCalledOnce()
  })

  it('lands on the order page with a pay button when Mercado Pago is unreachable', async () => {
    api.orders.state.checkoutDown = true
    const wrapper = await checkoutWithCart()

    await fillAndConfirm(wrapper)

    expect(router.currentRoute.value.fullPath).toBe('/pedido/RG-20001')
    expect(wrapper.text()).toContain('Falta el pago')
    const pay = wrapper.findAll('button').find((b) => b.text() === 'Pagar con Mercado Pago')!
    await pay.trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Mercado Pago no responde')
  })

  it('opens from the emailed link, then keeps the token out of the address bar', async () => {
    await fillAndConfirm(await checkoutWithCart(), 'transfer')
    localStorage.clear() // a different browser, holding only the email

    await mountAt('/pedido/RG-20001?token=order-token-1')

    expect(router.currentRoute.value.fullPath).toBe('/pedido/RG-20001')
    expect(document.body.textContent).toContain('Transferí para confirmar')
    const reloaded = await mountAt('/pedido/RG-20001')
    expect(reloaded.text()).toContain('Transferí para confirmar')
  })

  it("tells the shopper where to collect a paid pickup order, in the store's own words", async () => {
    api.checkoutOptions.pickup = { name: 'Indians Centro', details: 'Mar a sáb · 11 a 18 h' }
    const wrapper = await checkoutWithCart()
    await wrapper.find('input[name="del"][value="pickup"]').setValue()
    await wrapper.find('#co-name').setValue('Juan Pérez')
    await wrapper.find('#co-email').setValue('juan@mail.com')
    await confirm(wrapper)
    const order = api.orders.orders.get('RG-20001')!
    expect(order.pickup).toEqual({ name: 'Indians Centro', details: 'Mar a sáb · 11 a 18 h' })
    order.status = 'paid'
    order.fulfillment = 'ready-for-pickup'

    const page = await mountAt('/pedido/RG-20001?token=order-token-1')

    expect(page.text()).toContain('Retiralo en Indians Centro (Mar a sáb · 11 a 18 h).')
    expect(page.text()).not.toContain('showroom')
  })

  it('falls back to "el local" when the store has since removed its pickup point', async () => {
    const wrapper = await checkoutWithCart()
    await wrapper.find('input[name="del"][value="pickup"]').setValue()
    await wrapper.find('#co-name').setValue('Juan Pérez')
    await wrapper.find('#co-email').setValue('juan@mail.com')
    await confirm(wrapper)
    const order = api.orders.orders.get('RG-20001')!
    order.status = 'paid'
    order.fulfillment = 'ready-for-pickup'
    order.pickup = null

    const page = await mountAt('/pedido/RG-20001?token=order-token-1')

    expect(page.text()).toContain('Retiralo en el local.')
  })

  it('checks the payment when the shopper comes back from Mercado Pago', async () => {
    await fillAndConfirm(await checkoutWithCart())
    api.orders.state.onSync = (order) => {
      order.status = 'paid'
    }

    const wrapper = await mountAt('/pedido/RG-20001?collection_status=approved&payment_id=123')

    expect(api.orders.state.syncs).toBe(1)
    expect(wrapper.text()).toContain('¡Pedido confirmado!')
    expect(wrapper.text()).toContain('juan@mail.com')
    expect(router.currentRoute.value.fullPath).toBe('/pedido/RG-20001')
  })

  it('checks the payment even when the shopper comes back on their own', async () => {
    await fillAndConfirm(await checkoutWithCart())
    api.orders.state.onSync = (order) => {
      order.status = 'paid'
    }

    const wrapper = await mountAt('/pedido/RG-20001')

    expect(api.orders.state.syncs).toBe(1)
    expect(wrapper.text()).toContain('¡Pedido confirmado!')
  })

  it('doesn’t ask Mercado Pago about transfer orders', async () => {
    await fillAndConfirm(await checkoutWithCart(), 'transfer')

    await mountAt('/pedido/RG-20001')

    expect(api.orders.state.syncs).toBe(0)
  })

  it('keeps checking for a while when the payment is still being confirmed', async () => {
    await fillAndConfirm(await checkoutWithCart())
    vi.useFakeTimers()
    api.orders.state.onSync = (order) => {
      if (api.orders.state.syncs >= 3) order.status = 'paid'
    }

    const wrapper = await mountAt('/pedido/RG-20001?payment_id=123&status=in_process')
    expect(wrapper.text()).toContain('Confirmando tu pago')

    await vi.advanceTimersByTimeAsync(8000)
    await flushPromises()

    expect(wrapper.text()).toContain('¡Pedido confirmado!')
  })

  it('says so when the order can’t be opened', async () => {
    rememberOrderToken('RG-99999', 'nope')

    const wrapper = await mountAt('/pedido/RG-99999')

    expect(wrapper.text()).toContain('No encontramos el pedido')
  })

  it('lists a signed-in shopper’s orders on the account page', async () => {
    api.auth.users.set('ana@mail.com', {
      id: 'u1',
      name: 'Ana',
      password: 'camiseta26',
      favorites: [],
    })
    api.auth.state.session = 'ana@mail.com'
    await mountAt('/')
    await useCartStore().add(PRODUCTS[1]!, 'Único')
    const checkout = await mountAt('/checkout')
    await fillAndConfirm(checkout, 'transfer')

    const wrapper = await mountAt('/cuenta')

    const row = wrapper.find('.order')
    expect(row.text()).toContain('RG-20001')
    expect(row.text()).toContain('Pendiente de pago')
    expect(row.attributes('href')).toBe('/pedido/RG-20001')
  })
})

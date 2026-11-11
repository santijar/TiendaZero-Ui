import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, type Router } from 'vue-router'

import App from '../App.vue'
import { createAppRouter } from '../router'
import { useCartStore } from '../stores/cart'
import { PRODUCTS, REGATE_THEME, stubApi, type FakeApi } from './fakeApi'

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

const button = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)

// A neighborhood grocery: it takes cash and no online payment, and its theme says so.
function becomeGrocery() {
  api.theme.current = { ...REGATE_THEME, storeKind: 'Grocery' }
  Object.assign(api.checkoutOptions, { cash: true, mercadoPago: false, transfer: false })
}

async function checkoutWithCart() {
  await mountAt('/')
  await useCartStore().add(PRODUCTS[1]!, 'Único')
  return mountAt('/checkout')
}

async function confirm(wrapper: VueWrapper) {
  await wrapper.find('.confirm').trigger('click')
  await flushPromises()
}

describe('cash orders', () => {
  beforeAll(async () => {
    await Promise.all([
      import('../components/admin/AdminLayout.vue'),
      import('../views/admin/AdminOrdersView.vue'),
      import('../views/admin/AdminOrderView.vue'),
      import('../views/CheckoutView.vue'),
      import('../views/OrderView.vue'),
    ])
  })

  beforeEach(() => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    vi.stubGlobal('confirm', vi.fn<() => boolean>().mockReturnValue(true))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('at checkout', () => {
    it('lists cash only when the store accepts it', async () => {
      const without = await checkoutWithCart()
      expect(without.find('input[name="pay"][value="cash"]').exists()).toBe(false)

      api.checkoutOptions.cash = true
      const withCash = await checkoutWithCart()
      expect(withCash.find('input[name="pay"][value="cash"]').exists()).toBe(true)
      expect(withCash.text()).toContain('Pagás al recibir o retirar')
    })

    it('starts a grocery on cash, asks for a phone, and makes the email optional', async () => {
      becomeGrocery()
      const wrapper = await checkoutWithCart()

      expect(
        wrapper.find<HTMLInputElement>('input[name="pay"][value="cash"]').element.checked,
      ).toBe(true)
      expect(wrapper.find('#co-phone').exists()).toBe(true)
      expect(wrapper.find('label[for="co-email"]').text()).toBe('Email (opcional)')
    })

    it('does not ask a standard store for a phone', async () => {
      api.checkoutOptions.cash = true
      const wrapper = await checkoutWithCart()

      expect(wrapper.find('#co-phone').exists()).toBe(false)
      expect(wrapper.find('label[for="co-email"]').text()).toBe('Email')
    })

    it('places a grocery order with a phone and no email, and shows the order page', async () => {
      becomeGrocery()
      const wrapper = await checkoutWithCart()
      await wrapper.find('#co-name').setValue('Ana')
      await wrapper.find('#co-phone').setValue('11 5555-1234')
      await wrapper.find('#co-address').setValue('Calle 1')
      await wrapper.find('#co-zip').setValue('1000')
      await confirm(wrapper)

      expect(api.orders.state.placed.slice(-1)[0]!.body).toMatchObject({
        email: '',
        phone: '11 5555-1234',
        paymentMethod: 'cash',
      })
      expect(router.currentRoute.value.fullPath).toBe('/pedido/RG-20001')
      const page = wrapper.text()
      expect(page).toContain('Recibimos tu pedido')
      expect(page).toContain('en efectivo cuando te lo entregamos')
      expect(page).not.toContain('Te enviamos el detalle')
      expect(page).not.toContain('Falta el pago')
      expect(button(wrapper, 'Seguir comprando')).toBeTruthy()
    })

    it('asks for the phone, not the email, before confirming a grocery order', async () => {
      becomeGrocery()
      const wrapper = await checkoutWithCart()
      await wrapper.find('#co-name').setValue('Ana')
      await wrapper.find('#co-address').setValue('Calle 1')
      await wrapper.find('#co-zip').setValue('1000')
      await confirm(wrapper)

      expect(api.orders.state.placed).toHaveLength(0)
      expect(wrapper.text()).toContain('Completá tus datos para confirmar.')
    })

    it('still needs an email at a standard store paying in cash', async () => {
      api.checkoutOptions.cash = true
      const wrapper = await checkoutWithCart()
      await wrapper.find('#co-name').setValue('Ana')
      await wrapper.find('#co-address').setValue('Calle 1')
      await wrapper.find('#co-zip').setValue('1000')
      await wrapper.find('input[name="pay"][value="cash"]').setValue()
      await confirm(wrapper)

      expect(api.orders.state.placed).toHaveLength(0)
    })
  })

  describe('the order page', () => {
    async function placedCashOrder(delivery: 'home' | 'pickup') {
      becomeGrocery()
      const wrapper = await checkoutWithCart()
      await wrapper.find('#co-name').setValue('Ana')
      await wrapper.find('#co-phone').setValue('11 5555-1234')
      if (delivery === 'pickup') {
        await wrapper.find('input[name="del"][value="pickup"]').setValue()
      } else {
        await wrapper.find('#co-address').setValue('Calle 1')
        await wrapper.find('#co-zip').setValue('1000')
      }
      await confirm(wrapper)
      return wrapper
    }

    it('says a pickup is paid when it is collected', async () => {
      const wrapper = await placedCashOrder('pickup')

      expect(wrapper.text()).toContain('en efectivo cuando lo retirás')
    })

    it('follows the order through preparation before it is paid', async () => {
      const wrapper = await placedCashOrder('home')
      expect(wrapper.find('.progress').text()).toContain('Recibido')

      api.orders.orders.get('RG-20001')!.fulfillment = 'shipped'
      const later = await mountAt('/pedido/RG-20001')

      expect(later.text()).toContain('Tu pedido está en camino')
      expect(later.text()).toContain('en efectivo cuando te lo entregamos')
    })

    it('says an expired cash order was not prepared in time, not that payment is missing', async () => {
      await placedCashOrder('home')
      api.orders.orders.get('RG-20001')!.status = 'expired'

      const later = await mountAt('/pedido/RG-20001')

      expect(later.text()).toContain('El pedido venció')
      expect(later.text()).toContain('No llegamos a preparar')
      expect(later.text()).not.toContain('No recibimos el pago')
    })
  })

  describe('in the admin', () => {
    async function openAdminOrder() {
      await placedOrder()
      signInAsAdmin()
      return mountAt('/admin/pedidos/RG-20001')
    }

    async function placedOrder() {
      becomeGrocery()
      const wrapper = await checkoutWithCart()
      await wrapper.find('#co-name').setValue('Ana')
      await wrapper.find('#co-phone').setValue('11 5555-1234')
      await wrapper.find('input[name="del"][value="pickup"]').setValue()
      await confirm(wrapper)
    }

    it('shows the phone and no email, and lets the owner prepare the order before it is paid', async () => {
      const wrapper = await openAdminOrder()

      expect(wrapper.text()).toContain('11 5555-1234')
      expect(wrapper.text()).toContain('No dejó email')
      expect(wrapper.text()).toContain('Efectivo')
      expect(button(wrapper, 'Preparando')).toBeTruthy()
      expect(wrapper.text()).not.toContain('Cada cambio le avisa al cliente por email')

      await button(wrapper, 'Preparando')!.trigger('click')
      await flushPromises()

      expect(api.orders.orders.get('RG-20001')!.fulfillment).toBe('preparing')
      expect(api.orders.orders.get('RG-20001')!.status).toBe('pending')
    })

    it('marks the order paid with a cash wording', async () => {
      const wrapper = await openAdminOrder()

      await button(wrapper, 'Cobré en efectivo')!.trigger('click')
      await flushPromises()

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('en efectivo'))
      expect(api.orders.orders.get('RG-20001')!.status).toBe('paid')
      expect(button(wrapper, 'Cobré en efectivo')).toBeUndefined()
    })

    it('lists an order without an email under the customer name only', async () => {
      await placedOrder()
      signInAsAdmin()

      const list = await mountAt('/admin/pedidos')

      expect(list.text()).toContain('RG-20001')
      expect(list.text()).toContain('Ana')
    })
  })
})

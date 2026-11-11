import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, type Router } from 'vue-router'

import App from '../App.vue'
import { formatPrice } from '../lib/commerce'
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

const centro = { id: 'z-centro', name: 'Centro', cost: 500, minimumOrder: 0 }
const norte = { id: 'z-norte', name: 'Barrio Norte', cost: 800, minimumOrder: 999_999_999 }

describe('delivery zones', () => {
  beforeAll(async () => {
    await Promise.all([
      import('../components/admin/AdminLayout.vue'),
      import('../views/admin/AdminDeliveryZonesView.vue'),
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

  describe('the admin screen', () => {
    let wrapper: VueWrapper

    beforeEach(async () => {
      signInAsAdmin()
      wrapper = await mountAt('/admin/zonas')
    })

    const input = (id: string) => wrapper.find<HTMLInputElement>(`#${id}`)
    const button = (text: string) => wrapper.findAll('button').find((b) => b.text() === text)

    async function save(name: string, cost: string, minimum: string) {
      await input('dz-name').setValue(name)
      await input('dz-cost').setValue(cost)
      await input('dz-min').setValue(minimum)
      await wrapper.find('form[aria-label="Zona de envío"]').trigger('submit')
      await flushPromises()
    }

    it('is in the sidebar and says what having no zones means', () => {
      expect(wrapper.find('nav').text()).toContain('Zonas de envío')
      expect(wrapper.text()).toContain('Sin zonas')
      expect(wrapper.text()).toContain('el envío a domicilio es gratis y se pide el código postal')
    })

    it('adds a zone with its cost and minimum, and the checkout then offers it', async () => {
      await save('Centro', '500', '2000')

      expect(api.admin.deliveryZones.state.saves).toEqual([
        { name: 'Centro', cost: 500, minimumOrder: 2000 },
      ])
      expect(wrapper.text()).toContain('Centro')
      expect(wrapper.text()).toContain(formatPrice(500))
      expect(wrapper.text()).toContain(`mínimo ${formatPrice(2000)}`)
      expect(wrapper.text()).toContain('1 zona')
      expect(api.checkoutOptions.zones.map((z) => z.name)).toEqual(['Centro'])
      // The form is ready for the next one.
      expect(input('dz-name').element.value).toBe('')
    })

    it('shows a free zone as free', async () => {
      await save('Plaza', '0', '0')

      expect(wrapper.text()).toContain('Envío gratis')
    })

    it("shows the Api's messages next to the field, and keeps what was typed", async () => {
      await save('Centro', '500', '0')

      await save('centro', '-1', '')

      expect(wrapper.text()).toContain('Ya tenés una zona con ese nombre.')
      expect(wrapper.text()).toContain('Ingresá cuánto cuesta el envío')
      expect(wrapper.text()).toContain('Ingresá el pedido mínimo')
      expect(wrapper.text()).toContain('Revisá los campos marcados.')
      expect(input('dz-name').element.value).toBe('centro')
      expect(api.checkoutOptions.zones).toHaveLength(1)
    })

    it('edits a zone in place and can cancel', async () => {
      await save('Centro', '500', '0')

      await button('Editar')!.trigger('click')
      expect(input('dz-name').element.value).toBe('Centro')
      expect(wrapper.text()).toContain('Editar zona')
      await save('Microcentro', '900', '0')

      expect(api.checkoutOptions.zones).toHaveLength(1)
      expect(api.checkoutOptions.zones[0]).toMatchObject({ name: 'Microcentro', cost: 900 })
      expect(wrapper.text()).not.toContain('Editar zona')

      await button('Editar')!.trigger('click')
      await button('Cancelar')!.trigger('click')
      expect(wrapper.text()).toContain('Nueva zona')
    })

    it('removes a zone after asking, with a stronger warning for the last one', async () => {
      await save('Centro', '500', '0')
      await save('Norte', '800', '0')

      await wrapper.find('button[aria-label="Quitar Centro"]').trigger('click')
      await flushPromises()
      expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining('no cambian'))
      expect(api.checkoutOptions.zones.map((z) => z.name)).toEqual(['Norte'])

      await wrapper.find('button[aria-label="Quitar Norte"]').trigger('click')
      await flushPromises()
      expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining('código postal'))
      expect(wrapper.text()).toContain('Sin zonas')
    })

    it('keeps the zone when the admin does not confirm', async () => {
      await save('Centro', '500', '0')
      vi.mocked(window.confirm).mockReturnValue(false)

      await wrapper.find('button[aria-label="Quitar Centro"]').trigger('click')
      await flushPromises()

      expect(api.admin.deliveryZones.state.deletes).toEqual([])
      expect(wrapper.text()).toContain('Centro')
    })
  })

  describe('at checkout', () => {
    async function checkoutWithCart() {
      await mountAt('/')
      const cart = useCartStore()
      await cart.add(PRODUCTS[1]!, 'Único')
      const wrapper = await mountAt('/checkout')
      return { wrapper, cart }
    }

    it('asks for a zone, not a postal code, when the store has zones', async () => {
      api.checkoutOptions.zones = [centro, norte]
      const { wrapper } = await checkoutWithCart()

      expect(wrapper.find('#co-zip').exists()).toBe(false)
      const options = wrapper.findAll('#co-zone option').map((o) => o.text())
      expect(options).toEqual([
        'Elegí tu zona',
        `Centro · ${formatPrice(500)}`,
        `Barrio Norte · ${formatPrice(800)}`,
      ])
    })

    it('still asks for a postal code when the store has no zones', async () => {
      const { wrapper } = await checkoutWithCart()

      expect(wrapper.find('#co-zone').exists()).toBe(false)
      expect(wrapper.find('#co-zip').exists()).toBe(true)
    })

    it("adds the picked zone's cost to the total, and shows its minimum", async () => {
      api.checkoutOptions.zones = [centro, { ...norte, minimumOrder: 3000 }]
      const { wrapper, cart } = await checkoutWithCart()
      // No shipping price to show until a zone is picked.
      expect(wrapper.find('.totals').text()).toContain('Elegí tu zona')
      expect(wrapper.find('.totals').text()).not.toContain('Gratis')

      await wrapper.find('#co-zone').setValue('z-norte')

      expect(wrapper.find('.totals').text()).toContain(formatPrice(800))
      expect(wrapper.find('.total-amount').text()).toBe(formatPrice(cart.subtotal + 800))
      expect(wrapper.text()).toContain(`Pedido mínimo: ${formatPrice(3000)}`)
    })

    it('does not charge a zone for a pickup', async () => {
      api.checkoutOptions.zones = [centro]
      const { wrapper, cart } = await checkoutWithCart()
      await wrapper.find('#co-zone').setValue('z-centro')

      await wrapper.find('input[name="del"][value="pickup"]').setValue()

      expect(wrapper.find('#co-zone').exists()).toBe(false)
      expect(wrapper.find('.total-amount').text()).toBe(formatPrice(cart.subtotal))
    })

    it('will not confirm a home delivery until a zone is picked', async () => {
      api.checkoutOptions.zones = [centro]
      const { wrapper } = await checkoutWithCart()
      await wrapper.find('#co-name').setValue('Juan')
      await wrapper.find('#co-email').setValue('juan@mail.com')
      await wrapper.find('#co-address').setValue('Calle 1')

      await wrapper.find('.confirm').trigger('click')
      await flushPromises()

      expect(api.orders.state.placed).toHaveLength(0)
      expect(wrapper.text()).toContain('Completá tus datos para confirmar.')
    })

    async function placeInZone(zone: string) {
      api.checkoutOptions.zones = [centro, norte]
      const { wrapper } = await checkoutWithCart()
      await wrapper.find('#co-name').setValue('Juan')
      await wrapper.find('#co-email').setValue('juan@mail.com')
      await wrapper.find('#co-address').setValue('Calle 1')
      await wrapper.find('#co-zone').setValue(zone)
      // Transfer, so the order page opens (a Mercado Pago order leaves for Mercado Pago instead).
      await wrapper.find('input[name="pay"][value="transfer"]').setValue()
      await wrapper.find('.confirm').trigger('click')
      await flushPromises()
      return wrapper
    }

    it('sends the zone and no postal code, and the order page names the zone', async () => {
      const wrapper = await placeInZone('z-centro')

      expect(api.orders.state.placed.slice(-1)[0]!.body).toMatchObject({
        zoneId: 'z-centro',
        address: { street: 'Calle 1', postalCode: '' },
      })
      expect(router.currentRoute.value.fullPath).toBe('/pedido/RG-20001')
      expect(wrapper.find('.ship-to').text()).toBe('Envío a Calle 1 (Centro)')
      expect(wrapper.text()).toContain(formatPrice(500))
    })

    it("shows the Api's minimum-order message and places nothing", async () => {
      const wrapper = await placeInZone('z-norte')

      expect(wrapper.find('[role="alert"]').text()).toContain('El pedido mínimo para Barrio Norte')
      expect(router.currentRoute.value.name).toBe('checkout')
      expect(api.orders.orders.size).toBe(0)
    })
  })
})

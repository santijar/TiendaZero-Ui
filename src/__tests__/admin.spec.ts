import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, type Router } from 'vue-router'

import App from '../App.vue'
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

function signInAs(email: string, roles: string[]) {
  api.auth.users.set(email, {
    id: email,
    name: 'Admin',
    password: 'camiseta26',
    favorites: [],
    roles,
  })
  api.auth.state.session = email
}

const button = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)

// A guest's transfer order, placed through the real checkout.
async function placeTransferOrder(delivery: 'home' | 'pickup' = 'home') {
  await mountAt('/')
  await useCartStore().add(PRODUCTS[1]!, 'Único')
  const checkout = await mountAt('/checkout')
  await checkout.find('#co-name').setValue('Juan Pérez')
  await checkout.find('#co-email').setValue('juan@mail.com')
  if (delivery === 'pickup') {
    await checkout.find('input[name="del"][value="pickup"]').setValue()
  } else {
    await checkout.find('#co-address').setValue('Av. Corrientes 1234')
    await checkout.find('#co-zip').setValue('1043')
  }
  await checkout.find('input[name="pay"][value="transfer"]').setValue()
  await checkout.find('.confirm').trigger('click')
  await flushPromises()
}

describe('admin', () => {
  beforeAll(async () => {
    await Promise.all([
      import('../components/admin/AdminLayout.vue'),
      import('../views/admin/AdminOrdersView.vue'),
      import('../views/admin/AdminOrderView.vue'),
      import('../views/admin/AdminProductsView.vue'),
      import('../views/admin/AdminProductEditView.vue'),
      import('../views/admin/AdminTaxonomyView.vue'),
      import('../views/AccountView.vue'),
      import('../views/CheckoutView.vue'),
      import('../views/OrderView.vue'),
      import('../views/NotFoundView.vue'),
      import('../views/auth/LoginView.vue'),
    ])
  })

  beforeEach(() => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('is only for admins', async () => {
    await mountAt('/admin')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.next).toBe('/admin/pedidos')

    signInAs('cliente@mail.com', ['Customer'])
    await mountAt('/admin/pedidos')
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('shows admins a way in from their account', async () => {
    signInAs('admin@mail.com', ['TenantAdmin'])

    const wrapper = await mountAt('/cuenta')

    const link = wrapper.findAll('a').find((a) => a.text() === 'Administrar la tienda')!
    expect(link.attributes('href')).toBe('/admin/pedidos')
  })

  it('confirms a transfer and moves the order through shipping', async () => {
    await placeTransferOrder()
    signInAs('admin@mail.com', ['TenantAdmin'])

    const list = await mountAt('/admin/pedidos')
    // The admin has its own shell, without the storefront's header and cart.
    expect(list.find('.admin-shell').exists()).toBe(true)
    expect(list.find('.shell').exists()).toBe(false)
    expect(list.text()).toContain('RG-20001')
    expect(list.text()).toContain('Pendiente de pago')

    const wrapper = await mountAt('/admin/pedidos/RG-20001')
    await button(wrapper, 'Recibí la transferencia')!.trigger('click')
    await flushPromises()
    expect(window.confirm).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Pagado')

    await wrapper.find('#tracking').setValue('Andreani 360001')
    await button(wrapper, 'Enviado')!.trigger('click')
    await flushPromises()

    const order = api.orders.orders.get('RG-20001')!
    expect(order.status).toBe('paid')
    expect(order.fulfillment).toBe('shipped')
    expect(order.trackingInfo).toBe('Andreani 360001')
    expect(button(wrapper, 'Entregado')).toBeTruthy()
  })

  it('shows the shopper where their order is', async () => {
    await placeTransferOrder('pickup')
    const order = api.orders.orders.get('RG-20001')!
    order.status = 'paid'
    order.fulfillment = 'ready-for-pickup'

    const wrapper = await mountAt('/pedido/RG-20001')

    expect(wrapper.text()).toContain('Tu pedido está listo para retirar')
    expect(wrapper.find('[aria-current="step"]').text()).toBe('Listo para retirar')
  })

  it('sends stock only for the sizes whose stock was edited', async () => {
    signInAs('admin@mail.com', ['TenantAdmin'])
    const wrapper = await mountAt('/admin/productos/1')

    await wrapper.find('#p-name').setValue('Camiseta Titular 27')
    await wrapper.find('[aria-label="Stock 2"]').setValue(12)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const [save] = api.admin.state.saves
    expect(save!.name).toBe('Camiseta Titular 27')
    expect(save!.variants.map((v) => v.stock)).toEqual([null, 12])
    expect(button(wrapper, 'Guardado')).toBeTruthy()
  })

  it('stops a stale stock figure from undoing a sale, then picks up the current stock', async () => {
    signInAs('admin@mail.com', ['TenantAdmin'])
    const wrapper = await mountAt('/admin/productos/1')
    // A sale while the form is open.
    api.admin.state.product.variants[0] = {
      ...api.admin.state.product.variants[0]!,
      stock: 4,
      version: 2,
    }

    await wrapper.find('[aria-label="Stock 1"]').setValue(10)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('El stock cambió')
    await button(wrapper, 'Traer el stock actual')!.trigger('click')
    await flushPromises()
    expect((wrapper.find('[aria-label="Stock 1"]').element as HTMLInputElement).value).toBe('4')
  })

  it('creates a product and opens it for photos', async () => {
    signInAs('admin@mail.com', ['TenantAdmin'])
    const wrapper = await mountAt('/admin/productos/nuevo')
    expect(wrapper.text()).toContain('Guardá el producto para poder subirle fotos')

    await wrapper.find('#p-name').setValue('Camiseta Retro Ñandú')
    await wrapper.find('#p-name').trigger('input')
    await wrapper.find('#p-price').setValue(39900)
    await wrapper.find('#p-color').setValue('Bordó')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const [created] = api.admin.state.created
    expect(created!.slug).toBe('camiseta-retro-nandu')
    expect(created!.variants.map((v) => v.size)).toEqual(['S', 'M', 'L', 'XL'])
    expect(router.currentRoute.value.fullPath).toBe('/admin/productos/2')
    expect(wrapper.text()).toContain('Subir fotos')
  })

  it('marks the size row whose SKU is missing, and sends nothing', async () => {
    signInAs('admin@mail.com', ['TenantAdmin'])
    const wrapper = await mountAt('/admin/productos/nuevo')
    await wrapper.find('#p-name').setValue('Camiseta')
    await wrapper.find('#p-name').trigger('input')
    await wrapper.find('[aria-label="Talle 1"]').setValue('')
    await wrapper.find('[aria-label="SKU 1"]').setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.admin.state.created).toHaveLength(0)
    expect(wrapper.find('[aria-label="SKU 1"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[aria-label="Talle 1"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Falta el SKU.')
    expect(wrapper.text()).toContain('Falta el talle.')
    expect(wrapper.find('[aria-label="SKU 2"]').attributes('aria-invalid')).toBe('false')

    await wrapper.find('[aria-label="SKU 1"]').setValue('CAM-1')
    expect(wrapper.find('[aria-label="SKU 1"]').attributes('aria-invalid')).toBe('false')
  })
})

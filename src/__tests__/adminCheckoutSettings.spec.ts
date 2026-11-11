import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'

import App from '../App.vue'
import { createAppRouter } from '../router'
import { stubApi, type FakeApi } from './fakeApi'

let api: FakeApi
const mounted: VueWrapper[] = []

beforeAll(async () => {
  // Preload the lazily-routed views (flushPromises doesn't wait for a first dynamic import).
  await import('../components/admin/AdminLayout.vue')
  await import('../views/admin/AdminCheckoutSettingsView.vue')
})

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

const settings = () => api.admin.checkoutSettings.state

describe('the checkout settings screen', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    signInAs('admin@mail.com', ['TenantAdmin'])
    wrapper = await mountAt('/admin/cobros')
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
  })

  const whatsapp = () => wrapper.find<HTMLInputElement>('#cs-whatsapp')
  const checkbox = (name: string) => wrapper.find<HTMLInputElement>(`input[name="${name}"]`)

  async function save() {
    await wrapper.find('form[aria-label="Cobros y WhatsApp"]').trigger('submit')
    await flushPromises()
  }

  it('is in the admin sidebar, for store admins only', async () => {
    expect(wrapper.find('nav').text()).toContain('Cobros y WhatsApp')
    api.auth.users.get('admin@mail.com')!.roles = ['Customer']
    const other = await mountAt('/admin/cobros')
    expect(other.find('h1').exists() && other.find('h1').text()).not.toBe('Cobros y WhatsApp')
  })

  it('shows what the Api answers for the store, not an empty form', async () => {
    settings().settings = { whatsappNumber: '5491155551234', cash: true, mercadoPago: false }

    const reopened = await mountAt('/admin/cobros')

    expect(reopened.find<HTMLInputElement>('#cs-whatsapp').element.value).toBe('5491155551234')
    expect(reopened.find<HTMLInputElement>('input[name="cash"]').element.checked).toBe(true)
    expect(reopened.find<HTMLInputElement>('input[name="mercadopago"]').element.checked).toBe(false)
  })

  it('saves the number and the two switches, and the checkout offers them', async () => {
    await whatsapp().setValue('+54 9 11 5555-1234')
    await checkbox('cash').setValue(true)
    await checkbox('mercadopago').setValue(false)
    await save()

    expect(settings().saves).toEqual([
      { whatsappNumber: '+54 9 11 5555-1234', cash: true, mercadoPago: false },
    ])
    // The Api normalizes the number to digits and the form shows what was kept.
    expect(whatsapp().element.value).toBe('5491155551234')
    expect(wrapper.text()).toContain('Guardamos cómo cobrás')
    expect(api.checkoutOptions.whatsappNumber).toBe('5491155551234')
  })

  it('sends no number at all when the field is left empty', async () => {
    await save()

    expect(settings().saves).toEqual([{ whatsappNumber: null, cash: false, mercadoPago: true }])
  })

  it("shows the Api's message next to a number that can't be dialed", async () => {
    await whatsapp().setValue('1234')
    await save()

    expect(settings().saves).toHaveLength(0)
    expect(wrapper.text()).toContain('Ingresá el número con código de país')
    expect(wrapper.text()).toContain('Revisá los campos marcados.')
  })
})

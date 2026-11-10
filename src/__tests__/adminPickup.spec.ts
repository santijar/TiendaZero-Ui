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
  await import('../views/admin/AdminPickupView.vue')
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

const pickup = () => api.admin.pickup.state

describe('the pickup screen', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    signInAs('admin@mail.com', ['TenantAdmin'])
    wrapper = await mountAt('/admin/retiro')
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
  })

  const input = (id: string) => wrapper.find<HTMLInputElement>(`#${id}`)

  async function save(name: string, details = '') {
    await input('pk-name').setValue(name)
    await input('pk-details').setValue(details)
    await wrapper.find('form[aria-label="Retiro en local"]').trigger('submit')
    await flushPromises()
  }

  it('is in the admin sidebar, for store admins only', async () => {
    expect(wrapper.find('nav').text()).toContain('Retiro')
    api.auth.users.get('admin@mail.com')!.roles = ['Customer']
    const other = await mountAt('/admin/retiro')
    expect(other.find('h1').text()).not.toBe('Retiro en local')
  })

  it('says a store without a pickup point offers only home delivery', () => {
    expect(wrapper.text()).toContain('Sin retiro')
    expect(wrapper.text()).toContain('solo envío a domicilio')
    expect(wrapper.text()).not.toContain('Quitar el retiro')
  })

  it('saves the place and its hours', async () => {
    await save('Showroom Centro', 'Lun a vie · 10 a 19 h')

    expect(pickup().saves).toEqual([{ name: 'Showroom Centro', details: 'Lun a vie · 10 a 19 h' }])
    expect(wrapper.text()).toContain('Ofrecés retiro')
    expect(wrapper.text()).toContain('Ya se ofrece al comprar')
    expect(wrapper.text()).toContain('Quitar el retiro')
  })

  it("shows the Api's message next to a missing name", async () => {
    await save('', 'Lun a vie')

    expect(pickup().saves).toHaveLength(0)
    expect(wrapper.text()).toContain('Ingresá el nombre del lugar de retiro')
    expect(wrapper.text()).toContain('Revisá los campos marcados.')
  })

  it('shows the saved place when the screen opens', async () => {
    pickup().settings = { configured: true, name: 'Local Norte', details: 'Sáb 10 a 14 h' }

    const reopened = await mountAt('/admin/retiro')

    expect(reopened.find<HTMLInputElement>('#pk-name').element.value).toBe('Local Norte')
    expect(reopened.find<HTMLInputElement>('#pk-details').element.value).toBe('Sáb 10 a 14 h')
    expect(reopened.text()).toContain('Ofrecés retiro')
  })

  it('removes the pickup point after asking', async () => {
    pickup().settings = { configured: true, name: 'Local Norte', details: '' }
    const configured = await mountAt('/admin/retiro')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const remove = configured.findAll('button').find((b) => b.text() === 'Quitar el retiro')!
    await remove.trigger('click')
    await flushPromises()

    expect(confirm).toHaveBeenCalled()
    expect(pickup().removes).toBe(1)
    expect(configured.text()).toContain('Sin retiro')
    expect(configured.text()).toContain('ya no ofrece retiro en local')
    confirm.mockRestore()
  })

  it('keeps the pickup point when the admin does not confirm', async () => {
    pickup().settings = { configured: true, name: 'Local Norte', details: '' }
    const configured = await mountAt('/admin/retiro')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const remove = configured.findAll('button').find((b) => b.text() === 'Quitar el retiro')!
    await remove.trigger('click')
    await flushPromises()

    expect(pickup().removes).toBe(0)
    expect(configured.text()).toContain('Ofrecés retiro')
    confirm.mockRestore()
  })
})

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import QRCode from 'qrcode'

import App from '../App.vue'
import { createAppRouter } from '../router'
import { stubApi, type FakeApi } from './fakeApi'

let api: FakeApi
const mounted: VueWrapper[] = []

beforeAll(async () => {
  // Preload the lazily-routed views (flushPromises doesn't wait for a first dynamic import).
  await import('../components/admin/AdminLayout.vue')
  await import('../views/admin/AdminShareView.vue')
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

describe('the share screen', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    signInAs('admin@mail.com', ['TenantAdmin'])
    wrapper = await mountAt('/admin/compartir')
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('is in the admin sidebar, for store admins only', async () => {
    expect(wrapper.find('nav').text()).toContain('Compartir tienda')
    api.auth.users.get('admin@mail.com')!.roles = ['Customer']

    const other = await mountAt('/admin/compartir')

    expect(other.text()).not.toContain('Compartir tu tienda')
  })

  it("shows the store's own address, and the store's name on the poster", () => {
    expect(
      wrapper.find<HTMLInputElement>('input[aria-label="Link de la tienda"]').element.value,
    ).toBe(window.location.origin)
    expect(wrapper.find('.poster h2').text()).toBe('Regate')
    expect(wrapper.find('.poster').text()).toContain('Escaneá y hacé tu pedido')
    expect(wrapper.find('.poster-url').text()).toBe(window.location.origin)
  })

  it('draws a QR code for that address', async () => {
    const draw = vi.spyOn(QRCode, 'toString')
    const again = await mountAt('/admin/compartir')

    expect(draw).toHaveBeenCalledWith(
      window.location.origin,
      expect.objectContaining({ type: 'svg' }),
    )
    const code = again.find('.qr')
    expect(code.attributes('role')).toBe('img')
    expect(code.find('svg').exists()).toBe(true)
    expect(code.find('svg path').exists()).toBe(true)
  })

  it('says so when the code cannot be drawn, and does not offer to print it', async () => {
    vi.spyOn(QRCode, 'toString').mockRejectedValue(new Error('boom'))

    const failed = await mountAt('/admin/compartir')

    expect(failed.text()).toContain('No pudimos generar el código QR.')
    expect(failed.find('.qr').exists()).toBe(false)
    const print = failed.findAll('button').find((b) => b.text() === 'Imprimir el cartel')!
    expect(print.attributes('disabled')).toBeDefined()
  })

  it('copies the link, or says it could not', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const copy = () => wrapper.findAll('button').find((b) => b.text() === 'Copiar link')!

    await copy().trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(window.location.origin)
    expect(wrapper.text()).toContain('Copiamos el link.')

    writeText.mockRejectedValue(new Error('denied'))
    await copy().trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('No pudimos copiarlo')
  })

  it('prints the poster', async () => {
    const print = vi.fn<() => void>()
    vi.stubGlobal('print', print)

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Imprimir el cartel')!
      .trigger('click')

    expect(print).toHaveBeenCalledOnce()
  })
})

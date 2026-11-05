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
  await import('../views/admin/AdminDomainsView.vue')
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

const domains = () => api.admin.domains.state

describe('the domains screen', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    signInAs('admin@mail.com', ['TenantAdmin'])
    wrapper = await mountAt('/admin/dominios')
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const section = (host: string) => wrapper.find(`section[aria-label="${host}"]`)
  const button = (scope: ReturnType<typeof section>, text: string) =>
    scope.findAll('button').find((b) => b.text() === text)

  async function claim(host: string) {
    await wrapper.find<HTMLInputElement>('#d-new').setValue(host)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
  }

  async function click(scope: ReturnType<typeof section>, text: string) {
    await button(scope, text)!.trigger('click')
    await flushPromises()
  }

  // The record a store would publish for a claim, put in DNS.
  function publish(host: string) {
    const d = domains().domains.find((x) => x.domain === host)!
    domains().published.add(`${d.instructions!.txtName}=${d.instructions!.txtValue}`)
  }

  it('is a screen for store admins only', async () => {
    api.auth.users.get('admin@mail.com')!.roles = ['Customer']
    const other = await mountAt('/admin/dominios')

    expect(other.text()).not.toContain('Agregar un dominio propio')
  })

  it('is in the admin sidebar', () => {
    expect(wrapper.find('nav').text()).toContain('Dominios')
  })

  it('lists the platform subdomain as the primary one, with nothing to do on it', () => {
    const sub = section('regate.localhost')

    expect(wrapper.find('h1').text()).toBe('Dominios')
    expect(sub.text()).toContain('Principal')
    expect(sub.text()).toContain('De la plataforma')
    expect(sub.findAll('button')).toHaveLength(0)
  })

  it('claims a host and shows the records to publish', async () => {
    await claim('shop.example.com')

    const pending = section('shop.example.com')
    expect(pending.text()).toContain('Pendiente de verificar')
    expect(pending.text()).toContain('_tiendazero.shop.example.com')
    expect(pending.text()).toContain('tiendazero-verification=token1')
    expect(pending.text()).toContain('stores.tienda.example')
    expect(pending.text()).toContain('Los cambios de DNS pueden tardar')
    expect(button(pending, 'Verificar')).toBeDefined()
    expect(button(pending, 'Hacer principal')).toBeUndefined()
    expect(wrapper.find<HTMLInputElement>('#d-new').element.value).toBe('')
  })

  it("shows the Api's message when the host can't be used", async () => {
    await claim('https://shop.example.com')

    expect(wrapper.text()).toContain('sin https:// ni barras')
    expect(wrapper.findAll('section.domain')).toHaveLength(1)
  })

  it('says when another store already has the host', async () => {
    domains().taken.add('taken.example.com')

    await claim('taken.example.com')

    expect(wrapper.text()).toContain('Ese dominio ya está en uso por otra tienda.')
  })

  it('tells the admin the record is not there yet, and leaves the claim pending', async () => {
    await claim('shop.example.com')

    await click(section('shop.example.com'), 'Verificar')

    expect(section('shop.example.com').text()).toContain('Todavía no vemos el registro TXT')
    expect(section('shop.example.com').text()).toContain('Pendiente de verificar')
  })

  it('says when DNS could not be read, which is not the same as not published', async () => {
    await claim('shop.example.com')
    publish('shop.example.com')
    domains().dnsDown = true

    await click(section('shop.example.com'), 'Verificar')

    expect(section('shop.example.com').text()).toContain('No pudimos consultar el DNS')
    expect(section('shop.example.com').text()).not.toContain('Todavía no vemos')
  })

  it('verifies once the record is published, then shows the certificate and the CNAME', async () => {
    await claim('shop.example.com')
    publish('shop.example.com')

    await click(section('shop.example.com'), 'Verificar')

    const verified = section('shop.example.com')
    expect(verified.text()).toContain('Dominio verificado')
    expect(verified.text()).toContain('Verificado')
    expect(verified.text()).toContain('Certificado en trámite')
    expect(verified.text()).toContain('Esperando el certificado.')
    // The TXT step is done; the CNAME to point at is still shown.
    expect(verified.text()).not.toContain('tiendazero-verification')
    expect(verified.text()).toContain('stores.tienda.example')
    expect(button(verified, 'Actualizar estado del certificado')).toBeDefined()
    expect(button(verified, 'Hacer principal')).toBeDefined()
  })

  it('refreshes the certificate status of a verified host', async () => {
    await claim('shop.example.com')
    publish('shop.example.com')
    await click(section('shop.example.com'), 'Verificar')
    domains().certificate = { status: 'Active', detail: null }

    await click(section('shop.example.com'), 'Actualizar estado del certificado')

    expect(section('shop.example.com').text()).toContain('Certificado activo')
  })

  it('makes a verified host primary, with a warning while it has no active certificate', async () => {
    await claim('shop.example.com')
    publish('shop.example.com')
    await click(section('shop.example.com'), 'Verificar')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await click(section('shop.example.com'), 'Hacer principal')
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0]![0]).toContain('certificado activo')
    expect(section('shop.example.com').text()).not.toContain('Principal')

    confirm.mockReturnValue(true)
    await click(section('shop.example.com'), 'Hacer principal')
    expect(section('shop.example.com').text()).toContain('Principal')
    expect(section('regate.localhost').text()).not.toContain('Principal')
    expect(wrapper.text()).toContain('shop.example.com es ahora el dominio principal.')
    // The subdomain can be made primary again, without a warning (it has the platform's own certificate).
    await click(section('regate.localhost'), 'Hacer principal')
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(section('regate.localhost').text()).toContain('Principal')
  })

  it('removes a claim after asking, and not when the admin backs out', async () => {
    await claim('shop.example.com')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await click(section('shop.example.com'), 'Quitar')
    expect(section('shop.example.com').exists()).toBe(true)
    expect(domains().removed).toEqual([])

    confirm.mockReturnValue(true)
    await click(section('shop.example.com'), 'Quitar')
    expect(section('shop.example.com').exists()).toBe(false)
    expect(domains().removed).toEqual(['shop.example.com'])
  })

  it('does not offer to remove the primary host', async () => {
    await claim('shop.example.com')
    publish('shop.example.com')
    await click(section('shop.example.com'), 'Verificar')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await click(section('shop.example.com'), 'Hacer principal')

    expect(button(section('shop.example.com'), 'Quitar')).toBeUndefined()
    expect(button(section('regate.localhost'), 'Quitar')).toBeUndefined()
  })
})

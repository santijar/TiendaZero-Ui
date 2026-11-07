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
  await import('../views/admin/AdminPaymentsView.vue')
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

// The Mercado Pago form (the transfer details have their own form on the same screen).
const MP_FORM = 'form:not([aria-label="Transferencia bancaria"])'
const transfer = () => api.admin.transfer.state
const payments = () => api.admin.payments.state

describe('the payments screen', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    signInAs('admin@mail.com', ['TenantAdmin'])
    wrapper = await mountAt('/admin/pagos')
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
  })

  const input = (id: string) => wrapper.find<HTMLInputElement>(`#${id}`)

  async function fillAndSubmit(token = 'APP_USR-regate-token-1234') {
    await input('p-token').setValue(token)
    await input('p-key').setValue('APP_USR-public-key')
    await input('p-secret').setValue('the-secret')
    await wrapper.find(MP_FORM).trigger('submit')
    await flushPromises()
  }

  it('is a screen for store admins only', async () => {
    api.auth.users.get('admin@mail.com')!.roles = ['Customer']
    const other = await mountAt('/admin/pagos')

    expect(other.text()).not.toContain('Conectar Mercado Pago')
  })

  it('is in the admin sidebar', () => {
    expect(wrapper.find('nav').text()).toContain('Pagos')
  })

  it('offers to connect a store that has no account, with secrets hidden as they are typed', () => {
    expect(wrapper.find('h1').text()).toBe('Pagos')
    expect(wrapper.text()).toContain('Mercado Pago sin conectar')
    expect(wrapper.text()).toContain('Conectar Mercado Pago')
    expect(input('p-token').attributes('type')).toBe('password')
    expect(input('p-secret').attributes('type')).toBe('password')
    expect(input('p-key').attributes('type')).toBeUndefined()
    expect(wrapper.find('[aria-label="Cuenta conectada"]').exists()).toBe(false)
  })

  it('connects with the pasted credentials, then shows the account without any secret', async () => {
    await fillAndSubmit()

    expect(payments().connects).toEqual([
      {
        accessToken: 'APP_USR-regate-token-1234',
        publicKey: 'APP_USR-public-key',
        webhookSecret: 'the-secret',
      },
    ])
    const summary = wrapper.find('[aria-label="Cuenta conectada"]')
    expect(summary.text()).toContain('1000')
    expect(summary.text()).toContain('…1234')
    expect(summary.text()).toContain('APP_USR-public-key')
    expect(summary.text()).toContain('Cargada')
    expect(wrapper.text()).toContain('Mercado Pago conectado')
    expect(wrapper.text()).toContain('Mercado Pago quedó conectado')
    // The form is gone and nothing typed is left in the page.
    expect(wrapper.find(MP_FORM).exists()).toBe(false)
    expect(wrapper.html()).not.toContain('APP_USR-regate-token-1234')
    expect(wrapper.html()).not.toContain('the-secret')
  })

  it('shows the webhook url the store has to register in Mercado Pago', async () => {
    await fillAndSubmit()

    expect(input('p-webhook').element.value).toBe(
      'https://api.tienda.example/api/payments/webhooks/mercadopago/0197-regate',
    )
    expect(input('p-webhook').attributes('readonly')).toBeDefined()
  })

  it("shows the Api's message when Mercado Pago does not know the token, and keeps the form", async () => {
    await fillAndSubmit('APP_USR-made-up')

    expect(wrapper.text()).toContain('Mercado Pago no reconoce este access token.')
    expect(wrapper.find(MP_FORM).exists()).toBe(true)
    expect(wrapper.find('[aria-label="Cuenta conectada"]').exists()).toBe(false)
    expect(payments().connects).toEqual([])
  })

  it('says so when Mercado Pago cannot be reached', async () => {
    payments().down = true

    await fillAndSubmit()

    expect(wrapper.text()).toContain('No pudimos comunicarnos con Mercado Pago')
    expect(wrapper.find(MP_FORM).exists()).toBe(true)
  })

  it('shows a missing field next to it', async () => {
    await input('p-token').setValue('APP_USR-regate-token-1234')
    await input('p-key').setValue('pk')
    await input('p-secret').setValue('   ')
    await wrapper.find(MP_FORM).trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('La clave secreta de webhooks es obligatoria.')
    expect(payments().connects).toEqual([])
  })

  describe('with an account connected', () => {
    beforeEach(async () => {
      await fillAndSubmit()
    })

    it('reopens the form empty to change the credentials, and can be cancelled', async () => {
      const change = wrapper.findAll('button').find((b) => b.text() === 'Cambiar credenciales')!
      await change.trigger('click')

      expect(wrapper.text()).toContain('Nuevas credenciales')
      expect(input('p-token').element.value).toBe('')
      expect(input('p-secret').element.value).toBe('')

      const cancel = wrapper.findAll('button').find((b) => b.text() === 'Cancelar')!
      await cancel.trigger('click')
      expect(wrapper.find(MP_FORM).exists()).toBe(false)
      expect(wrapper.find('[aria-label="Cuenta conectada"]').exists()).toBe(true)
    })

    it('disconnects after confirming, and not when the admin backs out', async () => {
      const disconnect = () => wrapper.findAll('button').find((b) => b.text() === 'Desconectar')!
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

      await disconnect().trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenCalled()
      expect(payments().disconnects).toBe(0)
      expect(wrapper.find('[aria-label="Cuenta conectada"]').exists()).toBe(true)

      confirm.mockReturnValue(true)
      await disconnect().trigger('click')
      await flushPromises()
      expect(payments().disconnects).toBe(1)
      expect(wrapper.text()).toContain('Mercado Pago sin conectar')
      expect(wrapper.text()).toContain('Mercado Pago quedó desconectado')
      expect(wrapper.find(MP_FORM).exists()).toBe(true)
      confirm.mockRestore()
    })
  })

  it('shows the webhook url before connecting, because the secret only exists once it is registered', () => {
    expect(payments().account.status).toBe('Disconnected')
    expect(input('p-webhook-first').element.value).toBe(payments().account.webhookUrl)
    expect(input('p-webhook-first').attributes('readonly')).toBeDefined()
  })

  describe('transfer details', () => {
    const tform = () => wrapper.find('form[aria-label="Transferencia bancaria"]')

    async function fillTransfer(
      values: Partial<Record<'alias' | 'cbu' | 'holder' | 'bank', string>> = {},
    ) {
      const v = {
        alias: 'TIENDA.PROPIA',
        cbu: '0000003100012345678901',
        holder: 'Tienda SRL',
        bank: 'Banco Demo',
        ...values,
      }
      await wrapper.find<HTMLInputElement>('#t-alias').setValue(v.alias)
      await wrapper.find<HTMLInputElement>('#t-cbu').setValue(v.cbu)
      await wrapper.find<HTMLInputElement>('#t-holder').setValue(v.holder)
      await wrapper.find<HTMLInputElement>('#t-bank').setValue(v.bank)
      await tform().trigger('submit')
      await flushPromises()
    }

    it('says a store without details takes no transfers', () => {
      expect(tform().exists()).toBe(true)
      expect(wrapper.text()).toContain('Sin configurar')
      expect(wrapper.text()).toContain('no ofrece pagar por transferencia')
    })

    it('saves the details and shows the store accepts transfers', async () => {
      await fillTransfer()

      expect(transfer().saves).toEqual([
        {
          alias: 'TIENDA.PROPIA',
          cbu: '0000003100012345678901',
          holder: 'Tienda SRL',
          bank: 'Banco Demo',
        },
      ])
      expect(wrapper.text()).toContain('Acepta transferencias')
      expect(wrapper.text()).toContain('Guardamos los datos')
    })

    it('shows the saved details when the screen opens', async () => {
      transfer().account = {
        configured: true,
        alias: 'YA.CARGADO',
        cbu: '0000003100099999999999',
        holder: 'Otro SA',
        bank: 'Banco Otro',
      }

      const reopened = await mountAt('/admin/pagos')

      expect(reopened.find<HTMLInputElement>('#t-alias').element.value).toBe('YA.CARGADO')
      expect(reopened.find<HTMLInputElement>('#t-bank').element.value).toBe('Banco Otro')
      expect(reopened.text()).toContain('Acepta transferencias')
    })

    it("marks each field the Api refuses, with the Api's message", async () => {
      await fillTransfer({ alias: 'con espacios', cbu: '123' })

      expect(transfer().saves).toHaveLength(0)
      expect(wrapper.text()).toContain('sin espacios')
      expect(wrapper.text()).toContain('El CBU o CVU tiene 22 números.')
      expect(wrapper.text()).toContain('Revisá los campos marcados.')
      expect(wrapper.text()).toContain('Sin configurar')
    })
  })

  it('shows an account that was already connected when the screen opens', async () => {
    payments().account = {
      ...payments().account,
      status: 'Connected',
      providerAccountId: '55',
      accessTokenHint: '…9999',
      publicKey: 'APP_USR-pk',
      hasWebhookSecret: true,
      connectedAt: '2026-11-01T12:00:00Z',
    }

    const reopened = await mountAt('/admin/pagos')

    expect(reopened.find('[aria-label="Cuenta conectada"]').text()).toContain('…9999')
    expect(reopened.find(MP_FORM).exists()).toBe(false)
  })
})

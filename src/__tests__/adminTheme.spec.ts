import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'

import App from '../App.vue'
import { checkContrast, contrastRatio, luminance } from '../lib/contrast'
import { createAppRouter } from '../router'
import { stubApi, type FakeApi } from './fakeApi'

let api: FakeApi

beforeAll(async () => {
  // Preload the lazily-routed views (flushPromises doesn't wait for a first dynamic import).
  await import('../components/admin/AdminLayout.vue')
  await import('../views/admin/AdminThemeView.vue')
})

describe('contrast', () => {
  it('measures WCAG ratios between plain hex colors', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1)
    expect(luminance('#000000')).toBe(0)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21)
    expect(contrastRatio('#7363c0', '#7363c0')).toBeCloseTo(1)
    // Nocturne's own accent on its dark ground clears the 3:1 its readme asks for.
    expect(contrastRatio('#9184d9', '#161826')!).toBeGreaterThan(3)
  })

  it('has no ratio for colors that are not plain hex', () => {
    expect(luminance('rgba(0, 0, 0, 0.5)')).toBeNull()
    expect(luminance('')).toBeNull()
    expect(contrastRatio('red', '#ffffff')).toBeNull()
  })

  it('checks the accent against both grounds and its text pair, flagging what falls short', () => {
    const good = checkContrast({
      '--color-bg': '#161826',
      '--color-surface': '#232532',
      '--color-accent': '#a296f1',
      '--color-accent-200': '#e7e5fe',
      '--color-accent-900': '#2b2741',
    })
    expect(good.map((c) => c.id)).toEqual(['accent-bg', 'accent-surface', 'tint-text'])
    expect(good.every((c) => c.passes)).toBe(true)

    const bad = checkContrast({
      '--color-bg': '#161826',
      '--color-surface': '#232532',
      '--color-accent': '#222222',
      '--color-accent-200': '#e7e5fe',
      '--color-accent-900': '#2b2741',
    })
    expect(bad.filter((c) => !c.passes).map((c) => c.id)).toEqual(['accent-bg', 'accent-surface'])
  })

  it('does not pass what it cannot measure', () => {
    expect(checkContrast({}).every((c) => !c.passes && c.ratio === null)).toBe(true)
  })
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

const requestsTo = (path: string) =>
  api.fetchMock.mock.calls.filter(([input]) => new URL(String(input), 'http://x').pathname === path)

// The preview is debounced by 250 ms.
const afterDebounce = async () => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  await flushPromises()
}

const mounted: VueWrapper[] = []

const last = <T>(items: T[]): T => items[items.length - 1]!

describe('the branding editor', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico">'
    signInAs('admin@mail.com', ['TenantAdmin'])
    wrapper = await mountAt('/admin/marca')
  })

  afterEach(() => {
    // A mounted editor keeps its debounce timer; leave none behind for the next test's fake Api.
    mounted.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-theme-mode')
  })

  const input = (id: string) => wrapper.find<HTMLInputElement>(`#${id}`)

  it('is a screen for store admins only', async () => {
    api.auth.users.get('admin@mail.com')!.roles = ['Customer']
    const other = await mountAt('/admin/marca')

    expect(other.find('h1').exists() && other.find('h1').text() === 'Marca').toBe(false)
    expect(other.text()).not.toContain('Contraste del acento')
  })

  it('loads the saved branding into the form', () => {
    expect(wrapper.find('h1').text()).toBe('Marca')
    expect(input('t-name').element.value).toBe('Regate')
    expect(input('t-legal').element.value).toBe('Regate Indumentaria')
    expect(input('t-wordmark').element.value).toBe('REGATE')
    expect(input('t-monogram').element.value).toBe('RG')
    expect(wrapper.find<HTMLInputElement>('input[name="mode"][value="Dark"]').element.checked).toBe(
      true,
    )
    expect(wrapper.find<HTMLInputElement>('.hue-number').element.value).toBe('289')
    expect(wrapper.find('.link-row input').element).toHaveProperty('value', '@regate.indumentaria')
    expect(wrapper.find('nav').text()).toContain('Marca')
  })

  it('previews with the Api’s colors for the chosen mode, on the preview box only', async () => {
    const preview = wrapper.find<HTMLElement>('.preview')

    expect(requestsTo('/api/admin/theme/preview')).toHaveLength(1)
    expect(preview.element.style.getPropertyValue('--color-accent')).toBe('#a296f1')
    expect(preview.text()).toContain('REGATE')

    await wrapper.find('input[name="mode"][value="Light"]').setValue()

    expect(preview.element.style.getPropertyValue('--color-accent')).toBe('#7363c0')
    expect(preview.element.style.getPropertyValue('--color-bg')).toBe('#f6f7fa')
    // Not applied to the page itself.
    expect(document.documentElement.style.getPropertyValue('--color-bg')).not.toBe('#f6f7fa')
    // Switching mode needs no new request: the Api already answered both.
    expect(requestsTo('/api/admin/theme/preview')).toHaveLength(1)
  })

  it('asks the Api for the colors again, once, after the hue stops changing', async () => {
    const number = wrapper.find<HTMLInputElement>('.hue-number')
    await number.setValue('100') // the hand-picked accent is on, which locks the hue
    expect(number.element.disabled).toBe(true)
    await wrapper.find('.admin-check input').setValue(false)

    await number.setValue('120')
    await number.setValue('150')
    await afterDebounce()

    const previews = api.admin.theme.state.previews
    expect(previews).toHaveLength(2)
    expect(last(previews)).toEqual({ accentHue: 150, useHandPickedAccent: false })
  })

  it('shows the contrast in both modes and warns when the accent falls short in the current one', async () => {
    const table = wrapper.find('.contrast-table')
    expect(table.findAll('th').map((th) => th.text())).toEqual(['', 'Oscuro', 'Claro'])
    expect(table.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.find('.contrast .form-error').exists()).toBe(false)

    await wrapper.find('.admin-check input').setValue(false)
    await wrapper.find<HTMLInputElement>('.hue-number').setValue('0')
    await afterDebounce()

    const warning = wrapper.find('.contrast .form-error')
    expect(warning.text()).toContain('modo oscuro')
    expect(warning.text()).toContain('acento sobre el fondo')
    expect(table.findAll('td.bad').length).toBeGreaterThan(0)

    // The other mode is fine for this hue, so the warning follows the mode.
    await wrapper.find('input[name="mode"][value="Light"]').setValue()
    expect(wrapper.find('.contrast .form-error').exists()).toBe(false)
  })

  it('saves the branding, then refreshes the storefront’s own theme', async () => {
    const themeRequests = requestsTo('/api/theme').length
    await input('t-name').setValue('Regate Deportes')
    await input('t-wordmark').setValue('  ')
    await input('t-lw').setValue('48px') // inside the collapsed “Ajustes del logo”
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const saved = last(api.admin.theme.state.saves)
    expect(saved).toMatchObject({
      mode: 'Dark',
      accentHue: 289,
      useHandPickedAccent: true,
      storeName: 'Regate Deportes',
      wordmark: null,
      monogram: 'RG',
      logoWidth: '48px',
      logoHeight: '44px',
      logoFilter: null,
    })
    expect(saved.socialLinks).toEqual([
      { label: '@regate.indumentaria', url: 'https://www.instagram.com/regate.indumentaria/' },
    ])
    expect(wrapper.find('.save-bar').text()).toContain('Guardado')
    expect(requestsTo('/api/theme').length).toBeGreaterThan(themeRequests)
  })

  it('shows the Api’s message on the field it belongs to, and keeps what was typed', async () => {
    await input('t-name').setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const field = input('t-name').element.closest('.field')!
    expect(field.textContent).toContain('El nombre de la tienda tiene entre 1 y 80 caracteres.')
    expect(wrapper.find('.save-bar .form-error').exists()).toBe(true)
    expect(input('t-wordmark').element.value).toBe('REGATE')
    expect(api.admin.theme.state.saves).toHaveLength(0)
  })

  describe('the address replies to emails go to', () => {
    const warning = () => wrapper.find('[data-testid="reply-warning"]')

    it('warns that replies reach nobody while the store has no address', () => {
      expect(input('t-email-reply').element.value).toBe('')
      expect(warning().exists()).toBe(true)
      expect(warning().text()).toContain('no le llegan a nadie')
    })

    it('saves the address trimmed, and stops warning', async () => {
      await input('t-email-reply').setValue('  contacto@regate.com  ')
      expect(warning().exists()).toBe(false)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(last(api.admin.theme.state.saves).emailReplyTo).toBe('contacto@regate.com')
      expect(wrapper.find('.save-bar').text()).toContain('Guardado')
    })

    it('shows the saved address when the editor opens', async () => {
      api.admin.theme.state.theme.emailReplyTo = 'hola@regate.com'

      const reopened = await mountAt('/admin/marca')

      expect(reopened.find<HTMLInputElement>('#t-email-reply').element.value).toBe(
        'hola@regate.com',
      )
      expect(reopened.find('[data-testid="reply-warning"]').exists()).toBe(false)
    })

    it('clears it when emptied', async () => {
      api.admin.theme.state.theme.emailReplyTo = 'hola@regate.com'
      const reopened = await mountAt('/admin/marca')

      await reopened.find<HTMLInputElement>('#t-email-reply').setValue('   ')
      await reopened.find('form').trigger('submit')
      await flushPromises()

      expect(last(api.admin.theme.state.saves).emailReplyTo).toBeNull()
    })

    it('shows the Api\x27s message under the field when the address is not valid, and keeps what was typed', async () => {
      await input('t-email-reply').setValue('no-es-un-mail')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      const field = input('t-email-reply').element.closest('.field')!
      expect(field.textContent).toContain('Una dirección de correo como contacto@tutienda.com.')
      expect(input('t-email-reply').element.value).toBe('no-es-un-mail')
      expect(api.admin.theme.state.saves).toHaveLength(0)
    })
  })

  describe('the contact phone', () => {
    const MESSAGE = 'Un teléfono con código de área, como +54 11 5555-1234.'
    const field = () => input('t-phone').element.closest('.field')!
    const submit = async (w: VueWrapper = wrapper) => {
      await w.find('form').trigger('submit')
      await flushPromises()
    }

    it('is labelled and starts empty for a store without a phone', () => {
      expect(wrapper.find('label[for="t-phone"]').text()).toBe('Teléfono de contacto')
      expect(input('t-phone').element.value).toBe('')
    })

    it('shows the stored phone when the editor opens', async () => {
      api.admin.theme.state.theme.phone = '+54 11 5555-1234'

      const reopened = await mountAt('/admin/marca')

      expect(reopened.find<HTMLInputElement>('#t-phone').element.value).toBe('+54 11 5555-1234')
    })

    it('saves the phone and updates the preview theme', async () => {
      await input('t-phone').setValue('+54 11 5555-1234')
      await submit()

      expect(last(api.admin.theme.state.saves).phone).toBe('+54 11 5555-1234')
      expect(api.admin.theme.state.theme.phone).toBe('+54 11 5555-1234')
      expect(api.admin.theme.state.theme.preview.phone).toBe('+54 11 5555-1234')
      expect(wrapper.find('.save-bar').text()).toContain('Guardado')
    })

    it('shows the phone trimmed after saving, as the Api returns it', async () => {
      await input('t-phone').setValue('  +54 11 5555-1234  ')
      await submit()

      expect(input('t-phone').element.value).toBe('+54 11 5555-1234')
      expect(api.admin.theme.state.theme.phone).toBe('+54 11 5555-1234')
    })

    it.each([
      ['', 'empty'],
      ['   ', 'whitespace'],
    ])('clears a stored phone when saved %j (%s)', async (value) => {
      api.admin.theme.state.theme.phone = '+54 11 5555-1234'
      const reopened = await mountAt('/admin/marca')

      await reopened.find<HTMLInputElement>('#t-phone').setValue(value)
      await submit(reopened)

      expect(last(api.admin.theme.state.saves).phone).toBeNull()
      expect(api.admin.theme.state.theme.phone).toBeNull()
      expect(api.admin.theme.state.theme.preview.phone).toBeNull()
    })

    it.each([
      ['letters', 'abc'],
      ['too few digits', '12345'],
      ['a plus in the middle', '+54+11 5555'],
      ['more than 30 characters', '+54 11 5555-1234 5555-1234 5555'],
      ['more than 15 digits', '1234567890123456'],
    ])(
      'shows the Api’s message under the field for %s, and stores nothing',
      async (_name, value) => {
        await input('t-phone').setValue(value)
        await submit()

        expect(field().querySelector('.form-error')!.textContent).toBe(MESSAGE)
        expect(input('t-phone').element.value).toBe(value)
        expect(api.admin.theme.state.saves).toHaveLength(0)
        expect(api.admin.theme.state.theme.phone).toBeNull()
      },
    )

    it('shows the hint while there is no error, and the error instead of it after', async () => {
      expect(field().querySelector('.form-error')).toBeNull()
      expect(field().querySelector('.admin-muted')!.textContent).toContain('Con código de área.')

      await input('t-phone').setValue('abc')
      await submit()

      expect(field().querySelector('.form-error')).not.toBeNull()
      expect(field().querySelector('.admin-muted')).toBeNull()
    })
  })

  it('drops the hand-picked accent when asked to, with a warning that it cannot come back', async () => {
    const check = wrapper.find<HTMLInputElement>('.admin-check input')
    expect(check.element.checked).toBe(true)
    expect(wrapper.text()).not.toContain('se descarta')

    await check.setValue(false)
    expect(wrapper.text()).toContain('se descarta')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(last(api.admin.theme.state.saves).useHandPickedAccent).toBe(false)
    expect(wrapper.find('.admin-check').exists()).toBe(false)
  })

  it('uploads a logo and a favicon, and shows them', async () => {
    async function pick(label: string, file: File) {
      const field = wrapper.find<HTMLInputElement>(`input[aria-label="${label}"]`)
      Object.defineProperty(field.element, 'files', { value: [file], configurable: true })
      await field.trigger('change')
      await flushPromises()
    }

    await pick('Archivo del logo', new File(['x'], 'nuevo-logo.png', { type: 'image/png' }))
    await pick('Archivo del ícono', new File(['x'], 'icono.ico'))

    expect(api.admin.theme.state.uploads).toEqual(['logo:nuevo-logo.png', 'favicon:icono.ico'])
    expect(wrapper.find('.logo-thumb').attributes('style')).toContain('nuevo-logo.png')
    expect(wrapper.find('.fav-thumb').attributes('style')).toContain('icono.ico')
    expect(wrapper.find('.preview .p-logo').attributes('style')).toContain('nuevo-logo.png')
  })

  it('refuses a file that is not an image with the Api’s message', async () => {
    const field = wrapper.find<HTMLInputElement>('input[aria-label="Archivo del logo"]')
    Object.defineProperty(field.element, 'files', {
      value: [new File(['<svg/>'], 'logo.svg')],
      configurable: true,
    })
    await field.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('Subí una imagen JPG, PNG o WebP.')
    expect(wrapper.find('.logo-thumb').attributes('style')).toContain('regate-logo.png')
  })

  it('removes the logo along with its display settings', async () => {
    const remove = wrapper.findAll('button').find((b) => b.text() === 'Quitar')!
    await remove.trigger('click')
    await flushPromises()

    expect(wrapper.find('.logo-thumb').exists()).toBe(false)
    expect(wrapper.find('.preview .p-logo').exists()).toBe(false)
    expect(wrapper.find('.preview .p-wordmark').text()).toBe('REGATE')
    expect(input('t-lw').element.value).toBe('')
    expect(input('t-lm').element.value).toBe('')
  })

  it('adds and removes footer links, up to four', async () => {
    const add = () => wrapper.findAll('button').find((b) => b.text() === 'Agregar link')

    for (let i = 0; i < 3; i++) await add()!.trigger('click')
    expect(wrapper.findAll('.link-row')).toHaveLength(4)
    expect(add()).toBeUndefined()

    await wrapper.findAll('.link-row')[3]!.find('button').trigger('click')
    expect(wrapper.findAll('.link-row')).toHaveLength(3)
    expect(add()).toBeDefined()

    // Blank rows are not sent.
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(last(api.admin.theme.state.saves).socialLinks).toHaveLength(1)
  })
})

describe('the fake Api’s phone rule', () => {
  beforeEach(() => {
    api = stubApi()
    signInAs('admin@mail.com', ['TenantAdmin'])
  })

  afterEach(() => vi.unstubAllGlobals())

  async function put(phone: unknown) {
    const session = await (await fetch('/api/auth/refresh', { method: 'POST' })).json()
    const response = await fetch('/api/admin/theme', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ storeName: 'Regate', useHandPickedAccent: true, phone }),
    })
    return { status: response.status, body: await response.json() }
  }

  it.each(['+54 11 5555-1234', '(011) 5555-1234', '1155551234', '+541155551234', '12 3456'])(
    'accepts %j',
    async (phone) => {
      expect((await put(phone)).status).toBe(200)
    },
  )

  it.each(['abc', '12345', '+54+11 5555', '+54 11 5555-1234 5555-1234 5555', '1234567890123456'])(
    'refuses %j with the Api’s message',
    async (phone) => {
      const { status, body } = await put(phone)

      expect(status).toBe(400)
      expect(body.errors.phone).toEqual(['Un teléfono con código de área, como +54 11 5555-1234.'])
    },
  )

  it.each([[''], ['   '], [null], [undefined]])('turns %j into no phone', async (phone) => {
    api.admin.theme.state.theme.phone = '+54 11 5555-1234'

    const { status, body } = await put(phone)

    expect(status).toBe(200)
    expect(body.phone).toBeNull()
  })

  it('returns the phone trimmed', async () => {
    expect((await put('  +54 11 5555-1234 ')).body.phone).toBe('+54 11 5555-1234')
  })
})

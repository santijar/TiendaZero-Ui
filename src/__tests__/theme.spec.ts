import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'

import App from '../App.vue'
import PlatformApp from '../platform/PlatformApp.vue'
import { createPlatformRouter } from '../platform/router'
import { createAppRouter } from '../router'
import { INDIANS_THEME, PLATFORM_ADMIN, REGATE_THEME, stubApi, type FakeApi } from './fakeApi'

let api: FakeApi

const root = () => document.documentElement

async function mountStore() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createAppRouter(createMemoryHistory())
  await router.push('/')
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function resetDocument() {
  document.body.innerHTML = ''
  document.head.innerHTML = '<link rel="icon" href="/favicon.ico">'
  document.title = 'Tienda'
  root().removeAttribute('style')
  root().removeAttribute('data-theme-mode')
}

describe("a store's theme", () => {
  beforeEach(() => {
    api = stubApi()
    localStorage.clear()
    resetDocument()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetDocument()
  })

  it("applies the Api's CSS variables, tab title and mode to the document", async () => {
    await mountStore()

    expect(root().style.getPropertyValue('--color-bg')).toBe('#161826')
    expect(root().style.getPropertyValue('--color-accent')).toBe('#9184d9')
    expect(root().dataset.themeMode).toBe('dark')
    expect(root().style.colorScheme).toBe('dark')
    expect(document.title).toBe('Regate')
  })

  it("draws a dark store's header with its wordmark and a lightened logo, and the footer from the theme", async () => {
    const wrapper = await mountStore()

    expect(wrapper.find('.wordmark').text()).toBe('REGATE')
    expect(wrapper.find('.monogram').exists()).toBe(false)
    const logo = wrapper.find('.logo')
    expect(logo.attributes('aria-label')).toBe('Regate')
    expect((logo.element as HTMLElement).style.mixBlendMode).toBe('lighten')
    expect((logo.element as HTMLElement).style.margin).toBe('-4px -6px')
    expect((logo.element as HTMLElement).style.backgroundImage).toContain('regate-logo.png')

    const footer = wrapper.find('footer')
    expect(footer.text()).toContain(`© ${new Date().getFullYear()} Regate Indumentaria`)
    expect(footer.find('a').text()).toBe('@regate.indumentaria')
    expect(footer.find('a').attributes('href')).toBe(
      'https://www.instagram.com/regate.indumentaria/',
    )
  })

  it('draws a light store as it is: no forced blend, its own logo size, the favicon from the theme', async () => {
    api.theme.current = INDIANS_THEME

    const wrapper = await mountStore()

    expect(root().dataset.themeMode).toBe('light')
    expect(root().style.getPropertyValue('--color-bg')).toBe('#f6f7fa')
    expect(document.title).toBe('Indians')
    expect(document.querySelector<HTMLLinkElement>('link[rel~="icon"]')!.getAttribute('href')).toBe(
      '/media/brand/indians-favicon.png',
    )
    const logo = wrapper.find('.logo').element as HTMLElement
    expect(logo.style.mixBlendMode).toBe('normal')
    expect(logo.style.width).toBe('116px')
    expect(wrapper.find('.wordmark').exists()).toBe(false)
  })

  it('falls back to the monogram badge when a store has neither logo nor wordmark', async () => {
    api.theme.current = { ...INDIANS_THEME, logo: null, wordmark: null }

    const wrapper = await mountStore()

    expect(wrapper.find('.logo').exists()).toBe(false)
    expect(wrapper.find('.monogram').text()).toBe('IN')
  })

  it("lets an explicit blend mode win over the mode's default", async () => {
    api.theme.current = { ...REGATE_THEME, logo: { ...REGATE_THEME.logo!, blendMode: 'multiply' } }

    const wrapper = await mountStore()

    expect((wrapper.find('.logo').element as HTMLElement).style.mixBlendMode).toBe('multiply')
  })

  it("still opens the store, in Nocturne's defaults, when the theme cannot be loaded", async () => {
    const original = api.fetchMock.getMockImplementation()!
    api.fetchMock.mockImplementation(async (input, init) =>
      String(input) === '/api/theme' ? new Response('{}', { status: 500 }) : original(input, init),
    )

    const wrapper = await mountStore()

    expect(wrapper.text()).toContain('Todos los productos')
    expect(root().style.getPropertyValue('--color-bg')).toBe('')
    expect(wrapper.find('footer a').exists()).toBe(false)
  })

  it('asks for the theme once, however many parts of the app want it', async () => {
    await mountStore()

    expect(api.fetchMock.mock.calls.filter(([i]) => String(i) === '/api/theme')).toHaveLength(1)
  })
})

describe("the platform preview's theme", () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    vi.stubEnv('VITE_PLATFORM_HOST', 'localhost')
    api = stubApi()
    sessionStorage.clear()
    localStorage.clear()
    resetDocument()

    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createPlatformRouter(createMemoryHistory())
    await router.push('/')
    wrapper = mount(PlatformApp, { global: { plugins: [pinia, router] }, attachTo: document.body })
    await flushPromises()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    resetDocument()
  })

  async function signIn() {
    await wrapper.find('#platform-email').setValue(PLATFORM_ADMIN.email)
    await wrapper.find('#platform-password').setValue(PLATFORM_ADMIN.password)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
  }

  it("shows no store's branding before sign-in, then the previewed store's, then the next one's", async () => {
    expect(root().style.getPropertyValue('--color-bg')).toBe('')
    expect(document.title).toBe('Tienda')

    await signIn()
    expect(root().dataset.themeMode).toBe('dark')
    expect(wrapper.find('.wordmark').text()).toBe('REGATE')

    await wrapper.findAll('.tenant-pill')[1]!.trigger('click') // Indians
    await flushPromises()
    expect(root().dataset.themeMode).toBe('light')
    expect(root().style.getPropertyValue('--color-bg')).toBe('#f6f7fa')
    expect(document.title).toBe('Indians')
    expect(wrapper.find('footer').text()).toContain('Indians Indumentaria')
    // Regate's variables don't linger once Indians replaces them.
    expect(root().style.getPropertyValue('--color-accent')).toBe('#2a73b8')
  })

  it('goes back to the defaults when the admin signs out', async () => {
    await signIn()
    await wrapper.find('.out').trigger('click')
    await flushPromises()

    expect(root().style.getPropertyValue('--color-bg')).toBe('')
    expect(root().dataset.themeMode).toBeUndefined()
    expect(document.title).toBe('Tienda')
  })
})

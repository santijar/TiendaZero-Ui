import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'

import App from '../App.vue'
import { createAppRouter } from '../router'
import { useCatalogStore } from '../stores/catalog'
import { stubApi, type FakeApi } from './fakeApi'

let api: FakeApi
const mounted: VueWrapper[] = []

beforeAll(async () => {
  // Preload the lazily-routed views (flushPromises doesn't wait for a first dynamic import).
  await import('../components/admin/AdminLayout.vue')
  await import('../views/admin/AdminPromosView.vue')
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

const promos = () => api.admin.promos.state

beforeEach(() => {
  api = stubApi()
  localStorage.clear()
  document.body.innerHTML = ''
})

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  vi.unstubAllGlobals()
})

describe("the store's home carousel", () => {
  it('shows the slides the store set up, with the first one open', async () => {
    const home = await mountAt('/')

    const carousel = home.find('.promo')
    expect(carousel.exists()).toBe(true)
    expect(carousel.text()).toContain('Hecho para la cancha')
    expect(carousel.text()).toContain('Fútbol')
    expect(carousel.findAll('img')).toHaveLength(2)
    expect(carousel.findAll('.dots button')).toHaveLength(2)
  })

  it('moves to the next slide', async () => {
    const home = await mountAt('/')

    await home.find('button[aria-label="Siguiente"]').trigger('click')

    expect(home.find('.promo').text()).toContain('Salí a la cancha con Regate')
  })

  it("opens the slide's category when its button is pressed", async () => {
    const home = await mountAt('/')

    await home.find('.ctas .btn-primary').trigger('click')

    expect(useCatalogStore().category).toBe('camisetas')
  })

  it('opens the whole store from a slide that points at no category', async () => {
    const home = await mountAt('/')
    await home.find('button[aria-label="Siguiente"]').trigger('click')
    useCatalogStore().setFilter({ category: 'accesorios' })

    await home.find('.ctas .btn-primary').trigger('click')

    expect(useCatalogStore().category).toBeNull()
  })

  it('has no carousel when the store has no slides, and the catalog is still there', async () => {
    promos().slides = []

    const home = await mountAt('/')

    expect(home.find('.promo').exists()).toBe(false)
    expect(home.find('.catalog').exists()).toBe(true)
  })

  it('does not show a slide that has no photo yet', async () => {
    promos().slides[0]!.imageUrl = null

    const home = await mountAt('/')

    expect(home.find('.promo').text()).toContain('Salí a la cancha con Regate')
    expect(home.find('.promo').text()).not.toContain('Hecho para la cancha')
    // A single slide has nothing to page through.
    expect(home.find('.controls').exists()).toBe(false)
  })

  it('has no carousel, and does not break the page, if the slides cannot be read', async () => {
    const real = globalThis.fetch
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/api/promos')
        ? Promise.reject(new TypeError('network'))
        : real(input, init),
    )

    const home = await mountAt('/')

    expect(home.find('.promo').exists()).toBe(false)
    expect(home.find('.catalog').exists()).toBe(true)
  })
})

describe('the promotions screen', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    signInAs('admin@mail.com', ['TenantAdmin'])
    wrapper = await mountAt('/admin/promociones')
  })

  const form = () => wrapper.find('form[aria-label="Promoción"]')
  const input = (id: string) => wrapper.find<HTMLInputElement>(`#${id}`)
  const button = (label: string) => wrapper.findAll('button').find((b) => b.text() === label)

  async function fillNew(title: string, cta: string, kicker = '') {
    await button('Agregar promoción')!.trigger('click')
    await input('pr-kicker').setValue(kicker)
    await input('pr-title').setValue(title)
    await input('pr-cta').setValue(cta)
    await form().trigger('submit')
    await flushPromises()
  }

  async function choosePhoto(label: string, file: File) {
    const field = wrapper.find<HTMLInputElement>(`input[aria-label="${label}"]`)
    Object.defineProperty(field.element, 'files', { value: [file], configurable: true })
    await field.trigger('change')
    await flushPromises()
  }

  it('is in the admin sidebar, for store admins only', async () => {
    expect(wrapper.find('nav').text()).toContain('Promociones')
    api.auth.users.get('admin@mail.com')!.roles = ['Customer']
    const other = await mountAt('/admin/promociones')
    expect(other.find('h1').text()).not.toBe('Promociones')
  })

  it("lists the store's slides with what each button opens", () => {
    const list = wrapper.find('ul[aria-label="Promociones"]')

    expect(list.findAll('li')).toHaveLength(2)
    expect(list.text()).toContain('Hecho para la cancha')
    expect(list.text()).toContain('Categoría: Camisetas')
    expect(list.text()).toContain('Toda la tienda')
  })

  it('creates a slide, which is not shown to shoppers until it has a photo', async () => {
    await fillNew('Nueva temporada', 'Ver todo', 'Temporada 27')

    expect(promos().slides).toHaveLength(3)
    const added = wrapper.findAll('li').slice(-1)[0]!
    expect(added.text()).toContain('Nueva temporada')
    expect(added.text()).toContain('Sin foto')
    expect(added.text()).toContain('No se muestra hasta que tenga foto')
    expect(wrapper.text()).toContain('Subile una foto')
    const shopper = await mountAt('/')
    expect(shopper.find('.promo').text()).not.toContain('Nueva temporada')
  })

  it("points a slide's button at a category of the store", async () => {
    await button('Agregar promoción')!.trigger('click')
    await input('pr-title').setValue('Camisetas')
    await input('pr-cta').setValue('Ver camisetas')
    await wrapper.find<HTMLSelectElement>('#pr-target').setValue('category:camisetas')
    await form().trigger('submit')
    await flushPromises()

    expect(promos().slides.slice(-1)[0]).toMatchObject({ category: 'camisetas', collection: null })
  })

  it("shows the Api's message next to a missing title, and creates nothing", async () => {
    await fillNew('', '')

    expect(promos().slides).toHaveLength(2)
    expect(wrapper.text()).toContain('Ingresá el título')
    expect(wrapper.text()).toContain('Ingresá el texto del botón')
    expect(wrapper.text()).toContain('Revisá los campos marcados.')
    expect(form().exists()).toBe(true)
  })

  it('edits a slide', async () => {
    await button('Editar')!.trigger('click')
    expect(input('pr-title').element.value).toBe('Hecho para la cancha')

    await input('pr-title').setValue('Otro título')
    await form().trigger('submit')
    await flushPromises()

    expect(promos().slides[0]!.title).toBe('Otro título')
    expect(wrapper.find('ul').text()).toContain('Otro título')
    expect(form().exists()).toBe(false)
  })

  it('uploads a photo for a slide', async () => {
    await fillNew('Nueva temporada', 'Ver todo')

    await choosePhoto(
      'Foto de Nueva temporada',
      new File(['x'], 'foto.jpg', { type: 'image/jpeg' }),
    )

    expect(promos().uploads).toEqual([{ id: 'promo-3', name: 'foto.jpg' }])
    expect(wrapper.findAll('li').slice(-1)[0]!.find('img').attributes('src')).toBe(
      '/media/uploads/test/foto.jpg',
    )
    expect(wrapper.findAll('li').slice(-1)[0]!.text()).not.toContain('No se muestra hasta')
  })

  it("shows the Api's message when the file is not a photo", async () => {
    await choosePhoto(
      'Foto de Hecho para la cancha',
      new File(['x'], 'nota.txt', { type: 'text/plain' }),
    )

    expect(wrapper.text()).toContain('Subí una foto JPG, PNG o WebP.')
    expect(promos().uploads).toHaveLength(0)
  })

  it('moves a slide down and up', async () => {
    await wrapper.findAll('button[aria-label="Bajar"]')[0]!.trigger('click')
    await flushPromises()

    expect(promos().reorders).toEqual([['promo-2', 'promo-1']])
    expect(wrapper.findAll('li')[0]!.text()).toContain('Salí a la cancha con Regate')

    await wrapper.findAll('button[aria-label="Subir"]')[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('li')[0]!.text()).toContain('Hecho para la cancha')
  })

  it('cannot move the first slide up or the last one down', () => {
    const items = wrapper.findAll('li')

    expect(items[0]!.find('button[aria-label="Subir"]').attributes('disabled')).toBeDefined()
    expect(
      items.slice(-1)[0]!.find('button[aria-label="Bajar"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('deletes a slide after asking, and keeps it if the admin changes their mind', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)

    await button('Borrar')!.trigger('click')
    await flushPromises()
    expect(promos().deleted).toEqual([])
    expect(wrapper.findAll('li')).toHaveLength(2)

    await button('Borrar')!.trigger('click')
    await flushPromises()
    expect(promos().deleted).toEqual(['promo-1'])
    expect(wrapper.findAll('li')).toHaveLength(1)
    confirm.mockRestore()
  })

  it('stops offering new slides at the limit of eight', async () => {
    promos().slides = Array.from({ length: 8 }, (_, i) => ({
      id: `promo-${i + 1}`,
      imageUrl: null,
      alt: `S${i}`,
      kicker: '',
      title: `S${i}`,
      cta: 'Ver',
      category: null,
      collection: null,
    }))

    const full = await mountAt('/admin/promociones')

    const add = full.findAll('button').find((b) => b.text() === 'Agregar promoción')!
    expect(add.attributes('disabled')).toBeDefined()
  })

  it('says so when the store has no slides yet', async () => {
    promos().slides = []

    const empty = await mountAt('/admin/promociones')

    expect(empty.text()).toContain('Todavía no cargaste promociones')
    expect(empty.find('ul').exists()).toBe(false)
  })
})

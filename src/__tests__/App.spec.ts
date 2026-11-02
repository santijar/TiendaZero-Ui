import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'

import App from '../App.vue'
import router from '../router'
import { PRODUCTS, stubCatalogApi } from './fakeApi'

async function mountAt(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  await router.push(path)
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('App', () => {
  beforeEach(async () => {
    stubCatalogApi()
    document.body.innerHTML = ''
    await router.replace('/')
  })

  afterEach(() => vi.unstubAllGlobals())

  it('renders the storefront with the categories and products from the API', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.text()).toContain('REGATE')
    expect(wrapper.text()).toContain('Todos los productos')
    expect(wrapper.text()).toContain('2 productos')
    expect(wrapper.findAll('.grid > *')).toHaveLength(PRODUCTS.length)
    expect(wrapper.findAll('.pill').map((b) => b.text())).toEqual([
      'Todo',
      'Camisetas',
      'Accesorios',
    ])
  })

  it('filters the grid when a category pill is picked', async () => {
    const wrapper = await mountAt('/')

    await wrapper
      .findAll('.pill')
      .find((b) => b.text() === 'Accesorios')!
      .trigger('click')
    await flushPromises()

    expect(wrapper.find('h2').text()).toBe('Accesorios')
    expect(wrapper.findAll('.grid > *')).toHaveLength(1)
    expect(wrapper.find('.grid').text()).toContain('Bolso Deportivo')
  })

  it('requires an in-stock size before adding to the cart from the product page', async () => {
    const wrapper = await mountAt('/producto/cam-titular')
    const add = wrapper.findAll('button').find((b) => b.text() === 'Agregar al carrito')!
    const sizes = wrapper.findAll('[role="radio"]')

    expect(sizes[0]!.attributes('disabled')).toBeDefined()

    await add.trigger('click')
    expect(wrapper.text()).toContain('Elegí un talle para continuar.')

    await sizes[1]!.trigger('click')
    await add.trigger('click')
    expect(wrapper.find('.cart').text()).toBe('1')
    expect(wrapper.text()).toContain('Camiseta Titular 26 · Talle M agregado')
  })

  it('redirects to home when opening checkout with an empty cart', async () => {
    await mountAt('/checkout')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('shows not found when the API has no such product', async () => {
    const wrapper = await mountAt('/producto/no-existe')

    expect(wrapper.text()).toContain('No encontramos esta página')
  })

  it('offers a retry when the catalog fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response(null, { status: 500 })),
    )
    const wrapper = await mountAt('/')

    expect(wrapper.text()).toContain('No pudimos cargar los productos.')

    stubCatalogApi()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Reintentar')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.grid > *')).toHaveLength(PRODUCTS.length)
  })
})

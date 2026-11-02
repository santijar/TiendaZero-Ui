import { beforeEach, describe, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'

import App from '../App.vue'
import router from '../router'
import { PRODUCTS } from '../catalog/products'

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
    document.body.innerHTML = ''
    await router.replace('/')
  })

  it('renders the storefront shell and every product on the home route', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.text()).toContain('REGATE')
    expect(wrapper.text()).toContain('Todos los productos')
    expect(wrapper.findAll('.grid > *')).toHaveLength(PRODUCTS.length)
  })

  it('requires a size before adding to the cart from the product page', async () => {
    const wrapper = await mountAt('/producto/cam-titular')
    const add = wrapper.findAll('button').find((b) => b.text() === 'Agregar al carrito')!

    await add.trigger('click')
    expect(wrapper.text()).toContain('Elegí un talle para continuar.')

    await wrapper.find('[role="radio"]').trigger('click')
    await add.trigger('click')
    expect(wrapper.find('.cart').text()).toBe('1')
    expect(wrapper.text()).toContain('Camiseta Titular 26 · Talle S agregado')
  })

  it('redirects to home when opening checkout with an empty cart', async () => {
    await mountAt('/checkout')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('shows not found for an unknown product', async () => {
    const wrapper = await mountAt('/producto/no-existe')

    expect(wrapper.text()).toContain('No encontramos esta página')
  })
})

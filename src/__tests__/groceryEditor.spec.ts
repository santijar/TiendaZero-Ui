import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import App from '../App.vue'
import { createAppRouter } from '../router'
import { useCartStore } from '../stores/cart'
import { PRODUCTS, REGATE_THEME, stubApi, type FakeApi } from './fakeApi'

vi.mock('../lib/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/navigation')>()),
  leaveTo: vi.fn<(url: string) => void>(),
}))

// Read from disk (Vitest runs from the repo root): it does not return a stylesheet's source for an import.
const adminCss = readFileSync(resolve(process.cwd(), 'src/assets/admin.css'), 'utf8')

let api: FakeApi
const mounted: VueWrapper[] = []

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

function signInAsAdmin() {
  api.auth.users.set('admin@mail.com', {
    id: 'admin@mail.com',
    name: 'Admin',
    password: 'camiseta26',
    favorites: [],
    roles: ['TenantAdmin'],
  })
  api.auth.state.session = 'admin@mail.com'
}

const grocery = () => {
  api.theme.current = { ...REGATE_THEME, storeKind: 'Grocery' }
  Object.assign(api.checkoutOptions, { cash: true, mercadoPago: false, transfer: false })
}

describe('the product editor and the admin tables', () => {
  beforeAll(async () => {
    await Promise.all([
      import('../components/admin/AdminLayout.vue'),
      import('../views/admin/AdminProductEditView.vue'),
      import('../views/admin/AdminProductsView.vue'),
      import('../views/admin/AdminOrderView.vue'),
      import('../views/CheckoutView.vue'),
    ])
  })

  beforeEach(() => {
    api = stubApi()
    localStorage.clear()
    document.body.innerHTML = ''
    signInAsAdmin()
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
  })

  describe('a new product at a grocery', () => {
    let page: VueWrapper

    beforeEach(async () => {
      grocery()
      page = await mountAt('/admin/productos/nuevo')
    })

    it('talks about presentations, not sizes, and starts with a single "Unidad"', () => {
      expect(page.text()).toContain('Presentaciones y stock')
      expect(page.text()).not.toContain('Talles')
      expect(page.text()).not.toContain('Agregar talle')
      expect(page.text()).toContain('Agregar presentación')
      expect(page.find('table.sizes th').text()).toBe('Presentación')
      const rows = page.findAll<HTMLInputElement>('[aria-label^="Presentación "]')
      expect(rows.map((r) => r.element.value)).toEqual(['Unidad'])
    })

    it('has no color to fill in, and does not ask for one', () => {
      expect(page.find('#p-color').exists()).toBe(false)
      expect(page.text()).not.toContain('Color')
    })

    it('saves with the color the catalog still needs, and the one presentation', async () => {
      await page.find('#p-name').setValue('Azúcar 1 kg')
      await page.find('#p-name').trigger('input')
      await page.find('#p-price').setValue(1800)
      await page.find('#p-brand').setValue('La Independencia')
      await page.find('form').trigger('submit')
      await flushPromises()

      const [created] = api.admin.state.created
      expect(created!.color).toBe('Único')
      expect(created!.brand).toBe('La Independencia')
      expect(created!.variants.map((v) => v.size)).toEqual(['Unidad'])
    })

    it('says a missing presentation is missing, not a missing size', async () => {
      await page.find('[aria-label="Presentación 1"]').setValue('')
      await page.find('#p-name').setValue('Azúcar 1 kg')
      await page.find('form').trigger('submit')
      await flushPromises()

      expect(page.text()).toContain('Falta la presentación.')
      expect(page.text()).not.toContain('Falta el talle.')
      expect(api.admin.state.created).toHaveLength(0)
    })
  })

  describe('an existing product at a grocery', () => {
    it('shows presentations and no color, and keeps the product color when it is saved', async () => {
      grocery()
      const page = await mountAt('/admin/productos/1')

      expect(page.text()).toContain('Presentaciones y stock')
      expect(page.find('#p-color').exists()).toBe(false)

      await page.find('form').trigger('submit')
      await flushPromises()

      expect(api.admin.state.saves.slice(-1)[0]!.color).toBe(api.admin.state.product.color)
    })
  })

  describe('at a store that sells clothes', () => {
    it('is exactly as before: sizes, S to XL for a new product, and a color', async () => {
      const page = await mountAt('/admin/productos/nuevo')

      expect(page.text()).toContain('Talles y stock')
      expect(page.text()).toContain('Agregar talle')
      expect(page.find('#p-color').exists()).toBe(true)
      const rows = page.findAll<HTMLInputElement>('[aria-label^="Talle "]')
      expect(rows.map((r) => r.element.value)).toEqual(['S', 'M', 'L', 'XL'])
    })
  })

  describe('the order lines the owner prepares', () => {
    async function openOrder() {
      await mountAt('/')
      await useCartStore().add(PRODUCTS[1]!, 'Único')
      const checkout = await mountAt('/checkout')
      await checkout.find('#co-name').setValue('Ana')
      await checkout.find('#co-phone').setValue('11 5555-1234')
      await checkout.find('input[name="del"][value="pickup"]').setValue()
      await checkout.find('.confirm').trigger('click')
      await flushPromises()
      return mountAt('/admin/pedidos/RG-20001')
    }

    it('say "Presentación" at a grocery', async () => {
      grocery()
      const order = await openOrder()

      expect(order.findAll('thead th').map((th) => th.text())).toContain('Presentación')
      expect(order.findAll('thead th').map((th) => th.text())).not.toContain('Talle')
    })

    it('say "Talle" at a store that sells clothes', async () => {
      api.checkoutOptions.cash = true
      await mountAt('/')
      await useCartStore().add(PRODUCTS[1]!, 'Único')
      const checkout = await mountAt('/checkout')
      await checkout.find('#co-name').setValue('Ana')
      await checkout.find('#co-email').setValue('ana@mail.com')
      await checkout.find('input[name="del"][value="pickup"]').setValue()
      await checkout.find('input[name="pay"][value="transfer"]').setValue()
      await checkout.find('.confirm').trigger('click')
      await flushPromises()

      const order = await mountAt('/admin/pedidos/RG-20001')

      expect(order.findAll('thead th').map((th) => th.text())).toContain('Talle')
    })
  })

  // jsdom does not apply the cascade, so this guards the rule itself: the header of a numeric column has to be at least as
  // specific as ".table th" (which sets text-align: left), or "Precio" and "Stock" stay left of their right-aligned numbers.
  describe('the alignment of numeric columns', () => {
    it('has a rule that right-aligns the header cell as well as the data cell', () => {
      const rule = adminCss.match(/([^{}]*\.table th\.admin-num[^{}]*)\{([^}]*)\}/)
      expect(rule, 'a rule naming ".table th.admin-num"').toBeTruthy()
      expect(rule![1]).toContain('.table td.admin-num')
      expect(rule![2]).toMatch(/text-align:\s*right/)
    })

    it('uses the numeric class on both the header and the cells of the products list', async () => {
      const list = await mountAt('/admin/productos')

      const headers = list.findAll('thead th').map((th) => [th.text(), th.classes('admin-num')])
      expect(headers).toContainEqual(['Precio', true])
      expect(headers).toContainEqual(['Stock', true])
      const cells = list.findAll('tbody tr:first-child td').map((td) => td.classes('admin-num'))
      expect(cells.filter(Boolean)).toHaveLength(2)
    })
  })
})

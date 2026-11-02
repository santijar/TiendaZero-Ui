import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

import { getProducts } from '../api/catalog'
import { formatPrice, installmentsLabel } from '../lib/commerce'
import { useCartStore } from '../stores/cart'
import { useCatalogStore } from '../stores/catalog'
import { CATEGORIES, PRODUCTS, stubCatalogApi } from './fakeApi'

const titular = PRODUCTS[0]!
const bolso = PRODUCTS[1]!

function requestedUrls(fetchMock: ReturnType<typeof stubCatalogApi>) {
  return fetchMock.mock.calls.map(([input]) => String(input))
}

describe('catalog API client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends only the filters that are set', async () => {
    const fetchMock = stubCatalogApi()

    await getProducts({})
    await getProducts({ category: 'abrigo', q: '  buzo ', sort: 'price-asc' })
    await getProducts({ collection: 'entrenamiento', sort: 'featured' })

    expect(requestedUrls(fetchMock)).toEqual([
      '/api/products',
      '/api/products?category=abrigo&q=buzo&sort=price-asc',
      '/api/products?collection=entrenamiento',
    ])
  })
})

describe('catalog store', () => {
  let fetchMock: ReturnType<typeof stubCatalogApi>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = stubCatalogApi()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reloads products when the filter changes', async () => {
    const catalog = useCatalogStore()
    await catalog.loadTaxonomy()
    await catalog.loadProducts()
    expect(catalog.total).toBe(2)

    catalog.setFilter({ category: 'accesorios' })
    await flushPromises()

    expect(catalog.products.map((p) => p.slug)).toEqual(['bolso'])
    expect(catalog.title).toBe('Accesorios')
    expect(catalog.isCategoryActive('accesorios')).toBe(true)
    expect(catalog.isCategoryActive(null)).toBe(false)
  })

  it('keeps category and collection mutually exclusive', () => {
    const catalog = useCatalogStore()

    catalog.setFilter({ collection: 'entrenamiento' })
    expect([catalog.category, catalog.collection]).toEqual([null, 'entrenamiento'])

    catalog.setFilter({ category: 'camisetas' })
    expect([catalog.category, catalog.collection]).toEqual(['camisetas', null])

    catalog.setFilter({})
    expect(catalog.isUnfiltered).toBe(true)
  })

  it('debounces search requests', async () => {
    vi.useFakeTimers()
    const catalog = useCatalogStore()

    catalog.query = 'c'
    await flushPromises()
    catalog.query = 'cam'
    await flushPromises()
    await vi.runAllTimersAsync()

    expect(requestedUrls(fetchMock)).toEqual(['/api/products?q=cam'])
    expect(catalog.title).toBe('Resultados')
  })

  it('lists "Todo" before the API categories', async () => {
    const catalog = useCatalogStore()
    await catalog.loadTaxonomy()

    expect(catalog.categoryOptions.map((c) => c.label)).toEqual([
      'Todo',
      ...CATEGORIES.map((c) => c.name),
    ])
  })
})

describe('cart store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('merges repeat adds of the same product and size', () => {
    const cart = useCartStore()
    cart.add(titular, 'M')
    cart.add(titular, 'M')
    cart.add(titular, 'L')
    cart.add(bolso, 'Único')

    expect(cart.lines.map((l) => [l.slug, l.size, l.qty])).toEqual([
      ['cam-titular', 'M', 2],
      ['cam-titular', 'L', 1],
      ['bolso', 'Único', 1],
    ])
    expect(cart.count).toBe(4)
    expect(cart.subtotal).toBe(48900 * 3 + 54900)
  })

  it('snapshots only the fields the cart needs', () => {
    const cart = useCartStore()
    cart.add(titular, 'M')

    expect(Object.keys(cart.entries[0]!).sort()).toEqual(
      ['color', 'imageUrl', 'name', 'price', 'qty', 'size', 'slug'].sort(),
    )
  })

  it('drops a line when its quantity reaches zero', () => {
    const cart = useCartStore()
    cart.add(titular, 'M')
    cart.changeQty(0, -1)

    expect(cart.isEmpty).toBe(true)
  })

  it('clears the toast when the drawer opens', () => {
    const cart = useCartStore()
    cart.add(bolso, 'Único')
    expect(cart.toast).toBe('Bolso Deportivo · Talle Único agregado')

    cart.open()
    expect(cart.toast).toBeNull()
    expect(cart.isOpen).toBe(true)
  })
})

describe('commerce formatting', () => {
  it('formats prices in es-AR', () => {
    expect(formatPrice(48900)).toBe('$ 48.900')
    expect(installmentsLabel(48900)).toBe('3 cuotas sin interés de $ 16.300')
  })
})

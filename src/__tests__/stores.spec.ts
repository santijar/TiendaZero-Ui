import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

import { getProducts } from '../api/catalog'
import { formatPrice, installmentsLabel } from '../lib/commerce'
import { useCartStore } from '../stores/cart'
import { useCatalogStore } from '../stores/catalog'
import { CATEGORIES, PRODUCTS, stubApi, type FakeApi } from './fakeApi'

const titular = PRODUCTS[0]!
const bolso = PRODUCTS[1]!

function requestedUrls(fetchMock: FakeApi['fetchMock']) {
  return fetchMock.mock.calls.map(([input]) => String(input))
}

describe('catalog API client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends only the filters that are set', async () => {
    const fetchMock = stubApi().fetchMock

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
  let fetchMock: FakeApi['fetchMock']

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = stubApi().fetchMock
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
  let api: FakeApi

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    api = stubApi()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('creates a server cart on the first add and remembers its token', async () => {
    const cart = useCartStore()
    await cart.add(titular, 'M')
    await cart.add(titular, 'M')
    await cart.add(bolso, 'Único')

    expect(cart.lines.map((l) => [l.slug, l.size, l.qty])).toEqual([
      ['cam-titular', 'M', 2],
      ['bolso', 'Único', 1],
    ])
    expect(cart.count).toBe(3)
    expect(cart.subtotal).toBe(48900 * 2 + 54900)
    expect(localStorage.getItem('tiendazero.cartToken')).toBe('token-1')
    expect(api.carts.size).toBe(1)
  })

  it('restores the stored cart on load', async () => {
    await useCartStore().add(bolso, 'Único')

    setActivePinia(createPinia())
    const reloaded = useCartStore()
    await reloaded.ensureLoaded()

    expect(reloaded.lines.map((l) => l.slug)).toEqual(['bolso'])
  })

  it('starts a fresh cart when the stored token is no longer valid', async () => {
    localStorage.setItem('tiendazero.cartToken', 'expired')
    const cart = useCartStore()
    await cart.ensureLoaded()
    expect(cart.isEmpty).toBe(true)
    expect(localStorage.getItem('tiendazero.cartToken')).toBeNull()

    await cart.add(bolso, 'Único')
    expect(cart.count).toBe(1)
    expect(localStorage.getItem('tiendazero.cartToken')).toBe('token-1')
  })

  it('reports a stock conflict instead of adding', async () => {
    const cart = useCartStore()
    await cart.add(titular, 'L')
    await cart.add(titular, 'L')

    expect(await cart.add(titular, 'L')).toBe(false)
    expect(cart.toast).toEqual({ kind: 'error', message: 'Solo quedan 2 unidades de este talle.' })
    expect(cart.lines[0]!.qty).toBe(2)
  })

  it('removes a line when its quantity drops to zero', async () => {
    const cart = useCartStore()
    await cart.add(titular, 'M')
    await cart.changeQty(cart.lines[0]!, -1)

    expect(cart.isEmpty).toBe(true)
  })

  it('shows a success toast that clears when the drawer opens', async () => {
    const cart = useCartStore()
    await cart.add(bolso, 'Único')
    expect(cart.toast).toEqual({
      kind: 'success',
      message: 'Bolso Deportivo · Talle Único agregado',
    })

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

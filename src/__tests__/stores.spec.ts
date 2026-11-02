import { beforeEach, describe, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { findProduct } from '../catalog/products'
import { formatPrice, installmentsLabel } from '../lib/commerce'
import { useCartStore } from '../stores/cart'
import { useCatalogStore } from '../stores/catalog'

const titular = findProduct('cam-titular')!
const bolso = findProduct('bolso')!

describe('catalog store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('filters by category', () => {
    const catalog = useCatalogStore()
    catalog.category = 'Abrigo'

    expect(catalog.visibleProducts.map((p) => p.id)).toEqual(['buzo-hz', 'campera'])
    expect(catalog.title).toBe('Abrigo')
  })

  it('treats the training category as a tag filter', () => {
    const catalog = useCatalogStore()
    catalog.category = 'Entrenamiento'

    expect(catalog.visibleProducts.map((p) => p.id)).toEqual(['buzo-hz', 'remera-dry'])
  })

  it('searches name and category case-insensitively', () => {
    const catalog = useCatalogStore()
    catalog.query = '  CAMISETA '

    expect(catalog.visibleProducts.map((p) => p.id)).toEqual([
      'cam-titular',
      'cam-alt',
      'remera-dry',
    ])
    expect(catalog.title).toBe('Resultados')
  })

  it('sorts by price', () => {
    const catalog = useCatalogStore()
    catalog.sort = 'asc'
    expect(catalog.visibleProducts[0]!.id).toBe('medias')

    catalog.sort = 'desc'
    expect(catalog.visibleProducts[0]!.id).toBe('campera')
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

    expect(cart.lines.map((l) => [l.id, l.size, l.qty])).toEqual([
      ['cam-titular', 'M', 2],
      ['cam-titular', 'L', 1],
      ['bolso', 'Único', 1],
    ])
    expect(cart.count).toBe(4)
    expect(cart.subtotal).toBe(48900 * 3 + 54900)
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

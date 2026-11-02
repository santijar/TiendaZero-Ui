import { vi } from 'vitest'

import type { Category, ProductDetail, ProductSummary } from '../api/catalog'

export const CATEGORIES: Category[] = [
  { slug: 'camisetas', name: 'Camisetas' },
  { slug: 'accesorios', name: 'Accesorios' },
]

export const PRODUCTS: ProductSummary[] = [
  {
    slug: 'cam-titular',
    name: 'Camiseta Titular 26',
    categorySlug: 'camisetas',
    categoryName: 'Camisetas',
    price: 48900,
    color: 'Negro',
    badge: 'Nuevo',
    imageUrl: '/media/products/cam-titular.webp',
    sizes: ['S', 'M', 'L'],
  },
  {
    slug: 'bolso',
    name: 'Bolso Deportivo',
    categorySlug: 'accesorios',
    categoryName: 'Accesorios',
    price: 54900,
    color: 'Negro',
    badge: null,
    imageUrl: null,
    sizes: ['Único'],
  },
]

export const TITULAR_DETAIL: ProductDetail = {
  slug: 'cam-titular',
  name: 'Camiseta Titular 26',
  categorySlug: 'camisetas',
  categoryName: 'Camisetas',
  price: 48900,
  color: 'Negro',
  badge: 'Nuevo',
  description: 'Tela dry-fit liviana.',
  sizes: [
    { size: 'S', inStock: false },
    { size: 'M', inStock: true },
    { size: 'L', inStock: true },
  ],
  images: [{ url: '/media/products/cam-titular.webp', alt: 'Camiseta Titular 26' }],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Stubs `fetch` with a tiny in-memory version of the catalog API. Returns the mock so tests can
// inspect the requested URLs.
export function stubCatalogApi() {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input), 'http://localhost')
    if (url.pathname === '/api/categories') return json(CATEGORIES)
    if (url.pathname === '/api/collections') return json([])
    if (url.pathname === '/api/products') {
      const category = url.searchParams.get('category')
      const items = PRODUCTS.filter((p) => !category || p.categorySlug === category)
      return json({ items, total: items.length, page: 1, pageSize: 48 })
    }
    if (url.pathname === '/api/products/cam-titular') return json(TITULAR_DETAIL)
    return json({ status: 404 }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

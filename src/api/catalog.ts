// Client for the TiendaZero-Api catalog endpoints (src/TiendaZero.Api/Catalog in that repo).
import { getJson } from './http'

export interface Category {
  slug: string
  name: string
}

export type Collection = Category

export interface ProductSummary {
  slug: string
  name: string
  categorySlug: string
  categoryName: string
  price: number
  color: string
  badge: string | null
  imageUrl: string | null
  sizes: string[]
  // Who makes it ("La Independencia"); null when the store did not say.
  brand: string | null
}

export interface ProductPage {
  items: ProductSummary[]
  total: number
  page: number
  pageSize: number
}

export interface ProductDetail extends Omit<ProductSummary, 'imageUrl' | 'sizes'> {
  description: string
  sizes: { size: string; inStock: boolean }[]
  images: { url: string; alt: string }[]
}

export type ProductSort = 'featured' | 'price-asc' | 'price-desc'

export interface ProductQuery {
  category?: string | null
  collection?: string | null
  q?: string
  sort?: ProductSort
}

export function getCategories(): Promise<Category[]> {
  return getJson('/api/categories')
}

export function getCollections(): Promise<Collection[]> {
  return getJson('/api/collections')
}

export function getProducts(query: ProductQuery, signal?: AbortSignal): Promise<ProductPage> {
  const params = new URLSearchParams()
  if (query.category) params.set('category', query.category)
  if (query.collection) params.set('collection', query.collection)
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.sort && query.sort !== 'featured') params.set('sort', query.sort)
  const search = params.toString()
  return getJson(`/api/products${search ? `?${search}` : ''}`, signal)
}

export function getProduct(slug: string, signal?: AbortSignal): Promise<ProductDetail> {
  return getJson(`/api/products/${encodeURIComponent(slug)}`, signal)
}

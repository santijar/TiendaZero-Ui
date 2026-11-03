// Client for the TiendaZero-Api store admin (/api/admin/*, src/TiendaZero.Api/Admin in that repo).
// Requires a signed-in TenantAdmin. Validation messages come back in Spanish, ready to show.
import { request } from './http'
import type { Order, OrderStatus, PaymentMethod } from './orders'

export type Fulfillment = Order['fulfillment']

export interface AdminCategory {
  id: number
  slug: string
  name: string
  sortOrder: number
  productCount: number
}

export interface AdminCollection {
  id: number
  slug: string
  name: string
  productCount: number
}

export interface AdminProductRow {
  id: number
  slug: string
  name: string
  categoryName: string
  price: number
  isActive: boolean
  totalStock: number
  imageUrl: string | null
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AdminVariant {
  id: number
  size: string
  sku: string
  stock: number
  // Send back unchanged with an edited stock, so a figure that went stale (a sale) is refused.
  version: number
}

export interface AdminImage {
  id: number
  url: string
  alt: string
}

export interface AdminProduct {
  id: number
  slug: string
  name: string
  description: string
  price: number
  color: string
  badge: string | null
  categoryId: number
  collectionIds: number[]
  isActive: boolean
  sortOrder: number
  variants: AdminVariant[]
  images: AdminImage[]
}

// id null for a new size. stock null keeps the current stock.
export interface SaveVariant {
  id: number | null
  size: string
  sku: string
  stock: number | null
  version: number | null
}

export type SaveProduct = Omit<AdminProduct, 'id' | 'variants' | 'images'> & {
  variants: SaveVariant[]
}

export interface AdminOrderRow {
  number: string
  createdAt: string
  customerName: string
  email: string
  paymentMethod: PaymentMethod
  status: OrderStatus
  fulfillment: Fulfillment
  needsReview: boolean
  itemCount: number
  total: number
}

export interface AdminPayment {
  provider: string
  providerPaymentId: string
  status: string
  statusDetail: string | null
  amount: number
  updatedAt: string
}

export interface AdminOrder {
  order: Order
  signedIn: boolean
  needsReview: boolean
  reviewNotes: string | null
  payments: AdminPayment[]
  nextFulfillment: Fulfillment[]
  canMarkPaid: boolean
}

export interface OrderFilters {
  q?: string
  status?: OrderStatus | ''
  fulfillment?: 'open' | ''
  review?: boolean
  page?: number
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

// ---- catalog ----

export const getCategories = () => request<AdminCategory[]>('GET', '/api/admin/categories')
export const createCategory = (body: { slug: string; name: string; sortOrder: number }) =>
  request<AdminCategory>('POST', '/api/admin/categories', { body })
export const updateCategory = (
  id: number,
  body: { slug: string; name: string; sortOrder: number },
) => request<AdminCategory>('PUT', `/api/admin/categories/${id}`, { body })
export const deleteCategory = (id: number) => request<void>('DELETE', `/api/admin/categories/${id}`)

export const getCollections = () => request<AdminCollection[]>('GET', '/api/admin/collections')
export const createCollection = (body: { slug: string; name: string }) =>
  request<AdminCollection>('POST', '/api/admin/collections', { body })
export const updateCollection = (id: number, body: { slug: string; name: string }) =>
  request<AdminCollection>('PUT', `/api/admin/collections/${id}`, { body })
export const deleteCollection = (id: number) =>
  request<void>('DELETE', `/api/admin/collections/${id}`)

export const getProducts = (q = '', page = 1) =>
  request<Page<AdminProductRow>>('GET', `/api/admin/products${query({ q, page })}`)
export const getProduct = (id: number) => request<AdminProduct>('GET', `/api/admin/products/${id}`)
export const createProduct = (body: SaveProduct) =>
  request<AdminProduct>('POST', '/api/admin/products', { body })
export const updateProduct = (id: number, body: SaveProduct) =>
  request<AdminProduct>('PUT', `/api/admin/products/${id}`, { body })
export const deleteProduct = (id: number) => request<void>('DELETE', `/api/admin/products/${id}`)

export function uploadImage(productId: number, file: File): Promise<AdminImage> {
  const form = new FormData()
  form.append('file', file)
  return request('POST', `/api/admin/products/${productId}/images`, { form })
}
export const reorderImages = (productId: number, imageIds: number[]) =>
  request<AdminImage[]>('PUT', `/api/admin/products/${productId}/images/order`, {
    body: { imageIds },
  })
export const deleteImage = (productId: number, imageId: number) =>
  request<void>('DELETE', `/api/admin/products/${productId}/images/${imageId}`)

// ---- orders ----

export const getOrders = (filters: OrderFilters = {}) =>
  request<Page<AdminOrderRow>>('GET', `/api/admin/orders${query({ ...filters })}`)

const orderPath = (number: string) => `/api/admin/orders/${encodeURIComponent(number)}`

export const getAdminOrder = (number: string) => request<AdminOrder>('GET', orderPath(number))
export const markPaid = (number: string) =>
  request<AdminOrder>('POST', `${orderPath(number)}/mark-paid`, { body: {} })
export const updateFulfillment = (number: string, status: Fulfillment, trackingInfo?: string) =>
  request<AdminOrder>('POST', `${orderPath(number)}/fulfillment`, {
    body: { status, trackingInfo: trackingInfo || null },
  })
export const resolveReview = (number: string, note: string) =>
  request<AdminOrder>('POST', `${orderPath(number)}/resolve-review`, { body: { note } })

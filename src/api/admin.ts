// Client for the TiendaZero-Api store admin (/api/admin/*, src/TiendaZero.Api/Admin in that repo).
// Requires a signed-in TenantAdmin. Validation messages come back in Spanish, ready to show.
import { request } from './http'
import type { Order, OrderStatus, PaymentMethod } from './orders'
import type { Theme } from './theme'

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

// ---- branding ----

export interface SocialLinkInput {
  label: string
  url: string
}

// What the branding editor loads (AdminThemeEndpoints in the Api). `preview` is what the storefront will
// serve after saving. Logo and favicon are only ever set by uploading a file.
export interface AdminTheme {
  mode: 'Dark' | 'Light'
  accentHue: number
  hasHandPickedAccent: boolean
  storeName: string
  footerLegalName: string | null
  logoUrl: string | null
  logoWidth: string | null
  logoHeight: string | null
  logoMargin: string | null
  logoFilter: string | null
  logoBlendMode: string | null
  wordmark: string | null
  monogram: string | null
  faviconUrl: string | null
  socialLinks: SocialLinkInput[]
  emailAccentHex: string
  emailLogoUrl: string | null
  preview: Theme
}

export type SaveTheme = Omit<
  AdminTheme,
  'hasHandPickedAccent' | 'logoUrl' | 'faviconUrl' | 'preview' | 'emailAccentHex'
> & {
  useHandPickedAccent: boolean
  // Blank means "use the resolved accent" (the Api answers it back filled in).
  emailAccentHex: string | null
}

// Every CSS variable of the theme, once per mode, for one accent (not saved).
export interface ThemeColors {
  dark: Record<string, string>
  light: Record<string, string>
}

export type ThemeAsset = 'logo' | 'favicon'

export const getAdminTheme = () => request<AdminTheme>('GET', '/api/admin/theme')
export const saveAdminTheme = (body: SaveTheme) =>
  request<AdminTheme>('PUT', '/api/admin/theme', { body })
export const previewThemeColors = (
  accentHue: number,
  useHandPickedAccent: boolean,
  signal?: AbortSignal,
) =>
  request<ThemeColors>('POST', '/api/admin/theme/preview', {
    body: { accentHue, useHandPickedAccent },
    signal,
  })

export function uploadThemeAsset(asset: ThemeAsset, file: File): Promise<AdminTheme> {
  const form = new FormData()
  form.append('file', file)
  return request('POST', `/api/admin/theme/${asset}`, { form })
}

export const removeThemeAsset = (asset: ThemeAsset) =>
  request<AdminTheme>('DELETE', `/api/admin/theme/${asset}`)

// The store's own Mercado Pago connection (AdminPaymentAccountEndpoints in the Api). Credentials go in once and
// never come back: the Api answers the public key, the last four characters of the token and whether a webhook
// secret is set. `webhookUrl` is what the store registers in its Mercado Pago application (absent or null where
// the Api has no public address, like local development).
export interface PaymentAccount {
  provider: string
  status: 'Connected' | 'Disconnected' | 'Error'
  providerAccountId: string | null
  accessTokenHint: string | null
  publicKey: string | null
  hasWebhookSecret: boolean
  connectedAt: string | null
  lastVerifiedAt: string | null
  webhookUrl?: string | null
}

export interface ConnectPaymentAccount {
  accessToken: string
  publicKey: string
  webhookSecret: string
}

export const getPaymentAccount = () => request<PaymentAccount>('GET', '/api/admin/payment-account')
export const connectPaymentAccount = (body: ConnectPaymentAccount) =>
  request<PaymentAccount>('PUT', '/api/admin/payment-account', { body })
export const disconnectPaymentAccount = () =>
  request<PaymentAccount>('DELETE', '/api/admin/payment-account')

// Where the store's transfer orders are paid (AdminTransferAccountEndpoints in the Api). Until `configured`, the
// store does not accept transfers (checkout is refused); once set it can be replaced but not removed.
export interface TransferAccount {
  configured: boolean
  alias: string | null
  cbu: string | null
  holder: string | null
  bank: string | null
}

export interface SaveTransferAccount {
  alias: string
  cbu: string
  holder: string
  bank: string
}

// Where shoppers collect "retiro en local" orders (AdminPickupEndpoints in the Api). Without it the store does not offer
// pickup, and it can be removed (orders already for pickup then say "en el local").
export interface PickupSettings {
  configured: boolean
  name: string | null
  details: string | null
}

export interface SavePickupSettings {
  name: string
  details: string
}

export const getPickupSettings = () => request<PickupSettings>('GET', '/api/admin/pickup')
export const savePickupSettings = (body: SavePickupSettings) =>
  request<PickupSettings>('PUT', '/api/admin/pickup', { body })
export const removePickupSettings = () => request<PickupSettings>('DELETE', '/api/admin/pickup')

export const getTransferAccount = () =>
  request<TransferAccount>('GET', '/api/admin/transfer-account')
export const saveTransferAccount = (body: SaveTransferAccount) =>
  request<TransferAccount>('PUT', '/api/admin/transfer-account', { body })

// The store's domains (AdminDomainEndpoints in the Api): its platform subdomain plus custom hosts it claims. A claim
// is proven by publishing a TXT record, then answered for like the subdomain. `instructions` is only on custom hosts;
// once verified its txtValue is empty (the token is spent) but the CNAME target is still the one to point at.
export interface DomainInstructions {
  txtName: string
  txtValue: string
  cnameTarget: string | null
}

export interface AdminDomain {
  id: string
  domain: string
  type: 'Subdomain' | 'Custom'
  isPrimary: boolean
  verified: boolean
  verifiedAt: string | null
  tlsStatus: 'None' | 'Pending' | 'Active' | 'Failed'
  tlsDetail: string | null
  instructions: DomainInstructions | null
}

export const listDomains = () => request<AdminDomain[]>('GET', '/api/admin/domains')
export const claimDomain = (domain: string) =>
  request<AdminDomain>('POST', '/api/admin/domains', { body: { domain } })
export const checkDomain = (id: string) =>
  request<AdminDomain>('POST', `/api/admin/domains/${id}/check`)
export const makeDomainPrimary = (id: string) =>
  request<AdminDomain>('POST', `/api/admin/domains/${id}/primary`)
export const removeDomain = (id: string) => request<void>('DELETE', `/api/admin/domains/${id}`)

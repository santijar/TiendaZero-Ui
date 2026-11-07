// Client for the TiendaZero-Api orders and checkout endpoints (src/TiendaZero.Api/Orders in that
// repo). An order is readable by its signed-in owner, or by whoever holds its access token (the
// emailed link), sent as X-Order-Token.
import { request } from './http'

export type OrderStatus = 'pending' | 'paid' | 'expired'
export type PaymentMethod = 'mercadopago' | 'transfer'
export type Delivery = 'home' | 'pickup'

export interface ShippingAddress {
  street: string
  postalCode: string
}

export interface OrderLine {
  productSlug: string
  name: string
  size: string
  color: string
  imageUrl: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface TransferDetails {
  alias: string
  cbu: string
  holder: string
  bank: string
}

export interface Order {
  number: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  delivery: Delivery
  email: string
  customerName: string
  shippingAddress: ShippingAddress | null
  lines: OrderLine[]
  subtotal: number
  shippingCost: number
  discount: number
  total: number
  createdAt: string
  expiresAt: string
  paidAt: string | null
  transfer: TransferDetails | null
  // Mercado Pago's status for the latest payment attempt ("approved", "rejected", "in_process", ...).
  lastPaymentStatus: string | null
  // Where a paid order is on its way; set by the store.
  fulfillment: 'unfulfilled' | 'preparing' | 'shipped' | 'ready-for-pickup' | 'delivered'
  trackingInfo: string | null
  // Where to collect a pickup order; null for home delivery, or if the store has since removed it.
  pickup: PickupInfo | null
}

// A store's pickup point: a name and free text for hours and lead time, both written by the store.
export interface PickupInfo {
  name: string
  details: string
}

// What this store's checkout offers (GET /api/checkout-options): pickup, if it has set one up, and whether it takes bank
// transfers. Mercado Pago is always listed.
export interface CheckoutOptions {
  pickup: PickupInfo | null
  transfer: boolean
}

export function getCheckoutOptions(): Promise<CheckoutOptions> {
  return request('GET', '/api/checkout-options')
}

export interface PlacedOrder {
  order: Order
  accessToken: string
}

export interface OrderSummary {
  number: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  itemCount: number
  total: number
  createdAt: string
}

export interface PlaceOrderRequest {
  email: string
  name: string
  delivery: Delivery
  address: ShippingAddress | null
  paymentMethod: PaymentMethod
}

// Places the shopper's current cart as an order. The idempotency key makes a retried request
// (a lost response, a double click) return the order it already placed instead of a second one.
export function placeOrder(
  body: PlaceOrderRequest,
  idempotencyKey: string,
  cartToken: string | null,
): Promise<PlacedOrder> {
  return request('POST', '/api/orders', {
    body,
    headers: {
      'Idempotency-Key': idempotencyKey,
      ...(cartToken ? { 'X-Cart-Token': cartToken } : {}),
    },
  })
}

const access = (token: string | null): Record<string, string> =>
  token ? { 'X-Order-Token': token } : {}

const path = (number: string) => `/api/orders/${encodeURIComponent(number)}`

export function getOrder(number: string, token: string | null): Promise<Order> {
  return request('GET', path(number), { headers: access(token) })
}

// Asks the Api to check the order's payments with Mercado Pago now.
export function syncOrder(number: string, token: string | null): Promise<Order> {
  return request('POST', `${path(number)}/sync`, { headers: access(token) })
}

// The Mercado Pago Checkout Pro page to send the shopper to.
export async function startCheckout(number: string, token: string | null): Promise<string> {
  return (
    await request<{ url: string }>('POST', `${path(number)}/checkout`, { headers: access(token) })
  ).url
}

export function getMyOrders(): Promise<OrderSummary[]> {
  return request('GET', '/api/account/orders')
}

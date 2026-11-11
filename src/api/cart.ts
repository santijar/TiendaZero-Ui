// Client for the TiendaZero-Api cart (src/TiendaZero.Api/Cart in that repo). A guest cart is
// addressed by the bearer token POST /api/cart returns, sent back in the X-Cart-Token header.
import { request } from './http'

export interface CartItem {
  id: number
  productSlug: string
  name: string
  size: string
  color: string
  brand: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
  imageUrl: string | null
  maxQuantity: number
}

export interface Cart {
  items: CartItem[]
  count: number
  subtotal: number
}

// Guests name their cart with its token; signed-in users pass null and get their account's cart.
const auth = (token: string | null): Record<string, string> =>
  token ? { 'X-Cart-Token': token } : {}

export async function createCart(): Promise<string> {
  return (await request<{ token: string }>('POST', '/api/cart')).token
}

export function getCart(token: string | null): Promise<Cart> {
  return request('GET', '/api/cart', { headers: auth(token) })
}

export function addCartItem(
  token: string | null,
  item: { productSlug: string; size: string; quantity?: number },
): Promise<Cart> {
  return request('POST', '/api/cart/items', { headers: auth(token), body: item })
}

export function updateCartItem(
  token: string | null,
  itemId: number,
  quantity: number,
): Promise<Cart> {
  return request('PATCH', `/api/cart/items/${itemId}`, { headers: auth(token), body: { quantity } })
}

export function removeCartItem(token: string | null, itemId: number): Promise<Cart> {
  return request('DELETE', `/api/cart/items/${itemId}`, { headers: auth(token) })
}

export function clearCart(token: string | null): Promise<Cart> {
  return request('DELETE', '/api/cart/items', { headers: auth(token) })
}

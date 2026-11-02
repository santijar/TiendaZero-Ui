// Client for the TiendaZero-Api guest cart (src/TiendaZero.Api/Cart in that repo). A cart is
// addressed by the bearer token POST /api/cart returns, sent back in the X-Cart-Token header.
import { request } from './http'

export interface CartItem {
  id: number
  productSlug: string
  name: string
  size: string
  color: string
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

const auth = (token: string) => ({ 'X-Cart-Token': token })

export async function createCart(): Promise<string> {
  return (await request<{ token: string }>('POST', '/api/cart')).token
}

export function getCart(token: string): Promise<Cart> {
  return request('GET', '/api/cart', { headers: auth(token) })
}

export function addCartItem(
  token: string,
  item: { productSlug: string; size: string; quantity?: number },
): Promise<Cart> {
  return request('POST', '/api/cart/items', { headers: auth(token), body: item })
}

export function updateCartItem(token: string, itemId: number, quantity: number): Promise<Cart> {
  return request('PATCH', `/api/cart/items/${itemId}`, { headers: auth(token), body: { quantity } })
}

export function removeCartItem(token: string, itemId: number): Promise<Cart> {
  return request('DELETE', `/api/cart/items/${itemId}`, { headers: auth(token) })
}

export function clearCart(token: string): Promise<Cart> {
  return request('DELETE', '/api/cart/items', { headers: auth(token) })
}

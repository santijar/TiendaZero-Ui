import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  addCartItem,
  clearCart,
  createCart,
  getCart,
  removeCartItem,
  updateCartItem,
  type Cart,
} from '@/api/cart'
import { ApiError } from '@/api/http'

export interface CartLine {
  id: number
  slug: string
  name: string
  price: number
  color: string
  imageUrl: string | null
  size: string
  qty: number
  total: number
  maxQty: number
}

export interface Toast {
  kind: 'success' | 'error'
  message: string
}

const TOKEN_KEY = 'tiendazero.cartToken'
const TOAST_MS = 3000
const EMPTY_CART: Cart = { items: [], count: 0, subtotal: 0 }

// The guest token is what makes the cart survive reloads. Storage can be unavailable (private
// mode, blocked site data), in which case the cart just lasts for the tab's lifetime.
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // See readToken.
  }
}

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404

function stockMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const stock = Number(error.problem?.stock ?? 0)
  if (stock === 0) return 'No queda stock de este talle.'
  return stock === 1
    ? 'Solo queda 1 unidad de este talle.'
    : `Solo quedan ${stock} unidades de este talle.`
}

export const useCartStore = defineStore('cart', () => {
  let token = readToken()
  const cart = ref<Cart>(EMPTY_CART)
  const isOpen = ref(false)
  // True while a quantity change or removal is in flight, so the drawer can't stack requests.
  const updating = ref(false)
  let loaded: Promise<void> | undefined
  const toast = ref<Toast | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  const lines = computed<CartLine[]>(() =>
    cart.value.items.map((i) => ({
      id: i.id,
      slug: i.productSlug,
      name: i.name,
      price: i.unitPrice,
      color: i.color,
      imageUrl: i.imageUrl,
      size: i.size,
      qty: i.quantity,
      total: i.lineTotal,
      maxQty: i.maxQuantity,
    })),
  )
  const count = computed(() => cart.value.count)
  const subtotal = computed(() => cart.value.subtotal)
  const isEmpty = computed(() => cart.value.items.length === 0)

  function showToast(kind: Toast['kind'], message: string) {
    toast.value = { kind, message }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = null), TOAST_MS)
  }

  function forgetCart() {
    token = null
    writeToken(null)
    cart.value = EMPTY_CART
  }

  // Runs a call against the current cart. If the server no longer knows the token (cart expired or
  // converted), the local cart is dropped; `retryOnNewCart` then repeats the call on a fresh one.
  async function withCart(call: (token: string) => Promise<Cart>, retryOnNewCart = false) {
    if (!token && retryOnNewCart) {
      token = await createCart()
      writeToken(token)
    }
    if (!token) return
    try {
      cart.value = await call(token)
    } catch (error) {
      if (!isNotFound(error)) throw error
      forgetCart()
      if (retryOnNewCart) await withCart(call, true)
    }
  }

  // Loads the stored cart once per page load; later calls reuse the same promise.
  function ensureLoaded(): Promise<void> {
    loaded ??= withCart(getCart).catch(() => {})
    return loaded
  }

  async function add(product: { slug: string; name: string }, size: string): Promise<boolean> {
    try {
      await withCart((t) => addCartItem(t, { productSlug: product.slug, size }), true)
      showToast('success', `${product.name} · Talle ${size} agregado`)
      return true
    } catch (error) {
      showToast('error', stockMessage(error) ?? 'No pudimos agregar el producto. Probá de nuevo.')
      return false
    }
  }

  async function changeQty(line: CartLine, delta: number) {
    const qty = line.qty + delta
    updating.value = true
    try {
      if (qty <= 0) await withCart((t) => removeCartItem(t, line.id))
      else await withCart((t) => updateCartItem(t, line.id, qty))
    } catch (error) {
      showToast('error', stockMessage(error) ?? 'No pudimos actualizar el carrito.')
    } finally {
      updating.value = false
    }
  }

  async function remove(line: CartLine) {
    updating.value = true
    try {
      await withCart((t) => removeCartItem(t, line.id))
    } catch {
      showToast('error', 'No pudimos actualizar el carrito.')
    } finally {
      updating.value = false
    }
  }

  async function clear() {
    await withCart(clearCart)
  }

  function open() {
    isOpen.value = true
    toast.value = null
  }

  function close() {
    isOpen.value = false
  }

  return {
    isOpen,
    updating,
    toast,
    lines,
    count,
    subtotal,
    isEmpty,
    ensureLoaded,
    add,
    changeQty,
    remove,
    clear,
    open,
    close,
  }
})

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

// What the cart keeps about a product: a snapshot taken when it was added. The cart moves to the
// API later in Milestone 1, which will own prices and stock from then on.
export interface CartProduct {
  slug: string
  name: string
  price: number
  color: string
  imageUrl: string | null
}

export interface CartLine extends CartProduct {
  size: string
  qty: number
  total: number
}

const TOAST_MS = 3000

export const useCartStore = defineStore('cart', () => {
  const entries = ref<(CartProduct & { size: string; qty: number })[]>([])
  const isOpen = ref(false)
  const toast = ref<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  const lines = computed<CartLine[]>(() =>
    entries.value.map((e) => ({ ...e, total: e.price * e.qty })),
  )
  const count = computed(() => lines.value.reduce((sum, l) => sum + l.qty, 0))
  const subtotal = computed(() => lines.value.reduce((sum, l) => sum + l.total, 0))
  const isEmpty = computed(() => lines.value.length === 0)

  function add(product: CartProduct, size: string) {
    const existing = entries.value.find((e) => e.slug === product.slug && e.size === size)
    if (existing) existing.qty++
    else {
      const { slug, name, price, color, imageUrl } = product
      entries.value.push({ slug, name, price, color, imageUrl, size, qty: 1 })
    }

    toast.value = `${product.name} · Talle ${size} agregado`
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = null), TOAST_MS)
  }

  function changeQty(index: number, delta: number) {
    const entry = entries.value[index]
    if (!entry) return
    entry.qty += delta
    if (entry.qty <= 0) entries.value.splice(index, 1)
  }

  function remove(index: number) {
    entries.value.splice(index, 1)
  }

  function clear() {
    entries.value = []
  }

  function open() {
    isOpen.value = true
    toast.value = null
  }

  function close() {
    isOpen.value = false
  }

  return {
    entries,
    isOpen,
    toast,
    lines,
    count,
    subtotal,
    isEmpty,
    add,
    changeQty,
    remove,
    clear,
    open,
    close,
  }
})

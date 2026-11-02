import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { findProduct, type Product } from '@/catalog/products'

interface CartEntry {
  productId: string
  size: string
  qty: number
}

export interface CartLine extends Product {
  size: string
  qty: number
  total: number
}

const TOAST_MS = 3000

export const useCartStore = defineStore('cart', () => {
  const entries = ref<CartEntry[]>([])
  const isOpen = ref(false)
  const toast = ref<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  const lines = computed<CartLine[]>(() =>
    entries.value.flatMap((e) => {
      const product = findProduct(e.productId)
      return product ? [{ ...product, size: e.size, qty: e.qty, total: product.price * e.qty }] : []
    }),
  )
  const count = computed(() => lines.value.reduce((sum, l) => sum + l.qty, 0))
  const subtotal = computed(() => lines.value.reduce((sum, l) => sum + l.total, 0))
  const isEmpty = computed(() => lines.value.length === 0)

  function add(product: Product, size: string) {
    const existing = entries.value.find((e) => e.productId === product.id && e.size === size)
    if (existing) existing.qty++
    else entries.value.push({ productId: product.id, size, qty: 1 })

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

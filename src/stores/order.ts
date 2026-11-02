import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface PlacedOrder {
  orderNumber: string
  email: string
}

// Static stand-in for order creation until checkout talks to the API.
export const useOrderStore = defineStore('order', () => {
  const lastOrder = ref<PlacedOrder | null>(null)

  function place(email: string): PlacedOrder {
    const order = { orderNumber: 'RG-' + (20000 + Math.floor(Math.random() * 9000)), email }
    lastOrder.value = order
    return order
  }

  return { lastOrder, place }
})

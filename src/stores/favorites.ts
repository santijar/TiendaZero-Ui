import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useFavoritesStore = defineStore('favorites', () => {
  const ids = ref(new Set<string>())

  function isFavorite(productId: string) {
    return ids.value.has(productId)
  }

  function toggle(productId: string) {
    if (!ids.value.delete(productId)) ids.value.add(productId)
  }

  return { ids, isFavorite, toggle }
})

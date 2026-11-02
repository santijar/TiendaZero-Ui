import { ref } from 'vue'
import { defineStore } from 'pinia'

import { addFavorite, getFavorites, removeFavorite } from '@/api/auth'
import type { ProductSummary } from '@/api/catalog'
import { useAuthStore } from './auth'

// Favorites are saved to the account when signed in. A guest's favorites last for the visit and
// are added to the account when they sign in.
export const useFavoritesStore = defineStore('favorites', () => {
  const ids = ref(new Set<string>())
  // Full product cards for the account page, newest first. Only loaded when signed in.
  const items = ref<ProductSummary[]>([])

  function isFavorite(slug: string) {
    return ids.value.has(slug)
  }

  async function load() {
    if (!useAuthStore().isSignedIn) return
    items.value = await getFavorites()
    ids.value = new Set(items.value.map((p) => p.slug))
  }

  // Optimistic: the heart flips at once, and flips back if the Api refuses.
  async function toggle(slug: string) {
    const adding = !ids.value.has(slug)
    if (adding) ids.value.add(slug)
    else ids.value.delete(slug)
    if (!useAuthStore().isSignedIn) return

    try {
      if (adding) await addFavorite(slug)
      else {
        await removeFavorite(slug)
        items.value = items.value.filter((p) => p.slug !== slug)
      }
    } catch {
      if (adding) ids.value.delete(slug)
      else ids.value.add(slug)
    }
  }

  async function onSignedIn() {
    const picked = [...ids.value]
    await Promise.all(picked.map((slug) => addFavorite(slug).catch(() => {})))
    await load().catch(() => {})
  }

  function onSignedOut() {
    ids.value = new Set()
    items.value = []
  }

  return { ids, items, isFavorite, load, toggle, onSignedIn, onSignedOut }
})

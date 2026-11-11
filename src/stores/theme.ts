import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { getTheme, type Theme } from '@/api/theme'
import { applyTheme, clearTheme } from '@/lib/applyTheme'

// The current store's branding (docs/plan.md §3). A store's own site loads it once at boot; the platform
// preview reloads it whenever another store is picked (the Api answers as that store for X-Preview-Tenant).
export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme | null>(null)
  // Only the newest load may land: switching stores quickly must not let a slow earlier answer win.
  let latest = 0
  let pending: Promise<void> | undefined

  async function load() {
    const mine = ++latest
    const loaded = await getTheme()
    if (mine !== latest) return
    theme.value = loaded
    applyTheme(loaded)
  }

  // Boot path: a no-op once loaded, and concurrent callers share one request.
  function ensureLoaded(): Promise<void> {
    if (theme.value) return Promise.resolve()
    pending ??= load().finally(() => (pending = undefined))
    return pending
  }

  function reset() {
    latest++
    theme.value = null
    clearTheme()
  }

  // A grocery is sold by the pack, not by size or color, takes no installments and charges shipping by zone, so the
  // storefront drops the apparel wording for it (sizes, color, "cambios gratis", "envío gratis", cuotas).
  const isGrocery = computed(() => theme.value?.storeKind === 'Grocery')

  return { theme, isGrocery, load, ensureLoaded, reset }
})

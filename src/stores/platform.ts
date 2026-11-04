import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { Session, User } from '@/api/auth'
import { configureAuth, configurePreview } from '@/api/http'
import {
  getPlatformTenants,
  platformLogin,
  platformLogout,
  platformRefresh,
  type PlatformTenant,
} from '@/api/platform'

const PREVIEW_KEY = 'tiendazero.previewTenant'

// The platform admin's session and the store they are previewing (docs/plan.md §1, §8). Only created on the
// platform host. The access token lives only in memory; a page load restores the session from the httpOnly
// refresh cookie, like a shopper's.
export const usePlatformStore = defineStore('platform', () => {
  const user = ref<User | null>(null)
  let accessToken: string | null = null
  const tenants = ref<PlatformTenant[]>([])
  // The store whose catalog the storefront below the bar shows. Sent as X-Preview-Tenant on every storefront call.
  const previewSlug = ref<string | null>(remembered())
  const isSignedIn = computed(() => user.value !== null)
  const previewing = computed(() => tenants.value.find((t) => t.slug === previewSlug.value) ?? null)

  let restoring: Promise<void> | undefined
  let refreshing: Promise<boolean> | undefined

  function apply(session: Session | null) {
    accessToken = session?.accessToken ?? null
    user.value = session?.user ?? null
  }

  // Concurrent callers (several requests hitting 401 at once) share one refresh: each one rotates the cookie.
  function renew(): Promise<boolean> {
    refreshing ??= platformRefresh()
      .then(
        (session) => {
          apply(session)
          return true
        },
        () => {
          apply(null)
          return false
        },
      )
      .finally(() => (refreshing = undefined))
    return refreshing
  }

  configureAuth({ accessToken: () => accessToken, refresh: renew })
  configurePreview(() => previewSlug.value)

  // Resolves once the page-load session restore has finished, signed in or not.
  function ready(): Promise<void> {
    restoring ??= renew().then(() => {})
    return restoring
  }

  async function signIn(email: string, password: string) {
    apply(await platformLogin({ email, password }))
    restoring = Promise.resolve()
  }

  async function signOut() {
    // Even if the Api is unreachable, the admin is signed out locally.
    await platformLogout().catch(() => {})
    apply(null)
    tenants.value = []
  }

  // Loads the store list and makes sure the preview names a store that exists: the remembered one, else the first.
  async function loadTenants() {
    tenants.value = await getPlatformTenants()
    if (!tenants.value.some((t) => t.slug === previewSlug.value)) {
      select(tenants.value[0]?.slug ?? null)
    }
  }

  function select(slug: string | null) {
    previewSlug.value = slug
    try {
      if (slug) sessionStorage.setItem(PREVIEW_KEY, slug)
      else sessionStorage.removeItem(PREVIEW_KEY)
    } catch {
      // Storage can be unavailable (private windows); the choice just won't survive a reload.
    }
  }

  return {
    user,
    tenants,
    previewSlug,
    previewing,
    isSignedIn,
    ready,
    signIn,
    signOut,
    loadTenants,
    select,
  }
})

function remembered(): string | null {
  try {
    return sessionStorage.getItem(PREVIEW_KEY)
  } catch {
    return null
  }
}

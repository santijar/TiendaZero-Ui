import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  login,
  logout,
  refresh,
  register,
  updateProfile,
  type Session,
  type User,
} from '@/api/auth'
import { configureAuth } from '@/api/http'
import { useCartStore } from './cart'
import { useFavoritesStore } from './favorites'

// The shopper's session. The access token lives only in memory; a page load restores the session
// from the httpOnly refresh cookie, which JavaScript never sees.
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  let accessToken: string | null = null
  const isSignedIn = computed(() => user.value !== null)

  let restoring: Promise<void> | undefined
  let refreshing: Promise<boolean> | undefined

  function apply(session: Session | null) {
    accessToken = session?.accessToken ?? null
    user.value = session?.user ?? null
  }

  // Renews the access token from the refresh cookie. Concurrent callers (several requests hitting
  // 401 at once) share one refresh, since each refresh rotates the cookie.
  function renew(): Promise<boolean> {
    refreshing ??= refresh()
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

  // Resolves once the page-load session restore has finished, signed in or not.
  function ready(): Promise<void> {
    restoring ??= renew().then(() => {})
    return restoring
  }

  async function afterSignIn(session: Session) {
    apply(session)
    restoring = Promise.resolve()
    await Promise.all([useCartStore().onSessionChanged(), useFavoritesStore().onSignedIn()])
  }

  async function signIn(email: string, password: string) {
    await afterSignIn(await login({ email, password }, useCartStore().guestToken()))
  }

  async function signUp(name: string, email: string, password: string) {
    await afterSignIn(await register({ name, email, password }, useCartStore().guestToken()))
  }

  async function signOut() {
    // Even if the Api is unreachable, the shopper is signed out locally.
    await logout().catch(() => {})
    apply(null)
    useFavoritesStore().onSignedOut()
    await useCartStore().onSessionChanged()
  }

  async function saveName(name: string) {
    user.value = await updateProfile(name)
  }

  return { user, isSignedIn, ready, signIn, signUp, signOut, saveName }
})

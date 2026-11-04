<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { logoStyle } from '@/lib/logoStyle'
import { isPlatformHost } from '@/lib/platform'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCatalogStore } from '@/stores/catalog'
import { useThemeStore } from '@/stores/theme'
import AppIcon from './AppIcon.vue'

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const cart = useCartStore()
const auth = useAuthStore()
const theme = computed(() => useThemeStore().theme)
const storeName = computed(() => theme.value?.storeName ?? '')

const logoCss = computed(() => {
  const t = theme.value
  return t?.logo ? logoStyle(t.logo, t.mode) : null
})

const onHome = computed(() => route.name === 'home')

// A platform admin's preview shows the store as shoppers see it and lets them do nothing: no account, no cart.
const preview = isPlatformHost()

function goHome() {
  catalog.setFilter({})
  router.push({ name: 'home' })
}

function selectCategory(slug: string | null) {
  catalog.setFilter(slug ? { category: slug } : {})
  if (onHome.value) window.scrollTo({ top: 0 })
  else router.push({ name: 'home' })
}

function onSearch(event: Event) {
  catalog.query = (event.target as HTMLInputElement).value
  if (!onHome.value) router.push({ name: 'home' })
}
</script>

<template>
  <header class="header">
    <div class="bar">
      <button type="button" class="brand" :aria-label="storeName" @click="goHome">
        <span v-if="logoCss" class="logo" role="img" :aria-label="storeName" :style="logoCss" />
        <span v-else-if="!theme?.wordmark" class="monogram">{{ theme?.monogram }}</span>
        <span v-if="theme?.wordmark" class="wordmark">{{ theme.wordmark }}</span>
      </button>
      <nav class="nav-cats" aria-label="Categorías">
        <button
          v-for="c in catalog.categoryOptions"
          :key="c.label"
          type="button"
          :class="{ active: onHome && catalog.isCategoryActive(c.slug) }"
          @click="selectCategory(c.slug)"
        >
          {{ c.label }}
        </button>
      </nav>
      <div class="search">
        <AppIcon name="search" :size="15" />
        <input
          class="input"
          type="search"
          placeholder="Buscar productos"
          aria-label="Buscar productos"
          :value="catalog.query"
          @input="onSearch"
        />
      </div>
      <RouterLink
        v-if="!preview"
        :to="{ name: auth.isSignedIn ? 'account' : 'login' }"
        class="btn btn-secondary btn-icon account"
        :aria-label="auth.isSignedIn ? 'Mi cuenta' : 'Ingresar'"
        :title="auth.isSignedIn ? auth.user?.name : 'Ingresar'"
      >
        <AppIcon name="user" :size="17" />
      </RouterLink>
      <button
        v-if="!preview"
        type="button"
        class="btn btn-secondary cart"
        aria-label="Carrito"
        @click="cart.open"
      >
        <AppIcon name="bag" :size="17" />
        <span>{{ cart.count }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg);
  box-shadow: 0 1px 0 var(--color-neutral-900);
}

.bar {
  max-width: 1280px;
  margin: 0 auto;
  padding: 10px clamp(16px, 4vw, 40px);
  display: flex;
  align-items: center;
  gap: clamp(12px, 3vw, 32px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: 0;
  cursor: pointer;
  color: var(--color-text);
  padding: 0;
  font: inherit;
}

.logo {
  flex: none;
  background: center / contain no-repeat;
}

.wordmark {
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0.14em;
  white-space: nowrap;
}

/* The fallback badge when a store has neither a logo nor a wordmark. */
.monogram {
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  box-sizing: border-box;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  display: grid;
  place-items: center;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.nav-cats {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  min-width: 0;
  flex: 1 1 auto;
  margin-right: auto;
  white-space: nowrap;
  padding-right: 24px;
  mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
}

.nav-cats button {
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
  color: var(--color-neutral-300);
}

.nav-cats button:hover {
  background: color-mix(in srgb, var(--color-text) 7%, transparent);
}

.nav-cats button.active {
  color: var(--color-accent);
}

.search {
  position: relative;
  flex: 0 1 240px;
  min-width: 140px;
}

.search svg {
  position: absolute;
  left: 10px;
  top: 11px;
  color: var(--color-neutral-500);
}

.search .input {
  padding-left: 32px;
}

.search .input::-webkit-search-cancel-button {
  display: none;
}

.cart {
  position: relative;
  height: 36px;
}

/* Pairs with the cart button; the global a:hover color doesn't apply to it. */
.account,
.account:hover {
  flex: none;
  color: var(--color-text);
}

.account.router-link-active {
  color: var(--color-accent);
}
</style>

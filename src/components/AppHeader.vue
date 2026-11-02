<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import logo from '@/assets/regate-logo.png'
import { useCartStore } from '@/stores/cart'
import { useCatalogStore } from '@/stores/catalog'
import AppIcon from './AppIcon.vue'

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const cart = useCartStore()

const onHome = computed(() => route.name === 'home')

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
      <button type="button" class="brand" @click="goHome">
        <img class="lighten" :src="logo" alt="Regate" width="44" height="44" />
        <span>REGATE</span>
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
      <button type="button" class="btn btn-secondary cart" aria-label="Carrito" @click="cart.open">
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

.brand img {
  width: 44px;
  height: 44px;
  margin: -4px -6px;
}

.brand span {
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0.14em;
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
</style>

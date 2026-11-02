<script setup lang="ts">
import { computed } from 'vue'

import type { ProductSort } from '@/api/catalog'
import PromoCarousel from '@/components/PromoCarousel.vue'
import ProductCard from '@/components/ProductCard.vue'
import { productCountLabel } from '@/lib/commerce'
import { useCatalogStore } from '@/stores/catalog'

const catalog = useCatalogStore()

const showPromo = computed(() => catalog.isUnfiltered && !catalog.isSearching)
const countLabel = computed(() =>
  catalog.status === 'ready' ? productCountLabel(catalog.total) : ' ',
)
const isEmpty = computed(() => catalog.status === 'ready' && catalog.products.length === 0)

function onSort(event: Event) {
  catalog.sort = (event.target as HTMLSelectElement).value as ProductSort
}
</script>

<template>
  <div class="home">
    <PromoCarousel v-if="showPromo" />

    <section class="catalog" :aria-busy="catalog.status === 'loading'">
      <div class="toolbar">
        <div class="heading">
          <h2>{{ catalog.title }}</h2>
          <span class="count">{{ countLabel }}</span>
        </div>
        <div class="filters">
          <button
            v-for="c in catalog.categoryOptions"
            :key="c.label"
            type="button"
            class="pill"
            :class="{ active: catalog.isCategoryActive(c.slug) }"
            :aria-pressed="catalog.isCategoryActive(c.slug)"
            @click="catalog.setFilter(c.slug ? { category: c.slug } : {})"
          >
            {{ c.label }}
          </button>
          <select class="input sort" aria-label="Ordenar" :value="catalog.sort" @change="onSort">
            <option value="featured">Destacados</option>
            <option value="price-asc">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
          </select>
        </div>
      </div>

      <div v-if="catalog.status === 'error'" class="message">
        <span>No pudimos cargar los productos.</span>
        <button type="button" class="btn btn-ghost" @click="catalog.loadProducts()">
          Reintentar
        </button>
      </div>

      <div v-else-if="isEmpty" class="message">
        <template v-if="catalog.isSearching">
          <span>No encontramos productos para “{{ catalog.query.trim() }}”.</span>
          <button type="button" class="btn btn-ghost" @click="catalog.query = ''">
            Limpiar búsqueda
          </button>
        </template>
        <span v-else>Todavía no hay productos acá.</span>
      </div>

      <div class="grid">
        <ProductCard v-for="p in catalog.products" :key="p.slug" :product="p" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  max-width: 1280px;
  margin: 0 auto;
  padding: 8px clamp(16px, 4vw, 40px) 56px;
  display: flex;
  flex-direction: column;
  gap: 36px;
}

.catalog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.heading h2 {
  margin: 0;
  font-size: 26px;
}

.count {
  font-size: 12px;
  color: var(--color-neutral-500);
}

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.pill {
  font: inherit;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
  background: transparent;
  color: var(--color-neutral-300);
  border: 1px solid var(--color-divider);
}

.pill.active {
  background: var(--color-accent-900);
  color: var(--color-accent-200);
  border-color: var(--color-accent);
}

.sort {
  width: auto;
  min-width: 150px;
}

.message {
  padding: 40px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  font-size: 16px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 28px 18px;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'

import { ALL_CATEGORY, CATEGORIES } from '@/catalog/products'
import PromoCarousel from '@/components/PromoCarousel.vue'
import ProductCard from '@/components/ProductCard.vue'
import { productCountLabel } from '@/lib/commerce'
import { useCatalogStore, type SortOrder } from '@/stores/catalog'

const catalog = useCatalogStore()

const showPromo = computed(() => catalog.category === ALL_CATEGORY && !catalog.isSearching)

function onSort(event: Event) {
  catalog.sort = (event.target as HTMLSelectElement).value as SortOrder
}
</script>

<template>
  <div class="home">
    <PromoCarousel v-if="showPromo" />

    <section class="catalog">
      <div class="toolbar">
        <div class="heading">
          <h2>{{ catalog.title }}</h2>
          <span class="count">{{ productCountLabel(catalog.visibleProducts.length) }}</span>
        </div>
        <div class="filters">
          <button
            v-for="c in CATEGORIES"
            :key="c"
            type="button"
            class="pill"
            :class="{ active: catalog.category === c }"
            :aria-pressed="catalog.category === c"
            @click="catalog.category = c"
          >
            {{ c }}
          </button>
          <select class="input sort" aria-label="Ordenar" :value="catalog.sort" @change="onSort">
            <option value="rel">Destacados</option>
            <option value="asc">Menor precio</option>
            <option value="desc">Mayor precio</option>
          </select>
        </div>
      </div>

      <div v-if="catalog.visibleProducts.length === 0" class="no-results">
        <span>No encontramos productos para “{{ catalog.query }}”.</span>
        <button type="button" class="btn btn-ghost" @click="catalog.query = ''">
          Limpiar búsqueda
        </button>
      </div>

      <div class="grid">
        <ProductCard v-for="p in catalog.visibleProducts" :key="p.id" :product="p" />
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

.no-results {
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

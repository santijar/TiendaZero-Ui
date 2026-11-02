import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { ALL_CATEGORY, PRODUCTS, TRAINING_CATEGORY } from '@/catalog/products'

export type SortOrder = 'rel' | 'asc' | 'desc'

export const useCatalogStore = defineStore('catalog', () => {
  const category = ref(ALL_CATEGORY)
  const query = ref('')
  const sort = ref<SortOrder>('rel')

  const normalizedQuery = computed(() => query.value.trim().toLowerCase())

  const visibleProducts = computed(() => {
    const q = normalizedQuery.value
    const matches = PRODUCTS.filter(
      (p) =>
        (category.value === ALL_CATEGORY ||
          p.category === category.value ||
          (category.value === TRAINING_CATEGORY && p.tag === TRAINING_CATEGORY)) &&
        (!q || `${p.name} ${p.category}`.toLowerCase().includes(q)),
    )
    if (sort.value === 'asc') return [...matches].sort((a, b) => a.price - b.price)
    if (sort.value === 'desc') return [...matches].sort((a, b) => b.price - a.price)
    return matches
  })

  const isSearching = computed(() => normalizedQuery.value !== '')

  const title = computed(() => {
    if (isSearching.value) return 'Resultados'
    return category.value === ALL_CATEGORY ? 'Todos los productos' : category.value
  })

  return { category, query, sort, visibleProducts, isSearching, title }
})

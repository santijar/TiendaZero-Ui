import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import {
  getCategories,
  getCollections,
  getProducts,
  type Category,
  type Collection,
  type ProductSort,
  type ProductSummary,
} from '@/api/catalog'
import type { CatalogFilter } from '@/catalog/promos'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const SEARCH_DEBOUNCE_MS = 250

export const useCatalogStore = defineStore('catalog', () => {
  const categories = ref<Category[]>([])
  const collections = ref<Collection[]>([])

  // At most one of category/collection is set; neither means the whole store ("Todo").
  const category = ref<string | null>(null)
  const collection = ref<string | null>(null)
  const query = ref('')
  const sort = ref<ProductSort>('featured')

  const products = ref<ProductSummary[]>([])
  const total = ref(0)
  const status = ref<LoadStatus>('idle')

  const isSearching = computed(() => query.value.trim() !== '')
  const isUnfiltered = computed(() => !category.value && !collection.value)

  const title = computed(() => {
    if (isSearching.value) return 'Resultados'
    if (category.value) return nameOf(categories.value, category.value)
    if (collection.value) return nameOf(collections.value, collection.value)
    return 'Todos los productos'
  })

  // The category pills shown in the header and above the grid: "Todo" plus every category.
  const categoryOptions = computed(() => [
    { label: 'Todo', slug: null as string | null },
    ...categories.value.map((c) => ({ label: c.name, slug: c.slug as string | null })),
  ])

  function isCategoryActive(slug: string | null) {
    return slug === null ? isUnfiltered.value : category.value === slug
  }

  function setFilter(filter: CatalogFilter) {
    category.value = filter.category ?? null
    collection.value = filter.category ? null : (filter.collection ?? null)
  }

  async function loadTaxonomy() {
    const [cats, cols] = await Promise.all([getCategories(), getCollections()])
    categories.value = cats
    collections.value = cols
  }

  let inflight: AbortController | undefined

  async function loadProducts() {
    inflight?.abort()
    const controller = (inflight = new AbortController())
    status.value = 'loading'
    try {
      const page = await getProducts(
        {
          category: category.value,
          collection: collection.value,
          q: query.value,
          sort: sort.value,
        },
        controller.signal,
      )
      products.value = page.items
      total.value = page.total
      status.value = 'ready'
    } catch {
      // An aborted request was superseded by a newer one, which owns the state now.
      if (!controller.signal.aborted) status.value = 'error'
    }
  }

  watch([category, collection, sort], () => void loadProducts())

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  watch(query, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => void loadProducts(), SEARCH_DEBOUNCE_MS)
  })

  return {
    categories,
    collections,
    category,
    collection,
    query,
    sort,
    products,
    total,
    status,
    isSearching,
    isUnfiltered,
    title,
    categoryOptions,
    isCategoryActive,
    setFilter,
    loadTaxonomy,
    loadProducts,
  }
})

function nameOf(list: { slug: string; name: string }[], slug: string): string {
  return list.find((x) => x.slug === slug)?.name ?? ''
}

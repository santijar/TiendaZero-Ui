<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import {
  createCategory,
  createCollection,
  deleteCategory,
  deleteCollection,
  getCategories,
  getCollections,
  updateCategory,
  updateCollection,
  type AdminCategory,
  type AdminCollection,
} from '@/api/admin'
import { ApiError } from '@/api/http'

// Categories (each product has one; they're the storefront's filter tabs) and collections (curated
// groups, e.g. "Entrenamiento", used by the home carousel).
type Kind = 'category' | 'collection'

interface Row {
  id: number | null
  slug: string
  name: string
  sortOrder: number
  productCount: number
}

const categories = ref<Row[]>([])
const collections = ref<Row[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const errors = reactive<Record<string, string>>({})
const busy = ref(false)

const toRow = (c: AdminCategory | AdminCollection): Row => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  sortOrder: 'sortOrder' in c ? c.sortOrder : 0,
  productCount: c.productCount,
})

async function load() {
  try {
    const [cats, cols] = await Promise.all([getCategories(), getCollections()])
    categories.value = cats.map(toRow)
    collections.value = cols.map(toRow)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

const listOf = (kind: Kind) => (kind === 'category' ? categories : collections)
const errorKey = (kind: Kind, row: Row) => `${kind}:${row.id ?? 'new'}`

function add(kind: Kind) {
  const list = listOf(kind)
  if (list.value.some((r) => r.id === null)) return
  const sortOrder = Math.max(0, ...list.value.map((r) => r.sortOrder)) + 1
  list.value.push({ id: null, slug: '', name: '', sortOrder, productCount: 0 })
}

function message(e: unknown) {
  if (e instanceof ApiError) {
    return (
      Object.values(e.problem?.errors ?? {})[0]?.[0] ?? e.problem?.detail ?? 'No pudimos guardar.'
    )
  }
  return 'No pudimos guardar.'
}

async function save(kind: Kind, row: Row) {
  const key = errorKey(kind, row)
  delete errors[key]
  busy.value = true
  try {
    const body = { slug: row.slug.trim(), name: row.name.trim(), sortOrder: row.sortOrder }
    const saved =
      kind === 'category'
        ? row.id === null
          ? await createCategory(body)
          : await updateCategory(row.id, body)
        : row.id === null
          ? await createCollection(body)
          : await updateCollection(row.id, body)
    Object.assign(row, toRow(saved))
  } catch (e) {
    errors[key] = message(e)
  } finally {
    busy.value = false
  }
}

async function remove(kind: Kind, row: Row) {
  const list = listOf(kind)
  if (row.id === null) {
    list.value = list.value.filter((r) => r !== row)
    return
  }
  const what = kind === 'category' ? 'la categoría' : 'la colección'
  if (!window.confirm(`¿Borrar ${what} "${row.name}"?`)) return
  const key = errorKey(kind, row)
  delete errors[key]
  try {
    await (kind === 'category' ? deleteCategory(row.id) : deleteCollection(row.id))
    list.value = list.value.filter((r) => r !== row)
  } catch (e) {
    errors[key] = message(e)
  }
}

function slugFromName(row: Row) {
  if (row.id === null && !row.slug) {
    row.slug = row.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Categorías y colecciones</h1>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'error'" class="form-error">No pudimos cargar el catálogo.</p>

    <div v-else class="admin-grid">
      <section
        v-for="kind in ['category', 'collection'] as const"
        :key="kind"
        class="card admin-section"
      >
        <h2>{{ kind === 'category' ? 'Categorías' : 'Colecciones' }}</h2>
        <p class="admin-muted">
          {{
            kind === 'category'
              ? 'Cada producto tiene una. Son las pestañas de la tienda, en este orden.'
              : 'Grupos curados (por ejemplo, Entrenamiento). Un producto puede estar en varias.'
          }}
        </p>
        <div v-for="row in listOf(kind).value" :key="row.id ?? 'new'" class="row">
          <div class="row-fields">
            <input
              v-model="row.name"
              class="input"
              placeholder="Nombre"
              :aria-label="`Nombre de ${row.name || 'la nueva'}`"
              @blur="slugFromName(row)"
            />
            <input v-model="row.slug" class="input" placeholder="slug" aria-label="Slug" />
            <input
              v-if="kind === 'category'"
              v-model.number="row.sortOrder"
              class="input order"
              type="number"
              aria-label="Orden"
            />
          </div>
          <div class="row-actions">
            <span class="admin-muted">{{ row.productCount }} prod.</span>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="busy"
              @click="save(kind, row)"
            >
              {{ row.id === null ? 'Crear' : 'Guardar' }}
            </button>
            <button type="button" class="btn btn-ghost" @click="remove(kind, row)">
              {{ row.id === null ? 'Cancelar' : 'Borrar' }}
            </button>
          </div>
          <span v-if="errors[errorKey(kind, row)]" class="form-error">
            {{ errors[errorKey(kind, row)] }}
          </span>
        </div>
        <div class="admin-actions">
          <button type="button" class="btn btn-ghost" @click="add(kind)">
            {{ kind === 'category' ? 'Nueva categoría' : 'Nueva colección' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-divider);
}

.row-fields {
  display: flex;
  gap: 8px;
}

.row-fields .input {
  height: 34px;
  min-width: 0;
}

.order {
  width: 72px;
  flex: none;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.row-actions .btn {
  height: 30px;
}

.row-actions .admin-muted {
  margin-right: auto;
}
</style>

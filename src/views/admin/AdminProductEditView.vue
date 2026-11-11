<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  createProduct,
  deleteImage,
  deleteProduct,
  getCategories,
  getCollections,
  getProduct,
  reorderImages,
  updateProduct,
  uploadImage,
  type AdminCategory,
  type AdminCollection,
  type AdminImage,
  type AdminProduct,
  type SaveProduct,
} from '@/api/admin'
import { ApiError } from '@/api/http'

// /admin/productos/nuevo (no id) or /admin/productos/:id.
const props = defineProps<{ id?: number }>()

interface SizeRow {
  key: number
  id: number | null
  size: string
  sku: string
  stock: number
  // What the Api last said, so only edited stock is sent (an untouched figure may be stale).
  savedStock: number | null
  version: number | null
}

const router = useRouter()
const isNew = computed(() => props.id === undefined)

const categories = ref<AdminCategory[]>([])
const collections = ref<AdminCollection[]>([])
const form = reactive({
  slug: '',
  name: '',
  description: '',
  price: 0,
  color: '',
  badge: '',
  brand: '',
  categoryId: 0,
  collectionIds: [] as number[],
  isActive: true,
  sortOrder: 0,
})
const sizes = ref<SizeRow[]>([])
const images = ref<AdminImage[]>([])
const state = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const saving = ref(false)
const saved = ref(false)
const errors = ref<Record<string, string>>({})
// Per size row (by its key), what the editor found missing before sending.
const rowErrors = ref<Record<number, { size?: string; sku?: string }>>({})
const message = ref<string | null>(null)
const stockConflict = ref(false)
const uploading = ref(false)
let slugEdited = false
let nextKey = 1

function fill(p: AdminProduct) {
  Object.assign(form, {
    slug: p.slug,
    name: p.name,
    description: p.description,
    price: p.price,
    color: p.color,
    badge: p.badge ?? '',
    brand: p.brand ?? '',
    categoryId: p.categoryId,
    collectionIds: [...p.collectionIds],
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  })
  sizes.value = p.variants.map((v) => ({
    key: nextKey++,
    id: v.id,
    size: v.size,
    sku: v.sku,
    stock: v.stock,
    savedStock: v.stock,
    version: v.version,
  }))
  images.value = p.images
  slugEdited = true
}

async function load() {
  try {
    const [cats, cols] = await Promise.all([getCategories(), getCollections()])
    categories.value = cats
    collections.value = cols
    if (props.id === undefined) {
      form.categoryId = cats[0]?.id ?? 0
      sizes.value = ['S', 'M', 'L', 'XL'].map((size) => newSize(size))
    } else {
      fill(await getProduct(props.id))
    }
    state.value = 'ready'
  } catch (e) {
    state.value = e instanceof ApiError && e.status === 404 ? 'not-found' : 'error'
  }
}

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// New products get a slug from the name until the admin types one.
function onNameInput() {
  if (!slugEdited) form.slug = slugify(form.name)
}

function newSize(size = ''): SizeRow {
  return {
    key: nextKey++,
    id: null,
    size,
    sku: skuFor(size),
    stock: 0,
    savedStock: null,
    version: null,
  }
}

function skuFor(size: string) {
  return size && form.slug ? `${form.slug}-${slugify(size)}`.toUpperCase() : ''
}

function addSize() {
  sizes.value.push(newSize())
}

function removeSize(i: number) {
  sizes.value.splice(i, 1)
}

function moveSize(i: number, by: number) {
  const [row] = sizes.value.splice(i, 1)
  sizes.value.splice(i + by, 0, row!)
}

function fillSku(row: SizeRow) {
  if (!row.sku) row.sku = skuFor(row.size)
}

function toBody(): SaveProduct {
  return {
    ...form,
    badge: form.badge.trim() || null,
    brand: form.brand.trim() || null,
    price: Number(form.price),
    variants: sizes.value.map((s) => ({
      id: s.id,
      size: s.size,
      sku: s.sku,
      stock: s.id === null || s.stock !== s.savedStock ? Number(s.stock) : null,
      version: s.version,
    })),
  }
}

// Marks the rows the Api would reject, so the admin sees which field is missing.
function checkSizes(): boolean {
  const found: Record<number, { size?: string; sku?: string }> = {}
  for (const row of sizes.value) {
    fillSku(row)
    const problem: { size?: string; sku?: string } = {}
    if (!row.size.trim()) problem.size = 'Falta el talle.'
    if (!row.sku.trim()) problem.sku = 'Falta el SKU.'
    if (problem.size || problem.sku) found[row.key] = problem
  }
  rowErrors.value = found
  return Object.keys(found).length === 0
}

function clearRowError(row: SizeRow, field: 'size' | 'sku') {
  const problem = rowErrors.value[row.key]
  if (problem) delete problem[field]
}

async function save() {
  saved.value = false
  errors.value = {}
  message.value = null
  stockConflict.value = false
  if (!checkSizes()) {
    message.value = 'Revisá los campos marcados.'
    return
  }
  saving.value = true
  try {
    if (props.id === undefined) {
      const created = await createProduct(toBody())
      await router.replace({ name: 'admin-product', params: { id: created.id } })
      return
    }
    fill(await updateProduct(props.id, toBody()))
    saved.value = true
  } catch (e) {
    if (e instanceof ApiError && e.status === 400 && e.problem?.errors) {
      errors.value = Object.fromEntries(
        Object.entries(e.problem.errors).map(([field, list]) => [field, list[0] ?? '']),
      )
      message.value = 'Revisá los campos marcados.'
    } else if (e instanceof ApiError && e.status === 409) {
      stockConflict.value = true
      message.value = e.problem?.detail ?? 'El stock cambió mientras editabas.'
    } else {
      message.value = 'No pudimos guardar el producto. Probá de nuevo.'
    }
  } finally {
    saving.value = false
  }
}

// After a stock conflict: take the current stock (sales included) and keep every other edit.
async function reloadStock() {
  if (props.id === undefined) return
  const fresh = await getProduct(props.id)
  for (const row of sizes.value) {
    const current = fresh.variants.find((v) => v.id === row.id)
    if (!current) continue
    row.stock = current.stock
    row.savedStock = current.stock
    row.version = current.version
  }
  stockConflict.value = false
  message.value = 'Actualizamos el stock con las ventas. Revisalo y guardá de nuevo.'
}

async function remove() {
  if (props.id === undefined) return
  if (
    !window.confirm(
      `¿Borrar "${form.name}"? Los pedidos ya hechos no cambian. Para dejar de venderlo sin borrarlo, desmarcá "A la venta".`,
    )
  )
    return
  try {
    await deleteProduct(props.id)
    await router.push({ name: 'admin-products' })
  } catch {
    message.value = 'No pudimos borrar el producto.'
  }
}

async function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (props.id === undefined || files.length === 0) return
  uploading.value = true
  message.value = null
  try {
    for (const file of files) images.value.push(await uploadImage(props.id, file))
  } catch (e) {
    message.value =
      (e instanceof ApiError && e.fieldError('file')) || 'No pudimos subir la foto. Probá de nuevo.'
  } finally {
    uploading.value = false
  }
}

async function moveImage(i: number, by: number) {
  if (props.id === undefined) return
  const ids = images.value.map((img) => img.id)
  const [id] = ids.splice(i, 1)
  ids.splice(i + by, 0, id!)
  images.value = await reorderImages(props.id, ids)
}

async function removeImage(image: AdminImage) {
  if (props.id === undefined || !window.confirm('¿Borrar esta foto?')) return
  await deleteImage(props.id, image.id)
  images.value = images.value.filter((img) => img.id !== image.id)
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <div>
      <RouterLink :to="{ name: 'admin-products' }" class="btn btn-ghost">← Productos</RouterLink>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'not-found'" class="form-note">Ese producto no existe.</p>
    <p v-else-if="state === 'error'" class="form-error">No pudimos cargar el producto.</p>

    <form v-else class="admin-page" novalidate @submit.prevent="save" @input="saved = false">
      <div class="admin-head">
        <h1>{{ isNew ? 'Nuevo producto' : form.name || 'Producto' }}</h1>
        <div class="admin-actions">
          <RouterLink
            v-if="!isNew && form.isActive"
            :to="{ name: 'product', params: { slug: form.slug } }"
            class="btn btn-ghost"
            target="_blank"
          >
            Ver en la tienda
          </RouterLink>
          <button v-if="!isNew" type="button" class="btn btn-ghost" @click="remove">Borrar</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar' }}
          </button>
        </div>
      </div>

      <div v-if="message" class="admin-actions" role="alert">
        <span class="form-error">{{ message }}</span>
        <button v-if="stockConflict" type="button" class="btn btn-secondary" @click="reloadStock">
          Traer el stock actual
        </button>
      </div>

      <section class="card admin-section">
        <h2>Datos</h2>
        <div class="admin-fields">
          <div class="field">
            <label for="p-name">Nombre</label>
            <input id="p-name" v-model="form.name" class="input" @input="onNameInput" />
            <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
          </div>
          <div class="field">
            <label for="p-slug">Slug (dirección)</label>
            <input id="p-slug" v-model="form.slug" class="input" @input="slugEdited = true" />
            <span v-if="errors.slug" class="form-error">{{ errors.slug }}</span>
          </div>
          <div class="field">
            <label for="p-price">Precio (ARS, con impuestos)</label>
            <input
              id="p-price"
              v-model.number="form.price"
              class="input"
              type="number"
              min="0"
              step="100"
            />
            <span v-if="errors.price" class="form-error">{{ errors.price }}</span>
          </div>
          <div class="field">
            <label for="p-category">Categoría</label>
            <select id="p-category" v-model="form.categoryId" class="input">
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <span v-if="errors.categoryId" class="form-error">{{ errors.categoryId }}</span>
          </div>
          <div class="field">
            <label for="p-color">Color</label>
            <input id="p-color" v-model="form.color" class="input" />
            <span v-if="errors.color" class="form-error">{{ errors.color }}</span>
          </div>
          <div class="field">
            <label for="p-brand">Marca (opcional)</label>
            <input id="p-brand" v-model="form.brand" class="input" placeholder="La Independencia" />
            <span v-if="errors.brand" class="form-error">{{ errors.brand }}</span>
          </div>
          <div class="field">
            <label for="p-badge">Etiqueta (opcional)</label>
            <input id="p-badge" v-model="form.badge" class="input" placeholder="Nuevo" />
            <span v-if="errors.badge" class="form-error">{{ errors.badge }}</span>
          </div>
          <div class="field">
            <label for="p-order">Orden en "Destacados"</label>
            <input id="p-order" v-model.number="form.sortOrder" class="input" type="number" />
          </div>
        </div>
        <div class="field">
          <label for="p-description">Descripción</label>
          <textarea id="p-description" v-model="form.description" class="input" rows="4" />
          <span v-if="errors.description" class="form-error">{{ errors.description }}</span>
        </div>
        <div class="admin-toolbar">
          <label class="admin-check">
            <input v-model="form.isActive" type="checkbox" />
            A la venta
          </label>
          <label v-for="c in collections" :key="c.id" class="admin-check">
            <input v-model="form.collectionIds" type="checkbox" :value="c.id" />
            {{ c.name }}
          </label>
        </div>
      </section>

      <section class="card admin-section">
        <h2>Talles y stock</h2>
        <span v-if="errors.variants" class="form-error">{{ errors.variants }}</span>
        <div class="admin-table-wrap">
          <table class="table sizes">
            <thead>
              <tr>
                <th>Talle</th>
                <th>SKU</th>
                <th class="admin-num">Stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in sizes" :key="s.key">
                <td>
                  <input
                    v-model="s.size"
                    class="input"
                    :aria-label="`Talle ${i + 1}`"
                    :aria-invalid="!!rowErrors[s.key]?.size"
                    @input="clearRowError(s, 'size')"
                    @blur="fillSku(s)"
                  />
                  <span v-if="rowErrors[s.key]?.size" class="form-error" role="alert">
                    {{ rowErrors[s.key]?.size }}
                  </span>
                </td>
                <td>
                  <input
                    v-model="s.sku"
                    class="input"
                    :aria-label="`SKU ${i + 1}`"
                    :aria-invalid="!!rowErrors[s.key]?.sku"
                    @input="clearRowError(s, 'sku')"
                  />
                  <span v-if="rowErrors[s.key]?.sku" class="form-error" role="alert">
                    {{ rowErrors[s.key]?.sku }}
                  </span>
                </td>
                <td class="admin-num">
                  <input
                    v-model.number="s.stock"
                    class="input stock"
                    type="number"
                    min="0"
                    :aria-label="`Stock ${i + 1}`"
                  />
                </td>
                <td class="row-actions">
                  <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="i === 0"
                    aria-label="Subir"
                    @click="moveSize(i, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="i === sizes.length - 1"
                    aria-label="Bajar"
                    @click="moveSize(i, 1)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="sizes.length === 1"
                    @click="removeSize(i)"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="admin-actions">
          <button type="button" class="btn btn-secondary" @click="addSize">Agregar talle</button>
        </div>
        <p class="admin-muted">
          Las ventas descuentan stock solas. Si cambia mientras editás, te avisamos antes de
          pisarlo.
        </p>
      </section>

      <section class="card admin-section">
        <h2>Fotos</h2>
        <p v-if="isNew" class="admin-muted">Guardá el producto para poder subirle fotos.</p>
        <template v-else>
          <div v-if="images.length" class="images">
            <figure v-for="(img, i) in images" :key="img.id" class="image">
              <img :src="img.url" :alt="img.alt" />
              <figcaption>
                <span v-if="i === 0" class="admin-muted">Portada</span>
                <span class="row-actions">
                  <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="i === 0"
                    aria-label="Antes"
                    @click="moveImage(i, -1)"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="i === images.length - 1"
                    aria-label="Después"
                    @click="moveImage(i, 1)"
                  >
                    →
                  </button>
                  <button type="button" class="btn btn-ghost" @click="removeImage(img)">
                    Borrar
                  </button>
                </span>
              </figcaption>
            </figure>
          </div>
          <label class="btn btn-secondary upload">
            {{ uploading ? 'Subiendo…' : 'Subir fotos' }}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              :disabled="uploading"
              @change="onFiles"
            />
          </label>
          <p class="admin-muted">JPG, PNG o WebP de hasta 5 MB. La primera es la portada.</p>
        </template>
      </section>
    </form>
  </div>
</template>

<style scoped>
.sizes .input {
  height: 32px;
}

.sizes .input[aria-invalid='true'] {
  border-color: var(--color-accent-300);
}

.stock {
  width: 90px;
  text-align: right;
}

.row-actions {
  display: inline-flex;
  gap: 2px;
  white-space: nowrap;
}

.row-actions .btn {
  height: 30px;
  padding: 0 8px;
}

.images {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.image {
  margin: 0;
  width: 140px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.image img {
  width: 140px;
  height: 175px;
  object-fit: cover;
  border-radius: var(--radius-md);
  background: var(--color-neutral-900);
}

.image figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.upload {
  align-self: flex-start;
  position: relative;
  height: 36px;
  cursor: pointer;
}

.upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>

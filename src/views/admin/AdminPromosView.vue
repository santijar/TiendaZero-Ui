<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createPromo,
  deletePromo,
  getAdminPromos,
  getCategories,
  getCollections,
  reorderPromos,
  updatePromo,
  uploadPromoImage,
  type AdminCategory,
  type AdminCollection,
  type AdminPromo,
  type SavePromo,
} from '@/api/admin'
import { ApiError } from '@/api/http'

// The store's home carousel. Each slide is a photo, a small text and a title over it, and a button that opens one of the
// store's categories or collections (or the whole store). A slide only shows to shoppers once it has a photo; with no slides
// the home page has no carousel.
const MAX_SLIDES = 8

const state = ref<'loading' | 'ready' | 'error'>('loading')
const slides = ref<AdminPromo[]>([])
const categories = ref<AdminCategory[]>([])
const collections = ref<AdminCollection[]>([])
const busy = ref(false)
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

// The form: a new slide (id null) or one being edited. `target` is "" (whole store), "category:slug" or "collection:slug".
const editing = ref<{ id: string | null } | null>(null)
const form = reactive({ kicker: '', title: '', cta: '', alt: '', target: '' })
const errors = reactive<Record<string, string>>({})

const canAdd = computed(() => slides.value.length < MAX_SLIDES)

onMounted(async () => {
  try {
    const [list, cats, cols] = await Promise.all([
      getAdminPromos(),
      getCategories(),
      getCollections(),
    ])
    slides.value = list
    categories.value = cats
    collections.value = cols
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})

function clearErrors() {
  Object.keys(errors).forEach((k) => delete errors[k])
  notice.value = null
}

function targetOf(s: { category: string | null; collection: string | null }) {
  if (s.category) return `category:${s.category}`
  if (s.collection) return `collection:${s.collection}`
  return ''
}

function targetLabel(s: AdminPromo) {
  if (s.category) {
    return `Categoría: ${categories.value.find((c) => c.slug === s.category)?.name ?? s.category}`
  }
  if (s.collection) {
    return `Colección: ${collections.value.find((c) => c.slug === s.collection)?.name ?? s.collection}`
  }
  return 'Toda la tienda'
}

function startNew() {
  clearErrors()
  Object.assign(form, { kicker: '', title: '', cta: '', alt: '', target: '' })
  editing.value = { id: null }
}

function startEdit(s: AdminPromo) {
  clearErrors()
  Object.assign(form, {
    kicker: s.kicker,
    title: s.title,
    cta: s.cta,
    alt: s.alt,
    target: targetOf(s),
  })
  editing.value = { id: s.id }
}

function cancel() {
  clearErrors()
  editing.value = null
}

function body(): SavePromo {
  const [kind, slug] = form.target.split(':')
  return {
    kicker: form.kicker.trim(),
    title: form.title.trim(),
    cta: form.cta.trim(),
    alt: form.alt.trim(),
    category: kind === 'category' ? (slug ?? null) : null,
    collection: kind === 'collection' ? (slug ?? null) : null,
  }
}

function fail(e: unknown, fallback: string) {
  if (e instanceof ApiError && e.problem?.errors) {
    for (const [field, messages] of Object.entries(e.problem.errors)) {
      errors[field] = messages[0] ?? ''
    }
    notice.value = { kind: 'error', text: errors.slides ?? 'Revisá los campos marcados.' }
  } else {
    notice.value = { kind: 'error', text: fallback }
  }
}

async function save() {
  if (!editing.value) return
  busy.value = true
  clearErrors()
  try {
    if (editing.value.id === null) {
      slides.value.push(await createPromo(body()))
      notice.value = {
        kind: 'ok',
        text: 'Creamos la promoción. Subile una foto para que se muestre.',
      }
    } else {
      const updated = await updatePromo(editing.value.id, body())
      slides.value = slides.value.map((s) => (s.id === updated.id ? updated : s))
      notice.value = { kind: 'ok', text: 'Guardamos los cambios.' }
    }
    editing.value = null
  } catch (e) {
    fail(e, 'No pudimos guardar la promoción.')
  } finally {
    busy.value = false
  }
}

async function onPhoto(event: Event, s: AdminPromo) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  clearErrors()
  try {
    const updated = await uploadPromoImage(s.id, file)
    slides.value = slides.value.map((x) => (x.id === updated.id ? updated : x))
  } catch (e) {
    notice.value = {
      kind: 'error',
      text:
        (e instanceof ApiError && e.fieldError('file')) ||
        'No pudimos subir la foto. Probá de nuevo.',
    }
  } finally {
    busy.value = false
  }
}

async function move(index: number, by: number) {
  const ids = slides.value.map((s) => s.id)
  const [id] = ids.splice(index, 1)
  ids.splice(index + by, 0, id!)
  busy.value = true
  clearErrors()
  try {
    slides.value = await reorderPromos(ids)
  } catch {
    notice.value = { kind: 'error', text: 'No pudimos cambiar el orden.' }
  } finally {
    busy.value = false
  }
}

async function remove(s: AdminPromo) {
  if (!window.confirm(`¿Borrar la promoción «${s.title}»? Su foto también se borra.`)) return
  busy.value = true
  clearErrors()
  try {
    await deletePromo(s.id)
    slides.value = slides.value.filter((x) => x.id !== s.id)
    if (editing.value?.id === s.id) editing.value = null
  } catch {
    notice.value = { kind: 'error', text: 'No pudimos borrar la promoción.' }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Promociones</h1>
      <div class="admin-actions">
        <button
          v-if="state === 'ready' && !editing"
          type="button"
          class="btn btn-primary"
          :disabled="!canAdd || busy"
          @click="startNew"
        >
          Agregar promoción
        </button>
      </div>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'error'" class="form-error">No pudimos cargar las promociones.</p>

    <div v-else class="promos">
      <p class="admin-muted">
        Son las imágenes que rotan arriba en el inicio de tu tienda. Cada una necesita una foto para
        mostrarse. Si no cargás ninguna, el inicio no tiene carrusel. Hasta {{ MAX_SLIDES }}.
      </p>

      <form v-if="editing" class="card admin-section" aria-label="Promoción" @submit.prevent="save">
        <h2>{{ editing.id === null ? 'Nueva promoción' : 'Editar promoción' }}</h2>
        <div class="field">
          <label for="pr-kicker">Texto chico (opcional)</label>
          <input id="pr-kicker" v-model="form.kicker" class="input" placeholder="Temporada 26" />
          <span v-if="errors.kicker" class="form-error">{{ errors.kicker }}</span>
        </div>
        <div class="field">
          <label for="pr-title">Título</label>
          <input
            id="pr-title"
            v-model="form.title"
            class="input"
            placeholder="Hecho para la cancha"
          />
          <span v-if="errors.title" class="form-error">{{ errors.title }}</span>
        </div>
        <div class="field">
          <label for="pr-cta">Texto del botón</label>
          <input id="pr-cta" v-model="form.cta" class="input" placeholder="Ver camisetas" />
          <span v-if="errors.cta" class="form-error">{{ errors.cta }}</span>
        </div>
        <div class="field">
          <label for="pr-target">El botón abre</label>
          <select id="pr-target" v-model="form.target" class="input">
            <option value="">Toda la tienda</option>
            <option v-for="c in categories" :key="'c' + c.slug" :value="'category:' + c.slug">
              Categoría: {{ c.name }}
            </option>
            <option v-for="c in collections" :key="'k' + c.slug" :value="'collection:' + c.slug">
              Colección: {{ c.name }}
            </option>
          </select>
          <span v-if="errors.category" class="form-error">{{ errors.category }}</span>
          <span v-if="errors.collection" class="form-error">{{ errors.collection }}</span>
        </div>
        <div class="field">
          <label for="pr-alt">Descripción de la foto (opcional)</label>
          <input
            id="pr-alt"
            v-model="form.alt"
            class="input"
            placeholder="Jugadores en la cancha"
          />
          <span v-if="errors.alt" class="form-error">{{ errors.alt }}</span>
        </div>
        <div class="admin-actions">
          <button type="submit" class="btn btn-primary" :disabled="busy">Guardar</button>
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="cancel">
            Cancelar
          </button>
        </div>
      </form>

      <p v-if="notice" :class="notice.kind === 'ok' ? 'form-note' : 'form-error'" role="status">
        {{ notice.text }}
      </p>

      <p v-if="!slides.length && !editing" class="form-note">Todavía no cargaste promociones.</p>

      <ul v-if="slides.length" class="slides" aria-label="Promociones">
        <li v-for="(s, i) in slides" :key="s.id" class="card slide">
          <div class="photo">
            <img v-if="s.imageUrl" :src="s.imageUrl" :alt="s.alt" />
            <span v-else class="admin-muted">Sin foto</span>
          </div>
          <div class="info">
            <strong>{{ s.title }}</strong>
            <span v-if="s.kicker" class="admin-muted">{{ s.kicker }}</span>
            <span class="admin-muted">Botón «{{ s.cta }}» · {{ targetLabel(s) }}</span>
            <span v-if="!s.imageUrl" class="form-error">No se muestra hasta que tenga foto.</span>
          </div>
          <div class="row-actions">
            <label class="btn btn-secondary upload">
              {{ s.imageUrl ? 'Cambiar foto' : 'Subir foto' }}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :disabled="busy"
                :aria-label="`Foto de ${s.title}`"
                @change="onPhoto($event, s)"
              />
            </label>
            <button type="button" class="btn btn-ghost" :disabled="busy" @click="startEdit(s)">
              Editar
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="busy || i === 0"
              aria-label="Subir"
              @click="move(i, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="busy || i === slides.length - 1"
              aria-label="Bajar"
              @click="move(i, 1)"
            >
              ↓
            </button>
            <button type="button" class="btn btn-ghost" :disabled="busy" @click="remove(s)">
              Borrar
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.promos {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 820px;
}

.slides {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slide {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px 16px;
  align-items: center;
  padding: 12px;
}

.photo {
  width: 160px;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  background: var(--color-neutral-900);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.row-actions .btn {
  height: 32px;
  padding: 0 10px;
}

.upload {
  position: relative;
  cursor: pointer;
}

.upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>

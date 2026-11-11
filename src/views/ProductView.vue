<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { getProduct, type ProductDetail } from '@/api/catalog'
import { ApiError } from '@/api/http'
import AppIcon from '@/components/AppIcon.vue'
import ProductImage from '@/components/ProductImage.vue'
import { formatPrice, installmentsLabel } from '@/lib/commerce'
import { isPlatformHost } from '@/lib/platform'
import { useCartStore } from '@/stores/cart'
import { useFavoritesStore } from '@/stores/favorites'
import { useThemeStore } from '@/stores/theme'
import NotFoundView from './NotFoundView.vue'

const props = defineProps<{ slug: string }>()

const cart = useCartStore()
const theme = useThemeStore()
const favorites = useFavoritesStore()
// A platform admin's preview shows the product but offers no way to buy or save it.
const preview = isPlatformHost()

const product = ref<ProductDetail | null>(null)
const status = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const size = ref<string | null>(null)
const sizeError = ref(false)
const isFavorite = computed(() => favorites.isFavorite(props.slug))
// A grocery's product is sold by the pack: its one variant ("Unidad") is picked for the shopper and not shown. With
// several (say 500 g and 1 kg) they are shown as "Presentación", not as clothing sizes.
const sizeLabel = computed(() => (theme.isGrocery ? 'Presentación' : 'Talle'))
const hideSizes = computed(
  () => theme.isGrocery && product.value?.sizes.length === 1 && product.value.sizes[0]!.inStock,
)

// Main photo plus two detail shots; missing photos fall back to the empty image slot.
const gallery = computed(() => {
  const images = product.value?.images ?? []
  const name = product.value?.name ?? ''
  return [
    { image: images[0], alt: name, placeholder: 'Foto principal' },
    { image: images[1], alt: `${name}, detalle`, placeholder: 'Detalle' },
    { image: images[2], alt: `${name}, espalda`, placeholder: 'Espalda' },
  ]
})

let inflight: AbortController | undefined

async function load(slug: string) {
  inflight?.abort()
  const controller = (inflight = new AbortController())
  status.value = 'loading'
  sizeError.value = false
  try {
    const p = await getProduct(slug, controller.signal)
    product.value = p
    const available = p.sizes.filter((s) => s.inStock)
    size.value = p.sizes.length === 1 && available.length === 1 ? available[0]!.size : null
    status.value = 'ready'
  } catch (error) {
    if (controller.signal.aborted) return
    status.value = error instanceof ApiError && error.status === 404 ? 'not-found' : 'error'
  }
}

watch(() => props.slug, load, { immediate: true })

function selectSize(s: string) {
  size.value = s
  sizeError.value = false
}

function addToCart() {
  if (!product.value) return
  if (!size.value) {
    sizeError.value = true
    return
  }
  void cart.add(product.value, size.value)
}
</script>

<template>
  <NotFoundView v-if="status === 'not-found'" />
  <div v-else-if="status === 'error'" class="product">
    <div class="message">
      <span>No pudimos cargar este producto.</span>
      <button type="button" class="btn btn-ghost" @click="load(slug)">Reintentar</button>
    </div>
  </div>
  <div v-else-if="product && status === 'ready'" class="product">
    <div class="crumbs">
      <RouterLink :to="{ name: 'home' }">Tienda</RouterLink>
      <span>/</span><span>{{ product.categoryName }}</span
      ><span>/</span>
      <span class="current">{{ product.name }}</span>
    </div>

    <div class="layout">
      <div class="gallery">
        <div v-for="(g, i) in gallery" :key="g.placeholder" class="shot" :class="{ main: i === 0 }">
          <ProductImage
            :src="g.image?.url ?? null"
            :alt="g.image?.alt ?? g.alt"
            :placeholder="g.placeholder"
          />
        </div>
      </div>

      <div class="panel">
        <div class="intro">
          <span class="card-kicker">{{ product.categoryName }}</span>
          <h1>{{ product.name }}</h1>
          <span v-if="product.brand" class="brand">{{ product.brand }}</span>
          <span class="price">{{ formatPrice(product.price) }}</span>
          <span v-if="!theme.isGrocery" class="installments">{{
            installmentsLabel(product.price)
          }}</span>
        </div>
        <p class="desc">{{ product.description }}</p>
        <span v-if="!theme.isGrocery" class="color"
          >Color · <span>{{ product.color }}</span></span
        >

        <div v-if="!hideSizes" class="sizes">
          <div class="sizes-head">
            <span>{{ sizeLabel }}</span>
            <a v-if="!theme.isGrocery" href="#" @click.prevent>Guía de talles</a>
          </div>
          <div class="size-options" role="radiogroup" :aria-label="sizeLabel">
            <button
              v-for="s in product.sizes"
              :key="s.size"
              type="button"
              role="radio"
              :aria-checked="size === s.size"
              :disabled="!s.inStock"
              :title="s.inStock ? undefined : 'Sin stock'"
              :class="{ active: size === s.size, error: sizeError }"
              @click="selectSize(s.size)"
            >
              {{ s.size }}
            </button>
          </div>
          <span v-if="sizeError" class="size-error"
            >Elegí {{ theme.isGrocery ? 'una presentación' : 'un talle' }} para continuar.</span
          >
        </div>

        <p v-if="preview" class="preview-note">
          Vista previa de solo lectura: no se puede comprar.
        </p>
        <div v-else class="actions">
          <button type="button" class="btn btn-primary add" @click="addToCart">
            <AppIcon name="bag" :size="18" />Agregar al carrito
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-icon fav"
            :class="{ on: isFavorite }"
            aria-label="Favorito"
            :aria-pressed="isFavorite"
            @click="favorites.toggle(product.slug)"
          >
            <AppIcon name="heart" :size="18" :filled="isFavorite" />
          </button>
        </div>

        <div v-if="!theme.isGrocery" class="perks">
          <div><AppIcon name="truck" :size="18" />Envío gratis en todas las compras</div>
          <div><AppIcon name="return" :size="18" />Cambios gratis dentro de los 30 días</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product {
  max-width: 1280px;
  margin: 0 auto;
  padding: 8px clamp(16px, 4vw, 40px) 56px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.crumbs {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: var(--color-neutral-500);
  align-items: center;
}

.crumbs a {
  color: var(--color-neutral-400);
  text-decoration: none;
}

.crumbs .current {
  color: var(--color-text);
}

.layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  gap: clamp(24px, 4vw, 56px);
  align-items: start;
}

.gallery {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.shot {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
}

.shot.main {
  grid-column: 1 / -1;
  aspect-ratio: 4 / 5;
  border-radius: var(--radius-lg);
}

.panel {
  position: sticky;
  top: 80px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 480px;
}

.intro {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.intro h1 {
  margin: 0;
  font-size: clamp(28px, 3vw, 36px);
}

.price {
  font-size: 22px;
  font-weight: 500;
}

.installments {
  font-size: 12px;
  color: var(--color-neutral-500);
}

.desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-neutral-300);
  text-wrap: pretty;
}

.brand {
  font-size: 14px;
  color: var(--color-neutral-400);
}

.color {
  font-size: 13px;
  color: var(--color-neutral-400);
}

.color span {
  color: var(--color-text);
}

.sizes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sizes-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--color-neutral-400);
}

.sizes-head a {
  font-size: 12px;
}

.size-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.size-options button {
  min-width: 56px;
  height: 44px;
  padding: 0 12px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-divider);
}

.size-options button.error {
  border-color: var(--color-accent-700);
}

.size-options button.active {
  background: var(--color-accent-900);
  color: var(--color-accent-200);
  border-color: var(--color-accent);
}

/* Nocturne's disabled treatment (45% opacity), plus a strike-through so "sold out" doesn't rely on
   opacity alone. */
.size-options button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  text-decoration: line-through;
}

.message {
  padding: 40px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  font-size: 16px;
}

.size-error {
  font-size: 12px;
  color: var(--color-accent-300);
}

.actions {
  display: flex;
  gap: 8px;
}

.preview-note {
  margin: 0;
  font-size: 13px;
  color: var(--color-neutral-400);
}

.add {
  flex: 1;
  height: 48px;
  font-size: 15px;
}

.fav {
  width: 48px;
  height: 48px;
  color: var(--color-text);
}

.fav.on {
  color: var(--color-accent);
}

.perks {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  color: var(--color-neutral-400);
}

.perks div {
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>

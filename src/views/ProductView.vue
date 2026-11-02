<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { findProduct } from '@/catalog/products'
import AppIcon from '@/components/AppIcon.vue'
import ProductImage from '@/components/ProductImage.vue'
import { formatPrice, installmentsLabel } from '@/lib/commerce'
import { useCartStore } from '@/stores/cart'
import { useFavoritesStore } from '@/stores/favorites'
import NotFoundView from './NotFoundView.vue'

const props = defineProps<{ id: string }>()

const cart = useCartStore()
const favorites = useFavoritesStore()

const product = computed(() => findProduct(props.id))
const size = ref<string | null>(null)
const sizeError = ref(false)
const isFavorite = computed(() => favorites.isFavorite(props.id))

watch(
  product,
  (p) => {
    size.value = p?.sizes.length === 1 ? p.sizes[0]! : null
    sizeError.value = false
  },
  { immediate: true },
)

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
  cart.add(product.value, size.value)
}
</script>

<template>
  <NotFoundView v-if="!product" />
  <div v-else class="product">
    <div class="crumbs">
      <RouterLink :to="{ name: 'home' }">Tienda</RouterLink>
      <span>/</span><span>{{ product.category }}</span
      ><span>/</span>
      <span class="current">{{ product.name }}</span>
    </div>

    <div class="layout">
      <div class="gallery">
        <div class="shot main">
          <ProductImage :src="product.image" :alt="product.name" placeholder="Foto principal" />
        </div>
        <div class="shot">
          <ProductImage :src="null" :alt="`${product.name}, detalle`" placeholder="Detalle" />
        </div>
        <div class="shot">
          <ProductImage :src="null" :alt="`${product.name}, espalda`" placeholder="Espalda" />
        </div>
      </div>

      <div class="panel">
        <div class="intro">
          <span class="card-kicker">{{ product.category }}</span>
          <h1>{{ product.name }}</h1>
          <span class="price">{{ formatPrice(product.price) }}</span>
          <span class="installments">{{ installmentsLabel(product.price) }}</span>
        </div>
        <p class="desc">{{ product.description }}</p>
        <span class="color"
          >Color · <span>{{ product.color }}</span></span
        >

        <div class="sizes">
          <div class="sizes-head">
            <span>Talle</span>
            <a href="#" @click.prevent>Guía de talles</a>
          </div>
          <div class="size-options" role="radiogroup" aria-label="Talle">
            <button
              v-for="s in product.sizes"
              :key="s"
              type="button"
              role="radio"
              :aria-checked="size === s"
              :class="{ active: size === s, error: sizeError }"
              @click="selectSize(s)"
            >
              {{ s }}
            </button>
          </div>
          <span v-if="sizeError" class="size-error">Elegí un talle para continuar.</span>
        </div>

        <div class="actions">
          <button type="button" class="btn btn-primary add" @click="addToCart">
            <AppIcon name="bag" :size="18" />Agregar al carrito
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-icon fav"
            :class="{ on: isFavorite }"
            aria-label="Favorito"
            :aria-pressed="isFavorite"
            @click="favorites.toggle(product.id)"
          >
            <AppIcon name="heart" :size="18" :filled="isFavorite" />
          </button>
        </div>

        <div class="perks">
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

.size-error {
  font-size: 12px;
  color: var(--color-accent-300);
}

.actions {
  display: flex;
  gap: 8px;
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

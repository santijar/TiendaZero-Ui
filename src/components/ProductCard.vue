<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import type { ProductSummary } from '@/api/catalog'
import { formatPrice } from '@/lib/commerce'
import { useCartStore } from '@/stores/cart'
import { useFavoritesStore } from '@/stores/favorites'
import AppIcon from './AppIcon.vue'
import ProductImage from './ProductImage.vue'

const props = defineProps<{ product: ProductSummary }>()

const router = useRouter()
const cart = useCartStore()
const favorites = useFavoritesStore()

const singleSize = computed(() =>
  props.product.sizes.length === 1 ? props.product.sizes[0] : undefined,
)
const isFavorite = computed(() => favorites.isFavorite(props.product.slug))

function open() {
  router.push({ name: 'product', params: { slug: props.product.slug } })
}

function quickAdd() {
  if (singleSize.value) void cart.add(props.product, singleSize.value)
  else open()
}
</script>

<template>
  <div class="card-item" @click="open">
    <div class="media">
      <ProductImage :src="product.imageUrl" :alt="product.name" placeholder="Foto de producto" />
      <span v-if="product.badge" class="tag tag-accent badge">{{ product.badge }}</span>
      <button
        type="button"
        class="fav"
        :class="{ on: isFavorite }"
        aria-label="Favorito"
        :aria-pressed="isFavorite"
        @click.stop="favorites.toggle(product.slug)"
      >
        <AppIcon name="heart" :filled="isFavorite" />
      </button>
      <button type="button" class="btn btn-secondary quick" @click.stop="quickAdd">
        {{ singleSize ? 'Agregar al carrito' : 'Elegir talle' }}
      </button>
    </div>
    <div class="details">
      <RouterLink
        :to="{ name: 'product', params: { slug: product.slug } }"
        class="name"
        @click.stop
      >
        {{ product.name }}
      </RouterLink>
      <span class="meta">{{ product.categoryName }} · {{ product.color }}</span>
      <span class="price">{{ formatPrice(product.price) }}</span>
    </div>
  </div>
</template>

<style scoped>
.card-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
}

.media {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.media:hover {
  box-shadow: 0 0 0 1px var(--color-accent);
}

.badge {
  position: absolute;
  top: 10px;
  left: 10px;
}

.fav {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  cursor: pointer;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-bg) 70%, transparent);
  color: var(--color-text);
}

.fav.on {
  color: var(--color-accent);
}

.quick {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  height: 36px;
  background: color-mix(in srgb, var(--color-bg) 80%, transparent);
}

.quick:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: 14px;
  line-height: 1.3;
  color: var(--color-text);
  text-decoration: none;
}

.meta {
  font-size: 12px;
  color: var(--color-neutral-500);
}

.price {
  font-size: 15px;
  font-weight: 500;
  margin-top: 2px;
}
</style>

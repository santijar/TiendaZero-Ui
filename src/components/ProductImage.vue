<script setup lang="ts">
import AppIcon from './AppIcon.vue'

// Fills its positioned parent. Photos go through Nocturne's `.lighten` blend; products without a
// photo yet show the prototype's empty image-slot treatment.
defineProps<{ src: string | null; alt: string; placeholder: string }>()
</script>

<template>
  <div class="lighten product-image">
    <img v-if="src" :src="src" :alt="alt" />
    <div v-else class="empty" role="img" :aria-label="alt">
      <AppIcon name="image" :size="22" />
      <span>{{ placeholder }}</span>
    </div>
  </div>
</template>

<style scoped>
.product-image {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

img {
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
}

.empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  text-align: center;
  font-size: 13px;
  line-height: 1.3;
  font-weight: 500;
  letter-spacing: 0.01em;
  background: rgba(127, 127, 127, 0.08);
}

.empty span {
  opacity: 0.75;
}

.empty svg {
  opacity: 0.45;
}
</style>

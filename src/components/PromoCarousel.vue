<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { ALL_CATEGORY, PROMO_SLIDES } from '@/catalog/products'
import { useCatalogStore } from '@/stores/catalog'
import AppIcon from './AppIcon.vue'

const AUTOPLAY_MS = 6000

const catalog = useCatalogStore()
const current = ref(0)
const slide = computed(() => PROMO_SLIDES[current.value]!)
let timer: ReturnType<typeof setInterval> | undefined

function startAutoplay() {
  clearInterval(timer)
  timer = setInterval(
    () => (current.value = (current.value + 1) % PROMO_SLIDES.length),
    AUTOPLAY_MS,
  )
}

function select(index: number) {
  current.value = (index + PROMO_SLIDES.length) % PROMO_SLIDES.length
  startAutoplay()
}

onMounted(startAutoplay)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <section class="promo" aria-roledescription="carrusel">
    <div class="lighten photos">
      <img
        v-for="(s, i) in PROMO_SLIDES"
        :key="s.alt"
        :src="s.image"
        :alt="s.alt"
        :style="{ opacity: i === current ? 1 : 0 }"
      />
    </div>
    <div class="fade" />
    <div class="content">
      <div class="copy">
        <span class="card-kicker kicker">{{ slide.kicker }}</span>
        <span class="title">{{ slide.title }}</span>
        <div class="ctas">
          <button type="button" class="btn btn-primary" @click="catalog.category = slide.category">
            {{ slide.cta }}
          </button>
          <button type="button" class="btn btn-secondary" @click="catalog.category = ALL_CATEGORY">
            Toda la tienda
          </button>
        </div>
      </div>
      <div class="controls">
        <button
          type="button"
          class="btn btn-secondary btn-icon round"
          aria-label="Anterior"
          @click="select(current - 1)"
        >
          <AppIcon name="caret-left" />
        </button>
        <div class="dots">
          <button
            v-for="(s, i) in PROMO_SLIDES"
            :key="s.alt"
            type="button"
            :aria-label="s.title"
            :class="{ active: i === current }"
            @click="select(i)"
          />
        </div>
        <button
          type="button"
          class="btn btn-secondary btn-icon round"
          aria-label="Siguiente"
          @click="select(current + 1)"
        >
          <AppIcon name="caret-right" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.promo {
  position: relative;
  aspect-ratio: 16 / 7;
  min-height: 320px;
  max-height: 560px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface);
}

.photos {
  position: absolute;
  inset: 0;
}

.photos img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  object-position: center 45%;
  transition: opacity 700ms ease;
}

.fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    0deg,
    var(--color-bg) 0%,
    color-mix(in srgb, var(--color-bg) 60%, transparent) 30%,
    transparent 58%
  );
  pointer-events: none;
}

.content {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: clamp(18px, 3vw, 32px);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.kicker {
  color: var(--color-accent-300);
  font-size: 11px;
}

.title {
  font-size: clamp(22px, 2.6vw, 30px);
  font-weight: 500;
  letter-spacing: -0.015em;
  line-height: 1.1;
}

.ctas {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.ctas .btn {
  height: 40px;
  background: color-mix(in srgb, var(--color-bg) 60%, transparent);
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.round {
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-bg) 60%, transparent);
}

.dots {
  display: flex;
  gap: 6px;
}

.dots button {
  height: 3px;
  width: 8px;
  padding: 0;
  border: 0;
  border-radius: 2px;
  cursor: pointer;
  transition: width 300ms ease;
  background: var(--color-neutral-400);
}

.dots button.active {
  width: 22px;
  background: var(--color-accent);
}
</style>

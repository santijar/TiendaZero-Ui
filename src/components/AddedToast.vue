<script setup lang="ts">
import { useCartStore } from '@/stores/cart'
import AppIcon from './AppIcon.vue'

const cart = useCartStore()
</script>

<template>
  <div v-if="cart.toast" class="toast" role="status">
    <AppIcon name="check" :stroke-width="20" class="check" />
    <span>{{ cart.toast }}</span>
    <button type="button" class="btn btn-ghost" @click="cart.open">Ver carrito</button>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 15;
  max-width: calc(100% - 48px);
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.check {
  flex: none;
  color: var(--color-accent);
}
</style>

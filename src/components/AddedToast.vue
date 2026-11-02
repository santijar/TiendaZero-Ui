<script setup lang="ts">
import { useCartStore } from '@/stores/cart'
import AppIcon from './AppIcon.vue'

const cart = useCartStore()
</script>

<template>
  <div v-if="cart.toast" class="toast" :role="cart.toast.kind === 'error' ? 'alert' : 'status'">
    <AppIcon
      :name="cart.toast.kind === 'error' ? 'x' : 'check'"
      :stroke-width="20"
      class="icon"
      :class="cart.toast.kind"
    />
    <span>{{ cart.toast.message }}</span>
    <button
      v-if="cart.toast.kind === 'success'"
      type="button"
      class="btn btn-ghost"
      @click="cart.open"
    >
      Ver carrito
    </button>
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

.icon {
  flex: none;
  color: var(--color-accent);
}

/* Same deep accent step the design uses for inline errors ("Elegí un talle…"). */
.icon.error {
  color: var(--color-accent-300);
}
</style>

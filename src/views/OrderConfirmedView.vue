<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useOrderStore } from '@/stores/order'

const router = useRouter()
const catalog = useCatalogStore()
const orders = useOrderStore()

function keepShopping() {
  catalog.setFilter({})
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="done">
    <div class="badge"><AppIcon name="check" :size="28" :stroke-width="18" /></div>
    <h1>¡Pedido confirmado!</h1>
    <p>
      Te enviamos el detalle a {{ orders.lastOrder?.email || 'tu email' }}. Número de pedido
      <span>{{ orders.lastOrder?.orderNumber }}</span
      >.
    </p>
    <button type="button" class="btn btn-primary" @click="keepShopping">Seguir comprando</button>
  </div>
</template>

<style scoped>
.done {
  max-width: 1280px;
  margin: 0 auto;
  padding: clamp(48px, 10vw, 120px) clamp(16px, 4vw, 40px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.badge {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 1px solid var(--color-accent);
  display: grid;
  place-items: center;
  color: var(--color-accent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--color-accent) 40%, transparent);
}

h1 {
  margin: 0;
}

p {
  margin: 0;
  font-size: 15px;
  color: var(--color-neutral-300);
  max-width: 480px;
  text-wrap: pretty;
}

p span {
  color: var(--color-text);
}

.btn {
  margin-top: 8px;
  height: 40px;
}
</style>

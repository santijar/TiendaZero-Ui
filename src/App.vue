<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import AddedToast from '@/components/AddedToast.vue'
import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'
import CartDrawer from '@/components/CartDrawer.vue'
import { useCartStore } from '@/stores/cart'
import { useCatalogStore } from '@/stores/catalog'

const catalog = useCatalogStore()

onMounted(() => {
  // Without categories the header only offers "Todo"; the store still works, so don't block on it.
  catalog.loadTaxonomy().catch(() => {})
  void catalog.loadProducts()
  void useCartStore().ensureLoaded()
})
</script>

<template>
  <div class="shell">
    <AppHeader />
    <main>
      <RouterView />
    </main>
    <AppFooter />
    <CartDrawer />
    <AddedToast />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--font-body);
  color: var(--color-text);
  background-image: radial-gradient(80% 40% at 0% 0%, var(--color-accent-900), transparent 70%);
}

main {
  flex: 1;
}
</style>

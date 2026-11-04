<script setup lang="ts">
import { watch } from 'vue'
import { RouterView } from 'vue-router'

import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'
import { useCatalogStore } from '@/stores/catalog'
import { usePlatformStore } from '@/stores/platform'
import PlatformTenantBar from './PlatformTenantBar.vue'

const platform = usePlatformStore()
const catalog = useCatalogStore()

// A different store means a different catalog: start its storefront from a clean slate.
async function reload() {
  catalog.setFilter({})
  catalog.query = ''
  catalog.sort = 'featured'
  await catalog.loadTaxonomy().catch(() => {})
  await catalog.loadProducts()
}

watch(
  () => [platform.isSignedIn, platform.previewSlug] as const,
  ([signedIn, slug]) => {
    if (signedIn && slug) void reload()
  },
  { immediate: true },
)
</script>

<template>
  <template v-if="platform.isSignedIn">
    <PlatformTenantBar />
    <!-- Keyed by the store, so switching rebuilds everything below it. -->
    <div :key="platform.previewSlug ?? ''" class="shell">
      <AppHeader />
      <main>
        <p v-if="platform.tenants.length === 0" class="empty" role="alert">
          No pudimos cargar las tiendas.
        </p>
        <RouterView v-else />
      </main>
      <AppFooter />
    </div>
  </template>
  <RouterView v-else />
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

.empty {
  max-width: 1280px;
  margin: 0 auto;
  padding: 40px clamp(16px, 4vw, 40px);
  color: var(--color-neutral-400);
}
</style>

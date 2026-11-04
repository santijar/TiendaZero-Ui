<script setup lang="ts">
import { useRouter } from 'vue-router'

import { usePlatformStore } from '@/stores/platform'

const platform = usePlatformStore()
const router = useRouter()

async function signOut() {
  await platform.signOut()
  await router.replace({ name: 'platform-login' })
}
</script>

<template>
  <div class="tenant-bar">
    <div class="inner">
      <span class="label">Tienda</span>
      <div class="pills" role="group" aria-label="Tienda a previsualizar">
        <button
          v-for="t in platform.tenants"
          :key="t.slug"
          type="button"
          class="tenant-pill"
          :class="{ active: t.slug === platform.previewSlug }"
          :aria-pressed="t.slug === platform.previewSlug"
          @click="platform.select(t.slug)"
        >
          {{ t.name }}<small v-if="t.status === 'Suspended'"> · suspendida</small>
        </button>
      </div>
      <span class="mode">Vista previa · solo lectura</span>
      <span class="domain">{{ platform.previewing?.primaryDomain }}</span>
      <span class="who">{{ platform.user?.email }}</span>
      <button type="button" class="out" @click="signOut">Salir</button>
    </div>
  </div>
</template>

<style scoped>
/* The mock's tenant-switcher bar, made a real tool for platform admins. */
.tenant-bar {
  background: var(--color-neutral-900);
  font-size: 12px;
}

.inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 6px clamp(16px, 4vw, 40px);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.label,
.mode {
  color: var(--color-neutral-400);
}

.pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tenant-pill {
  font: inherit;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  background: transparent;
  color: var(--color-neutral-300);
  border: 1px solid var(--color-divider);
}

.tenant-pill.active {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.domain {
  margin-left: auto;
  color: var(--color-neutral-500);
}

.who {
  color: var(--color-neutral-400);
}

.out {
  font: inherit;
  font-size: 12px;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: var(--color-accent);
}
</style>

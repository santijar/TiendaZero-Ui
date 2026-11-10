<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

import '@/assets/admin.css'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const auth = useAuthStore()

const LINKS = [
  { to: { name: 'admin-orders' }, label: 'Pedidos' },
  { to: { name: 'admin-products' }, label: 'Productos' },
  { to: { name: 'admin-taxonomy' }, label: 'Categorías y colecciones' },
  { to: { name: 'admin-theme' }, label: 'Marca' },
  { to: { name: 'admin-promos' }, label: 'Promociones' },
  { to: { name: 'admin-payments' }, label: 'Pagos' },
  { to: { name: 'admin-pickup' }, label: 'Retiro' },
  { to: { name: 'admin-domains' }, label: 'Dominios' },
]
const theme = useThemeStore()
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-nav">
      <RouterLink :to="{ name: 'admin-orders' }" class="admin-brand">
        <span>{{ theme.theme?.storeName }} · Admin</span>
      </RouterLink>
      <nav>
        <RouterLink v-for="l in LINKS" :key="l.label" :to="l.to" class="admin-link">
          {{ l.label }}
        </RouterLink>
      </nav>
      <div class="admin-foot">
        <span class="admin-user">{{ auth.user?.email }}</span>
        <RouterLink :to="{ name: 'home' }" class="btn btn-ghost">Ver la tienda</RouterLink>
      </div>
    </aside>
    <main class="admin-main">
      <!-- Keyed by route and params (not the query), so e.g. a newly created product's page loads
      fresh, while typing in a list's search box doesn't remount it. -->
      <RouterView v-slot="{ Component, route }">
        <component :is="Component" :key="`${String(route.name)}:${JSON.stringify(route.params)}`" />
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  font-family: var(--font-body);
  color: var(--color-text);
  background: var(--color-bg);
}

.admin-nav {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 14px;
  border-right: 1px solid var(--color-divider);
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
  color: var(--color-neutral-400);
  font-size: 13px;
  text-decoration: none;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-link {
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--color-neutral-300);
  text-decoration: none;
}

.admin-link:hover {
  color: var(--color-text);
}

.admin-link.router-link-active {
  color: var(--color-text);
  box-shadow: inset 2px 0 0 var(--color-accent);
}

.admin-foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 0 8px;
}

.admin-user {
  font-size: 12px;
  color: var(--color-neutral-500);
  overflow-wrap: anywhere;
}

.admin-main {
  min-width: 0;
  padding: 28px clamp(16px, 3vw, 40px) 56px;
}

@media (max-width: 760px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }

  .admin-nav {
    position: static;
    height: auto;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    border-right: none;
    border-bottom: 1px solid var(--color-divider);
  }

  nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .admin-foot {
    margin-top: 0;
    margin-left: auto;
  }
}
</style>

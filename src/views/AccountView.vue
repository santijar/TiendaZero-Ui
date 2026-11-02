<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '@/api/http'
import { getMyOrders, type OrderSummary } from '@/api/orders'
import ProductCard from '@/components/ProductCard.vue'
import { formatPrice, productCountLabel } from '@/lib/commerce'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'

const auth = useAuthStore()
const favorites = useFavoritesStore()
const router = useRouter()

const name = ref(auth.user?.name ?? '')
const nameStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const nameError = ref<string | null>(null)
const favoritesFailed = ref(false)
const orders = ref<OrderSummary[] | null>(null)
const ordersFailed = ref(false)

const STATUS_LABELS: Record<OrderSummary['status'], string> = {
  pending: 'Pendiente de pago',
  paid: 'Pagado',
  expired: 'Vencido',
}

function orderDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

onMounted(() => {
  favorites.load().catch(() => (favoritesFailed.value = true))
  getMyOrders()
    .then((list) => (orders.value = list))
    .catch(() => (ordersFailed.value = true))
})

async function saveName() {
  nameError.value = null
  nameStatus.value = 'saving'
  try {
    await auth.saveName(name.value.trim())
    nameStatus.value = 'saved'
  } catch (e) {
    nameError.value =
      (e instanceof ApiError && e.fieldError('name')) || 'No pudimos guardar el nombre.'
    nameStatus.value = 'idle'
  }
}

async function signOut() {
  await auth.signOut()
  await router.push({ name: 'home' })
}
</script>

<template>
  <div class="account">
    <div class="head">
      <h1>Mi cuenta</h1>
      <button type="button" class="btn btn-ghost" @click="signOut">Cerrar sesión</button>
    </div>

    <section class="section">
      <h6>Datos</h6>
      <form class="profile" novalidate @submit.prevent="saveName">
        <div class="field">
          <label for="acc-name">Nombre y apellido</label>
          <input
            id="acc-name"
            v-model="name"
            class="input"
            autocomplete="name"
            @input="nameStatus = 'idle'"
          />
        </div>
        <button
          type="submit"
          class="btn btn-secondary save"
          :disabled="nameStatus === 'saving' || name.trim() === auth.user?.name"
        >
          {{ nameStatus === 'saved' ? 'Guardado' : 'Guardar' }}
        </button>
      </form>
      <span v-if="nameError" class="form-error" role="alert">{{ nameError }}</span>
      <div class="field email">
        <label>Email</label>
        <span>{{ auth.user?.email }}</span>
      </div>
    </section>

    <section class="section">
      <h6>Pedidos</h6>
      <span v-if="ordersFailed" class="form-note">No pudimos cargar tus pedidos.</span>
      <span v-else-if="orders && orders.length === 0" class="form-note">
        Todavía no hiciste pedidos.
      </span>
      <ul v-else-if="orders" class="orders">
        <li v-for="o in orders" :key="o.number">
          <RouterLink :to="{ name: 'order', params: { number: o.number } }" class="card order">
            <span class="order-number">{{ o.number }}</span>
            <span class="order-status" :class="o.status">{{ STATUS_LABELS[o.status] }}</span>
            <span class="order-meta">
              {{ orderDate(o.createdAt) }} · {{ productCountLabel(o.itemCount) }}
            </span>
            <span class="order-total">{{ formatPrice(o.total) }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <section class="section">
      <h6>Favoritos</h6>
      <span v-if="favoritesFailed" class="form-note">No pudimos cargar tus favoritos.</span>
      <div v-else-if="favorites.items.length === 0" class="empty">
        <span class="form-note">Todavía no guardaste favoritos.</span>
        <RouterLink :to="{ name: 'home' }" class="btn btn-ghost">Ir a la tienda</RouterLink>
      </div>
      <div v-else class="grid">
        <ProductCard v-for="p in favorites.items" :key="p.slug" :product="p" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.account {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px clamp(16px, 4vw, 40px) 56px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.head h1 {
  margin: 0;
  font-size: 32px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section h6 {
  margin: 0;
  color: var(--color-neutral-400);
}

.profile {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 480px;
}

.profile .field {
  flex: 1;
}

.save {
  height: 36px;
}

.email span {
  font-size: 14px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.orders {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 640px;
}

.order {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 16px;
  padding: 12px 14px;
  color: inherit;
  text-decoration: none;
}

.order:hover {
  border-color: var(--color-accent);
}

.order-number,
.order-total {
  font-size: 14px;
}

.order-meta,
.order-status {
  font-size: 12px;
  color: var(--color-neutral-400);
}

.order-status,
.order-total {
  text-align: right;
}

.order-status.paid {
  color: var(--color-accent-300);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 28px 18px;
}
</style>

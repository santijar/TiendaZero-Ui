<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getOrders, type AdminOrderRow, type OrderFilters } from '@/api/admin'
import { formatPrice } from '@/lib/commerce'
import { FULFILLMENT_LABELS, PAYMENT_LABELS, STATUS_LABELS, formatDate } from '@/lib/orderLabels'

const route = useRoute()
const router = useRouter()

// Filters live in the query string, so a filtered list can be reloaded or linked.
const filters = reactive<Required<Omit<OrderFilters, 'page'>>>({
  q: typeof route.query.q === 'string' ? route.query.q : '',
  status: (route.query.status as OrderFilters['status']) ?? '',
  fulfillment: route.query.fulfillment === 'open' ? 'open' : '',
  review: route.query.review === 'true',
})
const page = ref(Number(route.query.page) || 1)
const rows = ref<AdminOrderRow[]>([])
const total = ref(0)
const pageSize = ref(50)
const state = ref<'loading' | 'ready' | 'error'>('loading')

const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function load() {
  state.value = 'loading'
  try {
    const result = await getOrders({ ...filters, page: page.value })
    rows.value = result.items
    total.value = result.total
    pageSize.value = result.pageSize
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => ({ ...filters }),
  (now, before) => {
    page.value = 1
    clearTimeout(searchTimer)
    // Typing in the search box waits a moment; the other filters apply at once.
    searchTimer = setTimeout(apply, now.q !== before.q ? 300 : 0)
  },
)

function apply() {
  void router.replace({
    query: {
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.fulfillment ? { fulfillment: filters.fulfillment } : {}),
      ...(filters.review ? { review: 'true' } : {}),
      ...(page.value > 1 ? { page: String(page.value) } : {}),
    },
  })
  void load()
}

function goTo(p: number) {
  page.value = p
  apply()
}

function open(number: string) {
  void router.push({ name: 'admin-order', params: { number } })
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Pedidos</h1>
    </div>

    <div class="admin-toolbar">
      <input
        v-model.trim="filters.q"
        class="input"
        type="search"
        placeholder="Número, email o nombre"
        aria-label="Buscar pedidos"
      />
      <select v-model="filters.status" class="input" aria-label="Estado del pago">
        <option value="">Todos los pagos</option>
        <option value="pending">Pendientes de pago</option>
        <option value="paid">Pagados</option>
        <option value="expired">Vencidos</option>
      </select>
      <label class="admin-check">
        <input v-model="filters.fulfillment" type="checkbox" true-value="open" false-value="" />
        Por despachar
      </label>
      <label class="admin-check">
        <input v-model="filters.review" type="checkbox" />
        Necesitan revisión
      </label>
    </div>

    <p v-if="state === 'error'" class="form-error">No pudimos cargar los pedidos.</p>
    <p v-else-if="state === 'ready' && rows.length === 0" class="form-note">
      No hay pedidos con estos filtros.
    </p>
    <div v-else class="admin-table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Pago</th>
            <th>Envío</th>
            <th class="admin-num">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="o in rows"
            :key="o.number"
            data-link
            tabindex="0"
            @click="open(o.number)"
            @keydown.enter="open(o.number)"
          >
            <td>
              <RouterLink :to="{ name: 'admin-order', params: { number: o.number } }" @click.stop>
                {{ o.number }}
              </RouterLink>
              <span v-if="o.needsReview" class="tag tag-accent review">Revisar</span>
            </td>
            <td>{{ formatDate(o.createdAt, true) }}</td>
            <td>
              {{ o.customerName }}
              <div class="admin-muted">{{ o.email }}</div>
            </td>
            <td>
              {{ STATUS_LABELS[o.status] }}
              <div class="admin-muted">{{ PAYMENT_LABELS[o.paymentMethod] }}</div>
            </td>
            <td>{{ o.status === 'paid' ? FULFILLMENT_LABELS[o.fulfillment] : '—' }}</td>
            <td class="admin-num">
              {{ formatPrice(o.total) }}
              <div class="admin-muted">{{ o.itemCount }} u.</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pages > 1" class="admin-pager">
      <button type="button" class="btn btn-ghost" :disabled="page <= 1" @click="goTo(page - 1)">
        Anterior
      </button>
      <span>Página {{ page }} de {{ pages }} · {{ total }} pedidos</span>
      <button type="button" class="btn btn-ghost" :disabled="page >= pages" @click="goTo(page + 1)">
        Siguiente
      </button>
    </div>
  </div>
</template>

<style scoped>
.review {
  margin-left: 8px;
}

td a {
  color: var(--color-text);
}
</style>

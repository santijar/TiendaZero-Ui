<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  getAdminOrder,
  markPaid,
  resolveReview,
  updateFulfillment,
  type AdminOrder,
  type Fulfillment,
} from '@/api/admin'
import { ApiError } from '@/api/http'
import { formatPrice } from '@/lib/commerce'
import { FULFILLMENT_LABELS, PAYMENT_LABELS, STATUS_LABELS, formatDate } from '@/lib/orderLabels'

const props = defineProps<{ number: string }>()

const data = ref<AdminOrder | null>(null)
const state = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const busy = ref(false)
const actionError = ref<string | null>(null)
const tracking = ref('')
const reviewNote = ref('')

const order = computed(() => data.value?.order ?? null)

async function load() {
  try {
    data.value = await getAdminOrder(props.number)
    tracking.value = data.value.order.trackingInfo ?? ''
    state.value = 'ready'
  } catch (e) {
    state.value = e instanceof ApiError && e.status === 404 ? 'not-found' : 'error'
  }
}

// Runs an action that returns the updated order; the shopper is emailed by the Api where it applies.
async function act(action: () => Promise<AdminOrder>, confirmText?: string) {
  if (confirmText && !window.confirm(confirmText)) return
  busy.value = true
  actionError.value = null
  try {
    data.value = await action()
  } catch (e) {
    actionError.value =
      (e instanceof ApiError &&
        (e.problem?.detail ?? Object.values(e.problem?.errors ?? {})[0]?.[0])) ||
      'No pudimos guardar el cambio. Probá de nuevo.'
  } finally {
    busy.value = false
  }
}

const confirmPaid = () =>
  act(
    () => markPaid(props.number),
    `¿Confirmás que recibiste la transferencia de ${formatPrice(order.value!.total)}? Le avisamos al cliente por email.`,
  )

const advance = (status: Fulfillment) =>
  act(() =>
    updateFulfillment(props.number, status, status === 'shipped' ? tracking.value : undefined),
  )

const resolve = () =>
  act(async () => {
    const updated = await resolveReview(props.number, reviewNote.value)
    reviewNote.value = ''
    return updated
  })

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <div>
      <RouterLink :to="{ name: 'admin-orders' }" class="btn btn-ghost">← Pedidos</RouterLink>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'not-found'" class="form-note">No existe el pedido {{ number }}.</p>
    <p v-else-if="state === 'error' || !data || !order" class="form-error">
      No pudimos cargar el pedido.
    </p>

    <template v-else>
      <div class="admin-head">
        <h1>Pedido {{ order.number }}</h1>
        <div class="admin-actions">
          <span class="tag tag-outline">{{ STATUS_LABELS[order.status] }}</span>
          <span v-if="order.status === 'paid'" class="tag tag-neutral">
            {{ FULFILLMENT_LABELS[order.fulfillment] }}
          </span>
        </div>
      </div>

      <span v-if="actionError" class="form-error" role="alert">{{ actionError }}</span>

      <section
        v-if="data.needsReview || data.reviewNotes"
        class="card admin-section"
        :class="{ 'admin-review': data.needsReview }"
      >
        <h2>{{ data.needsReview ? 'Necesita revisión' : 'Notas de revisión' }}</h2>
        <p class="notes">{{ data.reviewNotes }}</p>
        <template v-if="data.needsReview">
          <div class="field">
            <label for="review-note">Qué se hizo (opcional)</label>
            <input
              id="review-note"
              v-model="reviewNote"
              class="input"
              placeholder="Ej.: reintegrado el pago duplicado"
            />
          </div>
          <div class="admin-actions">
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="resolve">
              Marcar como resuelto
            </button>
          </div>
        </template>
      </section>

      <div class="admin-grid">
        <section class="card admin-section">
          <h2>Pago</h2>
          <dl class="facts">
            <div>
              <dt>Medio</dt>
              <dd>{{ PAYMENT_LABELS[order.paymentMethod] }}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{{ STATUS_LABELS[order.status] }}</dd>
            </div>
            <div v-if="order.paidAt">
              <dt>Pagado</dt>
              <dd>{{ formatDate(order.paidAt, true) }}</dd>
            </div>
            <div v-else-if="order.status === 'pending'">
              <dt>Reserva hasta</dt>
              <dd>{{ formatDate(order.expiresAt, true) }}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{{ formatPrice(order.total) }}</dd>
            </div>
          </dl>
          <ul v-if="data.payments.length" class="payments">
            <li v-for="p in data.payments" :key="p.provider + p.providerPaymentId">
              {{ p.provider }} {{ p.providerPaymentId }} · {{ p.status }}
              <span class="admin-muted"
                >{{ formatPrice(p.amount) }} · {{ formatDate(p.updatedAt, true) }}</span
              >
            </li>
          </ul>
          <div v-if="data.canMarkPaid" class="admin-actions">
            <button type="button" class="btn btn-primary" :disabled="busy" @click="confirmPaid">
              Recibí la transferencia
            </button>
          </div>
          <p v-if="data.canMarkPaid && order.status === 'expired'" class="admin-muted">
            El pedido venció: si todavía hay stock, se vuelve a reservar al confirmarlo.
          </p>
        </section>

        <section class="card admin-section">
          <h2>Envío</h2>
          <dl class="facts">
            <div>
              <dt>Entrega</dt>
              <dd>{{ order.delivery === 'pickup' ? 'Retiro en local' : 'Envío a domicilio' }}</dd>
            </div>
            <div v-if="order.shippingAddress">
              <dt>Dirección</dt>
              <dd>{{ order.shippingAddress.street }} ({{ order.shippingAddress.postalCode }})</dd>
            </div>
            <div v-if="order.status === 'paid'">
              <dt>Estado</dt>
              <dd>{{ FULFILLMENT_LABELS[order.fulfillment] }}</dd>
            </div>
            <div v-if="order.trackingInfo">
              <dt>Seguimiento</dt>
              <dd>{{ order.trackingInfo }}</dd>
            </div>
          </dl>
          <template v-if="data.nextFulfillment.length">
            <div v-if="data.nextFulfillment.includes('shipped')" class="field">
              <label for="tracking">Seguimiento (opcional)</label>
              <input
                id="tracking"
                v-model="tracking"
                class="input"
                placeholder="Ej.: Andreani 3600012345"
              />
            </div>
            <div class="admin-actions">
              <button
                v-for="(next, i) in data.nextFulfillment"
                :key="next"
                type="button"
                class="btn"
                :class="i === 0 ? 'btn-primary' : 'btn-ghost'"
                :disabled="busy"
                @click="advance(next)"
              >
                {{ FULFILLMENT_LABELS[next] }}
              </button>
            </div>
            <p class="admin-muted">Cada cambio le avisa al cliente por email.</p>
          </template>
          <p v-else-if="order.status !== 'paid'" class="admin-muted">
            Se puede preparar cuando el pedido esté pago.
          </p>
        </section>

        <section class="card admin-section">
          <h2>Cliente</h2>
          <dl class="facts">
            <div>
              <dt>Nombre</dt>
              <dd>{{ order.customerName }}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a :href="`mailto:${order.email}`">{{ order.email }}</a>
              </dd>
            </div>
            <div>
              <dt>Cuenta</dt>
              <dd>{{ data.signedIn ? 'Con cuenta' : 'Invitado' }}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{{ formatDate(order.createdAt, true) }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section class="card admin-section">
        <h2>Productos</h2>
        <div class="admin-table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Talle</th>
                <th class="admin-num">Cantidad</th>
                <th class="admin-num">Precio</th>
                <th class="admin-num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in order.lines" :key="l.productSlug + l.size">
                <td>
                  {{ l.name }} <span class="admin-muted">{{ l.color }}</span>
                </td>
                <td>{{ l.size }}</td>
                <td class="admin-num">{{ l.quantity }}</td>
                <td class="admin-num">{{ formatPrice(l.unitPrice) }}</td>
                <td class="admin-num">{{ formatPrice(l.lineTotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl class="facts totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{{ formatPrice(order.subtotal) }}</dd>
          </div>
          <div v-if="order.discount > 0">
            <dt>Descuento transferencia</dt>
            <dd>− {{ formatPrice(order.discount) }}</dd>
          </div>
          <div>
            <dt>Envío</dt>
            <dd>{{ order.shippingCost ? formatPrice(order.shippingCost) : 'Gratis' }}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{{ formatPrice(order.total) }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>

<style scoped>
.facts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.facts div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.facts dt {
  color: var(--color-neutral-400);
}

.facts dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.facts a {
  color: inherit;
}

.totals {
  max-width: 320px;
  margin-left: auto;
}

.notes {
  margin: 0;
  font-size: 13px;
  white-space: pre-line;
  color: var(--color-neutral-300);
}

.payments {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.payments .admin-muted {
  display: block;
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/http'
import { getOrder, startCheckout, syncOrder, type Order } from '@/api/orders'
import AppIcon from '@/components/AppIcon.vue'
import ProductImage from '@/components/ProductImage.vue'
import { formatPrice, productCountLabel } from '@/lib/commerce'
import { leaveTo } from '@/lib/navigation'
import { orderToken, rememberOrderToken } from '@/lib/orderAccess'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'

// The order's page: /pedido/:number. Opened from the emailed link (?token=…), after checkout, and
// on the way back from Mercado Pago, which appends its own query (payment_id, status, …). Those
// only signal "check now": the order's state always comes from the Api.
const props = defineProps<{ number: string }>()

const POLL_MS = 4000
const POLL_TRIES = 15

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()

const order = ref<Order | null>(null)
const state = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const paying = ref(false)
const payError = ref<string | null>(null)
const waiting = ref(false)
let token: string | null = null
let pollTimer: ReturnType<typeof setTimeout> | undefined
let unmounted = false

const itemCount = computed(() => order.value?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0)
const deadline = computed(() =>
  order.value
    ? new Date(order.value.expiresAt).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
)
const paymentNote = computed(() => {
  switch (order.value?.lastPaymentStatus) {
    case 'rejected':
    case 'cancelled':
      return 'El pago no se aprobó. Podés intentarlo de nuevo con otro medio.'
    case 'in_process':
    case 'pending':
    case 'authorized':
      return 'Mercado Pago está procesando tu pago. Te avisamos por email apenas se acredite.'
    default:
      return null
  }
})

// A paid order's way to the shopper, as the store moves it along.
const fulfillmentSteps = computed(() => [
  { key: 'paid', label: 'Pagado' },
  { key: 'preparing', label: 'Preparando' },
  order.value?.delivery === 'pickup'
    ? { key: 'ready-for-pickup', label: 'Listo para retirar' }
    : { key: 'shipped', label: 'En camino' },
  { key: 'delivered', label: 'Entregado' },
])
const fulfillmentAt = computed(() => {
  const at = fulfillmentSteps.value.findIndex((s) => s.key === order.value?.fulfillment)
  return at < 0 ? 0 : at
})
const fulfillmentTitle = computed(() => {
  switch (order.value?.fulfillment) {
    case 'preparing':
      return 'Estamos preparando tu pedido'
    case 'shipped':
      return 'Tu pedido está en camino'
    case 'ready-for-pickup':
      return 'Tu pedido está listo para retirar'
    case 'delivered':
      return '¡Pedido entregado!'
    default:
      return '¡Pedido confirmado!'
  }
})

function stillWaitingOnMercadoPago(o: Order) {
  return o.status === 'pending' && o.paymentMethod === 'mercadopago'
}

async function load() {
  // The emailed link's token is kept for later visits, then dropped from the address bar.
  const { token: fromQuery, ...rest } = route.query
  if (typeof fromQuery === 'string' && fromQuery) {
    rememberOrderToken(props.number, fromQuery)
    void router.replace({ query: rest })
  }
  token = orderToken(props.number)
  const returningFromMercadoPago = 'payment_id' in rest || 'collection_status' in rest

  await auth.ready()
  try {
    order.value = await getOrder(props.number, token)
    state.value = 'ready'
  } catch (e) {
    state.value = e instanceof ApiError && e.status === 404 ? 'not-found' : 'error'
    return
  }

  if (returningFromMercadoPago) {
    // Drop Mercado Pago's query so a reload doesn't look like another return.
    void router.replace({ query: {} })
  }
  // Mercado Pago doesn't always bring the shopper back (it offers no way back to a non-public
  // address, and shoppers close tabs), and webhooks can lag. So an unpaid Mercado Pago order is
  // checked every time its page opens, however the shopper got here.
  if (stillWaitingOnMercadoPago(order.value)) {
    await refresh()
    if (returningFromMercadoPago && stillWaitingOnMercadoPago(order.value)) poll(POLL_TRIES)
  }
}

// After the shopper pays, Mercado Pago can take a moment to report the payment approved.
function poll(triesLeft: number) {
  waiting.value = true
  pollTimer = setTimeout(async () => {
    if (unmounted) return
    try {
      order.value = await syncOrder(props.number, token)
    } catch {
      // Keep showing what we know.
    }
    if (order.value && stillWaitingOnMercadoPago(order.value) && triesLeft > 1) poll(triesLeft - 1)
    else waiting.value = false
  }, POLL_MS)
}

async function pay() {
  paying.value = true
  payError.value = null
  try {
    leaveTo(await startCheckout(props.number, token))
  } catch (e) {
    payError.value =
      (e instanceof ApiError && e.problem?.detail) ||
      'No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos.'
    paying.value = false
  }
}

async function refresh() {
  try {
    order.value = await syncOrder(props.number, token)
  } catch {
    // Keep showing what we know.
  }
}

function keepShopping() {
  catalog.setFilter({})
  router.push({ name: 'home' })
}

onMounted(load)
onBeforeUnmount(() => {
  unmounted = true
  clearTimeout(pollTimer)
})
</script>

<template>
  <div class="order-page">
    <p v-if="state === 'loading'" class="form-note">Cargando tu pedido…</p>

    <div v-else-if="state === 'not-found'" class="head">
      <h1>No encontramos el pedido</h1>
      <p class="lead">
        Abrí el enlace que te enviamos por email, o ingresá con tu cuenta si compraste con ella.
      </p>
      <div class="actions">
        <RouterLink
          v-if="!auth.isSignedIn"
          :to="{ name: 'login', query: { next: route.fullPath } }"
          class="btn btn-secondary"
        >
          Ingresar
        </RouterLink>
        <button type="button" class="btn btn-ghost" @click="keepShopping">Ir a la tienda</button>
      </div>
    </div>

    <div v-else-if="state === 'error' || !order" class="head">
      <h1>No pudimos cargar el pedido</h1>
      <p class="lead">Probá de nuevo en unos minutos.</p>
    </div>

    <template v-else>
      <div class="head">
        <template v-if="order.status === 'paid'">
          <div class="badge"><AppIcon name="check" :size="28" :stroke-width="18" /></div>
          <h1>{{ fulfillmentTitle }}</h1>
          <p class="lead">
            <template v-if="order.fulfillment === 'unfulfilled'">
              Te enviamos el detalle a {{ order.email }}.
            </template>
            <template v-else-if="order.fulfillment === 'ready-for-pickup'">
              Retiralo en {{ order.pickup?.name ?? 'el local'
              }}<template v-if="order.pickup?.details"> ({{ order.pickup.details }})</template>.
            </template>
            Número de pedido <span>{{ order.number }}</span
            >.
            <template v-if="order.fulfillment === 'shipped' && order.trackingInfo">
              Seguimiento: <span>{{ order.trackingInfo }}</span
              >.
            </template>
          </p>
          <ol class="progress" aria-label="Estado del pedido">
            <li
              v-for="(step, i) in fulfillmentSteps"
              :key="step.key"
              :class="{ done: i <= fulfillmentAt }"
              :aria-current="i === fulfillmentAt ? 'step' : undefined"
            >
              {{ step.label }}
            </li>
          </ol>
        </template>

        <template v-else-if="order.status === 'expired'">
          <h1>El pedido venció</h1>
          <p class="lead">
            No recibimos el pago de <span>{{ order.number }}</span> a tiempo, así que los productos
            volvieron a estar a la venta.
          </p>
        </template>

        <template v-else-if="order.paymentMethod === 'transfer'">
          <h1>Transferí para confirmar</h1>
          <p class="lead">
            Reservamos tu pedido <span>{{ order.number }}</span> hasta el {{ deadline }} h.
            Transferí <span>{{ formatPrice(order.total) }}</span> a esta cuenta y lo confirmamos
            apenas se acredite. También te enviamos estos datos a {{ order.email }}.
          </p>
          <dl v-if="order.transfer" class="card transfer">
            <div>
              <dt>Alias</dt>
              <dd>{{ order.transfer.alias }}</dd>
            </div>
            <div>
              <dt>CBU</dt>
              <dd>{{ order.transfer.cbu }}</dd>
            </div>
            <div>
              <dt>Titular</dt>
              <dd>{{ order.transfer.holder }}</dd>
            </div>
            <div>
              <dt>Banco</dt>
              <dd>{{ order.transfer.bank }}</dd>
            </div>
            <div>
              <dt>Monto</dt>
              <dd>{{ formatPrice(order.total) }}</dd>
            </div>
          </dl>
        </template>

        <template v-else>
          <h1>Falta el pago</h1>
          <p class="lead">
            Reservamos tu pedido <span>{{ order.number }}</span> hasta el {{ deadline }} h. Pagalo
            con Mercado Pago para confirmarlo.
          </p>
          <p v-if="waiting" class="form-note" role="status">Confirmando tu pago…</p>
          <p v-else-if="paymentNote" class="form-note" role="status">{{ paymentNote }}</p>
          <div class="actions">
            <button type="button" class="btn btn-primary" :disabled="paying" @click="pay">
              Pagar con Mercado Pago
            </button>
            <button v-if="!waiting" type="button" class="btn btn-ghost" @click="refresh">
              Ya pagué, actualizar
            </button>
          </div>
          <span v-if="payError" class="form-error" role="alert">{{ payError }}</span>
        </template>

        <button
          v-if="order.status !== 'pending'"
          type="button"
          class="btn btn-primary"
          @click="keepShopping"
        >
          Seguir comprando
        </button>
      </div>

      <aside class="card elev-sm summary">
        <span class="summary-title"
          >Pedido {{ order.number }} · {{ productCountLabel(itemCount) }}</span
        >
        <div v-for="l in order.lines" :key="`${l.productSlug}/${l.size}`" class="line">
          <div class="thumb">
            <ProductImage :src="l.imageUrl" :alt="l.name" placeholder="Foto" />
          </div>
          <div class="line-info">
            <span class="line-name">{{ l.name }}</span>
            <span class="line-meta">Talle {{ l.size }} · x{{ l.quantity }}</span>
          </div>
          <span class="line-total">{{ formatPrice(l.lineTotal) }}</span>
        </div>
        <div class="rule" />
        <div class="totals">
          <div class="row">
            <span class="muted">Subtotal</span><span>{{ formatPrice(order.subtotal) }}</span>
          </div>
          <div class="row">
            <span class="muted">{{
              order.delivery === 'pickup' ? 'Retiro en local' : 'Envío'
            }}</span>
            <span>{{ order.shippingCost ? formatPrice(order.shippingCost) : 'Gratis' }}</span>
          </div>
          <div v-if="order.discount > 0" class="row">
            <span class="muted">Transferencia −10%</span>
            <span class="discount">− {{ formatPrice(order.discount) }}</span>
          </div>
          <div class="row total">
            <span>Total</span><span class="total-amount">{{ formatPrice(order.total) }}</span>
          </div>
        </div>
        <span v-if="order.shippingAddress" class="ship-to">
          Envío a {{ order.shippingAddress.street }} ({{ order.shippingAddress.postalCode }})
        </span>
      </aside>
    </template>
  </div>
</template>

<style scoped>
.order-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: clamp(32px, 8vw, 96px) clamp(16px, 4vw, 40px) 56px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: clamp(24px, 4vw, 48px);
  align-items: start;
}

.head {
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
}

.lead {
  font-size: 15px;
  color: var(--color-neutral-300);
  max-width: 480px;
  text-wrap: pretty;
}

.lead span {
  color: var(--color-text);
}

.progress {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 0;
  font-size: 12px;
  color: var(--color-neutral-500);
}

.progress li {
  display: flex;
  align-items: center;
}

.progress li + li::before {
  content: '';
  width: 24px;
  height: 1px;
  margin: 0 8px;
  background: var(--color-divider);
}

.progress li.done {
  color: var(--color-text);
}

.progress li.done + li.done::before {
  background: var(--color-accent);
}

.head > .btn,
.actions .btn {
  height: 40px;
}

.head > .btn {
  margin-top: 8px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.transfer {
  margin: 0;
  padding: 16px 18px;
  gap: 10px;
  align-self: stretch;
  max-width: 480px;
}

.transfer div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 14px;
}

.transfer dt {
  color: var(--color-neutral-400);
}

.transfer dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
  user-select: all;
}

.summary {
  padding: 18px;
  gap: 14px;
}

.summary-title {
  font-size: 15px;
  font-weight: 500;
}

.line {
  display: flex;
  gap: 10px;
  align-items: center;
}

.thumb {
  position: relative;
  width: 48px;
  height: 60px;
  flex: none;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-neutral-900);
}

.thumb :deep(.empty span) {
  display: none;
}

.line-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.line-name,
.line-total {
  font-size: 13px;
}

.line-meta,
.ship-to {
  font-size: 11px;
  color: var(--color-neutral-500);
}

.rule {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--color-divider) 48px,
    var(--color-divider) calc(100% - 48px),
    transparent
  );
}

.totals {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.row {
  display: flex;
  justify-content: space-between;
}

.muted {
  color: var(--color-neutral-400);
}

.discount {
  color: var(--color-accent-300);
}

.row.total {
  align-items: baseline;
  margin-top: 4px;
}

.row.total > span:first-child {
  font-size: 15px;
}

.total-amount {
  font-size: 22px;
  font-weight: 500;
}
</style>

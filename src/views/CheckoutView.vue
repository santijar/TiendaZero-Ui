<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import ProductImage from '@/components/ProductImage.vue'
import {
  SHIPPING_COST,
  TRANSFER_DISCOUNT_RATE,
  formatPrice,
  productCountLabel,
} from '@/lib/commerce'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/order'

type Delivery = 'home' | 'pickup'
// Mercado Pago Checkout Pro covers cards too, so there's no separate card option (plan decisions).
type PaymentMethod = 'mp' | 'transfer'

const PAYMENT_METHODS: { key: PaymentMethod; label: string; note: string }[] = [
  { key: 'mp', label: 'Mercado Pago', note: 'Hasta 6 cuotas' },
  { key: 'transfer', label: 'Transferencia', note: '10% off' },
]

const router = useRouter()
const cart = useCartStore()
const orders = useOrderStore()

const delivery = ref<Delivery>('home')
const payment = ref<PaymentMethod>('mp')
// Signed-in shoppers start with their account's name and email filled in.
const auth = useAuthStore()
const form = reactive({
  name: auth.user?.name ?? '',
  email: auth.user?.email ?? '',
  address: '',
  zip: '',
})
const formError = ref(false)

const discount = computed(() =>
  payment.value === 'transfer' ? cart.subtotal * TRANSFER_DISCOUNT_RATE : 0,
)
const total = computed(() => cart.subtotal + SHIPPING_COST - discount.value)

function clearError() {
  formError.value = false
}

async function placeOrder() {
  const missingAddress = delivery.value === 'home' && !form.address.trim()
  if (!form.name.trim() || !form.email.trim() || missingAddress) {
    formError.value = true
    return
  }
  orders.place(form.email.trim())
  // Stand-in until orders exist (step 5): placing an order just empties the server cart.
  await cart.clear().catch(() => {})
  await router.push({ name: 'order-confirmed' })
}
</script>

<template>
  <div class="checkout">
    <div>
      <RouterLink :to="{ name: 'home' }" class="btn btn-ghost">
        <AppIcon name="arrow-left" />Seguir comprando
      </RouterLink>
    </div>
    <h1>Checkout</h1>

    <div class="layout">
      <form class="steps" novalidate @submit.prevent="placeOrder" @input="clearError">
        <div class="step">
          <h6>Entrega</h6>
          <div class="seg delivery">
            <label class="seg-opt">
              <input v-model="delivery" type="radio" name="del" value="home" />Envío a domicilio
            </label>
            <label class="seg-opt">
              <input v-model="delivery" type="radio" name="del" value="pickup" />Retiro en local
            </label>
          </div>
        </div>

        <div class="step data">
          <h6>Datos</h6>
          <div class="contact">
            <div class="field">
              <label for="co-name">Nombre y apellido</label>
              <input
                id="co-name"
                v-model="form.name"
                class="input"
                autocomplete="name"
                placeholder="Juan Pérez"
              />
            </div>
            <div class="field">
              <label for="co-email">Email</label>
              <input
                id="co-email"
                v-model="form.email"
                class="input"
                type="email"
                autocomplete="email"
                placeholder="juan@mail.com"
              />
            </div>
          </div>
          <div v-if="delivery === 'home'" class="address">
            <div class="field">
              <label for="co-address">Dirección</label>
              <input
                id="co-address"
                v-model="form.address"
                class="input"
                autocomplete="street-address"
                placeholder="Av. Corrientes 1234"
              />
            </div>
            <div class="field">
              <label for="co-zip">Cód. postal</label>
              <input
                id="co-zip"
                v-model="form.zip"
                class="input"
                autocomplete="postal-code"
                placeholder="1043"
              />
            </div>
          </div>
          <div v-else class="card pickup">
            <span class="pickup-name">Showroom Regate</span>
            <span class="pickup-hours">Lun a vie · 10 a 19 h · Listo en 48 h</span>
          </div>
        </div>

        <div class="step">
          <h6>Pago</h6>
          <label
            v-for="m in PAYMENT_METHODS"
            :key="m.key"
            class="radio pay"
            :class="{ on: payment === m.key }"
          >
            <span class="pay-label">
              <input v-model="payment" type="radio" name="pay" :value="m.key" />
              <span class="dot" />{{ m.label }}
            </span>
            <span class="pay-note">{{ m.note }}</span>
          </label>
        </div>
      </form>

      <aside class="card elev-sm summary">
        <span class="summary-title">Resumen · {{ productCountLabel(cart.count) }}</span>
        <div v-for="l in cart.lines" :key="l.id" class="line">
          <div class="thumb">
            <ProductImage :src="l.imageUrl" :alt="l.name" placeholder="Foto" />
          </div>
          <div class="line-info">
            <span class="line-name">{{ l.name }}</span>
            <span class="line-meta">Talle {{ l.size }} · x{{ l.qty }}</span>
          </div>
          <span class="line-total">{{ formatPrice(l.total) }}</span>
        </div>
        <div class="rule" />
        <div class="totals">
          <div class="row">
            <span class="muted">Subtotal</span><span>{{ formatPrice(cart.subtotal) }}</span>
          </div>
          <div class="row">
            <span class="muted">Envío</span>
            <span>{{ SHIPPING_COST ? formatPrice(SHIPPING_COST) : 'Gratis' }}</span>
          </div>
          <div v-if="discount > 0" class="row">
            <span class="muted">Transferencia −10%</span>
            <span class="discount">− {{ formatPrice(discount) }}</span>
          </div>
          <div class="row total">
            <span>Total</span><span class="total-amount">{{ formatPrice(total) }}</span>
          </div>
        </div>
        <span v-if="formError" class="form-error">Completá tus datos para confirmar.</span>
        <button type="button" class="btn btn-primary confirm" @click="placeOrder">
          Confirmar pedido
        </button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.checkout {
  max-width: 1080px;
  margin: 0 auto;
  padding: 16px clamp(16px, 4vw, 40px) 56px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.checkout h1 {
  margin: 0;
  font-size: 32px;
}

.layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: clamp(24px, 4vw, 48px);
  align-items: start;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step.data {
  gap: 12px;
}

.step h6 {
  margin: 0;
  color: var(--color-neutral-400);
}

.delivery {
  display: flex;
}

.delivery .seg-opt {
  flex: 1;
  justify-content: center;
}

.contact {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.address {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
}

.pickup {
  gap: 2px;
}

.pickup-name {
  font-size: 13px;
}

.pickup-hours {
  font-size: 12px;
  color: var(--color-neutral-400);
}

.pay {
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-divider);
}

.pay.on {
  border-color: var(--color-accent);
}

.pay-label {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pay-note {
  font-size: 12px;
  color: var(--color-neutral-500);
}

.summary {
  padding: 18px;
  gap: 14px;
  position: sticky;
  top: 80px;
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

.line-meta {
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

.form-error {
  font-size: 12px;
  color: var(--color-accent-300);
}

.confirm {
  height: 48px;
  font-size: 15px;
}
</style>

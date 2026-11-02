<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { SHIPPING_COST, formatPrice, installmentsLabel, productCountLabel } from '@/lib/commerce'
import { useCartStore } from '@/stores/cart'
import AppIcon from './AppIcon.vue'
import ProductImage from './ProductImage.vue'

const cart = useCartStore()
const router = useRouter()

const total = computed(() => cart.subtotal + SHIPPING_COST)

function checkout() {
  if (cart.isEmpty) return
  cart.close()
  router.push({ name: 'checkout' })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') cart.close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <template v-if="cart.isOpen">
    <div class="backdrop" @click="cart.close" />
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Carrito">
      <div class="head">
        <div class="title">
          <span>Carrito</span>
          <span class="count">{{ productCountLabel(cart.count) }}</span>
        </div>
        <button type="button" class="btn btn-icon" aria-label="Cerrar" @click="cart.close">
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <div v-if="cart.isEmpty" class="empty">
        <span class="empty-title">Tu carrito está vacío</span>
        <span class="empty-body">Sumá prendas desde la tienda para verlas acá.</span>
        <button type="button" class="btn btn-primary" @click="cart.close">Ir a la tienda</button>
      </div>

      <template v-else>
        <div class="lines">
          <div v-for="l in cart.lines" :key="l.id" class="line">
            <div class="thumb">
              <ProductImage :src="l.imageUrl" :alt="l.name" placeholder="Foto" />
            </div>
            <div class="info">
              <div class="info-top">
                <span class="name">{{ l.name }}</span>
                <button
                  type="button"
                  class="btn btn-icon remove"
                  aria-label="Quitar"
                  :disabled="cart.updating"
                  @click="cart.remove(l)"
                >
                  <AppIcon name="trash" />
                </button>
              </div>
              <span class="meta">Talle {{ l.size }} · {{ l.color }}</span>
              <div class="info-bottom">
                <div class="stepper">
                  <button
                    type="button"
                    aria-label="Menos"
                    :disabled="cart.updating"
                    @click="cart.changeQty(l, -1)"
                  >
                    <AppIcon name="minus" :size="12" :stroke-width="20" />
                  </button>
                  <span>{{ l.qty }}</span>
                  <button
                    type="button"
                    aria-label="Más"
                    :disabled="cart.updating || l.qty >= l.maxQty"
                    @click="cart.changeQty(l, 1)"
                  >
                    <AppIcon name="plus" :size="12" :stroke-width="20" />
                  </button>
                </div>
                <span class="line-total">{{ formatPrice(l.total) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="summary">
          <span class="ship-msg">Tenés envío gratis en este pedido.</span>
          <div class="row">
            <span class="muted">Subtotal</span><span>{{ formatPrice(cart.subtotal) }}</span>
          </div>
          <div class="row">
            <span class="muted">Envío</span>
            <span>{{ SHIPPING_COST ? formatPrice(SHIPPING_COST) : 'Gratis' }}</span>
          </div>
          <div class="row total">
            <span>Total</span><span class="total-amount">{{ formatPrice(total) }}</span>
          </div>
          <span class="installments">{{ installmentsLabel(total) }}</span>
          <button type="button" class="btn btn-primary finish" @click="checkout">
            Finalizar compra
          </button>
        </div>
      </template>
    </aside>
  </template>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: color-mix(in srgb, var(--color-neutral-900) 60%, transparent);
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 21;
  width: min(420px, 100%);
  background: var(--color-bg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
}

.title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 22px;
  font-weight: 500;
}

.count {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-neutral-500);
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 32px 20px;
}

.empty-title {
  font-size: 17px;
  font-weight: 500;
}

.empty-body {
  font-size: 13px;
  color: var(--color-neutral-400);
}

.lines {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 20px 16px;
}

.line {
  display: flex;
  gap: 12px;
}

.thumb {
  position: relative;
  width: 80px;
  height: 100px;
  flex: none;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.name {
  font-size: 14px;
  line-height: 1.3;
}

.remove {
  width: 28px;
  height: 28px;
  margin: -4px -6px 0 0;
  color: var(--color-neutral-500);
}

.meta {
  font-size: 11px;
  color: var(--color-neutral-500);
}

.info-bottom {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-md);
}

.stepper button {
  width: 32px;
  height: 30px;
  border: 0;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.stepper button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.stepper span {
  min-width: 20px;
  text-align: center;
  font-size: 13px;
}

.line-total {
  font-size: 14px;
  font-weight: 500;
}

.summary {
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--color-surface);
}

.ship-msg {
  font-size: 12px;
  color: var(--color-neutral-300);
}

.row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.muted {
  color: var(--color-neutral-400);
}

.row.total {
  align-items: baseline;
  font-size: 15px;
}

.total-amount {
  font-size: 20px;
  font-weight: 500;
}

.installments {
  font-size: 11px;
  color: var(--color-neutral-500);
}

.finish {
  height: 46px;
  font-size: 15px;
  margin-top: 4px;
}
</style>

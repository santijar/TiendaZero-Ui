<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { getCheckoutSettings, saveCheckoutSettings, type CheckoutSettings } from '@/api/admin'
import { ApiError } from '@/api/http'

// How the store takes orders: the WhatsApp number that receives them and whether it accepts cash and Mercado Pago.
// Transfer and pickup have their own screens (Pagos, Retiro). The Api validates the number and normalizes it.
const state = ref<'loading' | 'ready' | 'error'>('loading')
const form = reactive({ whatsappNumber: '', cash: false, mercadoPago: true })
const errors = reactive<Record<string, string>>({})
const busy = ref(false)
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

function fill(s: CheckoutSettings) {
  form.whatsappNumber = s.whatsappNumber ?? ''
  form.cash = s.cash
  form.mercadoPago = s.mercadoPago
}

function clearErrors() {
  Object.keys(errors).forEach((k) => delete errors[k])
  notice.value = null
}

onMounted(async () => {
  try {
    fill(await getCheckoutSettings())
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})

async function save() {
  busy.value = true
  clearErrors()
  try {
    fill(
      await saveCheckoutSettings({
        whatsappNumber: form.whatsappNumber.trim() || null,
        cash: form.cash,
        mercadoPago: form.mercadoPago,
      }),
    )
    notice.value = { kind: 'ok', text: 'Guardamos cómo cobrás y recibís pedidos.' }
  } catch (e) {
    if (e instanceof ApiError && e.problem?.errors) {
      for (const [field, messages] of Object.entries(e.problem.errors)) {
        errors[field] = messages[0] ?? ''
      }
      notice.value = { kind: 'error', text: 'Revisá los campos marcados.' }
    } else {
      notice.value = { kind: 'error', text: 'No pudimos guardar los cambios.' }
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Cobros y WhatsApp</h1>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'error'" class="form-error">No pudimos cargar esta configuración.</p>

    <form
      v-else
      class="form-stack settings"
      aria-label="Cobros y WhatsApp"
      novalidate
      @submit.prevent="save"
    >
      <section class="card admin-section">
        <p class="admin-muted">
          El número de WhatsApp es donde recibís los pedidos. Escribilo con código de país, por
          ejemplo +54 9 11 5555-1234.
        </p>
        <div class="field">
          <label for="cs-whatsapp">WhatsApp de la tienda</label>
          <input
            id="cs-whatsapp"
            v-model="form.whatsappNumber"
            class="input"
            type="tel"
            autocomplete="off"
            placeholder="+54 9 11 5555-1234"
          />
          <span v-if="errors.whatsappNumber" class="form-error">{{ errors.whatsappNumber }}</span>
        </div>
      </section>

      <section class="card admin-section">
        <p class="admin-muted">
          La transferencia se ofrece cuando cargás tus datos en Pagos, y el retiro cuando cargás el
          lugar en Retiro.
        </p>
        <label class="check">
          <input v-model="form.cash" type="checkbox" name="cash" />
          <span>Efectivo al recibir o retirar</span>
        </label>
        <label class="check">
          <input v-model="form.mercadoPago" type="checkbox" name="mercadopago" />
          <span>Mercado Pago</span>
        </label>
      </section>

      <div class="save-bar">
        <button type="submit" class="btn btn-primary" :disabled="busy">Guardar</button>
      </div>

      <p v-if="notice" :class="notice.kind === 'ok' ? 'form-note' : 'form-error'" role="status">
        {{ notice.text }}
      </p>
    </form>
  </div>
</template>

<style scoped>
.settings {
  max-width: 640px;
}

.check {
  display: flex;
  align-items: center;
  gap: 10px;
}

.save-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import {
  getPickupSettings,
  removePickupSettings,
  savePickupSettings,
  type PickupSettings,
} from '@/api/admin'
import { ApiError } from '@/api/http'

// Where and when shoppers collect "retiro en local" orders. It appears in the checkout, on the order page and in the
// emails. Without it the store does not offer pickup.
const state = ref<'loading' | 'ready' | 'error'>('loading')
const settings = ref<PickupSettings | null>(null)
const form = reactive({ name: '', details: '' })
const errors = reactive<Record<string, string>>({})
const busy = ref(false)
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

const configured = computed(() => settings.value?.configured === true)

function fill(s: PickupSettings) {
  settings.value = s
  form.name = s.name ?? ''
  form.details = s.details ?? ''
}

function clearErrors() {
  Object.keys(errors).forEach((k) => delete errors[k])
  notice.value = null
}

onMounted(async () => {
  try {
    fill(await getPickupSettings())
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})

async function save() {
  busy.value = true
  clearErrors()
  try {
    fill(await savePickupSettings({ name: form.name.trim(), details: form.details.trim() }))
    notice.value = { kind: 'ok', text: 'Guardamos el lugar de retiro. Ya se ofrece al comprar.' }
  } catch (e) {
    if (e instanceof ApiError && e.problem?.errors) {
      for (const [field, messages] of Object.entries(e.problem.errors)) {
        errors[field] = messages[0] ?? ''
      }
      notice.value = { kind: 'error', text: 'Revisá los campos marcados.' }
    } else {
      notice.value = { kind: 'error', text: 'No pudimos guardar el lugar de retiro.' }
    }
  } finally {
    busy.value = false
  }
}

async function remove() {
  const warning =
    'Tus clientes dejan de ver la opción de retiro en local. Los pedidos que ya eligieron retiro dicen «en el local». ¿Quitarla?'
  if (!window.confirm(warning)) return
  busy.value = true
  clearErrors()
  try {
    fill(await removePickupSettings())
    notice.value = { kind: 'ok', text: 'Tu tienda ya no ofrece retiro en local.' }
  } catch {
    notice.value = { kind: 'error', text: 'No pudimos quitar el retiro.' }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Retiro en local</h1>
      <span v-if="state === 'ready'" class="tag">
        {{ configured ? 'Ofrecés retiro' : 'Sin retiro' }}
      </span>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'error'" class="form-error">No pudimos cargar el retiro en local.</p>

    <form v-else class="form-stack pickup" aria-label="Retiro en local" @submit.prevent="save">
      <section class="card admin-section">
        <p class="admin-muted">
          Es el lugar donde tus clientes retiran sus pedidos. Lo ven al comprar, en su pedido y en
          los emails.
          {{
            configured
              ? ''
              : 'Hasta que lo cargues, tu tienda no ofrece retiro en local, solo envío a domicilio.'
          }}
        </p>
        <div class="field">
          <label for="pk-name">Nombre del lugar</label>
          <input
            id="pk-name"
            v-model="form.name"
            class="input"
            autocomplete="off"
            placeholder="Showroom Centro"
          />
          <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
        </div>
        <div class="field">
          <label for="pk-details">Horarios y detalles (opcional)</label>
          <input
            id="pk-details"
            v-model="form.details"
            class="input"
            autocomplete="off"
            placeholder="Lun a vie · 10 a 19 h · Listo en 48 h"
          />
          <span v-if="errors.details" class="form-error">{{ errors.details }}</span>
        </div>
      </section>

      <div class="save-bar">
        <button type="submit" class="btn btn-primary" :disabled="busy">Guardar</button>
        <button
          v-if="configured"
          type="button"
          class="btn btn-secondary"
          :disabled="busy"
          @click="remove"
        >
          Quitar el retiro
        </button>
      </div>

      <p v-if="notice" :class="notice.kind === 'ok' ? 'form-note' : 'form-error'" role="status">
        {{ notice.text }}
      </p>
    </form>
  </div>
</template>

<style scoped>
.pickup {
  max-width: 640px;
}

.save-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
</style>

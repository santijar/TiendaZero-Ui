<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import {
  createDeliveryZone,
  deleteDeliveryZone,
  getDeliveryZones,
  updateDeliveryZone,
  type DeliveryZone,
} from '@/api/admin'
import { ApiError } from '@/api/http'
import { formatPrice } from '@/lib/commerce'

// The areas the store delivers to, with the price of each and the smallest order it delivers there. Without any, a
// home delivery is free and asks for a postal code; with one, shoppers must pick a zone. The Api validates the form.
const state = ref<'loading' | 'ready' | 'error'>('loading')
const zones = ref<DeliveryZone[]>([])
const editing = ref<string | null>(null)
const form = reactive({ name: '', cost: '0', minimumOrder: '0' })
const errors = reactive<Record<string, string>>({})
const busy = ref(false)
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

function clearErrors() {
  Object.keys(errors).forEach((k) => delete errors[k])
  notice.value = null
}

function reset() {
  editing.value = null
  form.name = ''
  form.cost = '0'
  form.minimumOrder = '0'
}

function edit(zone: DeliveryZone) {
  clearErrors()
  editing.value = zone.id
  form.name = zone.name
  form.cost = String(zone.cost)
  form.minimumOrder = String(zone.minimumOrder)
}

onMounted(async () => {
  try {
    zones.value = await getDeliveryZones()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})

// An empty or non-numeric box is sent as null so the Api answers with its own message for the field.
const amount = (text: string) =>
  text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text)

async function save() {
  busy.value = true
  clearErrors()
  const body = {
    name: form.name.trim(),
    cost: amount(form.cost),
    minimumOrder: amount(form.minimumOrder),
  }
  try {
    if (editing.value) {
      const saved = await updateDeliveryZone(editing.value, body)
      zones.value = zones.value.map((z) => (z.id === saved.id ? saved : z))
    } else {
      zones.value = [...zones.value, await createDeliveryZone(body)]
    }
    reset()
    notice.value = { kind: 'ok', text: 'Guardamos la zona. Ya se ofrece al comprar.' }
  } catch (e) {
    if (e instanceof ApiError && e.problem?.errors) {
      for (const [field, messages] of Object.entries(e.problem.errors)) {
        errors[field] = messages[0] ?? ''
      }
      notice.value = { kind: 'error', text: 'Revisá los campos marcados.' }
    } else {
      notice.value = { kind: 'error', text: 'No pudimos guardar la zona.' }
    }
  } finally {
    busy.value = false
  }
}

async function remove(zone: DeliveryZone) {
  const last = zones.value.length === 1
  const warning = last
    ? `Si quitás «${zone.name}», tu tienda deja de pedir zona y vuelve a pedir el código postal, con envío gratis. ¿Quitarla?`
    : `Tus clientes dejan de ver «${zone.name}». Los pedidos que ya la eligieron no cambian. ¿Quitarla?`
  if (!window.confirm(warning)) return
  busy.value = true
  clearErrors()
  try {
    await deleteDeliveryZone(zone.id)
    zones.value = zones.value.filter((z) => z.id !== zone.id)
    if (editing.value === zone.id) reset()
    notice.value = { kind: 'ok', text: 'Quitamos la zona.' }
  } catch {
    notice.value = { kind: 'error', text: 'No pudimos quitar la zona.' }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Zonas de envío</h1>
      <span v-if="state === 'ready'" class="tag">
        {{
          zones.length ? `${zones.length} ${zones.length === 1 ? 'zona' : 'zonas'}` : 'Sin zonas'
        }}
      </span>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'error'" class="form-error">No pudimos cargar las zonas de envío.</p>

    <template v-else>
      <section class="card admin-section zones">
        <p class="admin-muted">
          {{
            zones.length
              ? 'Tus clientes eligen una zona al pedir con envío a domicilio y pagan lo que cuesta.'
              : 'Hasta que cargues una zona, el envío a domicilio es gratis y se pide el código postal.'
          }}
        </p>
        <ul v-if="zones.length" class="zone-list">
          <li v-for="z in zones" :key="z.id">
            <div>
              <span class="zone-name">{{ z.name }}</span>
              <span class="admin-muted">
                {{ z.cost ? formatPrice(z.cost) : 'Envío gratis' }}
                <template v-if="z.minimumOrder">
                  · mínimo {{ formatPrice(z.minimumOrder) }}</template
                >
              </span>
            </div>
            <div class="row-actions">
              <button type="button" class="btn btn-ghost" :disabled="busy" @click="edit(z)">
                Editar
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                :aria-label="`Quitar ${z.name}`"
                :disabled="busy"
                @click="remove(z)"
              >
                Quitar
              </button>
            </div>
          </li>
        </ul>
      </section>

      <form
        class="form-stack zone-form"
        aria-label="Zona de envío"
        novalidate
        @submit.prevent="save"
      >
        <section class="card admin-section">
          <h2>{{ editing ? 'Editar zona' : 'Nueva zona' }}</h2>
          <div class="field">
            <label for="dz-name">Nombre</label>
            <input
              id="dz-name"
              v-model="form.name"
              class="input"
              autocomplete="off"
              placeholder="Barrio Norte"
            />
            <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
          </div>
          <div class="amounts">
            <div class="field">
              <label for="dz-cost">Costo del envío ($)</label>
              <input
                id="dz-cost"
                v-model="form.cost"
                class="input"
                inputmode="decimal"
                autocomplete="off"
              />
              <span v-if="errors.cost" class="form-error">{{ errors.cost }}</span>
            </div>
            <div class="field">
              <label for="dz-min">Pedido mínimo ($)</label>
              <input
                id="dz-min"
                v-model="form.minimumOrder"
                class="input"
                inputmode="decimal"
                autocomplete="off"
              />
              <span v-if="errors.minimumOrder" class="form-error">{{ errors.minimumOrder }}</span>
            </div>
          </div>
          <span v-if="errors.zones" class="form-error">{{ errors.zones }}</span>
        </section>

        <div class="save-bar">
          <button type="submit" class="btn btn-primary" :disabled="busy">
            {{ editing ? 'Guardar cambios' : 'Agregar zona' }}
          </button>
          <button v-if="editing" type="button" class="btn btn-secondary" @click="reset">
            Cancelar
          </button>
        </div>
      </form>

      <p v-if="notice" :class="notice.kind === 'ok' ? 'form-note' : 'form-error'" role="status">
        {{ notice.text }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.zones,
.zone-form {
  max-width: 640px;
}

.zone-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.zone-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--color-divider);
}

.zone-list li > div:first-child {
  display: flex;
  flex-direction: column;
}

.zone-name {
  font-size: 14px;
}

.row-actions {
  display: flex;
  gap: 4px;
}

.amounts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.save-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
</style>

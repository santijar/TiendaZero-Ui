<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import {
  connectPaymentAccount,
  disconnectPaymentAccount,
  getPaymentAccount,
  type PaymentAccount,
} from '@/api/admin'
import { ApiError } from '@/api/http'

// The store's own Mercado Pago account (docs/plan.md §2, Milestone 4). The admin pastes the credentials of their
// Mercado Pago application; the Api checks the token with Mercado Pago before saving and keeps all three
// encrypted. They are never shown again, so the inputs start empty even when an account is connected.
const state = ref<'loading' | 'ready' | 'error'>('loading')
const account = ref<PaymentAccount | null>(null)
const editing = ref(false)
const busy = ref(false)
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)
const form = reactive({ accessToken: '', publicKey: '', webhookSecret: '' })
const fieldErrors = reactive<Record<string, string>>({})

const connected = computed(() => account.value?.status === 'Connected')
const showForm = computed(() => !connected.value || editing.value)

onMounted(async () => {
  try {
    account.value = await getPaymentAccount()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})

function clearErrors() {
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
  notice.value = null
}

function showError(e: unknown, fallback: string) {
  clearErrors()
  if (e instanceof ApiError) {
    for (const [field, messages] of Object.entries(e.problem?.errors ?? {})) {
      fieldErrors[field] = messages[0] ?? ''
    }
    const first = Object.values(fieldErrors)[0]
    notice.value = {
      kind: 'error',
      text: first ?? e.problem?.detail ?? e.problem?.title ?? fallback,
    }
    return
  }
  notice.value = { kind: 'error', text: fallback }
}

function clearForm() {
  form.accessToken = form.publicKey = form.webhookSecret = ''
}

async function connect() {
  busy.value = true
  clearErrors()
  try {
    account.value = await connectPaymentAccount({
      accessToken: form.accessToken.trim(),
      publicKey: form.publicKey.trim(),
      webhookSecret: form.webhookSecret.trim(),
    })
    clearForm()
    editing.value = false
    notice.value = {
      kind: 'ok',
      text: 'Mercado Pago quedó conectado. Ya podés cobrar con tarjeta.',
    }
  } catch (e) {
    showError(e, 'No pudimos conectar Mercado Pago.')
  } finally {
    busy.value = false
  }
}

async function disconnect() {
  const warning =
    'Los clientes no van a poder pagar con Mercado Pago hasta que lo vuelvas a conectar. ¿Desconectar?'
  if (!window.confirm(warning)) return
  busy.value = true
  clearErrors()
  try {
    account.value = await disconnectPaymentAccount()
    editing.value = false
    notice.value = { kind: 'ok', text: 'Mercado Pago quedó desconectado.' }
  } catch (e) {
    showError(e, 'No pudimos desconectar Mercado Pago.')
  } finally {
    busy.value = false
  }
}

function startEditing() {
  clearErrors()
  editing.value = true
}

function cancelEditing() {
  clearErrors()
  clearForm()
  editing.value = false
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Pagos</h1>
      <span v-if="state === 'ready'" class="tag">
        {{ connected ? 'Mercado Pago conectado' : 'Mercado Pago sin conectar' }}
      </span>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'error'" class="form-error">
      No pudimos cargar la configuración de pagos.
    </p>

    <div v-else class="payments">
      <section v-if="connected" class="card admin-section" aria-label="Cuenta conectada">
        <h2>Tu cuenta de Mercado Pago</h2>
        <dl class="facts">
          <div>
            <dt>ID de la cuenta</dt>
            <dd>{{ account?.providerAccountId }}</dd>
          </div>
          <div>
            <dt>Public key</dt>
            <dd class="mono">{{ account?.publicKey ?? '—' }}</dd>
          </div>
          <div>
            <dt>Access token</dt>
            <dd class="mono">{{ account?.accessTokenHint ?? '—' }}</dd>
          </div>
          <div>
            <dt>Clave secreta de webhooks</dt>
            <dd>{{ account?.hasWebhookSecret ? 'Cargada' : 'Falta' }}</dd>
          </div>
          <div>
            <dt>Conectada</dt>
            <dd>{{ when(account?.connectedAt ?? null) }}</dd>
          </div>
        </dl>
        <div v-if="account?.webhookUrl" class="field">
          <label for="p-webhook">URL de notificaciones (webhooks)</label>
          <input id="p-webhook" class="input mono" :value="account.webhookUrl" readonly />
          <span class="admin-muted">
            Tiene que estar cargada en tu aplicación de Mercado Pago, en Webhooks, con el evento
            «Pagos».
          </span>
        </div>
        <div v-if="!editing" class="admin-actions">
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="startEditing">
            Cambiar credenciales
          </button>
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="disconnect">
            Desconectar
          </button>
        </div>
      </section>

      <form v-if="showForm" class="form-stack" @submit.prevent="connect">
        <section class="card admin-section">
          <h2>{{ connected ? 'Nuevas credenciales' : 'Conectar Mercado Pago' }}</h2>
          <ol class="steps admin-muted">
            <li>
              Entrá a «Tus integraciones» en Mercado Pago Developers y creá (o abrí) una aplicación
              de Checkout Pro.
            </li>
            <li>En «Credenciales de producción» copiá la Public Key y el Access Token.</li>
            <li>
              En «Webhooks» cargá la URL de notificaciones que te mostramos al conectar, elegí el
              evento «Pagos» y copiá la clave secreta.
            </li>
          </ol>

          <div class="field">
            <label for="p-token">Access token</label>
            <input
              id="p-token"
              v-model="form.accessToken"
              class="input mono"
              type="password"
              autocomplete="off"
              spellcheck="false"
              required
            />
            <span v-if="fieldErrors.accessToken" class="form-error">{{
              fieldErrors.accessToken
            }}</span>
          </div>
          <div class="field">
            <label for="p-key">Public key</label>
            <input
              id="p-key"
              v-model="form.publicKey"
              class="input mono"
              autocomplete="off"
              spellcheck="false"
              required
            />
            <span v-if="fieldErrors.publicKey" class="form-error">{{ fieldErrors.publicKey }}</span>
          </div>
          <div class="field">
            <label for="p-secret">Clave secreta de webhooks</label>
            <input
              id="p-secret"
              v-model="form.webhookSecret"
              class="input mono"
              type="password"
              autocomplete="off"
              spellcheck="false"
              required
            />
            <span v-if="fieldErrors.webhookSecret" class="form-error">{{
              fieldErrors.webhookSecret
            }}</span>
          </div>
          <p class="admin-muted">
            Verificamos el access token con Mercado Pago antes de guardar. Las credenciales se
            guardan cifradas y no se vuelven a mostrar.
          </p>
        </section>

        <div class="save-bar">
          <button type="submit" class="btn btn-primary" :disabled="busy">
            {{ connected ? 'Guardar credenciales' : 'Conectar' }}
          </button>
          <button v-if="editing" type="button" class="btn btn-secondary" @click="cancelEditing">
            Cancelar
          </button>
        </div>
      </form>

      <p v-if="notice" :class="notice.kind === 'ok' ? 'form-note' : 'form-error'" role="status">
        {{ notice.text }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.payments {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 640px;
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 12px 16px;
  margin: 0;
}

.facts dt {
  font-size: 12px;
  color: var(--color-neutral-500);
}

.facts dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.steps {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.save-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
</style>

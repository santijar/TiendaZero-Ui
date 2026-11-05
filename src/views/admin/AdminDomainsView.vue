<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import {
  checkDomain,
  claimDomain,
  listDomains,
  makeDomainPrimary,
  removeDomain,
  type AdminDomain,
} from '@/api/admin'
import { ApiError } from '@/api/http'

// The store's domains (docs/plan.md §2, Milestone 5): the platform subdomain, plus custom hosts the store owns. A
// custom host is claimed here, proven by publishing a TXT record, and from then on answers for the store; the admin
// picks which host is the primary one (the host used in emailed links). Rules and DNS lookups live in the Api.
const state = ref<'loading' | 'ready' | 'error'>('loading')
const domains = ref<AdminDomain[]>([])
const newDomain = ref('')
const claimError = ref('')
const busyId = ref<string | null>(null)
const adding = ref(false)
// Per-domain message from the last action (e.g. "still no TXT record"), shown under that domain.
const notes = reactive<Record<string, { kind: 'ok' | 'error'; text: string }>>({})
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

onMounted(async () => {
  try {
    domains.value = await listDomains()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})

const TLS_LABEL: Record<AdminDomain['tlsStatus'], string> = {
  None: 'Sin certificado propio',
  Pending: 'Certificado en trámite',
  Active: 'Certificado activo',
  Failed: 'Falló el certificado',
}

function messageOf(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const first = Object.values(e.problem?.errors ?? {})[0]?.[0]
    return first ?? e.problem?.detail ?? fallback
  }
  return fallback
}

function replace(updated: AdminDomain) {
  domains.value = domains.value.map((d) => (d.id === updated.id ? updated : d))
}

async function reload() {
  domains.value = await listDomains()
}

async function add() {
  adding.value = true
  claimError.value = ''
  notice.value = null
  try {
    const claim = await claimDomain(newDomain.value.trim())
    newDomain.value = ''
    await reload()
    notes[claim.id] = {
      kind: 'ok',
      text: 'Listo. Ahora publicá los registros de abajo y tocá «Verificar».',
    }
  } catch (e) {
    claimError.value = messageOf(e, 'No pudimos agregar el dominio.')
  } finally {
    adding.value = false
  }
}

async function verify(domain: AdminDomain) {
  busyId.value = domain.id
  delete notes[domain.id]
  try {
    const wasVerified = domain.verified
    const updated = await checkDomain(domain.id)
    replace(updated)
    if (!wasVerified && updated.verified) {
      notes[domain.id] = { kind: 'ok', text: 'Dominio verificado. Ya responde con tu tienda.' }
    }
  } catch (e) {
    notes[domain.id] = { kind: 'error', text: messageOf(e, 'No pudimos verificar el dominio.') }
    // A 409 means someone else proved it first; the list may have changed.
    if (e instanceof ApiError && e.status === 409) void reload().catch(() => {})
  } finally {
    busyId.value = null
  }
}

async function makePrimary(domain: AdminDomain) {
  if (
    domain.tlsStatus !== 'Active' &&
    domain.type === 'Custom' &&
    !window.confirm(
      'Este dominio todavía no tiene un certificado activo: los links de tus mails podrían mostrar una advertencia de seguridad. ¿Hacerlo principal igual?',
    )
  ) {
    return
  }
  busyId.value = domain.id
  delete notes[domain.id]
  try {
    await makeDomainPrimary(domain.id)
    await reload()
    notice.value = { kind: 'ok', text: `${domain.domain} es ahora el dominio principal.` }
  } catch (e) {
    notes[domain.id] = { kind: 'error', text: messageOf(e, 'No pudimos cambiar el principal.') }
  } finally {
    busyId.value = null
  }
}

async function remove(domain: AdminDomain) {
  const warning = domain.verified
    ? `${domain.domain} va a dejar de abrir tu tienda. ¿Quitarlo?`
    : `¿Quitar el pedido de ${domain.domain}?`
  if (!window.confirm(warning)) return
  busyId.value = domain.id
  delete notes[domain.id]
  try {
    await removeDomain(domain.id)
    domains.value = domains.value.filter((d) => d.id !== domain.id)
  } catch (e) {
    notes[domain.id] = { kind: 'error', text: messageOf(e, 'No pudimos quitar el dominio.') }
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Dominios</h1>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'error'" class="form-error">No pudimos cargar tus dominios.</p>

    <div v-else class="domains">
      <p v-if="notice" :class="notice.kind === 'ok' ? 'form-note' : 'form-error'" role="status">
        {{ notice.text }}
      </p>

      <section
        v-for="d in domains"
        :key="d.id"
        class="card admin-section domain"
        :aria-label="d.domain"
      >
        <div class="domain-head">
          <strong class="domain-name">{{ d.domain }}</strong>
          <span v-if="d.isPrimary" class="tag">Principal</span>
          <span v-if="d.type === 'Subdomain'" class="tag">De la plataforma</span>
          <span v-else-if="d.verified" class="tag">Verificado</span>
          <span v-else class="tag">Pendiente de verificar</span>
        </div>

        <p v-if="d.type === 'Custom' && d.verified" class="admin-muted">
          {{ TLS_LABEL[d.tlsStatus] }}<template v-if="d.tlsDetail"> · {{ d.tlsDetail }}</template>
        </p>

        <div v-if="d.type === 'Custom' && d.instructions" class="steps">
          <template v-if="!d.verified">
            <p class="step-title">
              1. Publicá este registro TXT para demostrar que el dominio es tuyo
            </p>
            <dl class="record">
              <div>
                <dt>Tipo</dt>
                <dd>TXT</dd>
              </div>
              <div>
                <dt>Nombre</dt>
                <dd class="mono">{{ d.instructions.txtName }}</dd>
              </div>
              <div>
                <dt>Valor</dt>
                <dd class="mono">{{ d.instructions.txtValue }}</dd>
              </div>
            </dl>
          </template>
          <template v-if="d.instructions.cnameTarget">
            <p class="step-title">
              {{ d.verified ? 'Tu dominio tiene que apuntar a' : '2. Y apuntá el dominio a' }}
              nuestros servidores con un registro CNAME
            </p>
            <dl class="record">
              <div>
                <dt>Tipo</dt>
                <dd>CNAME</dd>
              </div>
              <div>
                <dt>Nombre</dt>
                <dd class="mono">{{ d.domain }}</dd>
              </div>
              <div>
                <dt>Valor</dt>
                <dd class="mono">{{ d.instructions.cnameTarget }}</dd>
              </div>
            </dl>
          </template>
          <p v-if="!d.verified" class="admin-muted">
            Los cambios de DNS pueden tardar un rato en llegar (a veces horas).
          </p>
        </div>

        <p
          v-if="notes[d.id]"
          :class="notes[d.id]!.kind === 'ok' ? 'form-note' : 'form-error'"
          role="status"
        >
          {{ notes[d.id]!.text }}
        </p>

        <div class="admin-actions">
          <button
            v-if="d.type === 'Custom'"
            type="button"
            class="btn btn-secondary"
            :disabled="busyId === d.id"
            @click="verify(d)"
          >
            {{ d.verified ? 'Actualizar estado del certificado' : 'Verificar' }}
          </button>
          <button
            v-if="d.verified && !d.isPrimary"
            type="button"
            class="btn btn-secondary"
            :disabled="busyId === d.id"
            @click="makePrimary(d)"
          >
            Hacer principal
          </button>
          <button
            v-if="d.type === 'Custom' && !d.isPrimary"
            type="button"
            class="btn btn-secondary"
            :disabled="busyId === d.id"
            @click="remove(d)"
          >
            Quitar
          </button>
        </div>
      </section>

      <form class="form-stack" @submit.prevent="add">
        <section class="card admin-section">
          <h2>Agregar un dominio propio</h2>
          <p class="admin-muted">
            Escribilo sin https:// (por ejemplo, tienda.midominio.com). Después te decimos qué
            registros publicar en tu proveedor de dominio.
          </p>
          <div class="field">
            <label for="d-new">Dominio</label>
            <input
              id="d-new"
              v-model="newDomain"
              class="input mono"
              autocomplete="off"
              spellcheck="false"
              placeholder="tienda.midominio.com"
              required
            />
            <span v-if="claimError" class="form-error">{{ claimError }}</span>
          </div>
        </section>
        <div>
          <button type="submit" class="btn btn-primary" :disabled="adding">Agregar dominio</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.domains {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
}

.domain-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.domain-name {
  overflow-wrap: anywhere;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-title {
  margin: 0;
  font-size: 13px;
}

.record {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 12px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--color-divider, var(--color-neutral-800));
  border-radius: 8px;
}

.record dt {
  font-size: 12px;
  color: var(--color-neutral-500);
}

.record dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

@media (max-width: 560px) {
  .record {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

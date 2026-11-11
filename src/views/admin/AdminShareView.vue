<script setup lang="ts">
import { onMounted, ref } from 'vue'
import QRCode from 'qrcode'

import { useThemeStore } from '@/stores/theme'

// The store's link and a QR for it, ready to print and stick on the shop window or the counter. The link is the address
// the admin is using right now, which is the store's own (its custom domain, once it has one).
const theme = useThemeStore()
const url = window.location.origin
const qr = ref<string | null>(null)
const qrFailed = ref(false)
const copied = ref<'idle' | 'copied' | 'failed'>('idle')

onMounted(async () => {
  try {
    // The library draws the code as plain SVG paths from the link; nothing the shopper or the admin typed becomes markup.
    qr.value = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  } catch {
    qrFailed.value = true
  }
})

function print() {
  window.print()
}

async function copy() {
  try {
    await navigator.clipboard.writeText(url)
    copied.value = 'copied'
  } catch {
    copied.value = 'failed'
  }
}
</script>

<template>
  <div class="admin-page">
    <div class="admin-head no-print">
      <h1>Compartir tu tienda</h1>
    </div>

    <section class="card admin-section share-tools no-print">
      <p class="admin-muted">
        Este es el link de tu tienda. Pegalo en tu WhatsApp, tus redes o donde quieras, o imprimí el
        cartel con el código QR para que tus clientes lo escaneen con el celular.
      </p>
      <div class="link-row">
        <input
          class="input"
          :value="url"
          readonly
          aria-label="Link de la tienda"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button type="button" class="btn btn-secondary" @click="copy">Copiar link</button>
      </div>
      <p v-if="copied === 'copied'" class="form-note" role="status">Copiamos el link.</p>
      <p v-else-if="copied === 'failed'" class="form-error" role="status">
        No pudimos copiarlo. Seleccionalo y copialo a mano.
      </p>
      <div class="actions">
        <button type="button" class="btn btn-primary" :disabled="!qr" @click="print">
          Imprimir el cartel
        </button>
      </div>
    </section>

    <section class="poster" aria-label="Cartel para imprimir">
      <h2>{{ theme.theme?.storeName }}</h2>
      <p class="poster-lead">Escaneá y hacé tu pedido</p>
      <div v-if="qr" class="qr" role="img" aria-label="Código QR de la tienda" v-html="qr" />
      <p v-else-if="qrFailed" class="form-error">No pudimos generar el código QR.</p>
      <p class="poster-url">{{ url }}</p>
    </section>
  </div>
</template>

<style scoped>
.share-tools {
  max-width: 640px;
}

.link-row {
  display: flex;
  gap: 8px;
}

.link-row .input {
  flex: 1;
  min-width: 0;
}

.actions {
  display: flex;
  gap: 8px;
}

.poster {
  max-width: 420px;
  margin: 24px 0 0;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  border: 1px dashed var(--color-divider);
  border-radius: var(--radius-md);
}

.poster h2 {
  margin: 0;
  font-size: 28px;
}

.poster-lead {
  margin: 0;
  font-size: 18px;
}

.qr {
  width: min(100%, 280px);
  /* A QR needs a light background and a dark code to scan, whatever the store's theme. */
  background: #fff;
  color: #000;
  border-radius: var(--radius-sm);
  padding: 8px;
}

.qr :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}

.poster-url {
  margin: 0;
  font-size: 14px;
  word-break: break-all;
}
</style>

<style>
@media print {
  .no-print,
  .admin-nav {
    display: none !important;
  }

  .admin-shell,
  .admin-main {
    display: block !important;
    padding: 0 !important;
  }

  .poster {
    border: none !important;
    max-width: none !important;
    margin: 0 auto !important;
    color: #000;
  }

  .poster * {
    color: #000 !important;
  }

  body {
    background: #fff !important;
  }
}
</style>

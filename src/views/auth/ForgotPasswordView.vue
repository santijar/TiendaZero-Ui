<script setup lang="ts">
import { ref } from 'vue'

import { forgotPassword } from '@/api/auth'
import AuthLayout from '@/components/AuthLayout.vue'

const email = ref('')
const sent = ref(false)
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  if (!email.value.trim()) {
    error.value = 'Ingresá tu email.'
    return
  }
  error.value = null
  busy.value = true
  try {
    await forgotPassword(email.value.trim())
    sent.value = true
  } catch {
    error.value = 'No pudimos enviar el enlace. Probá de nuevo.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout title="Recuperar contraseña">
    <template v-if="sent">
      <p class="form-note" role="status">
        Si hay una cuenta con <span class="email">{{ email.trim() }}</span
        >, te enviamos un enlace para elegir una contraseña nueva. Vence en una hora.
      </p>
      <RouterLink :to="{ name: 'login' }" class="btn btn-secondary back"
        >Volver a ingresar</RouterLink
      >
    </template>
    <form v-else class="form-stack" novalidate @submit.prevent="submit">
      <p class="form-note">Te enviamos un enlace para elegir una contraseña nueva.</p>
      <div class="field">
        <label for="forgot-email">Email</label>
        <input
          id="forgot-email"
          v-model="email"
          class="input"
          type="email"
          autocomplete="email"
          placeholder="juan@mail.com"
        />
      </div>
      <span v-if="error" class="form-error" role="alert">{{ error }}</span>
      <button type="submit" class="btn btn-primary form-submit" :disabled="busy">
        Enviar enlace
      </button>
    </form>
  </AuthLayout>
</template>

<style scoped>
p {
  margin: 0;
}

.email {
  color: var(--color-text);
}

.back {
  align-self: flex-start;
  height: 40px;
}
</style>

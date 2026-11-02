<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { resetPassword } from '@/api/auth'
import { ApiError } from '@/api/http'
import AuthLayout from '@/components/AuthLayout.vue'

// Opened from the emailed link: /restablecer?email=…&token=…
const route = useRoute()
const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const password = ref('')
const done = ref(false)
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  error.value = null
  busy.value = true
  try {
    await resetPassword({ email: email.value, token: token.value, newPassword: password.value })
    done.value = true
  } catch (e) {
    error.value =
      (e instanceof ApiError && (e.fieldError('password') ?? e.fieldError('token'))) ||
      'No pudimos cambiar la contraseña. Probá de nuevo.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout title="Elegí una contraseña nueva">
    <template v-if="!email || !token">
      <p class="form-note">El enlace no es válido. Pedí uno nuevo.</p>
      <RouterLink :to="{ name: 'forgot-password' }" class="btn btn-secondary action">
        Pedir un enlace
      </RouterLink>
    </template>
    <template v-else-if="done">
      <p class="form-note" role="status">Listo, ya podés ingresar con tu contraseña nueva.</p>
      <RouterLink :to="{ name: 'login' }" class="btn btn-primary action">Ingresar</RouterLink>
    </template>
    <form v-else class="form-stack" novalidate @submit.prevent="submit">
      <p class="form-note">Para {{ email }}</p>
      <div class="field">
        <label for="reset-password">Contraseña nueva</label>
        <input
          id="reset-password"
          v-model="password"
          class="input"
          type="password"
          autocomplete="new-password"
        />
      </div>
      <span v-if="error" class="form-error" role="alert">{{ error }}</span>
      <button type="submit" class="btn btn-primary form-submit" :disabled="busy">
        Guardar contraseña
      </button>
    </form>
  </AuthLayout>
</template>

<style scoped>
p {
  margin: 0;
}

.action {
  align-self: flex-start;
  height: 40px;
}
</style>

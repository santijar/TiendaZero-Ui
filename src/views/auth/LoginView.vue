<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/http'
import AuthLayout from '@/components/AuthLayout.vue'
import { safeNext } from '@/lib/navigation'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  if (!email.value.trim() || !password.value) {
    error.value = 'Ingresá tu email y tu contraseña.'
    return
  }
  error.value = null
  busy.value = true
  try {
    await auth.signIn(email.value.trim(), password.value)
    await router.replace(safeNext(route.query.next))
  } catch (e) {
    error.value =
      e instanceof ApiError && e.problem?.detail
        ? e.problem.detail
        : 'No pudimos ingresar. Probá de nuevo.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout title="Ingresar">
    <form class="form-stack" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="login-email">Email</label>
        <input
          id="login-email"
          v-model="email"
          class="input"
          type="email"
          autocomplete="email"
          placeholder="juan@mail.com"
        />
      </div>
      <div class="field">
        <label for="login-password">Contraseña</label>
        <input
          id="login-password"
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
        />
      </div>
      <RouterLink :to="{ name: 'forgot-password' }" class="forgot"
        >¿Olvidaste tu contraseña?</RouterLink
      >
      <span v-if="error" class="form-error" role="alert">{{ error }}</span>
      <button type="submit" class="btn btn-primary form-submit" :disabled="busy">Ingresar</button>
    </form>
    <span class="form-note">
      ¿No tenés cuenta?
      <RouterLink :to="{ name: 'register', query: route.query }">Creá una</RouterLink>
    </span>
  </AuthLayout>
</template>

<style scoped>
.forgot {
  font-size: 12px;
  align-self: flex-start;
}
</style>

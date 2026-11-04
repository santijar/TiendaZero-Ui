<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '@/api/http'
import AuthLayout from '@/components/AuthLayout.vue'
import { usePlatformStore } from '@/stores/platform'

const platform = usePlatformStore()
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
    await platform.signIn(email.value.trim(), password.value)
    await router.replace({ name: 'home' })
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
  <AuthLayout title="Plataforma">
    <form class="form-stack" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="platform-email">Email</label>
        <input
          id="platform-email"
          v-model="email"
          class="input"
          type="email"
          autocomplete="email"
        />
      </div>
      <div class="field">
        <label for="platform-password">Contraseña</label>
        <input
          id="platform-password"
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
        />
      </div>
      <span v-if="error" class="form-error" role="alert">{{ error }}</span>
      <button type="submit" class="btn btn-primary form-submit" :disabled="busy">Ingresar</button>
    </form>
  </AuthLayout>
</template>

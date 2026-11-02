<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/http'
import AuthLayout from '@/components/AuthLayout.vue'
import { safeNext } from '@/lib/navigation'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ name: '', email: '', password: '' })
const errors = reactive<{ name?: string; email?: string; password?: string; form?: string }>({})
const busy = ref(false)

async function submit() {
  Object.assign(errors, { name: undefined, email: undefined, password: undefined, form: undefined })
  busy.value = true
  try {
    await auth.signUp(form.name.trim(), form.email.trim(), form.password)
    await router.replace(safeNext(route.query.next))
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) {
      errors.name = e.fieldError('name')
      errors.email = e.fieldError('email')
      errors.password = e.fieldError('password')
    }
    if (!errors.name && !errors.email && !errors.password) {
      errors.form = 'No pudimos crear tu cuenta. Probá de nuevo.'
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout title="Crear cuenta">
    <form class="form-stack" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="reg-name">Nombre y apellido</label>
        <input
          id="reg-name"
          v-model="form.name"
          class="input"
          autocomplete="name"
          placeholder="Juan Pérez"
          :aria-invalid="!!errors.name"
        />
        <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
      </div>
      <div class="field">
        <label for="reg-email">Email</label>
        <input
          id="reg-email"
          v-model="form.email"
          class="input"
          type="email"
          autocomplete="email"
          placeholder="juan@mail.com"
          :aria-invalid="!!errors.email"
        />
        <span v-if="errors.email" class="form-error">{{ errors.email }}</span>
      </div>
      <div class="field">
        <label for="reg-password">Contraseña</label>
        <input
          id="reg-password"
          v-model="form.password"
          class="input"
          type="password"
          autocomplete="new-password"
          :aria-invalid="!!errors.password"
        />
        <span v-if="errors.password" class="form-error">{{ errors.password }}</span>
        <span v-else class="hint">Al menos 8 caracteres, con letras y números.</span>
      </div>
      <span v-if="errors.form" class="form-error" role="alert">{{ errors.form }}</span>
      <button type="submit" class="btn btn-primary form-submit" :disabled="busy">
        Crear cuenta
      </button>
    </form>
    <span class="form-note">
      ¿Ya tenés cuenta?
      <RouterLink :to="{ name: 'login', query: route.query }">Ingresá</RouterLink>
    </span>
  </AuthLayout>
</template>

<style scoped>
.field .form-error,
.hint {
  display: block;
  margin-top: 5px;
}

.hint {
  font-size: 12px;
  color: var(--color-neutral-500);
}
</style>

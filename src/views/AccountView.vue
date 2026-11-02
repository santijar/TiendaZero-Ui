<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '@/api/http'
import ProductCard from '@/components/ProductCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'

const auth = useAuthStore()
const favorites = useFavoritesStore()
const router = useRouter()

const name = ref(auth.user?.name ?? '')
const nameStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const nameError = ref<string | null>(null)
const favoritesFailed = ref(false)

onMounted(() => {
  favorites.load().catch(() => (favoritesFailed.value = true))
})

async function saveName() {
  nameError.value = null
  nameStatus.value = 'saving'
  try {
    await auth.saveName(name.value.trim())
    nameStatus.value = 'saved'
  } catch (e) {
    nameError.value =
      (e instanceof ApiError && e.fieldError('name')) || 'No pudimos guardar el nombre.'
    nameStatus.value = 'idle'
  }
}

async function signOut() {
  await auth.signOut()
  await router.push({ name: 'home' })
}
</script>

<template>
  <div class="account">
    <div class="head">
      <h1>Mi cuenta</h1>
      <button type="button" class="btn btn-ghost" @click="signOut">Cerrar sesión</button>
    </div>

    <section class="section">
      <h6>Datos</h6>
      <form class="profile" novalidate @submit.prevent="saveName">
        <div class="field">
          <label for="acc-name">Nombre y apellido</label>
          <input
            id="acc-name"
            v-model="name"
            class="input"
            autocomplete="name"
            @input="nameStatus = 'idle'"
          />
        </div>
        <button
          type="submit"
          class="btn btn-secondary save"
          :disabled="nameStatus === 'saving' || name.trim() === auth.user?.name"
        >
          {{ nameStatus === 'saved' ? 'Guardado' : 'Guardar' }}
        </button>
      </form>
      <span v-if="nameError" class="form-error" role="alert">{{ nameError }}</span>
      <div class="field email">
        <label>Email</label>
        <span>{{ auth.user?.email }}</span>
      </div>
    </section>

    <section class="section">
      <h6>Favoritos</h6>
      <span v-if="favoritesFailed" class="form-note">No pudimos cargar tus favoritos.</span>
      <div v-else-if="favorites.items.length === 0" class="empty">
        <span class="form-note">Todavía no guardaste favoritos.</span>
        <RouterLink :to="{ name: 'home' }" class="btn btn-ghost">Ir a la tienda</RouterLink>
      </div>
      <div v-else class="grid">
        <ProductCard v-for="p in favorites.items" :key="p.slug" :product="p" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.account {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px clamp(16px, 4vw, 40px) 56px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.head h1 {
  margin: 0;
  font-size: 32px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section h6 {
  margin: 0;
  color: var(--color-neutral-400);
}

.profile {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 480px;
}

.profile .field {
  flex: 1;
}

.save {
  height: 36px;
}

.email span {
  font-size: 14px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 28px 18px;
}
</style>

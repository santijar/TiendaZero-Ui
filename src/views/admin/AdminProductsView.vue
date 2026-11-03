<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getProducts, type AdminProductRow } from '@/api/admin'
import ProductImage from '@/components/ProductImage.vue'
import { formatPrice } from '@/lib/commerce'

const router = useRouter()

const q = ref('')
const page = ref(1)
const rows = ref<AdminProductRow[]>([])
const total = ref(0)
const pageSize = ref(50)
const state = ref<'loading' | 'ready' | 'error'>('loading')

const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function load() {
  try {
    const result = await getProducts(q.value, page.value)
    rows.value = result.items
    total.value = result.total
    pageSize.value = result.pageSize
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(q, () => {
  page.value = 1
  clearTimeout(timer)
  timer = setTimeout(load, 300)
})

function goTo(p: number) {
  page.value = p
  void load()
}

function open(id: number) {
  void router.push({ name: 'admin-product', params: { id } })
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Productos</h1>
      <RouterLink :to="{ name: 'admin-product-new' }" class="btn btn-primary"
        >Nuevo producto</RouterLink
      >
    </div>

    <div class="admin-toolbar">
      <input
        v-model.trim="q"
        class="input"
        type="search"
        placeholder="Nombre, slug o SKU"
        aria-label="Buscar productos"
      />
    </div>

    <p v-if="state === 'error'" class="form-error">No pudimos cargar los productos.</p>
    <p v-else-if="state === 'ready' && rows.length === 0" class="form-note">No hay productos.</p>
    <div v-else class="admin-table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th />
            <th>Producto</th>
            <th>Categoría</th>
            <th class="admin-num">Precio</th>
            <th class="admin-num">Stock</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in rows"
            :key="p.id"
            data-link
            tabindex="0"
            @click="open(p.id)"
            @keydown.enter="open(p.id)"
          >
            <td class="thumb-cell">
              <div class="thumb">
                <ProductImage :src="p.imageUrl" :alt="p.name" placeholder="Foto" />
              </div>
            </td>
            <td>
              <RouterLink :to="{ name: 'admin-product', params: { id: p.id } }" @click.stop>
                {{ p.name }}
              </RouterLink>
              <div class="admin-muted">{{ p.slug }}</div>
            </td>
            <td>{{ p.categoryName }}</td>
            <td class="admin-num">{{ formatPrice(p.price) }}</td>
            <td class="admin-num" :class="{ out: p.totalStock === 0 }">{{ p.totalStock }}</td>
            <td>
              <span class="tag" :class="p.isActive ? 'tag-outline' : 'tag-neutral'">
                {{ p.isActive ? 'A la venta' : 'Oculto' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pages > 1" class="admin-pager">
      <button type="button" class="btn btn-ghost" :disabled="page <= 1" @click="goTo(page - 1)">
        Anterior
      </button>
      <span>Página {{ page }} de {{ pages }}</span>
      <button type="button" class="btn btn-ghost" :disabled="page >= pages" @click="goTo(page + 1)">
        Siguiente
      </button>
    </div>
  </div>
</template>

<style scoped>
.thumb-cell {
  width: 48px;
}

.thumb {
  position: relative;
  width: 40px;
  height: 50px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-neutral-900);
}

.thumb :deep(.empty span) {
  display: none;
}

td a {
  color: var(--color-text);
}

.out {
  color: var(--color-accent-300);
}
</style>

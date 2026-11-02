<template>
  <div class="not-found">
    <h1>No encontramos esta página</h1>
    <RouterLink :to="{ name: 'home' }" class="btn btn-primary">Ir a la tienda</RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  max-width: 1280px;
  margin: 0 auto;
  padding: clamp(48px, 10vw, 120px) clamp(16px, 4vw, 40px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.not-found h1 {
  margin: 0;
}

.btn {
  height: 40px;
}
</style>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="auth">
    <div class="column">
      <h1>{{ title }}</h1>
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* Same frame as checkout: flush-left column on the page grid. */
.auth {
  max-width: 1080px;
  margin: 0 auto;
  padding: clamp(32px, 6vw, 72px) clamp(16px, 4vw, 40px) 56px;
}

.column {
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

h1 {
  margin: 0;
  font-size: 32px;
}
</style>

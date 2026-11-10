<script setup lang="ts">
import { computed } from 'vue'

import { useThemeStore } from '@/stores/theme'

const theme = computed(() => useThemeStore().theme)
// The first social link, as in the design; the theme may carry more for later.
const social = computed(() => theme.value?.socialLinks[0] ?? null)
const year = new Date().getFullYear()
// The Api keeps the phone as typed; a tel: link needs only digits and a leading +.
const phoneHref = computed(() => {
  const phone = theme.value?.phone
  return phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null
})
</script>

<template>
  <footer class="footer">
    <span v-if="theme">© {{ year }} {{ theme.footerLegalName }}</span>
    <a v-if="phoneHref" :href="phoneHref" data-testid="footer-phone">{{ theme?.phone }}</a>
    <a v-if="social" :href="social.url" rel="noopener">{{ social.label }}</a>
  </footer>
</template>

<style scoped>
.footer {
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 20px clamp(16px, 4vw, 40px) 28px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--color-neutral-500);
}

a {
  color: var(--color-neutral-400);
}
</style>

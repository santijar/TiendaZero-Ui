<template>
  <footer class="footer">
    <span>© 2026 Regate Indumentaria</span>
    <a href="https://www.instagram.com/regate.indumentaria/">@regate.indumentaria</a>
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

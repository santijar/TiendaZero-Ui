<script setup lang="ts">
// Phosphor-style icons on a 256 grid, with the exact paths and stroke widths the prototype uses.
export type IconName =
  | 'search'
  | 'bag'
  | 'caret-left'
  | 'caret-right'
  | 'heart'
  | 'truck'
  | 'return'
  | 'arrow-left'
  | 'check'
  | 'x'
  | 'trash'
  | 'minus'
  | 'plus'
  | 'image'
  | 'user'

withDefaults(
  defineProps<{ name: IconName; size?: number; strokeWidth?: number; filled?: boolean }>(),
  { size: 16, strokeWidth: 16, filled: false },
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 256 256"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'search'">
      <circle cx="112" cy="112" r="72" />
      <line x1="163" y1="163" x2="224" y2="224" />
    </template>
    <template v-else-if="name === 'bag'">
      <path d="M40 72h176l-12 144H52Z" />
      <path d="M88 104V64a40 40 0 0 1 80 0v40" />
    </template>
    <polyline v-else-if="name === 'caret-left'" points="160 208 80 128 160 48" />
    <polyline v-else-if="name === 'caret-right'" points="96 48 176 128 96 208" />
    <path
      v-else-if="name === 'heart'"
      d="M128 216S24 160 24 94a54 54 0 0 1 104-20 54 54 0 0 1 104 20c0 66-104 122-104 122Z"
    />
    <template v-else-if="name === 'truck'">
      <path d="M16 72h136v104H16Z" />
      <path d="M152 104h48l40 40v32h-88" />
      <circle cx="64" cy="184" r="20" fill="var(--color-bg)" />
      <circle cx="192" cy="184" r="20" fill="var(--color-bg)" />
    </template>
    <template v-else-if="name === 'return'">
      <polyline points="80 56 32 104 80 152" />
      <path d="M32 104h128a64 64 0 0 1 0 128h-40" />
    </template>
    <template v-else-if="name === 'arrow-left'">
      <line x1="216" y1="128" x2="40" y2="128" />
      <polyline points="112 56 40 128 112 200" />
    </template>
    <polyline v-else-if="name === 'check'" points="40 136 96 192 216 72" />
    <template v-else-if="name === 'x'">
      <line x1="200" y1="56" x2="56" y2="200" />
      <line x1="200" y1="200" x2="56" y2="56" />
    </template>
    <template v-else-if="name === 'trash'">
      <line x1="216" y1="56" x2="40" y2="56" />
      <path d="M200 56v152H56V56" />
      <path d="M168 56V40a16 16 0 0 0-16-16h-48a16 16 0 0 0-16 16v16" />
    </template>
    <line v-else-if="name === 'minus'" x1="40" y1="128" x2="216" y2="128" />
    <template v-else-if="name === 'plus'">
      <line x1="40" y1="128" x2="216" y2="128" />
      <line x1="128" y1="40" x2="128" y2="216" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="128" cy="96" r="64" />
      <path d="M32 216c19.37-33.47 54.55-56 96-56s76.63 22.53 96 56" />
    </template>
    <template v-else-if="name === 'image'">
      <rect x="32" y="48" width="192" height="160" rx="8" />
      <circle cx="96" cy="104" r="16" />
      <path d="M32 176l56-56 48 48 32-32 56 56" />
    </template>
  </svg>
</template>

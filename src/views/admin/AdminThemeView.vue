<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import {
  getAdminTheme,
  previewThemeColors,
  removeThemeAsset,
  saveAdminTheme,
  uploadThemeAsset,
  type AdminTheme,
  type SaveTheme,
  type ThemeAsset,
  type ThemeColors,
} from '@/api/admin'
import { ApiError } from '@/api/http'
import { checkContrast } from '@/lib/contrast'
import { logoStyle } from '@/lib/logoStyle'
import { useThemeStore } from '@/stores/theme'

// The store's branding (docs/plan.md §3, Milestone 3): mode, accent hue, names, logo, favicon, footer copy and
// links. Colors are resolved by the Api (this screen never does OKLCH math): the preview asks it for both
// modes' variables at the chosen hue and applies them to a box, not to the page, so the editor itself stays
// readable while someone experiments.
const MAX_LINKS = 4

type Form = Omit<SaveTheme, 'footerLegalName' | 'wordmark' | 'monogram' | 'emailAccentHex'> & {
  emailAccentHex: string
  footerLegalName: string
  wordmark: string
  monogram: string
}

const state = ref<'loading' | 'ready' | 'error'>('loading')
const hasHandPickedAccent = ref(false)
const assets = reactive({ logoUrl: null as string | null, faviconUrl: null as string | null })
const form = reactive<Form>({
  mode: 'Dark',
  accentHue: 289,
  useHandPickedAccent: false,
  storeName: '',
  footerLegalName: '',
  logoWidth: null,
  logoHeight: null,
  logoMargin: null,
  logoFilter: null,
  logoBlendMode: null,
  wordmark: '',
  monogram: '',
  socialLinks: [],
  emailAccentHex: '',
  emailLogoUrl: null,
  emailReplyTo: null,
  phone: null,
})
const fieldErrors = reactive<Record<string, string>>({})
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)
const busy = ref(false)
const colors = ref<ThemeColors | null>(null)
const themeStore = useThemeStore()

// ---- loading ----

function fill(theme: AdminTheme) {
  hasHandPickedAccent.value = theme.hasHandPickedAccent
  assets.logoUrl = theme.logoUrl
  assets.faviconUrl = theme.faviconUrl
  Object.assign(form, {
    mode: theme.mode,
    accentHue: theme.accentHue,
    useHandPickedAccent: theme.hasHandPickedAccent,
    storeName: theme.storeName,
    footerLegalName: theme.footerLegalName ?? '',
    logoWidth: theme.logoWidth,
    logoHeight: theme.logoHeight,
    logoMargin: theme.logoMargin,
    logoFilter: theme.logoFilter,
    logoBlendMode: theme.logoBlendMode,
    wordmark: theme.wordmark ?? '',
    monogram: theme.monogram ?? '',
    socialLinks: theme.socialLinks.map((l) => ({ ...l })),
    emailAccentHex: theme.emailAccentHex,
    emailLogoUrl: theme.emailLogoUrl,
    emailReplyTo: theme.emailReplyTo,
    phone: theme.phone,
  })
}

onMounted(async () => {
  try {
    fill(await getAdminTheme())
    state.value = 'ready'
    await refreshColors()
  } catch {
    state.value = 'error'
  }
})

// ---- the live preview ----

let pending: AbortController | undefined
let timer: ReturnType<typeof setTimeout> | undefined

async function refreshColors() {
  pending?.abort()
  const mine = (pending = new AbortController())
  try {
    const next = await previewThemeColors(form.accentHue, form.useHandPickedAccent, mine.signal)
    if (!mine.signal.aborted) colors.value = next
  } catch {
    // Keep the last colors; the next change asks again. A save still validates on the Api.
  }
}

watch(
  () => [form.accentHue, form.useHandPickedAccent] as const,
  () => {
    clearTimeout(timer)
    timer = setTimeout(() => void refreshColors(), 250)
  },
)

onBeforeUnmount(() => {
  clearTimeout(timer)
  pending?.abort()
})

const previewVars = computed(() =>
  form.mode === 'Dark' ? colors.value?.dark : colors.value?.light,
)
const contrast = computed(() =>
  colors.value
    ? { Dark: checkContrast(colors.value.dark), Light: checkContrast(colors.value.light) }
    : null,
)
const failing = computed(() => contrast.value?.[form.mode].filter((c) => !c.passes) ?? [])

const logoCss = computed(() =>
  assets.logoUrl
    ? logoStyle(
        {
          url: assets.logoUrl,
          width: form.logoWidth || null,
          height: form.logoHeight || null,
          margin: form.logoMargin || null,
          filter: form.logoFilter || null,
          blendMode: form.logoBlendMode || null,
        },
        form.mode,
      )
    : null,
)
const firstLink = computed(() => form.socialLinks.find((l) => l.label && l.url) ?? null)
const year = new Date().getFullYear()
const monogramShown = computed(() => form.monogram || initials(form.storeName))

function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words.slice(0, 3).map((w) => w[0]) : [(words[0] ?? '').slice(0, 2)])
    .join('')
    .toUpperCase()
}

// ---- saving ----

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    return (
      Object.values(e.problem?.errors ?? {})[0]?.[0] ?? e.problem?.detail ?? 'No pudimos guardar.'
    )
  }
  return 'No pudimos guardar.'
}

function showError(e: unknown) {
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
  if (e instanceof ApiError) {
    for (const [field, messages] of Object.entries(e.problem?.errors ?? {})) {
      fieldErrors[field] = messages[0] ?? ''
    }
  }
  notice.value = { kind: 'error', text: messageOf(e) }
}

const orNull = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null)

async function save() {
  busy.value = true
  notice.value = null
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
  try {
    const saved = await saveAdminTheme({
      ...form,
      footerLegalName: orNull(form.footerLegalName),
      wordmark: orNull(form.wordmark),
      monogram: orNull(form.monogram),
      logoWidth: orNull(form.logoWidth),
      logoHeight: orNull(form.logoHeight),
      logoMargin: orNull(form.logoMargin),
      logoFilter: orNull(form.logoFilter),
      logoBlendMode: orNull(form.logoBlendMode),
      emailAccentHex: orNull(form.emailAccentHex),
      emailLogoUrl: orNull(form.emailLogoUrl),
      emailReplyTo: orNull(form.emailReplyTo),
      phone: orNull(form.phone),
      socialLinks: form.socialLinks.filter((l) => l.label.trim() || l.url.trim()),
    })
    fill(saved)
    notice.value = { kind: 'ok', text: 'Guardado. La tienda ya muestra los cambios.' }
    // The storefront (and this admin shell) wear the saved theme.
    void themeStore.load().catch(() => {})
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

// ---- logo and favicon ----

async function upload(asset: ThemeAsset, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  notice.value = null
  try {
    const saved = await uploadThemeAsset(asset, file)
    assets.logoUrl = saved.logoUrl
    assets.faviconUrl = saved.faviconUrl
    notice.value = {
      kind: 'ok',
      text: asset === 'logo' ? 'Logo actualizado.' : 'Ícono actualizado.',
    }
    void themeStore.load().catch(() => {})
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

async function removeAsset(asset: ThemeAsset) {
  busy.value = true
  notice.value = null
  try {
    const saved = await removeThemeAsset(asset)
    assets.logoUrl = saved.logoUrl
    assets.faviconUrl = saved.faviconUrl
    if (asset === 'logo') {
      // The server drops the logo's display settings with it.
      form.logoWidth =
        form.logoHeight =
        form.logoMargin =
        form.logoFilter =
        form.logoBlendMode =
          null
    }
    void themeStore.load().catch(() => {})
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

// ---- links ----

function addLink() {
  if (form.socialLinks.length < MAX_LINKS) form.socialLinks.push({ label: '', url: '' })
}

const ratioText = (ratio: number | null) => (ratio === null ? '—' : `${ratio.toFixed(1)}:1`)
</script>

<template>
  <div class="admin-page">
    <div class="admin-head">
      <h1>Marca</h1>
    </div>

    <p v-if="state === 'loading'" class="form-note">Cargando…</p>
    <p v-else-if="state === 'error'" class="form-error">No pudimos cargar la marca de la tienda.</p>

    <div v-else class="editor">
      <form class="form-stack panel" novalidate @submit.prevent="save">
        <section class="card admin-section">
          <h2>La tienda</h2>
          <div class="field">
            <label for="t-name">Nombre</label>
            <input id="t-name" v-model="form.storeName" class="input" maxlength="80" />
            <span v-if="fieldErrors.storeName" class="form-error">{{ fieldErrors.storeName }}</span>
          </div>
          <div class="field">
            <label for="t-legal">Razón social (pie de página)</label>
            <input id="t-legal" v-model="form.footerLegalName" class="input" maxlength="120" />
            <span v-if="fieldErrors.footerLegalName" class="form-error">
              {{ fieldErrors.footerLegalName }}
            </span>
          </div>
        </section>

        <section class="card admin-section">
          <h2>Apariencia</h2>
          <div class="field">
            <span class="label" id="t-mode-label">Modo</span>
            <div class="modes" role="radiogroup" aria-labelledby="t-mode-label">
              <label class="radio">
                <input v-model="form.mode" type="radio" name="mode" value="Dark" />
                <span class="dot"></span>Oscuro
              </label>
              <label class="radio">
                <input v-model="form.mode" type="radio" name="mode" value="Light" />
                <span class="dot"></span>Claro
              </label>
            </div>
            <span v-if="fieldErrors.mode" class="form-error">{{ fieldErrors.mode }}</span>
          </div>

          <div class="field">
            <label for="t-hue">Color de acento (tono)</label>
            <div class="hue">
              <input
                id="t-hue"
                v-model.number="form.accentHue"
                type="range"
                min="0"
                max="360"
                :disabled="form.useHandPickedAccent"
              />
              <input
                v-model.number="form.accentHue"
                class="input hue-number"
                type="number"
                min="0"
                max="360"
                aria-label="Tono, de 0 a 360"
                :disabled="form.useHandPickedAccent"
              />
            </div>
            <span v-if="fieldErrors.accentHue" class="form-error">{{ fieldErrors.accentHue }}</span>
          </div>
          <label v-if="hasHandPickedAccent" class="admin-check">
            <input v-model="form.useHandPickedAccent" type="checkbox" />
            Usar el acento elegido a mano para esta tienda
          </label>
          <p v-if="hasHandPickedAccent && !form.useHandPickedAccent" class="admin-muted">
            Al guardar con el acento generado, el elegido a mano se descarta y no se puede volver a
            activar desde acá.
          </p>

          <div class="contrast" aria-live="polite">
            <h3>Contraste del acento</h3>
            <table v-if="contrast" class="contrast-table">
              <thead>
                <tr>
                  <th></th>
                  <th
                    v-for="mode in ['Dark', 'Light'] as const"
                    :key="mode"
                    :class="{ now: mode === form.mode }"
                  >
                    {{ mode === 'Dark' ? 'Oscuro' : 'Claro' }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(check, i) in contrast[form.mode]" :key="check.id">
                  <td>
                    {{ check.label }}
                    <span class="admin-muted">(mín. {{ check.minimum }}:1)</span>
                  </td>
                  <td
                    v-for="mode in ['Dark', 'Light'] as const"
                    :key="mode"
                    :class="{ now: mode === form.mode, bad: !contrast[mode][i]!.passes }"
                  >
                    {{ ratioText(contrast[mode][i]!.ratio) }}
                    <span class="sr-only">{{
                      contrast[mode][i]!.passes ? 'cumple' : 'no cumple'
                    }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="failing.length" class="form-error" role="alert">
              Con este tono, en modo {{ form.mode === 'Dark' ? 'oscuro' : 'claro' }}, el acento
              puede costar leerse: {{ failing.map((c) => c.label.toLowerCase()).join(', ') }}. Probá
              otro tono o el otro modo. Podés guardar igual.
            </p>
          </div>
        </section>

        <section class="card admin-section">
          <h2>Logo</h2>
          <div class="asset">
            <span
              v-if="assets.logoUrl"
              class="logo-thumb"
              :style="{ backgroundImage: `url(${JSON.stringify(assets.logoUrl)})` }"
            />
            <div class="asset-actions">
              <label class="btn btn-secondary file">
                {{ assets.logoUrl ? 'Cambiar logo' : 'Subir logo' }}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Archivo del logo"
                  :disabled="busy"
                  @change="upload('logo', $event)"
                />
              </label>
              <button
                v-if="assets.logoUrl"
                type="button"
                class="btn btn-ghost"
                :disabled="busy"
                @click="removeAsset('logo')"
              >
                Quitar
              </button>
            </div>
          </div>
          <span v-if="fieldErrors.file" class="form-error">{{ fieldErrors.file }}</span>
          <p class="admin-muted">
            JPG, PNG o WebP. Sin logo, la tienda muestra el texto de marca o el monograma.
          </p>

          <div class="two">
            <div class="field">
              <label for="t-wordmark">Texto de marca</label>
              <input id="t-wordmark" v-model="form.wordmark" class="input" maxlength="40" />
              <span v-if="fieldErrors.wordmark" class="form-error">{{ fieldErrors.wordmark }}</span>
            </div>
            <div class="field">
              <label for="t-monogram">Monograma</label>
              <input id="t-monogram" v-model="form.monogram" class="input" maxlength="4" />
              <span v-if="fieldErrors.monogram" class="form-error">{{ fieldErrors.monogram }}</span>
            </div>
          </div>

          <details
            class="advanced"
            :open="
              !!(
                form.logoWidth ||
                form.logoHeight ||
                form.logoMargin ||
                form.logoFilter ||
                form.logoBlendMode
              )
            "
          >
            <summary>Ajustes del logo</summary>
            <div class="two">
              <div class="field">
                <label for="t-lw">Ancho</label>
                <input id="t-lw" v-model="form.logoWidth" class="input" placeholder="44px" />
                <span v-if="fieldErrors.logoWidth" class="form-error">{{
                  fieldErrors.logoWidth
                }}</span>
              </div>
              <div class="field">
                <label for="t-lh">Alto</label>
                <input id="t-lh" v-model="form.logoHeight" class="input" placeholder="44px" />
                <span v-if="fieldErrors.logoHeight" class="form-error">{{
                  fieldErrors.logoHeight
                }}</span>
              </div>
              <div class="field">
                <label for="t-lm">Margen</label>
                <input id="t-lm" v-model="form.logoMargin" class="input" placeholder="-4px -6px" />
                <span v-if="fieldErrors.logoMargin" class="form-error">{{
                  fieldErrors.logoMargin
                }}</span>
              </div>
              <div class="field">
                <label for="t-lf">Filtro</label>
                <input id="t-lf" v-model="form.logoFilter" class="input" placeholder="invert(1)" />
                <span v-if="fieldErrors.logoFilter" class="form-error">{{
                  fieldErrors.logoFilter
                }}</span>
              </div>
              <div class="field">
                <label for="t-lb">Mezcla</label>
                <input
                  id="t-lb"
                  v-model="form.logoBlendMode"
                  class="input"
                  placeholder="lighten, multiply…"
                />
                <span v-if="fieldErrors.logoBlendMode" class="form-error">{{
                  fieldErrors.logoBlendMode
                }}</span>
              </div>
            </div>
            <p class="admin-muted">
              Sin mezcla, el logo de una tienda oscura usa «lighten» y el de una clara se muestra
              tal cual.
            </p>
          </details>
        </section>

        <section class="card admin-section">
          <h2>Ícono de la pestaña</h2>
          <div class="asset">
            <span
              v-if="assets.faviconUrl"
              class="fav-thumb"
              :style="{ backgroundImage: `url(${JSON.stringify(assets.faviconUrl)})` }"
            />
            <div class="asset-actions">
              <label class="btn btn-secondary file">
                {{ assets.faviconUrl ? 'Cambiar ícono' : 'Subir ícono' }}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.ico"
                  aria-label="Archivo del ícono"
                  :disabled="busy"
                  @change="upload('favicon', $event)"
                />
              </label>
              <button
                v-if="assets.faviconUrl"
                type="button"
                class="btn btn-ghost"
                :disabled="busy"
                @click="removeAsset('favicon')"
              >
                Quitar
              </button>
            </div>
          </div>
        </section>

        <section class="card admin-section">
          <h2>Links del pie</h2>
          <div v-for="(link, i) in form.socialLinks" :key="i" class="link-row">
            <input
              v-model="link.label"
              class="input"
              placeholder="@usuario"
              :aria-label="`Nombre del link ${i + 1}`"
              maxlength="40"
            />
            <input
              v-model="link.url"
              class="input"
              placeholder="https://…"
              :aria-label="`Dirección del link ${i + 1}`"
            />
            <button type="button" class="btn btn-ghost" @click="form.socialLinks.splice(i, 1)">
              Quitar
            </button>
          </div>
          <span v-if="fieldErrors.socialLinks" class="form-error">{{
            fieldErrors.socialLinks
          }}</span>
          <div class="admin-actions">
            <button
              v-if="form.socialLinks.length < MAX_LINKS"
              type="button"
              class="btn btn-ghost"
              @click="addLink"
            >
              Agregar link
            </button>
          </div>
          <p class="admin-muted">La tienda muestra el primero.</p>
        </section>

        <section class="card admin-section">
          <h2>Emails</h2>
          <p class="admin-muted">Los mails no leen los colores de la tienda: usan estos valores.</p>
          <div class="two">
            <div class="field">
              <label for="t-email-accent">Color de acento</label>
              <input
                id="t-email-accent"
                v-model="form.emailAccentHex"
                class="input"
                placeholder="#7363c0"
              />
              <span v-if="fieldErrors.emailAccentHex" class="form-error">{{
                fieldErrors.emailAccentHex
              }}</span>
            </div>
            <div class="field">
              <label for="t-email-logo">Logo (dirección https)</label>
              <input
                id="t-email-logo"
                v-model="form.emailLogoUrl"
                class="input"
                placeholder="https://…"
              />
              <span v-if="fieldErrors.emailLogoUrl" class="form-error">{{
                fieldErrors.emailLogoUrl
              }}</span>
            </div>
          </div>
          <div class="field">
            <label for="t-email-reply">Dirección de respuesta</label>
            <input
              id="t-email-reply"
              v-model="form.emailReplyTo"
              class="input"
              type="email"
              autocomplete="off"
              placeholder="contacto@tutienda.com"
            />
            <span v-if="fieldErrors.emailReplyTo" class="form-error">{{
              fieldErrors.emailReplyTo
            }}</span>
            <span v-else-if="form.emailReplyTo?.trim()" class="admin-muted">
              Cuando un cliente responde un mail de tu tienda, te llega acá.
            </span>
            <span v-else class="form-error" data-testid="reply-warning">
              Sin dirección, las respuestas de tus clientes no le llegan a nadie. Cargá la dirección
              donde querés recibirlas.
            </span>
          </div>
          <div class="field">
            <label for="t-phone">Teléfono de contacto</label>
            <input
              id="t-phone"
              v-model="form.phone"
              class="input"
              type="tel"
              autocomplete="off"
              placeholder="+54 11 5555-1234"
            />
            <span v-if="fieldErrors.phone" class="form-error">{{ fieldErrors.phone }}</span>
            <span v-else class="admin-muted">
              Con código de área. Aparece en el pie de la tienda; si lo dejás vacío, no se muestra.
            </span>
          </div>
        </section>

        <div class="save-bar">
          <button type="submit" class="btn btn-primary" :disabled="busy">Guardar cambios</button>
          <span
            v-if="notice"
            :class="notice.kind === 'ok' ? 'form-note' : 'form-error'"
            role="status"
          >
            {{ notice.text }}
          </span>
        </div>
      </form>

      <aside class="panel preview-panel" aria-label="Vista previa">
        <h2 class="preview-title">Vista previa</h2>
        <div class="preview" :style="previewVars" :data-mode="form.mode.toLowerCase()">
          <div class="p-header">
            <span
              v-if="logoCss"
              class="p-logo"
              role="img"
              :aria-label="form.storeName"
              :style="logoCss"
            />
            <span v-else-if="!form.wordmark" class="p-monogram">{{ monogramShown }}</span>
            <span v-if="form.wordmark" class="p-wordmark">{{ form.wordmark }}</span>
            <span class="p-nav">Camisetas</span>
            <span class="p-nav active">Shorts</span>
          </div>
          <div class="p-body">
            <div class="card p-card">
              <span class="tag">Nuevo</span>
              <strong>{{ form.storeName || 'Tu tienda' }}</strong>
              <span class="p-muted">Camiseta titular · $48.900</span>
              <span class="btn btn-secondary p-btn">Agregar</span>
            </div>
            <div class="swatches" aria-hidden="true">
              <span v-for="n in 9" :key="n" :style="{ background: `var(--color-accent-${n}00)` }" />
            </div>
          </div>
          <div class="p-footer">
            <span>© {{ year }} {{ form.footerLegalName || form.storeName }}</span>
            <span v-if="firstLink">{{ firstLink.label }}</span>
          </div>
        </div>
        <p class="admin-muted">
          Así se ve en {{ form.mode === 'Dark' ? 'modo oscuro' : 'modo claro' }}. Los cambios se
          aplican a la tienda cuando guardás.
        </p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
  gap: 24px;
  align-items: start;
}

.panel {
  min-width: 0;
}

.preview-panel {
  position: sticky;
  top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
}

.modes {
  display: flex;
  gap: 20px;
}

.hue {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hue input[type='range'] {
  flex: 1;
  min-width: 0;
}

.hue-number {
  width: 84px;
  flex: none;
}

.two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 12px;
}

.asset {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.asset-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.logo-thumb,
.fav-thumb {
  flex: none;
  background: center / contain no-repeat var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.logo-thumb {
  width: 96px;
  height: 48px;
}

.fav-thumb {
  width: 32px;
  height: 32px;
}

.file {
  position: relative;
  cursor: pointer;
}

.file input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
}

.advanced summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--color-neutral-300);
  margin-bottom: 10px;
}

.link-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
  gap: 8px;
}

.save-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.contrast h3 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 500;
}

.contrast-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.contrast-table th,
.contrast-table td {
  text-align: left;
  padding: 4px 8px 4px 0;
}

.contrast-table .now {
  color: var(--color-text);
  font-weight: 500;
}

.contrast-table td.bad {
  color: var(--color-accent-300);
}

.contrast-table td.bad::before {
  content: '⚠ ';
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* The mock storefront: the previewed store's variables are set on this box only. */
.preview {
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg);
  color: var(--color-text);
  box-shadow: var(--shadow-md);
  font-size: 13px;
}

.p-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  box-shadow: 0 1px 0 var(--color-neutral-900);
}

.p-logo {
  flex: none;
  background: center / contain no-repeat;
}

.p-wordmark {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.14em;
}

.p-monogram {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  box-sizing: border-box;
  border-radius: 999px;
  font-size: 10px;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  display: grid;
  place-items: center;
}

.p-nav {
  color: var(--color-neutral-300);
}

.p-nav.active {
  color: var(--color-accent);
}

.p-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.p-card {
  gap: 6px;
  padding: 12px;
  background: var(--color-surface);
  align-items: flex-start;
}

.p-muted {
  color: var(--color-neutral-400);
  font-size: 12px;
}

.p-btn {
  height: 30px;
  pointer-events: none;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  height: 14px;
  border-radius: 4px;
  overflow: hidden;
}

.p-footer {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px 12px;
  font-size: 11px;
  color: var(--color-neutral-500);
}

@media (max-width: 980px) {
  .editor {
    grid-template-columns: minmax(0, 1fr);
  }

  .preview-panel {
    position: static;
    order: -1;
  }
}
</style>

import type { Theme } from '@/api/theme'

// Puts a store's theme on the document: its CSS custom properties (which override Nocturne's defaults), the tab
// title and the favicon. Kept apart from the store so tests and the platform preview can call it directly.
let applied: string[] = []
// The page's own title (index.html), kept the first time a theme replaces it so a reset can restore it.
let defaultTitle: string | null = null

function faviconLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
}

export function applyTheme(theme: Theme) {
  clearVariables()
  const root = document.documentElement
  for (const [name, value] of Object.entries(theme.cssVariables)) {
    root.style.setProperty(name, value)
  }
  applied = Object.keys(theme.cssVariables)
  root.dataset.themeMode = theme.mode.toLowerCase()
  // The ground colors above are light or dark: tell the browser so form controls and scrollbars match.
  root.style.colorScheme = theme.mode === 'Light' ? 'light' : 'dark'
  defaultTitle ??= document.title
  document.title = theme.storeName
  const link = faviconLink()
  if (link && theme.faviconUrl) link.href = theme.faviconUrl
}

export function clearTheme() {
  clearVariables()
  const root = document.documentElement
  delete root.dataset.themeMode
  root.style.removeProperty('color-scheme')
  if (defaultTitle !== null) document.title = defaultTitle
}

function clearVariables() {
  for (const name of applied) document.documentElement.style.removeProperty(name)
  applied = []
}

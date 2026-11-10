// Client for GET /api/theme (src/TiendaZero.Api/Theme in the Api repo): a store's branding, already resolved.
import { getJson } from './http'

export interface ThemeLogo {
  url: string
  width: string | null
  height: string | null
  margin: string | null
  filter: string | null
  blendMode: string | null
}

export interface SocialLink {
  label: string
  url: string
}

export interface Theme {
  mode: 'Dark' | 'Light'
  storeName: string
  footerLegalName: string
  // Plain CSS custom properties (name to value), applied to the document as they are: the Ui never does color math.
  cssVariables: Record<string, string>
  logo: ThemeLogo | null
  wordmark: string | null
  monogram: string
  faviconUrl: string | null
  socialLinks: SocialLink[]
  // The store's contact phone as its owner typed it; null when none is set.
  phone: string | null
}

export function getTheme(): Promise<Theme> {
  return getJson<Theme>('/api/theme')
}

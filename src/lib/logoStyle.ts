import type { CSSProperties } from 'vue'

export interface LogoDisplay {
  url: string
  width: string | null
  height: string | null
  margin: string | null
  filter: string | null
  blendMode: string | null
}

type MixBlendMode = NonNullable<CSSProperties['mixBlendMode']>

// How a store's logo is drawn, in the header and in the branding editor's preview: as a background, so its size,
// margin, filter and blend come straight from the theme. Without an explicit blend, a dark store's logo uses
// Nocturne's `lighten` (its dark artwork background drops out against the page, like the photos); a light
// store's is drawn as it is.
export function logoStyle(logo: LogoDisplay, mode: 'Dark' | 'Light'): CSSProperties {
  return {
    width: logo.width ?? '44px',
    height: logo.height ?? '44px',
    margin: logo.margin ?? '0',
    backgroundImage: `url(${JSON.stringify(logo.url)})`,
    filter: logo.filter ?? 'none',
    // Free text from the theme; the browser ignores a value it doesn't know.
    mixBlendMode: (logo.blendMode ?? (mode === 'Dark' ? 'lighten' : 'normal')) as MixBlendMode,
  }
}

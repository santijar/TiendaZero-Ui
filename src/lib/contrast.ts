// WCAG contrast for the branding editor's check (docs/plan.md §7): a tenant's hue can land where Nocturne's
// accent-on-ground ratio no longer holds, and the two modes' ramps don't share values, so the editor measures the
// colors the Api resolved, in both modes. Only sRGB math lives here; the OKLCH ramps stay on the server.

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

// Relative luminance of #rrggbb, or null for anything else (rgba() dividers, named colors).
export function luminance(hex: string): number | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!match) return null
  const [r, g, b] = [match[1]!, match[2]!, match[3]!].map((h) => channel(parseInt(h, 16)))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

// 1 (no contrast) to 21 (black on white); null when either color isn't a plain hex.
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  const [light, dark] = la >= lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

export interface ContrastCheck {
  id: string
  label: string
  // The least ratio that reads well for this pairing.
  minimum: number
  ratio: number | null
  passes: boolean
}

// The pairings the storefront relies on: the accent as outlines, links and focus rings against both grounds
// (Nocturne's readme asks 3:1), and the accent's light-on-tint text pair (4.5:1).
const CHECKS = [
  {
    id: 'accent-bg',
    label: 'Acento sobre el fondo',
    minimum: 3,
    a: '--color-accent',
    b: '--color-bg',
  },
  {
    id: 'accent-surface',
    label: 'Acento sobre tarjetas',
    minimum: 3,
    a: '--color-accent',
    b: '--color-surface',
  },
  {
    id: 'tint-text',
    label: 'Texto sobre el tinte del acento',
    minimum: 4.5,
    a: '--color-accent-200',
    b: '--color-accent-900',
  },
] as const

export function checkContrast(variables: Record<string, string>): ContrastCheck[] {
  return CHECKS.map((c) => {
    const ratio = contrastRatio(variables[c.a] ?? '', variables[c.b] ?? '')
    return {
      id: c.id,
      label: c.label,
      minimum: c.minimum,
      ratio,
      passes: ratio !== null && ratio >= c.minimum,
    }
  })
}

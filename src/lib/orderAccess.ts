// Order access tokens this browser has seen, by order number, so the order page still opens after
// the round trip through Mercado Pago (the return URL deliberately carries no token) or a reload.
// Storage can be unavailable; then the emailed link is the way back in.
const KEY = 'tiendazero.orderTokens'
const MAX_REMEMBERED = 20

function read(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function rememberOrderToken(number: string, token: string) {
  try {
    const tokens = read()
    delete tokens[number]
    tokens[number] = token
    const entries = Object.entries(tokens).slice(-MAX_REMEMBERED)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // See above.
  }
}

export function orderToken(number: string): string | null {
  return read()[number] ?? null
}

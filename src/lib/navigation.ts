// Where to go after signing in. Only same-site paths are followed, so a crafted
// ?next=https://evil.example (or //evil.example, or /\evil.example) can't turn the login page into
// an open redirect.
export function safeNext(next: unknown, fallback = '/cuenta'): string {
  if (typeof next !== 'string' || !next.startsWith('/') || /^\/[/\\]/.test(next)) return fallback
  return next
}

// Leaves the app for another site (Mercado Pago's checkout). Its own function so tests can stub it.
export function leaveTo(url: string) {
  window.location.assign(url)
}

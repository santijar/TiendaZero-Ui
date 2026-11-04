// The platform admin's tool (docs/plan.md §1) lives on its own host, not in any store's storefront. The page
// knows which one it is on by comparing its host to VITE_PLATFORM_HOST, which is set per environment
// (platform.localhost in development). Anything else is a store's own site, which has none of this: main.ts
// only loads the platform code on the platform host, so a shopper never downloads it.
export function platformHost(): string | null {
  const host = import.meta.env.VITE_PLATFORM_HOST as string | undefined
  return host ? host.toLowerCase() : null
}

export function isPlatformHost(): boolean {
  const host = platformHost()
  return host !== null && window.location.hostname.toLowerCase() === host
}

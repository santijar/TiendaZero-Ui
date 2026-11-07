// Carries a store's /api and /media calls to the Api, for the Worker (see worker/index.ts).
//
// The Api tells stores apart by the request's Host, so a call must reach it *as that store's host*. The browser only
// ever talks to the store's own origin (`regate.tudominio.com/api/...`), which also keeps the session cookie (host-only,
// SameSite=Strict) working and means the Api needs no CORS policy. This function forwards the call to the Api's own
// address and states the original host, address and scheme in X-Forwarded-*, signed with a shared secret the Api
// checks (Proxy__Secret in TiendaZero-Api). Anything the browser sent under those names is replaced, never passed on.

export interface ProxyEnv {
  // The Api's address, e.g. https://tiendazero-api.up.railway.app (no path).
  API_ORIGIN?: string
  // Shared with the Api (Proxy__Secret). Set as a Worker secret (`wrangler secret put PROXY_SECRET`), never in the repo.
  PROXY_SECRET?: string
}

const FORWARDED = ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-proxy-secret', 'forwarded']

export async function proxyToApi(request: Request, env: ProxyEnv): Promise<Response> {
  if (!env.API_ORIGIN) {
    return new Response('API_ORIGIN is not configured.', { status: 500 })
  }

  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN)

  const headers = new Headers(request.headers)
  for (const name of FORWARDED) headers.delete(name)
  headers.set('X-Forwarded-Host', incoming.host)
  headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''))
  const shopper = request.headers.get('CF-Connecting-IP')
  if (shopper) headers.set('X-Forwarded-For', shopper)
  if (env.PROXY_SECRET) headers.set('X-Proxy-Secret', env.PROXY_SECRET)

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  return fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
    // Let the browser follow redirects itself, so a redirect to /something stays on the store's origin.
    redirect: 'manual',
    // Required by the runtime to stream a request body.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit)
}

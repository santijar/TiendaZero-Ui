import { proxyToApi, type ProxyEnv } from './proxy'

// The store's Worker. Static files (the SPA, with index.html as the fallback for every route) are served by Cloudflare
// from the built `dist/` folder; only /api/* and /media/* reach this code (`run_worker_first` in wrangler.jsonc), and
// they are forwarded to the Api as that store's host (see proxy.ts).
export default {
  fetch: (request: Request, env: ProxyEnv) => proxyToApi(request, env),
}

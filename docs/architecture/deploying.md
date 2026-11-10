# Deploying the storefront (Milestone 6)

The storefront is served by a **Cloudflare Worker with static assets** (`wrangler.jsonc`, `worker/`), not by Pages:
Pages cannot take a wildcard custom domain (`*.yourdomain.com`), and stores are created without touching Cloudflare.

- **Static files**: `npm run build-only` writes `dist/`; the Worker serves it and answers `index.html` (200) for any route that
  is not a file, so the Vue router handles it (`not_found_handling: single-page-application`). `public/_headers` caches the
  hashed `assets/` for a year and `index.html` not at all.
- **`/api/*` and `/media/*`** are the only requests that run Worker code (`run_worker_first`). `worker/proxy.ts` forwards them to
  `API_ORIGIN` **as the store's own host**: the Api tells stores apart by Host, so the call must carry it, in `X-Forwarded-Host`,
  with the shopper's address (`CF-Connecting-IP` as `X-Forwarded-For`), the scheme, and `X-Proxy-Secret`. Whatever the browser
  sent under those names is replaced. Because the browser only talks to its own store's origin, the Api needs **no CORS policy**
  and the session cookie (host-only, `SameSite=Strict`) keeps working. The Api side is `Proxy__Enabled`, `Proxy__Secret`,
  `Proxy__ForwardLimit` (TiendaZero-Api, `Security/ProxyHeaders.cs`).
- **Settings**: `API_ORIGIN` in `wrangler.jsonc` (`vars`); `PROXY_SECRET` is a secret (`npx wrangler secret put PROXY_SECRET`, the
  same value as the Api's `Proxy__Secret`). `VITE_PLATFORM_HOST` is a build-time variable (the platform admin's host).
- **Routes**: uncomment `routes` in `wrangler.jsonc` with the real domain once it is on Cloudflare (`*.yourdomain.com/*`; the
  platform host is one of the subdomains). Do **not** make an `api.yourdomain.com` on the same zone: the wildcard would send it to
  the Worker. Use the Api's own Railway address as `API_ORIGIN` and for `MercadoPago__PublicApiUrl` (webhooks hit the Api directly).
- **Checked locally** (not on Cloudflare): `npx wrangler dev --var API_ORIGIN:http://localhost:5043 --var PROXY_SECRET:...` against an
  Api started with `Proxy__Enabled=true Proxy__Secret=...` serves the SPA and its deep routes, resolves `regate.localhost` and
  `indians.localhost` to their own stores through `/api`, answers 404 for an unknown store, and ignores a forged `X-Forwarded-Host`.
  `npx wrangler deploy --dry-run` validates the configuration. Tests: `workerProxy.spec.ts`.
- **Deploy on merge** (`deploy` job in `.github/workflows/ci.yml`): after a push to `main` whose CI passed, it builds and runs
  `wrangler deploy`. It does nothing until the repository variable `DEPLOY_ENABLED` is `true`. Needs the secrets
  `CLOUDFLARE_API_TOKEN` (permission to edit Workers) and `CLOUDFLARE_ACCOUNT_ID`, and the variable `VITE_PLATFORM_HOST`.
  Not run yet: the first real deploy will be its test. Replace the `REPLACE-WITH-...` placeholders in `wrangler.jsonc` first, or
  it publishes a Worker that proxies to nowhere (the Worker answers 500 "API_ORIGIN is not configured" while it is unset or still a placeholder).

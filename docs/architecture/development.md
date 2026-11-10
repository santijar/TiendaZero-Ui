# Development and testing

The stack, the dev server and how the tests fake the Api.

- Vue 3 + Vite + TypeScript + Vue Router + Pinia. Vitest + @vue/test-utils for tests.
  oxlint + ESLint + Prettier (no semicolons, single quotes, 100 cols).

- The dev server proxies `/api` and `/media` (product photos) to `http://localhost:5043` (the Api's `http` launch profile),
  so run the Api locally alongside `npm run dev`. **Open the storefront at
  `http://regate.localhost:5173`** (Milestone 2): the Api picks the tenant from the Host header,
  so the proxy passes the browser's host through (`changeOrigin: false` in `vite.config.ts`;
  Vite's string shorthand would set it to `true` and rewrite the host). `localhost:5173` and
  `127.0.0.1:5173` belong to no tenant and get a 404 from `/api`.

- Tests stub `fetch` with an in-memory Api (`src/__tests__/fakeApi.ts`: catalog, cart, auth,
  account, orders and admin). Build a fresh router per mounted app with `createAppRouter(createMemoryHistory())`,
  because vue-router runs guards in the first app it was installed on. Preload lazily-routed views
  in `beforeAll` (see `auth.spec.ts`), since `flushPromises` doesn't wait for a first dynamic
  import.

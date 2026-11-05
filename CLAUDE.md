# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## This repository

**TiendaZero-Ui**: the storefront frontend of TiendaZero, a multi-tenant white-label e-commerce
platform (Regate is the first tenant). The backend is a separate repo, TiendaZero-Api
(https://github.com/santijar/TiendaZero-Api). Implementation follows `docs/plan.md`
(milestones 0–6). **Milestone 0 (scaffold + CI) is done.** Milestone 1 is in progress: the
storefront screens from the design bundle are built (step 1). The catalog (categories,
collections, product list and detail) comes from the Api (step 2, `src/api/catalog.ts`). The
cart comes from the Api (step 3, `src/api/cart.ts`). Customer accounts are built (step 4,
`src/api/auth.ts`, `src/stores/auth.ts`): `/ingresar`, `/registrarse`, `/recuperar`,
`/restablecer` and `/cuenta` (profile name, order history and favorites). Checkout is real
(step 5, `src/api/orders.ts`): confirming places the order with one idempotency key per checkout
visit. A Mercado Pago order then leaves for Checkout Pro (`leaveTo` in `src/lib/navigation.ts`,
stubbed in tests). A transfer order goes to `/pedido/:number`, which shows the bank details.
The order page also opens from the emailed link (`?token=`, remembered in localStorage by
`src/lib/orderAccess.ts` and then dropped from the URL). Every time it opens an unpaid Mercado Pago order it
syncs with the Api, because Mercado Pago offers no way back to a non-public address and shoppers
close tabs. When it's opened from Mercado Pago's return (`payment_id`/`collection_status` in the
query), it also polls briefly while the payment is still pending.
Paid orders show their fulfillment progress.

The store admin (step 6) lives under `/admin`, for `TenantAdmin`/`PlatformAdmin` users
(`auth.isAdmin`); everyone else gets the 404 page. Routes with `meta.admin` render
`AdminLayout` (its own sidebar shell) instead of the storefront's header, footer and cart. The
screens are orders (`/admin/pedidos`, detail with confirm-transfer and fulfillment actions),
products (`/admin/productos`, editor with sizes/stock and photo upload) and categories and
collections (`/admin/catalogo`). The client is `src/api/admin.ts`. The product editor sends a
size's stock only when it was edited; on a 409 it offers to pull the current stock. The admin has
no design in the bundle: it's built from Nocturne's `.table`, `.card`, `.input` and `.tag`
(`src/assets/admin.css`).

- The home promo carousel is static content in `src/catalog/promos.ts`. Each slide's CTA applies
  a category or collection slug filter.
- Session: the access token lives only in the auth store's memory. On page load, `auth.ready()`
  restores the session from the Api's httpOnly refresh cookie. `src/api/http.ts` adds the bearer
  token to every call and, on a 401 outside `/api/auth/`, refreshes once (one shared refresh for
  concurrent calls) and retries.
- The cart store keeps the guest cart token in `localStorage` (`tiendazero.cartToken`). If the
  Api no longer knows the token, the store drops it and the next add starts a fresh cart. When
  signed in, the cart is the account's (no token). Signing in sends the guest token so the Api
  moves that cart into the account; the store then forgets the token.
- Favorites are saved to the account when signed in. A guest's favorites last for the visit and
  are added to the account at sign-in.
- After sign-in, `?next=` is followed only for same-site paths (`src/lib/navigation.ts`).
- The auth screens have no design in the bundle. They're built from Nocturne's form pieces in
  the checkout's frame (`AuthLayout.vue`, `src/assets/forms.css`).
- Tests stub `fetch` with an in-memory Api (`src/__tests__/fakeApi.ts`: catalog, cart, auth,
  account, orders and admin). Build a fresh router per mounted app with `createAppRouter(createMemoryHistory())`,
  because vue-router runs guards in the first app it was installed on. Preload lazily-routed views
  in `beforeAll` (see `auth.spec.ts`), since `flushPromises` doesn't wait for a first dynamic
  import.

- Nocturne tokens/classes live in `src/assets/nocturne.css`, a verbatim copy of the bundle's
  `styles.css`. Re-copy it rather than editing it.
- Shipping cost, installment count and transfer discount are platform constants in
  `src/lib/commerce.ts` (plan §5). Shipping is 0, so the prototype's free-shipping threshold and
  progress bar are intentionally not built.

- Vue 3 + Vite + TypeScript + Vue Router + Pinia. Vitest + @vue/test-utils for tests.
  oxlint + ESLint + Prettier (no semicolons, single quotes, 100 cols).
- The dev server proxies `/api` and `/media` (product photos) to `http://localhost:5043` (the Api's `http` launch profile),
  so run the Api locally alongside `npm run dev`. **Open the storefront at
  `http://regate.localhost:5173`** (Milestone 2): the Api picks the tenant from the Host header,
  so the proxy passes the browser's host through (`changeOrigin: false` in `vite.config.ts`;
  Vite's string shorthand would set it to `true` and rewrite the host). `localhost:5173` and
  `127.0.0.1:5173` belong to no tenant and get a 404 from `/api`.
- The platform admin's tool (Milestone 2, plan §1, §8) is served by the same app on the **platform host**
  (`VITE_PLATFORM_HOST`, `platform.localhost` in `.env.development`; unset means a build without it).
  `main.ts` loads `src/platform/` with a dynamic import only on that host, so a store's own site never
  requests it (checked in the build: the entry chunk lists it only as a preload target). It has its own
  app and router: `/plataforma/ingresar` signs in against `/api/platform/auth/*` (`stores/platform.ts`,
  `api/platform.ts`; the access token lives in memory, the refresh cookie is httpOnly), then the storefront
  screens (`HomeView`, `ProductView`) render a **read-only preview** of the store picked in the tenant bar
  (the mock's switcher, `PlatformTenantBar.vue`; the pick is remembered per tab). `api/http.ts` sends
  `X-Preview-Tenant: <slug>` on every call except the platform's own. The shared components hide every
  shopper control when `isPlatformHost()`: no cart, account, favorites or add-to-cart, and the shopper
  `auth` store does not register its HTTP hooks there (it would take over the platform admin's token).
  There is no cart, checkout, account or admin route on the platform host. The preview wears the picked store's
  own branding (see Theming below); signed out, it has none. Tests:
  `platform.spec.ts`, with the platform side in `fakeApi.ts` (as strict as the Api: a preview without the
  admin's token is a 401).
- Theming (Milestone 3, slice 2, plan §3). `GET /api/theme` (`src/api/theme.ts`) returns a store's branding already
  resolved: `cssVariables` (plain values), logo, wordmark, monogram, favicon, footer name and social links. The
  Ui does no color math. `stores/theme.ts` loads it; `lib/applyTheme.ts` sets the variables on `<html>` (they
  override Nocturne's defaults in `nocturne.css`, which stays verbatim), `data-theme-mode`, `color-scheme`, the tab
  title and the favicon. `main.ts` awaits it (max 2 s) before mounting, so a store never flashes in another's look;
  `App.vue` retries if that failed, and a failed theme leaves Nocturne's defaults. The platform preview calls
  `load()` whenever another store is picked and `reset()` when signed out. `AppHeader` draws the logo as a
  background (size, margin, filter and blend from the theme; with no blend set, a Dark store's logo uses
  `lighten`, a Light store's `normal`), else the wordmark, with the monogram badge when there is neither;
  `AppFooter` shows `© year footerLegalName` and the first social link. Still Regate-specific, on purpose (later
  work): the home promo slides (`src/catalog/promos.ts`) and the checkout's pickup text.
  Tests: `theme.spec.ts`; `fakeApi.ts` has `REGATE_THEME`/`INDIANS_THEME` and `api.theme.current`.
- Branding editor (Milestone 3, slice 4): `/admin/marca` (`AdminThemeView.vue`, "Marca" in the admin sidebar, client in
  `src/api/admin.ts`). It edits the store name and legal name, mode, accent hue (or keeps Regate's hand-picked
  accent), logo and favicon (uploaded, not typed), the logo's display settings, text mark and monogram, up to four
  footer links, and the email accent and logo. The preview is a box that gets the Api's variables for the
  chosen mode (`POST /api/admin/theme/preview`, debounced 250 ms; the Ui still does no OKLCH math) and is not
  applied to the page. The **contrast check** (`src/lib/contrast.ts`, WCAG on the resolved hex values) shows the
  accent against the background and cards (3:1, Nocturne's rule) and the accent's text-on-tint pair (4.5:1) in
  both modes, and warns (never blocks) for the mode being edited. After a save or an upload, the theme store
  reloads so the storefront and the admin shell wear the new look at once. The admin sidebar shows the store's name
  instead of the old bundled Regate logo (removed). `logoStyle.ts` is shared with the header.
  Tests: `adminTheme.spec.ts`; the fake Api's `api.admin.theme` records saves, previews and uploads.
- Payments screen (Milestone 4, slice 3): `/admin/pagos` (`AdminPaymentsView.vue`, "Pagos" in the admin sidebar, client in
  `src/api/admin.ts`). A store connects its own Mercado Pago account by pasting the access token, public key and
  webhook secret (no OAuth); the Api verifies the token with Mercado Pago and stores all three encrypted. They are never
  shown again: a connected store sees the account id, public key, the token's last four characters, whether a
  secret is set and the webhook URL to register in its Mercado Pago application (`webhookUrl`, hidden when the Api
  has none). The token and secret inputs are `type=password`; the form is emptied after a save, "Cambiar
  credenciales" reopens it empty, "Desconectar" asks first (`window.confirm`). Field messages come from the Api.
  Tests: `adminPayments.spec.ts`; the fake Api's `api.admin.payments` accepts the tokens in `validTokens`.
- **Changing Nocturne's tokens** (docs/plan.md §3 risk: two palettes to keep in sync). A new or retuned token needs a
  decision for each ground, then: (1) `src/assets/nocturne.css` stays a verbatim copy of the bundle's file, so
  re-copy it; (2) if it is chromatic or ground-dependent (bg, surface, text, divider, neutral steps, shadows,
  accent), add it to both `ThemeRamp.Dark` and `ThemeRamp.Light` in the Api (a test fails if their keys differ) and
  keep the light neutrals on the dark ramp's lightness scale; (3) if it is structural (font, space, radius,
  component class), leave it fixed for every tenant and in neither palette; (4) if the contrast check should
  cover a new pairing, add it to `CHECKS` in `src/lib/contrast.ts`; (5) update both copies of `docs/plan.md`.
- `design/` is excluded from oxlint and ESLint (`.oxlintrc.json`, `eslint.config.ts`). It's
  reference material, not app code.

Commands (what CI in `.github/workflows/ci.yml` runs):

```
npm run lint:check && npm run format:check && npm run type-check && npm test && npm run build-only
```

`npm run lint` and `npm run format` are the auto-fixing variants.

## Shared docs and design

`docs/plan.md` and `design/` (the Claude Design handoff bundle + `Regate Images/`) are
**copied identically into both TiendaZero-Api and TiendaZero-Ui**. When you change either, make
the same change in the other repo so they don't drift.

The design source is a **handoff bundle** exported from Claude Design (claude.ai/design):
`Regate Shop mobile prototype-handoff.zip`, already extracted into
`design/regate-shop-mobile-prototype/`. Its content is static prototype HTML/CSS/JS meant to
be read and reimplemented, not run through a toolchain.

**Read `design/regate-shop-mobile-prototype/README.md` first.** It contains the authoritative
instructions for how a coding agent should treat this bundle. The key points:

- The primary design to implement is `design/regate-shop-mobile-prototype/project/Regate Shop Web.dc.html`
  — read it in full, top to bottom, then follow its imports (the design-system stylesheet/bundle,
  `image-slot.js`, `support.js`) before implementing anything.
- The `.dc.html` files are **prototypes, not production code**. The job is to recreate them
  **pixel-perfectly** in whatever stack fits the real target codebase (React, Vue, native,
  etc.) — match the visual output, do not port the prototype's internal markup/structure
  unless it happens to fit.
- Don't render these files in a browser or take screenshots unless explicitly asked — all
  layout/color/sizing information is already explicit in the HTML/CSS source.
- If anything about scope or behavior is ambiguous, ask the user before implementing — this
  bundle is a starting point, not a finished spec.
- The target stack is fixed in `docs/plan.md`: TiendaZero-Api (.NET) + TiendaZero-Ui (Vue), two separate repos.

## Bundle structure

```
design/regate-shop-mobile-prototype/
  README.md                        # handoff instructions (read first)
  project/
    Regate Shop.dc.html            # mobile prototype (390x844 iPhone frame)
    Regate Shop Web.dc.html        # desktop/responsive web prototype — the primary design
    Regate Shop Web-print.dc.html  # auto-generated static multi-page export of the Web
                                    #   prototype for printing/review — mirrors it 1:1,
                                    #   do not hand-edit
    _ds/nocturne-*/                # "Nocturne" design system: styles.css (all design
                                    #   tokens — colors, type, spacing, radii, shadows as
                                    #   CSS variables), _ds_bundle.js, readme.md (usage
                                    #   rules), component/foundation reference pages
    support.js, image-slot.js,     # Claude Design prototyping runtime: implements the
      doc-page.js                  #   <x-dc>, <sc-if>, <sc-for>, <image-slot> custom
                                    #   elements and {{ mustache }} bindings used by the
                                    #   .dc.html files. This is tooling infrastructure for
                                    #   the prototype, not application logic to port.
    assets/                        # campaign photography referenced by the prototypes
    uploads/                       # user-supplied reference images filled into image slots
    .image-slots.state.json,       # tool-generated state, not meant for manual editing
      .thumbnail
```

## Domain context

"Regate" is a Spanish-language sporting-goods e-commerce storefront. Product categories
seen in the prototype: Camisetas, Shorts, Abrigo, Accesorios, spanning fútbol, running,
básquet, training, and estadio lines. Screens covered: home/catalog with promo carousel,
category filter + sort, product grid, product detail (gallery, size picker, add to cart),
and a cart.

The visual language is the **Nocturne** design system (see
`design/regate-shop-mobile-prototype/project/_ds/nocturne-*/readme.md` for full rules): a dark, desaturated UI
(`--color-bg` `#161826`, text `#e9e9ed`) with a single blurple accent (`#9184d9`) used only
as outlines/lines/glows — never a solid fill — plus Inter type, 8px radii, and OKLCH tonal
ramps (100–900) per color role. Outlined (not filled) primary buttons, flush-left headings,
and photographs wrapped in `.lighten` (`mix-blend-mode: lighten`) so dark photo backgrounds
disappear into the page are the system's signature traits. When reimplementing, carry over
these token values/relationships rather than inventing new ones.

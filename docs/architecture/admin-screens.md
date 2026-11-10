# Admin and platform screens

The store admin under `/admin` (one screen per area, each with its Api client in `src/api/admin.ts`) and the platform admin's tool.

The store admin (step 6) lives under `/admin`, for `TenantAdmin`/`PlatformAdmin` users
(`auth.isAdmin`); everyone else gets the 404 page. Routes with `meta.admin` render
`AdminLayout` (its own sidebar shell) instead of the storefront's header, footer and cart. The
screens are orders (`/admin/pedidos`, detail with confirm-transfer and fulfillment actions),
products (`/admin/productos`, editor with sizes/stock and photo upload) and categories and
collections (`/admin/catalogo`). The client is `src/api/admin.ts`. The product editor sends a
size's stock only when it was edited; on a 409 it offers to pull the current stock. The admin has
no design in the bundle: it's built from Nocturne's `.table`, `.card`, `.input` and `.tag`
(`src/assets/admin.css`).

- Branding editor (Milestone 3, slice 4): `/admin/marca` (`AdminThemeView.vue`, "Marca" in the admin sidebar, client in
  `src/api/admin.ts`). It edits the store name and legal name, mode, accent hue (or keeps Regate's hand-picked
  accent), logo and favicon (uploaded, not typed), the logo's display settings, text mark and monogram, up to four
  footer links, the email accent and logo, and the **reply address** for the store's emails (`emailReplyTo`: the Api sends it as
  Reply-To; with none set the field warns that replies reach nobody, because emails go out from one shared address), and the **contact phone** (`phone`, label "Teléfono de contacto", right
  after the reply address; blank saves as null and clears it; the Api's message for `phone` shows under the field, no Ui-side
  check). The form is
  `novalidate`, so the Api's Spanish messages show instead of the browser's. The preview is a box that gets the Api's variables for the
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
  The same screen has a second form, **Transferencia bancaria** (`getTransferAccount`/`saveTransferAccount`): the store's own
  alias, CBU/CVU, holder and bank, shown to shoppers on the order page and in the email. A store with none (tag "Sin
  configurar") does not offer transfers: the Api refuses a transfer order with a 400 on `paymentMethod`, and the checkout does
  not yet hide the option (known gap). Details can be replaced but not removed. Two stores may connect the same Mercado Pago
  seller account (one integration per store); nothing blocks it.
  Tests: `adminPayments.spec.ts` (the Mercado Pago form is selected by `MP_FORM`, since the transfer form shares the page); the
  fake Api's `api.admin.payments` accepts the tokens in `validTokens`, and `api.admin.transfer` keeps the transfer details.

- Pickup screen: `/admin/retiro` (`AdminPickupView.vue`, "Retiro" in the admin sidebar, client in `src/api/admin.ts`). The store's pickup
  point: a name and optional hours/lead-time text, shown at checkout, on the order page and in the emails. Without one the store offers only
  home delivery; "Quitar el retiro" asks first. The checkout reads `GET /api/checkout-options` (`getCheckoutOptions`) on mount and shows
  "Retiro en local" only if the store has a pickup point and "Transferencia" only if it has transfer details; until that answers (or if it
  fails) only home delivery and Mercado Pago show. The order page says where to collect from `order.pickup`, or "el local" if it is null.
  Tests: `adminPickup.spec.ts`, and `orders.spec.ts` ("what the store offers at checkout"); the fake Api's `api.checkoutOptions` models a
  store without pickup or transfer, and `api.admin.pickup` keeps the settings.

- Promotions screen: `/admin/promociones` (`AdminPromosView.vue`, "Promociones" in the admin sidebar, client in `src/api/admin.ts`). The
  store's home carousel: add a slide (small text, title, button text, what the button opens: a category, a collection or the whole
  store, and an optional photo description), then upload its photo; a slide without a photo shows "No se muestra hasta que tenga foto"
  and is not listed to shoppers. Edit, reorder (↑ ↓), delete (asks first). Eight at most. Photos are JPG/PNG/WebP, checked by the Api.
  Tests: `promos.spec.ts` (the carousel on the home page and this screen); the fake Api's `api.admin.promos` keeps the slides and is what
  `GET /api/promos` lists.

- Domains screen (Milestone 5, slice 2): `/admin/dominios` (`AdminDomainsView.vue`, "Dominios" in the admin sidebar, client in
  `src/api/admin.ts`). Lists the store's domains: the platform subdomain (nothing to do on it except make it primary) and the
  custom hosts it claimed. A claim shows the TXT record to publish (and the CNAME to point at) with "Verificar"; the Api
  answers "not published yet" (400, shown under that domain), "couldn't read DNS" (502, a different message) or verifies it.
  A verified host shows its certificate status (`tlsStatus`, refreshed by the same button) and can be made primary (a
  `window.confirm` warns when its certificate is not active yet) or removed (the primary one has no "Quitar"). All the rules
  (what a host may be, ownership, uniqueness, the limit of five) are the Api's; the Ui shows its Spanish messages.
  Tests: `adminDomains.spec.ts`; the fake Api's `api.admin.domains` takes TXT records a test publishes in `published`.

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

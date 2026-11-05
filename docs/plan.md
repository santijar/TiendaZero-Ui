# Regate Shop — Implementation Plan (multi-tenant)

Source: `regate-shop-mobile-prototype/` (Claude Design handoff bundle), now read alongside the
multi-tenant mock (`Storefront Multitenant.dc.html` / `Storefront Multitenant Light.dc.html`),
which was added as a worked example of how one storefront design serves several branded tenants
(Regate, plus three fictional clients: Indians, Kairós Running, Club Atlético Norte). The mock is
a prototype exploration, not a spec — where it demonstrates a mechanism, this plan adopts it;
where it raises a question the user hasn't answered yet, that question is carried into §9 rather
than decided here.

**Change of scope (this revision):** TiendaZero is now a multi-tenant, white-label e-commerce
platform. One codebase runs many independently branded storefronts ("Regate" becomes the first
tenant, not the product's identity). Everything in the original single-tenant plan — screens,
checkout flow, payments, milestones — still applies *per tenant*; this revision adds the tenant
dimension underneath it.

Decisions already made with the user (original, still in force):
- **Payments:** Mercado Pago only, via Checkout Pro (hosted redirect) — now one MP account *per
  tenant* (see §2, `TenantPaymentAccount`).
- **Favorites:** in scope — a simple per-user favorites list (product-level, matches the
  prototype's heart toggle) — scoped per tenant (a user's favorites don't cross stores).
- **Guest order tracking:** a magic link emailed at checkout, not a lookup form.
- **Stock reservation:** decrement at order creation; release unpaid orders after 30 minutes.
- **Shipping:** both delivery options stay in checkout, cost fixed at `0` platform-wide — the
  mock's per-tenant shipping cost/threshold was considered and explicitly **not** adopted for v1
  (see §5).
- **Tax:** prices are tax-inclusive; no separate tax line anywhere in the system.
- **Image hosting:** Cloudflare R2 — now path-prefixed per tenant, see §7.
- **Email provider:** Resend, for order confirmations, password resets, and magic links — now
  themed per tenant, see §3.
- **Catalog:** one color per product for now — no color swatches on the product page yet.
- **Account page:** minimal scope — profile basics, saved addresses, order history, favorites.

New decisions already made with the user (this revision):
- **Database:** one shared PostgreSQL database for all tenants. `TenantId` on every tenant-owned
  table. EF Core global query filters as the primary guard, PostgreSQL Row-Level Security (RLS) as
  defense in depth underneath — a bug in a LINQ query must not be the only thing standing between
  one tenant's data and another's.
- **Tenant resolution:** per request, by middleware. Subdomain first (`{tenant}.regate-platform
  .com` or similar); custom domains (§2, §8) come in a later milestone. Resolves into a scoped
  `ITenantContext` (tenant id + slug + theme + settings) that everything downstream — EF, cache
  keys, background jobs, file storage, email, logs — reads from instead of re-deriving.
- **Branding:** configuration only, no per-tenant code or per-tenant branches in the Vue app. The
  Vue app loads the tenant's theme at boot (one API call, keyed off the resolved domain) and
  applies it as CSS custom properties. See §3 for exactly what "theme" contains — the mock pins
  this down more precisely than the original decision list did.
- **Payments:** each tenant connects their own Mercado Pago account; credentials encrypted at
  rest; webhooks routed to the right tenant (see §2 `TenantPaymentAccount`, §7).
- **Roles:** platform admin (manages tenants themselves, not scoped to one), tenant admin (scoped
  to exactly one tenant), customer (scoped to exactly one tenant — the same email can be a
  customer at two different stores as two unrelated accounts).
- **Theming modes:** tenants can pick a light or dark storefront, not dark-only — `TenantTheme`
  gets a `Mode` field, and Nocturne gains a second, equally fixed light palette alongside the
  existing dark one (see §3).
- **Commerce rules stay global for v1:** shipping threshold/cost, installment count, and the
  bank-transfer discount % remain platform-wide constants, not per-tenant settings, for the first
  multi-tenant milestones (see §5). No `TenantCommerceSettings` entity yet.
- **Webhook security:** the Mercado Pago webhook handler doesn't trust the tenant-id-in-URL path
  segment alone — it cross-checks the payment's own collector/account id (from a live re-fetch of
  MP's API, already required for payload-spoofing reasons) against that tenant's
  `TenantPaymentAccount.ProviderAccountId` before updating anything (see §7).
- **Custom domain TLS:** Cloudflare for SaaS provisions per-domain certificates (see §8 Milestone
  5).
- **Platform-admin tenant preview:** in scope — a platform admin can override `ITenantContext` to
  preview any tenant's live storefront without visiting its actual subdomain (see §1, §8).
- **Order numbering:** `Tenant.OrderNumberPrefix` is assigned once by the platform admin at tenant
  onboarding and immutable afterward (see §2, §8 Milestone 2).

Stack (fixed, unchanged): ASP.NET Core Web API (.NET 10 LTS) + EF Core/Npgsql + PostgreSQL ·
Vue 3 + Vite + TS + Vue Router + Pinia · monorepo `/api` + `/web`.

---

## 1. Screen inventory → routes & components

Unchanged from the single-tenant plan (see the original screen/route/component tables — still
accurate per-tenant). Two additions from the mock:

- The mock's top tenant-switcher bar (`showTenantBar`, the row of pill buttons reading "Tenant")
  is **prototype review tooling** in the mock itself, not a storefront feature — a shopper's own
  storefront is resolved from their domain and never shows a tenant picker. But its underlying
  mechanism — overriding which tenant's data and theme render, without visiting that tenant's
  actual subdomain — is adopted as a real **platform-admin** tool (see §8 Milestone 2), restricted
  to the `PlatformAdmin` role and absent from the customer-facing app entirely.
- Every screen, component and Pinia store from §1 of the original plan is instantiated once per
  tenant at runtime (same code, tenant-scoped data and theme), not duplicated per tenant.

---

## 2. Domain model

### New tenant entities

```
Tenant 1───* TenantDomain          (subdomain + future custom domains, one IsPrimary)
Tenant 1───1 TenantTheme           (branding config — see §3)
Tenant 1───* TenantPaymentAccount  (their own Mercado Pago connection; practically 1, modeled as
                                     * for provider flexibility and reconnect history)
Tenant 1───* Category/Collection/Product/... (everything from the original domain model)
```

| Entity | Key fields | Constraints |
|---|---|---|
| **Tenant** | Id, Slug (used in subdomain and as a display fallback), Name, OrderNumberPrefix, NextOrderNumber, Status (`Active/Suspended`), CreatedAt | `Slug` unique. `OrderNumberPrefix` — the mock gives every tenant its own order-number prefix (`RG-20483`, `IND-20217`, `KR-…`, `CAN-…`); this plan adopts that, so `OrderNumber` reads as tenant-branded even for a guest who never sees the tenant's internal id. **Set once by the platform admin at onboarding (Milestone 2) and immutable afterward** — there's no update endpoint for it, by design, so a prefix never changes meaning partway through a store's order history. `NextOrderNumber` is the tenant's own counter (starts at 20001), taken with an atomic `UPDATE … RETURNING` inside the order transaction. It is per tenant rather than one global sequence, so a store never learns another's order volume from gaps in its own numbers |
| **TenantDomain** | Id, TenantId, Domain, Type (`Subdomain/Custom`), IsPrimary, VerifiedAt (nullable, custom domains only), VerificationToken (custom, until verified), TlsStatus (`None/Pending/Active/Failed`) + TlsDetail + TlsCheckedAt (custom domains: where the Cloudflare for SaaS certificate stands), CreatedAt | `Domain` is unique across all tenants **among hosts that answer for a store** (subdomains, and custom domains once verified): an unverified claim reserves nothing, so it cannot keep the real owner out, and only the claimant that publishes its own random token as a TXT record (`_tiendazero.<domain>`) can ever verify; exactly one `IsPrimary=true` per tenant. Not tenant-owned (resolution reads it before any tenant is known), so store-facing code must filter by tenant itself |
| **TenantTheme** | see §3 — one row per tenant, 1:1 | PK = `TenantId` |
| **TenantPaymentAccount** | Id, TenantId, Provider (`MercadoPago`), EncryptedAccessToken, EncryptedPublicKey, EncryptedWebhookSecret (the app's webhook signing key, one per store), ProviderAccountId (MP's own collector/user id — used for webhook disambiguation, see §7), Status (`Connected/Disconnected/Error`), ConnectedAt, LastVerifiedAt | Unique `(TenantId, Provider)` while `Status='Connected'` — one active connection per provider per tenant |

### Existing entities — `TenantId` added to every tenant-owned table

Every table from the original domain model (`Category`, `Collection`, `ProductCollection`,
`Product`, `ProductVariant`, `ProductImage`, `User`, `Address`, `Cart`, `CartItem`, `Order`,
`OrderShippingAddress`, `OrderLine`, `Payment`, `Favorite`, `RefreshToken`) gets a `TenantId`
column, denormalized directly onto the row rather than reached only through a join — this is what
makes both the EF global query filter and the RLS policy a single-column check on every table
instead of a join-dependent one, and it's what the decision "TenantId on every tenant-owned table"
actually requires.

`User` gets `TenantId` **nullable**: null for platform admins (not scoped to any store), set for
every tenant admin and customer. A customer's and a tenant admin's `User` row always has exactly
one `TenantId`.

### Unique constraints that change

| Entity | Was (single-tenant) | Becomes (multi-tenant) |
|---|---|---|
| `Category.Slug` | unique | unique on `(TenantId, Slug)` |
| `Collection.Slug` | unique | unique on `(TenantId, Slug)` |
| `Product.Slug` | unique | unique on `(TenantId, Slug)` |
| `ProductVariant.Sku` | unique | unique on `(TenantId, Sku)` — per the decision that SKUs are unique per tenant, not platform-wide |
| `ProductVariant(ProductId, Size, Color)` | unique | unchanged (already scoped through `Product`) |
| `User.Email` (ASP.NET Identity's normalized-email index) | unique | unique on `(TenantId, NormalizedEmail)`, **and** a separate unique index on `NormalizedEmail` where `TenantId IS NULL` (platform admins only) — **this needs a custom `IUserStore`/index override**, since Identity's default `AspNetUsers` schema assumes a single global unique email; this is implementation work to call out explicitly in Milestone 2, not just a config change |
| `Order.OrderNumber` | unique | unique on `(TenantId, OrderNumber)` — matches the per-tenant `OrderNumberPrefix` above; two tenants can both have order `-20483` |
| `Cart` partial unique on `UserId`/`GuestToken` where `Status='Active'` | unique | same partial index, with `TenantId` added to both — a guest token collision across two unrelated tenants (astronomically unlikely as a GUID, but free to guard) shouldn't be possible even in theory |
| `Payment(Provider, ProviderPaymentId)` where not null | unique | unique on `(TenantId, Provider, ProviderPaymentId)` — defense in depth; in practice each tenant's own MP account already makes `ProviderPaymentId` disjoint across tenants, but the constraint shouldn't depend on that holding |

`CartItem(CartId, ProductVariantId)` and `Favorite(UserId, ProductId)` are unchanged — already
scoped transitively through `CartId`/`UserId`, which are themselves tenant-scoped.

---

## 3. Tenant branding → design tokens

The single-tenant plan's instruction was "port Nocturne's tokens from `styles.css` as-is." That
no longer holds: some tokens are the *platform's* fixed design system and stay identical for every
tenant; others are exactly what a tenant is buying the right to change. The mock draws this line
concretely — more concretely than the original decision list ("logo, favicon, colors, fonts, store
name, footer, email templates") did on its own — so this plan follows the mock's split.

### Fixed — identical for every tenant within a mode, never themed

Everything Nocturne's own readme calls structural rather than chromatic stays fixed regardless of
mode: `--font-heading` / `--font-body` (Inter), the full `--space-*` scale, `--radius-sm/md/lg`,
and every component class (`.btn`, `.card`, `.input`, `.tag`, …). This plan keeps these fixed —
the whole point of one component library is that tenants don't get to relitigate radius or
spacing.

`--color-neutral-100…900`, `--color-bg`, `--color-surface`, `--color-text`, `--color-divider`, and
`--shadow-sm/md/lg` are fixed *per mode*, not per tenant: there are exactly two preset grounds —
Nocturne's existing dark one, and the light one the mock worked out — and a tenant picks between
them (`TenantTheme.Mode`), rather than customizing either. The light palette, taken directly from
the mock's light variant:

```
--color-bg: #f6f7fa;              --color-surface: #ffffff;
--color-text: #1b1d26;            --color-divider: rgba(27,29,38,0.14);
--color-neutral-300: #3f424d;     --color-neutral-400: #595d6c;
--color-neutral-500: #6b6f80;     --color-neutral-800: #e4e7f0;
--color-neutral-900: #eceef3;
--shadow-sm: 0 0 0 1px rgba(27,29,38,0.08), 0 1px 2px rgba(27,29,38,0.04);
--shadow-md: 0 0 0 1px rgba(27,29,38,0.08), 0 8px 24px rgba(27,29,38,0.12);
--shadow-lg: 0 0 0 1px rgba(27,29,38,0.08), 0 16px 40px rgba(27,29,38,0.18);
```
The mock only worked out neutral steps 300/400/500/800/900 for light mode (what the storefront
actually uses). Milestone 3 filled in 100/200/600/700 on the same OKLCH lightness scale as the dark
ramp: the mock's own steps land on it mirrored (light 300/400/800 are dark 800/700/200), so light N
takes dark (1100 − N) — 200 = `#292b31`, 600 = `#9397ab`, 700 = `#b2b6ca` — and 100, which would be
past the dark ramp's end, continues the scale one step (`#14161d`, L 0.20). They live in
`ThemeRamp.Light` (Api), with tests that keep the ramp monotonic.

The accent formula table below defines only steps 200/300/400/500/700/900, as the mock does. The
mock's light theme points the rest at neighbors (100 = 200, 600 = 400, 800 = 900); the dark mock
left them to Nocturne's Regate-blurple defaults, which would leak Regate's color into every other
dark store, so `ThemeRamp` applies the same mapping to both modes. `AccentHexOverride` is stored as
JSON (a base color plus a hex per step, and optionally a separate accent-2 ramp), not a single hex,
because Nocturne's hand-tuned ramp is ten values and its accent-2 differs from its accent.

### Tenant-brandable — `TenantTheme` fields

| Field | Drives | Source in mock |
|---|---|---|
| `Mode` (`Dark`/`Light`) | Which fixed ground palette (above) and which accent-ramp formula (below) apply | The mock ships both as separate files; this plan folds them into one field rather than one file per mode |
| `AccentHue` (0–360, OKLCH hue) | The entire accent ramp (`--color-accent`, `-100` … `-900`), generated by one formula instead of nine hand-picked colors — see below | `theme: ramp(232)` etc. — one number per tenant |
| `AccentHexOverride` (nullable) | Skips the generated ramp and uses Nocturne's own hand-tuned hex ramp instead | The mock's `regate` entry sets `theme: null` and falls back to the design system's existing hex values rather than regenerating them through the formula — because the formula is an algorithmic *approximation* of a ramp a designer hand-tuned (see the review-history comments in `styles.css`), not a guaranteed match. **Regate's own theme should use this override, not the generated ramp**, so the platform's original, already-approved look doesn't visibly shift on migration. |
| `LogoUrl`, `LogoWidth`, `LogoHeight`, `LogoMargin`, `LogoFilter`, `LogoBlendMode` (all nullable) | Header/footer logo rendering | `logo`, `logoW/H/M`, `logoFilter`, `logoBlend` per tenant (e.g. in the light mock Regate's logo is inverted + multiply-blended so its white-on-dark artwork sits on the light ground; Indians' is used as-is) |
| `Wordmark` (nullable text) | Text logo when there's no image | `wordmark: 'REGATE'` |
| `Monogram` (nullable text) | Fallback badge when there's neither logo nor wordmark | `monogram: 'RG'` |
| `FaviconUrl` | Browser tab icon | Not in the mock (it's a static prototype), but required by the original decision list |
| `StoreName`, `FooterLegalName` | `<title>`, footer copyright line | `name`, `legalName` |
| `SocialLinks` (small JSON: label → URL, e.g. Instagram) | Footer link | `instagram`, `instagramUrl` |
| `EmailAccentHex`, `EmailLogoUrl` | Resend template branding | Not in the mock; carried over from the original decision list — HTML email can't consume OKLCH CSS vars, so the theme needs a resolved hex snapshot for email independent of the CSS ramp |

**The accent-ramp formula** (ported directly from the mock — one formula per `Mode`, both keyed
off the same `H = TenantTheme.AccentHue`; this is the formula the Vue app's theme loader runs
client-side, or the API resolves server-side and ships as resolved hex/OKLCH strings):

```
                    Dark mode                      Light mode
accent-500 (base)   oklch(0.72 0.13 H)              oklch(0.56 0.14 H)
accent-200          oklch(0.88 0.06 H)              oklch(0.36 0.10 H)
accent-300          oklch(0.82 0.09 H)              oklch(0.44 0.12 H)
accent-400          oklch(0.78 0.11 H)              oklch(0.50 0.13 H)
accent-700          oklch(0.42 0.09 H)              oklch(0.78 0.08 H)
accent-900          oklch(0.26 0.05 H)              oklch(0.95 0.03 H)
```
Dark mode puts light text (`-200`) on a dark tint (`-900`); light mode does the opposite. (An
earlier revision of this table had the two columns swapped; the values above are taken directly
from each mock file's `ramp` function — `Storefront Multitenant.dc.html` for dark,
`Storefront Multitenant Light.dc.html` for light.)

Note the light ramp isn't the dark one inverted by a simple lightness flip — the chroma values
differ too (e.g. `accent-400` is `0.11` dark vs. `0.13` light), so both rows need to be carried
as their own lookup table, not derived from each other at runtime.

Nocturne's readme already treats `--color-accent-2-*` as "a mono scheme — no second accent was
chosen, treat them as one role"; the mock takes that literally and points every
`--color-accent-2-*` variable at the same generated ramp as `--color-accent-*` in both modes. This
plan adopts that too — one hue per tenant, not two — rather than giving `TenantTheme` a second hue
field nothing in the system actually uses independently.

---

## 4. REST API

Unchanged in shape from the original plan (see the full endpoint tables there), with tenant
resolution as a cross-cutting concern rather than a per-endpoint parameter:

- The tenant is resolved by middleware from the request's `Host` header (via `TenantDomain`)
  **before** any controller runs, and placed in the scoped `ITenantContext` — no endpoint takes a
  `tenantId`/`tenantSlug` parameter; it would be redundant and, worse, a second (forgeable) source
  of truth alongside the domain-resolved one.
- `GET /api/theme` (new, 🔓): returns the resolved tenant's `TenantTheme`, read by the Vue app at
  boot before the rest of the shell renders.
- Every other endpoint's behavior is implicitly scoped to `ITenantContext.TenantId` via the EF
  global query filter (§7) — nothing in the endpoint tables themselves changes.
- `POST /api/payments/webhooks/mercadopago` gains a tenant segment (see §7) since Mercado Pago's
  callback has no `Host`-based tenant to resolve from in the same way a browser request does.

---

## 5. Checkout flow

Unchanged mechanically from the original plan (§4 there — stock row-locking, idempotency key,
webhook idempotency, the 30-minute stock-hold job). Two tenant-scoping notes:

- Every step reads from the one `TenantPaymentAccount` connected to the resolved tenant, not a
  platform-wide Mercado Pago credential.
- The original plan's shipping cost (`0`) and bank-transfer discount (flat 10%) stay global
  platform constants for v1, confirmed — the mock's example tenants each have their own
  free-shipping threshold, shipping cost, installment count and transfer discount, but that
  per-tenant commerce config was explicitly decided *against* for now (see intro). If it's wanted
  later, it's a small new `TenantCommerceSettings` entity (threshold, shipping cost, installment
  count, transfer discount %) sitting next to `TenantTheme` — not a change to the checkout flow's
  mechanics — but it isn't built in any milestone below.

---

## 6. Auth (ASP.NET Core Identity)

Unchanged mechanically (short-lived JWT + rotated httpOnly refresh cookie, same as the original
plan's §5), with the role model now explicitly three-tiered:

| Role | Scope | Notes |
|---|---|---|
| `PlatformAdmin` | None (`User.TenantId = null`) | Manages `Tenant`/`TenantDomain`/`TenantTheme`/`TenantPaymentAccount` rows across all tenants. No public signup; seeded/promoted manually, same as the original plan's `Admin` role was. Signs in on the platform host at `/api/platform/auth/*` (separate from a store's `/api/auth`), and their token carries no `tid`, so it is only valid there |
| `TenantAdmin` | Exactly one tenant | Replaces the original plan's single `Admin` role for everything under `/api/admin/*` — scoped to their own tenant's products/categories/collections/orders only, enforced by the same global query filter as every other tenant-owned read |
| `Customer` | Exactly one tenant | Default on register; a `/api/auth/register` call is itself tenant-scoped (resolved from `Host`, same as everything else) |

JWT claims gain `tid` (tenant id) alongside user id/email/role, and the auth middleware verifies
`tid` matches the request's resolved tenant on every call — a token issued on one tenant's
subdomain must not authenticate a request to another's. This is the concrete mechanism behind
"customers are scoped per tenant," not just a database constraint.

---

## 7. Tenant isolation strategy

Isolation has to hold across every place tenant data can leak, not just the database — this
section is the one place to check all of them, and how each is verified.

| Layer | Mechanism |
|---|---|
| **Database (primary guard)** | EF Core global query filter (`HasQueryFilter(e => e.TenantId == _tenantContext.TenantId)`) on every tenant-owned entity, applied once in `OnModelCreating` rather than per-query — a developer forgetting a `.Where(TenantId == …)` is the normal failure mode this is built to not require avoiding |
| **Database (defense in depth)** | PostgreSQL RLS policy on every tenant-owned table, keyed off a session variable (`app.tenant_id`, set by an EF connection-opened hook every time a connection is checked out) rather than a role per tenant — N policies, one *runtime* role. Migrations run as the table owner and the Api as a separate restricted role (no superuser, no `BYPASSRLS`, owns nothing, no `TRUNCATE`), because RLS does not apply to superusers or to a table's owner; a startup check refuses to serve if the Api's login could bypass it. This is what still protects the data if the EF filter is ever bypassed (raw SQL, a forgotten `Where`, a future non-EF service). It guards against mistakes, not against injected SQL, which could set the session variable itself — SQL is built with parameters only |
| **Cache keys** | Every cache key (Redis or in-memory) is prefixed `tenant:{tenantId}:…` — never a bare `products:catalog` key that two tenants could collide on or poison for each other |
| **Background jobs** | The stock-hold-expiry job and the webhook-triggered email job both carry `TenantId` as an explicit field on the job payload (not inferred from "current request," since jobs don't have one) and re-establish `ITenantContext` from it before touching the database — the RLS session variable has to be set inside the job's own connection, same as a request's |
| **File storage (R2)** | Object keys are path-prefixed `tenants/{tenantId}/products/…` — not just a naming convention but what makes a signed upload URL for one tenant unable to even address another tenant's objects |
| **Email (Resend)** | Every template render takes the tenant's `EmailAccentHex`/`EmailLogoUrl`/`StoreName` from `TenantTheme`, and the sender/reply-to address is tenant-aware (at minimum a tenant-specific display name on a shared sending domain; a fully custom sending domain per tenant is a `TenantDomain`-adjacent follow-up, not required for the first slice) |
| **Logs** | `TenantId` is a structured field on every log line (via a logging scope opened in the tenant-resolution middleware), so a log query can be scoped per tenant the same way a DB query is — this matters operationally even though logs aren't a customer-facing leak surface |
| **Payment webhooks** | Mercado Pago's callback carries no `Host` header belonging to the tenant, so the tenant can't be resolved the normal way. The webhook URL registered on each `TenantPaymentAccount`'s Checkout Pro preference includes the tenant id as a path segment (`/api/payments/webhooks/mercadopago/{tenantId}`), but that path segment is only a routing hint, never trusted alone: the handler re-fetches the payment from MP's API (already required so the POST body itself isn't trusted — see the checkout flow's webhook step), reads *that* payment's own collector/account id, and confirms it equals the path-resolved tenant's `TenantPaymentAccount.ProviderAccountId` before touching the `Payment`/`Order` rows. A mismatch is treated as a routing error (logged, `200` returned so MP doesn't retry, nothing updated) — not processed against whichever tenant the path happened to name |

### Automated isolation testing

Correctness here can't rest on "the query filter looked right in review" — it needs a test that
would actually fail if isolation broke:

1. **Two-seeded-tenant integration suite**: every integration test that touches tenant-owned data
   runs against *two* seeded tenants (not one), and asserts both that tenant A's `ITenantContext`
   only ever sees tenant A's rows, *and* that a deliberately-crafted repository call using tenant
   A's context but tenant B's primary key returns nothing — not a 403, not an exception,
   genuinely nothing, the same as if the row didn't exist.
2. **RLS-direct test**: a smaller suite that connects to Postgres directly (bypassing EF and the
   API entirely) as the app's own role, sets `app.tenant_id` to tenant A, and queries tenant B's
   rows by primary key — this is what actually exercises the "defense in depth" layer rather than
   re-testing the EF filter a second time.
3. **Cross-tenant auth fuzzing**: a scripted pass over every authenticated endpoint using tenant
   A's valid JWT against tenant B's subdomain (and vice versa), asserting a `401`/`403` from the
   `tid` claim check in §6 — this is the test that would have caught a missing claim check, which
   the other two layers wouldn't.
4. This suite runs in CI on every PR, not just before release — isolation is exactly the kind of
   bug that's cheap to catch immediately and expensive to catch after tenant data has mixed.

---

## 8. Milestones

Each milestone is still independently demoable/shippable. The original plan's milestones 2–7
(static UI → catalog → cart → auth → checkout/payments → admin) become **Milestone 1** here,
built once against a single seeded tenant with no tenant-switching machinery yet — multi-tenancy
is added underneath a working store, not interleaved with building the store, so there's always a
demoable product at every step.

0. **Scaffold + CI** — unchanged from the original plan: monorepo skeleton, `docker-compose.yml`
   with local Postgres, EF Core wired, lint/format both sides, GitHub Actions, `/api/health`.
1. **Single seeded tenant through cart + checkout** — the entire original single-tenant plan
   (static UI from the bundle → real catalog → cart → auth → Mercado Pago checkout → admin CRUD),
   built against one hardcoded tenant row seeded directly in the database. No middleware, no
   `ITenantContext`, no `TenantId` columns yet — this milestone proves the storefront and checkout
   work before multi-tenancy adds its own surface area on top. (This both matches the user's
   requested ordering and avoids debugging two new kinds of bug — storefront logic and tenant
   isolation — at the same time.)
2. **Tenant onboarding** — `Tenant`/`TenantDomain` tables and the subdomain-resolution middleware;
   `TenantId` added to every table from Milestone 1 (migration + backfill the seeded tenant's rows
   to its own `TenantId`); the EF global query filter; the custom Identity email-uniqueness
   override from §2; `OrderNumberPrefix` assignment as part of the (manual/admin-script) tenant
   creation flow, immutable from then on; a second seeded tenant exists purely to prove isolation,
   not as a real customer-facing store yet. RLS policies and the two-tenant/RLS-direct/auth-fuzzing
   test suite from §7 land in this milestone, not later — isolation is this milestone's actual
   deliverable. The platform-admin tenant-preview override (§1) also lands here, since it's a thin
   layer over the same `ITenantContext` this milestone builds.
3. **Branding admin** — `TenantTheme` table (including `Mode`), the accent-ramp generation for
   both dark and light (server-resolved, shipped as resolved values rather than a formula the
   client re-runs, so the Vue app never needs to know OKLCH math), the light mode's own fixed
   ground palette (§3 — filling in the neutral steps the mock didn't cover), `GET /api/theme`, the
   Vue boot-time theme loader applying CSS custom properties, and a minimal `TenantAdmin` UI to
   edit logo/wordmark/colors/mode/footer copy. Regate's own theme is migrated using
   `AccentHexOverride` in `Dark` mode, per §3, not the generated ramp.
4. **Connected payments** — `TenantPaymentAccount`, the MP OAuth/API-key connection flow per
   tenant, encrypted credential storage, and the tenant-segmented webhook routing **with the
   `ProviderAccountId` cross-check** from §7 — not just the path segment. Every tenant from here on
   sets up their own Mercado Pago developer account at this milestone — flag it when we get here
   and walk through it per-tenant, same as the original plan did once.
5. **Custom domains** — `TenantDomain` entries of type `Custom`, DNS verification flow (TXT
   challenge), and TLS via **Cloudflare for SaaS** (confirmed) — budget its per-domain cost against
   the "lowest-cost" instinct behind the original deployment choice before onboarding many tenants
   onto custom domains.
6. **Deploy** — unchanged mechanically from the original plan (Railway for `/api` + Postgres,
   Cloudflare Pages for `/web`), plus: Pages/CDN routing needs to resolve *every* tenant's
   subdomain (and later custom domain) to the same deployed SPA, and `/api`'s CORS policy needs to
   allow an open-ended, data-driven set of tenant origins rather than a fixed list — both are
   small but real changes from a single-tenant deploy, not copy-paste.

---

## 9. Decisions recap & risks

The original plan's §7 recap (payments, favorites, deployment, guest tracking, stock, tax, image
hosting, email provider, color-as-facet, account scope) still holds and isn't repeated here. The
six open questions this revision originally raised (light vs. dark theming, per-tenant commerce
rules, webhook cross-checking, custom-domain TLS, the platform-admin preview tool, and
`OrderNumberPrefix` ownership) have all been resolved with the user — see the "this revision"
decisions in the intro and §3/§5/§7/§8 above — and aren't repeated here as open.

### New risks (this revision)

- **Shared-database blast radius** — a multi-tenant bug is categorically worse than a
  single-tenant one: a missed `TenantId` filter doesn't corrupt one store's data, it leaks one
  store's data into another's view. This is exactly why §7 treats automated isolation testing as
  a Milestone 2 deliverable rather than a hardening pass done later.
- **RLS performance** — a session-variable-keyed policy on every tenant-owned table adds a
  predicate to every query; worth a load-test pass once real data volume exists (deferred — not
  a Milestone 0–2 concern, but don't let it go unmeasured indefinitely).
- **Identity's email-uniqueness assumption** — ASP.NET Core Identity is built around one global
  unique email per user store; making it `(TenantId, Email)` is a real customization (§2), not a
  config flag, and needs to be gotten right in Milestone 2 since it's painful to migrate later
  once tenants have real users.
- **Generated-ramp drift from hand-tuned color** — per §3, both OKLCH formulas are approximations
  of colors a designer hand-picked for Regate's own original (dark) theme; a new tenant's
  generated ramp, in either mode, hasn't had that same review pass, so a very "off" hue could land
  somewhere the accent-to-ground 3:1 contrast ratio Nocturne's readme requires doesn't hold. Worth
  a contrast check in the `TenantAdmin` branding UI (Milestone 3) rather than trusting any hue
  blindly — and worth checking in *both* modes, since the two formulas don't share values.
- **Two palettes double the design-system surface to keep in sync** — adding light mode (§3)
  means every future Nocturne token change (a new component, a retuned shadow) needs a deliberate
  decision about whether it applies to both grounds or only one, instead of there being one
  ground to update. Worth a short checklist in the `TenantAdmin`/design-system docs so this
  doesn't silently drift the way the mock's own partial light-neutral-ramp (§3) already has.
- **Webhook routing's cross-check still depends on a live MP API call** — §7's mitigation (re-fetch
  the payment, compare its account id to `TenantPaymentAccount.ProviderAccountId`) is real defense
  in depth, but it means the webhook handler's correctness now also depends on MP's API being
  reachable at notification time, not just on verifying a signature locally; worth a clear retry/
  no-op path if that call itself fails, rather than silently skipping the cross-check under load.
- Every risk from the original plan's §7 (untracked delivery logistics, MP webhook signature
  currency, stock race conditions, guest cart durability, .NET 10 freshness, cost ceilings, single
  Postgres instance with no failover) still applies per-tenant and isn't repeated here.

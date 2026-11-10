# Storefront: shopper screens and state

What a shopper sees and how the Ui keeps its state: catalog, cart, accounts, checkout, orders and the home carousel.

The storefront screens come from the design bundle. The catalog (categories,
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

- The home promo carousel (`PromoCarousel.vue`) shows the store's own slides from `GET /api/promos` (`src/api/promos.ts`): a photo,
  a small text, a title and a button that applies a category or collection slug filter. With no slides there is no carousel, and
  if they cannot be read the home page still works. The store manages them at `/admin/promociones` (below).

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

- Shipping cost, installment count and transfer discount are platform constants in
  `src/lib/commerce.ts` (plan §5). Shipping is 0, so the prototype's free-shipping threshold and
  progress bar are intentionally not built.

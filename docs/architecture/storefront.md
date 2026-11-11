# Storefront: shopper screens and state

What a shopper sees and how the Ui keeps its state: catalog, cart, accounts, checkout, orders and the home carousel.

The storefront screens come from the design bundle. The catalog (categories,
collections, product list and detail) comes from the Api (step 2, `src/api/catalog.ts`). The
cart comes from the Api (step 3, `src/api/cart.ts`). Customer accounts are built (step 4,
`src/api/auth.ts`, `src/stores/auth.ts`): `/ingresar`, `/registrarse`, `/recuperar`,
`/restablecer` and `/cuenta` (profile name, order history and favorites). Checkout is real
(step 5, `src/api/orders.ts`): confirming places the order with one idempotency key per checkout
visit. A Mercado Pago order then leaves for Checkout Pro (`leaveTo` in `src/lib/navigation.ts`,
stubbed in tests). A transfer order goes to `/pedido/:number`, which shows the bank details. A cash order goes there too and is followed from "Recibido" through preparation and delivery before it is paid (`cashInProgress` in `OrderView.vue`); it says whether it is paid on delivery or on pickup. At a store whose theme has `storeKind: 'Grocery'` the checkout asks for a phone (required), makes the email optional and sends an empty one when it is left blank; every other store is unchanged. Cash is listed only when `checkout-options.cash` is true. Tests: `cashOrders.spec.ts`. A store with delivery zones (`checkout-options.zones`) replaces the postal code with a "Zona de entrega" select that lists each zone's price: the summary adds the picked zone's cost, the minimum order shows under the select, the request carries `zoneId` and an empty postal code, and a pickup shows no zone. The Api decides the price and refuses an order below the minimum; its message shows next to "Confirmar pedido". The order page says `Envío a <calle> (<zona>)`. A store without zones is unchanged. Tests: `deliveryZones.spec.ts`.

Grocery wording (`theme.isGrocery`, from `storeKind`; tests `groceryWording.spec.ts`). A grocery's storefront drops the clothing assumptions: no "Color" line, no "Guía de talles", no "envío gratis", "cambios gratis" or installments promises; a product with one variant hides the picker (it is chosen for the shopper) and with several calls them "Presentación"; cart, checkout and order lines show `x2` instead of `Talle M · x2`; stock messages say "de este producto"; the cart drawer shows shipping as "Según tu zona" until the checkout knows it. A standard store reads exactly as before. Checked in a real browser (Edge driven by a script, against the `almacen` dev store): a grocery's product page shows only its main photo slot (no "Detalle"/"Espalda") and says "Sin stock" with a disabled button when every presentation is out, at any store; the checkout summary says "Elegí tu zona" instead of "Gratis" until a store with zones has one picked; the poster prints black on white whatever the theme. Tests: `storefrontPolish.spec.ts`.

Product brand (`brand` on the product, the cart item and the order line; tests `productBrand.spec.ts`). When a product has one ("La Independencia"), it leads the line under the name on the card ("La Independencia · Almacén", so every card in a row keeps its name at the same height), shows under the title on the product page, and in the small text of a cart, checkout or order line (`src/lib/lineLabel.ts` builds it: brand, then "Talle M" for clothes only, then the quantity). A grocery card shows its category only (no color). The Api also matches the brand in the catalog search. Nothing is shown for a product without one.

WhatsApp and repeat order (tests `whatsappAndReorder.spec.ts`). When the store has a WhatsApp number (`checkout-options.whatsappNumber`, set in the admin) and the order is not expired, the order page offers "Enviar mi pedido por WhatsApp": a `wa.me` link (`src/lib/whatsapp.ts`) opening a chat with the store, with the order number, lines (brand and size, or only the brand at a grocery), total, payment, delivery (and zone) and the shopper's name and phone already written. It is built in the Ui; nothing is sent by the Api, and the order's access token is never put in the message. The account page's order list has "Repetir pedido": `cart.addLines` puts each line of the order (fetched with `GET /api/orders/{number}` as its owner) in the cart through the normal add endpoint, one by one, so a product that is gone or short of stock is added as far as it allows (or skipped) and reported in a message under the list instead of stopping the rest. The cart opens when something was added. Repeating adds to what is already in the cart.
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

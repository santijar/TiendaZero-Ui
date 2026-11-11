import { vi } from 'vitest'

import type { Cart, CartItem } from '../api/cart'
import type { Category, ProductDetail, ProductSummary } from '../api/catalog'
import type {
  AdminDomain,
  AdminPromo,
  AdminProduct,
  AdminTheme,
  ConnectPaymentAccount,
  PaymentAccount,
  PickupSettings,
  SavePickupSettings,
  CheckoutSettings,
  SaveDeliveryZone,
  SaveTransferAccount,
  TransferAccount,
  SaveProduct,
  SavePromo,
  SaveTheme,
  ThemeColors,
} from '../api/admin'
import type { CheckoutOptions, Order } from '../api/orders'
import type { Theme } from '../api/theme'

export const CATEGORIES: Category[] = [
  { slug: 'camisetas', name: 'Camisetas' },
  { slug: 'accesorios', name: 'Accesorios' },
]

export const PRODUCTS: ProductSummary[] = [
  {
    slug: 'cam-titular',
    name: 'Camiseta Titular 26',
    categorySlug: 'camisetas',
    categoryName: 'Camisetas',
    price: 48900,
    color: 'Negro',
    badge: 'Nuevo',
    imageUrl: '/media/products/cam-titular.webp',
    sizes: ['S', 'M', 'L'],
  },
  {
    slug: 'bolso',
    name: 'Bolso Deportivo',
    categorySlug: 'accesorios',
    categoryName: 'Accesorios',
    price: 54900,
    color: 'Negro',
    badge: null,
    imageUrl: null,
    sizes: ['Único'],
  },
]

export const TITULAR_DETAIL: ProductDetail = {
  slug: 'cam-titular',
  name: 'Camiseta Titular 26',
  categorySlug: 'camisetas',
  categoryName: 'Camisetas',
  price: 48900,
  color: 'Negro',
  badge: 'Nuevo',
  description: 'Tela dry-fit liviana.',
  sizes: [
    { size: 'S', inStock: false },
    { size: 'M', inStock: true },
    { size: 'L', inStock: true },
  ],
  images: [{ url: '/media/products/cam-titular.webp', alt: 'Camiseta Titular 26' }],
}

// A product with a single variant (a grocery's "Unidad", here the Bolso's "Único"), for the pages that pick it for the shopper.
export const BOLSO_DETAIL: ProductDetail = {
  slug: 'bolso',
  name: 'Bolso Deportivo',
  categorySlug: 'accesorios',
  categoryName: 'Accesorios',
  price: 54900,
  color: 'Negro',
  badge: null,
  description: 'Bolso de 40 L.',
  sizes: [{ size: 'Único', inStock: true }],
  images: [],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Stock per "slug/size"; anything not listed has plenty.
export const STOCK: Record<string, number> = { 'cam-titular/L': 2 }

// A minimal in-memory guest cart server mirroring the Api's contract.
function createCartServer() {
  const carts = new Map<string, CartItem[]>()
  let nextId = 1

  const toCart = (items: CartItem[]): Cart => ({
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: items.reduce((n, i) => n + i.lineTotal, 0),
  })
  const setQty = (item: CartItem, quantity: number) => {
    item.quantity = quantity
    item.lineTotal = item.unitPrice * quantity
  }

  return {
    carts,
    handle(method: string, path: string, token: string | null, body: Record<string, unknown>) {
      if (method === 'POST' && path === '/api/cart') {
        const newToken = `token-${carts.size + 1}`
        carts.set(newToken, [])
        return json({ token: newToken }, 201)
      }
      const items = token ? carts.get(token) : undefined
      if (!items) return json({ status: 404 }, 404)

      if (method === 'GET' && path === '/api/cart') return json(toCart(items))
      if (method === 'DELETE' && path === '/api/cart/items') {
        items.length = 0
        return json(toCart(items))
      }
      if (method === 'POST' && path === '/api/cart/items') {
        const product = PRODUCTS.find((p) => p.slug === body.productSlug)
        if (!product) return json({ status: 404 }, 404)
        const size = String(body.size)
        const stock = STOCK[`${product.slug}/${size}`] ?? 99
        const existing = items.find((i) => i.productSlug === product.slug && i.size === size)
        const added = Number(body.quantity ?? 1)
        const quantity = (existing?.quantity ?? 0) + added
        if (quantity > stock) return json({ stock, inCart: existing?.quantity ?? 0 }, 409)
        if (existing) setQty(existing, quantity)
        else {
          items.push({
            id: nextId++,
            productSlug: product.slug,
            name: product.name,
            size,
            color: product.color,
            unitPrice: product.price,
            quantity: added,
            lineTotal: product.price * added,
            imageUrl: product.imageUrl,
            maxQuantity: stock,
          })
        }
        return json(toCart(items))
      }
      const match = /^\/api\/cart\/items\/(\d+)$/.exec(path)
      const index = match ? items.findIndex((i) => i.id === Number(match[1])) : -1
      if (index < 0) return json({ status: 404 }, 404)
      if (method === 'DELETE') items.splice(index, 1)
      else if (method === 'PATCH') {
        const item = items[index]!
        const quantity = Number(body.quantity)
        if (quantity > item.maxQuantity) return json({ stock: item.maxQuantity }, 409)
        setQty(item, quantity)
      }
      return json(toCart(items))
    },
  }
}

interface FakeUser {
  id: string
  name: string
  password: string
  favorites: string[]
  roles?: string[]
}

// A minimal auth server: users, the refresh cookie (one per test "browser"), and access tokens that
// tests can expire to exercise the refresh-and-retry path.
function createAuthServer(cartServer: ReturnType<typeof createCartServer>) {
  const users = new Map<string, FakeUser>()
  const accessTokens = new Map<string, string>() // token -> email
  const state = { session: null as string | null, issued: 0, refreshes: 0 }

  const sessionFor = (email: string) => {
    const user = users.get(email)!
    const accessToken = `access-${++state.issued}`
    accessTokens.set(accessToken, email)
    state.session = email
    return {
      accessToken,
      expiresAt: '2099-01-01T00:00:00Z',
      user: { id: user.id, email, name: user.name, roles: user.roles ?? ['Customer'] },
    }
  }
  const adoptGuestCart = (email: string, cartToken: string | null) => {
    const guest = cartToken ? cartServer.carts.get(cartToken) : undefined
    if (!guest) return
    const account = cartServer.carts.get(`user:${email}`) ?? []
    cartServer.carts.set(`user:${email}`, [...account, ...guest])
    cartServer.carts.delete(cartToken!)
  }

  return {
    users,
    state,
    // Every issued access token stops working, as if they all expired.
    expireAccessTokens: () => accessTokens.clear(),
    emailFor: (authorization: string | null) =>
      authorization ? (accessTokens.get(authorization.replace('Bearer ', '')) ?? 'invalid') : null,
    handle(method: string, path: string, body: Record<string, unknown>, cartToken: string | null) {
      const email = String(body.email ?? '')
      if (path === '/api/auth/register') {
        if (users.has(email)) {
          return json({ errors: { email: ['Ya existe una cuenta con ese email.'] } }, 400)
        }
        if (String(body.password).length < 8) {
          return json(
            { errors: { password: ['La contraseña debe tener al menos 8 caracteres.'] } },
            400,
          )
        }
        users.set(email, {
          id: `u${users.size + 1}`,
          name: String(body.name),
          password: String(body.password),
          favorites: [],
        })
        adoptGuestCart(email, cartToken)
        return json(sessionFor(email))
      }
      if (path === '/api/auth/login') {
        if (users.get(email)?.password !== body.password) {
          return json({ detail: 'El email o la contraseña no son correctos.' }, 401)
        }
        adoptGuestCart(email, cartToken)
        return json(sessionFor(email))
      }
      if (path === '/api/auth/refresh') {
        state.refreshes++
        return state.session ? json(sessionFor(state.session)) : json({ detail: 'expired' }, 401)
      }
      if (path === '/api/auth/logout') {
        state.session = null
        return new Response(null, { status: 204 })
      }
      if (path === '/api/auth/forgot-password') return new Response(null, { status: 202 })
      return json({ status: 404 }, 404)
    },
    handleAccount(method: string, path: string, email: string, body: Record<string, unknown>) {
      const user = users.get(email)!
      if (path === '/api/account' && method === 'PATCH') {
        user.name = String(body.name)
        return json({ id: user.id, email, name: user.name, roles: ['Customer'] })
      }
      if (path === '/api/account/favorites') {
        return json(user.favorites.map((slug) => PRODUCTS.find((p) => p.slug === slug)!))
      }
      const slug = decodeURIComponent(path.replace('/api/account/favorites/', ''))
      user.favorites = user.favorites.filter((f) => f !== slug)
      if (method === 'PUT') user.favorites.unshift(slug)
      return new Response(null, { status: 204 })
    },
  }
}

// A minimal orders server: placing an order converts the cart (its key stops working), and tests
// can change an order's state directly (e.g. mark it paid, as a webhook would).
function createOrderServer(
  cartServer: ReturnType<typeof createCartServer>,
  checkoutOptions: CheckoutOptions,
) {
  const orders = new Map<string, Order & { token: string; owner: string | null }>()
  const state = {
    placed: [] as { body: Record<string, unknown>; idempotencyKey: string | null }[],
    syncs: 0,
    // When set, POST /api/orders answers with this instead of placing an order.
    refuse: null as { status: number; body: unknown } | null,
    checkoutDown: false,
    // Called on every sync, like Mercado Pago reporting a payment.
    onSync: null as ((order: Order) => void) | null,
  }

  const visible = (number: string, token: string | null, email: string | null) => {
    const order = orders.get(number)
    if (!order) return null
    return (order.owner && order.owner === email) || order.token === token ? order : null
  }
  const dto = (order: Order & { token: string; owner: string | null }): Order => {
    const { token: _token, owner: _owner, ...rest } = order
    return rest
  }

  return {
    orders,
    state,
    handle(
      method: string,
      path: string,
      headers: Headers,
      email: string | null,
      body: Record<string, unknown>,
    ) {
      if (path === '/api/account/orders') {
        const mine = [...orders.values()].filter((o) => o.owner === email)
        return json(
          mine.map((o) => ({
            number: o.number,
            status: o.status,
            paymentMethod: o.paymentMethod,
            itemCount: o.lines.reduce((n, l) => n + l.quantity, 0),
            total: o.total,
            createdAt: o.createdAt,
          })),
        )
      }
      if (method === 'POST' && path === '/api/orders') {
        state.placed.push({ body, idempotencyKey: headers.get('Idempotency-Key') })
        if (state.refuse) return json(state.refuse.body, state.refuse.status)
        const cartKey = email ? `user:${email}` : headers.get('X-Cart-Token')
        const items = cartKey ? cartServer.carts.get(cartKey) : undefined
        if (!items?.length) return json({ detail: 'Tu carrito está vacío.' }, 422)
        const subtotal = items.reduce((n, i) => n + i.lineTotal, 0)
        const transfer = body.paymentMethod === 'transfer'
        const cash = body.paymentMethod === 'cash'
        const discount = transfer ? subtotal * 0.1 : 0
        // A store with zones delivers by zone: the one named sets the shipping cost and a minimum order.
        const zone =
          body.delivery === 'home' && checkoutOptions.zones.length > 0
            ? checkoutOptions.zones.find((z) => z.id === body.zoneId)
            : undefined
        if (body.delivery === 'home' && checkoutOptions.zones.length > 0 && !zone) {
          return json({ errors: { zoneId: ['Elegí tu zona de entrega.'] } }, 400)
        }
        if (zone && subtotal < zone.minimumOrder) {
          return json(
            {
              errors: {
                zoneId: [`El pedido mínimo para ${zone.name} es $ ${zone.minimumOrder}.`],
              },
            },
            400,
          )
        }
        const shippingCost = zone?.cost ?? 0
        const number = `RG-${20001 + orders.size}`
        const order = {
          number,
          status: 'pending' as const,
          paymentMethod: transfer
            ? ('transfer' as const)
            : cash
              ? ('cash' as const)
              : ('mercadopago' as const),
          delivery: body.delivery as 'home' | 'pickup',
          email: String(body.email ?? ''),
          customerName: String(body.name),
          phone: typeof body.phone === 'string' ? body.phone : null,
          shippingAddress: (body.address as Order['shippingAddress']) ?? null,
          lines: items.map((i) => ({
            productSlug: i.productSlug,
            name: i.name,
            size: i.size,
            color: i.color,
            imageUrl: i.imageUrl,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
          })),
          subtotal,
          shippingCost,
          discount,
          total: subtotal + shippingCost - discount,
          deliveryZone: zone?.name ?? null,
          createdAt: '2026-11-02T15:00:00Z',
          expiresAt: transfer
            ? '2026-11-04T15:00:00Z'
            : cash
              ? '2026-11-02T16:00:00Z'
              : '2026-11-02T15:30:00Z',
          paidAt: null,
          transfer: transfer
            ? {
                alias: 'REGATE.TIENDA.DEMO',
                cbu: '0000003100000000000000',
                holder: 'Regate',
                bank: 'Banco',
              }
            : null,
          lastPaymentStatus: null,
          fulfillment: 'unfulfilled' as const,
          trackingInfo: null,
          pickup: body.delivery === 'pickup' ? { ...checkoutOptions.pickup! } : null,
          token: `order-token-${orders.size + 1}`,
          owner: email,
        }
        orders.set(number, order)
        // The cart is converted: a guest token no longer names a cart; an account starts empty.
        if (email) cartServer.carts.set(cartKey!, [])
        else cartServer.carts.delete(cartKey!)
        return json({ order: dto(order), accessToken: order.token }, 201)
      }

      const match = /^\/api\/orders\/([^/]+)(\/checkout|\/sync)?$/.exec(path)
      const order = match
        ? visible(decodeURIComponent(match[1]!), headers.get('X-Order-Token'), email)
        : null
      if (!order) return json({ status: 404 }, 404)
      if (match![2] === '/checkout') {
        if (state.checkoutDown) return json({ detail: 'Mercado Pago no responde.' }, 502)
        return json({ url: `https://mercadopago.example/checkout/${order.number}` })
      }
      if (match![2] === '/sync') {
        state.syncs++
        state.onSync?.(order)
      }
      return json(dto(order))
    },
  }
}

// A minimal /api/admin: orders (sharing the order server's orders) and an editable product whose
// stock version tests can bump, as a sale would.
function createAdminServer(
  orderServer: ReturnType<typeof createOrderServer>,
  checkoutOptions: CheckoutOptions,
) {
  const product: AdminProduct = {
    id: 1,
    slug: 'cam-titular',
    name: 'Camiseta Titular 26',
    description: 'Tela dry-fit liviana.',
    price: 48900,
    color: 'Negro',
    badge: 'Nuevo',
    categoryId: 1,
    collectionIds: [],
    isActive: true,
    sortOrder: 1,
    variants: [
      { id: 11, size: 'S', sku: 'CAM-TITULAR-S', stock: 5, version: 1 },
      { id: 12, size: 'M', sku: 'CAM-TITULAR-M', stock: 8, version: 1 },
    ],
    images: [],
  }
  const state = {
    product,
    saves: [] as SaveProduct[],
    created: [] as SaveProduct[],
  }

  const adminOrder = (o: Order & { token: string; owner: string | null }) => {
    const { token: _token, owner: _owner, ...order } = o
    const path =
      order.delivery === 'pickup'
        ? ['unfulfilled', 'preparing', 'ready-for-pickup', 'delivered']
        : ['unfulfilled', 'preparing', 'shipped', 'delivered']
    return {
      order,
      signedIn: o.owner !== null,
      needsReview: false,
      reviewNotes: null,
      payments: [],
      // A cash order is prepared before it is paid.
      nextFulfillment:
        order.status === 'paid' || (order.status === 'pending' && order.paymentMethod === 'cash')
          ? path.slice(path.indexOf(order.fulfillment) + 1)
          : [],
      canMarkPaid: order.paymentMethod !== 'mercadopago' && order.status !== 'paid',
    }
  }

  return {
    state,
    theme: createThemeAdmin(),
    payments: createPaymentAdmin(),
    transfer: createTransferAdmin(),
    pickup: createPickupAdmin(),
    checkoutSettings: createCheckoutSettingsAdmin(checkoutOptions),
    deliveryZones: createDeliveryZonesAdmin(checkoutOptions),
    promos: createPromoAdmin(),
    domains: createDomainAdmin(),
    handle(method: string, path: string, body: Record<string, unknown>) {
      if (path === '/api/admin/categories') {
        return json([
          { id: 1, slug: 'camisetas', name: 'Camisetas', sortOrder: 1, productCount: 1 },
        ])
      }
      if (path === '/api/admin/collections') return json([])
      if (path === '/api/admin/products' && method === 'GET') {
        const p = state.product
        return json({
          items: [
            {
              id: p.id,
              slug: p.slug,
              name: p.name,
              categoryName: 'Camisetas',
              price: p.price,
              isActive: p.isActive,
              totalStock: p.variants.reduce((n, v) => n + v.stock, 0),
              imageUrl: null,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 50,
        })
      }
      if (path === '/api/admin/products' && method === 'POST') {
        state.created.push(body as unknown as SaveProduct)
        return json({ ...state.product, ...body, id: 2, variants: [], images: [] }, 201)
      }
      if (path === '/api/admin/products/1' && method === 'GET') return json(state.product)
      if (path === '/api/admin/products/2' && method === 'GET') {
        return json({ ...state.product, id: 2, name: 'Nuevo' })
      }
      if (path === '/api/admin/products/1' && method === 'PUT') {
        const save = body as unknown as SaveProduct
        state.saves.push(save)
        for (const v of save.variants) {
          const current = state.product.variants.find((c) => c.id === v.id)
          if (
            current &&
            v.stock !== null &&
            v.stock !== current.stock &&
            v.version !== current.version
          ) {
            return json({ detail: 'El stock cambió mientras editabas (hubo ventas).' }, 409)
          }
        }
        state.product = {
          ...state.product,
          name: save.name,
          variants: save.variants.map((v, i) => {
            const current = state.product.variants.find((c) => c.id === v.id)
            return {
              id: v.id ?? 100 + i,
              size: v.size,
              sku: v.sku,
              stock: v.stock ?? current?.stock ?? 0,
              version: (current?.version ?? 0) + 1,
            }
          }),
        }
        return json(state.product)
      }

      if (path === '/api/admin/orders') {
        const items = [...orderServer.orders.values()].map((o) => ({
          number: o.number,
          createdAt: o.createdAt,
          customerName: o.customerName,
          email: o.email,
          paymentMethod: o.paymentMethod,
          status: o.status,
          fulfillment: o.fulfillment,
          needsReview: false,
          itemCount: o.lines.reduce((n, l) => n + l.quantity, 0),
          total: o.total,
        }))
        return json({ items, total: items.length, page: 1, pageSize: 50 })
      }
      const match = /^\/api\/admin\/orders\/([^/]+)(?:\/([a-z-]+))?$/.exec(path)
      const order = match ? orderServer.orders.get(decodeURIComponent(match[1]!)) : undefined
      if (!order) return json({ status: 404 }, 404)
      if (match![2] === 'mark-paid') order.status = 'paid'
      if (match![2] === 'fulfillment') {
        order.fulfillment = body.status as Order['fulfillment']
        order.trackingInfo = (body.trackingInfo as string | null) ?? order.trackingInfo
      }
      return json(adminOrder(order))
    },
  }
}

// The branding editor's side of the Api (/api/admin/theme*): the stored theme, what was saved, and the same
// validation messages and file checks the real one answers with (the Api's own tests cover the rules).
function createThemeAdmin() {
  const state = {
    theme: {
      mode: 'Dark',
      accentHue: 289,
      hasHandPickedAccent: true,
      storeName: 'Regate',
      footerLegalName: 'Regate Indumentaria',
      logoUrl: '/media/brand/regate-logo.png',
      logoWidth: '44px',
      logoHeight: '44px',
      logoMargin: '-4px -6px',
      logoFilter: null,
      logoBlendMode: null,
      wordmark: 'REGATE',
      monogram: 'RG',
      faviconUrl: null,
      socialLinks: [
        { label: '@regate.indumentaria', url: 'https://www.instagram.com/regate.indumentaria/' },
      ],
      emailAccentHex: '#9184d9',
      emailLogoUrl: null,
      emailReplyTo: null,
      phone: null,
      preview: REGATE_THEME,
    } as AdminTheme,
    saves: [] as SaveTheme[],
    previews: [] as { accentHue: number; useHandPickedAccent: boolean }[],
    uploads: [] as string[],
  }

  // Dark and light variables for a hue: just the ones the editor measures. Hue 0 is the awkward one, whose
  // dark accent is nearly the ground's color.
  const colors = (hue: number): ThemeColors => ({
    dark: {
      '--color-bg': '#161826',
      '--color-surface': '#232532',
      '--color-accent': hue === 0 ? '#222222' : '#a296f1',
      '--color-accent-200': '#e7e5fe',
      '--color-accent-900': '#2b2741',
    },
    light: {
      '--color-bg': '#f6f7fa',
      '--color-surface': '#ffffff',
      '--color-accent': '#7363c0',
      '--color-accent-200': '#2b2741',
      '--color-accent-900': '#f5f4ff',
    },
  })

  return {
    state,
    handle(method: string, path: string, body: Record<string, unknown>, form: FormData | null) {
      const theme = state.theme
      if (path === '/api/admin/theme' && method === 'GET') return json(theme)
      if (path === '/api/admin/theme' && method === 'PUT') {
        const save = body as unknown as SaveTheme
        if (!save.storeName?.trim()) {
          return json(
            { errors: { storeName: ['El nombre de la tienda tiene entre 1 y 80 caracteres.'] } },
            400,
          )
        }
        if (save.emailReplyTo && !/^[^s@<>,;"]+@[^s@<>,;"]+.[^s@<>,;"]+$/.test(save.emailReplyTo)) {
          return json(
            { errors: { emailReplyTo: ['Una dirección de correo como contacto@tutienda.com.'] } },
            400,
          )
        }
        // Blank or omitted clears the phone; the Api stores it trimmed.
        const phone = save.phone?.trim() || null
        if (phone) {
          const digits = phone.replace(/\D/g, '').length
          if (phone.length > 30 || digits < 6 || digits > 15 || !/^\+?[\d\s\-()]+$/.test(phone)) {
            return json(
              { errors: { phone: ['Un teléfono con código de área, como +54 11 5555-1234.'] } },
              400,
            )
          }
        }
        state.saves.push(save)
        const { useHandPickedAccent, ...fields } = save
        Object.assign(theme, fields, {
          phone,
          hasHandPickedAccent: theme.hasHandPickedAccent && useHandPickedAccent,
        })
        theme.preview = {
          ...theme.preview,
          mode: theme.mode,
          storeName: theme.storeName,
          phone,
        }
        return json(theme)
      }
      if (path === '/api/admin/theme/preview' && method === 'POST') {
        const request = body as unknown as { accentHue: number; useHandPickedAccent: boolean }
        state.previews.push(request)
        return json(colors(request.accentHue))
      }
      const asset = /^\/api\/admin\/theme\/(logo|favicon)$/.exec(path)?.[1] as
        'logo' | 'favicon' | undefined
      if (asset && method === 'POST') {
        const file = form?.get('file')
        const name = file instanceof File ? file.name : ''
        if (!/\.(png|jpe?g|webp|ico)$/i.test(name)) {
          return json({ errors: { file: ['Subí una imagen JPG, PNG o WebP.'] } }, 400)
        }
        state.uploads.push(`${asset}:${name}`)
        if (asset === 'logo') theme.logoUrl = `/media/uploads/01/${name}`
        else theme.faviconUrl = `/media/uploads/01/${name}`
        return json(theme)
      }
      if (asset && method === 'DELETE') {
        if (asset === 'logo') {
          Object.assign(theme, {
            logoUrl: null,
            logoWidth: null,
            logoHeight: null,
            logoMargin: null,
            logoFilter: null,
            logoBlendMode: null,
          })
        } else theme.faviconUrl = null
        return json(theme)
      }
      return json({ status: 404 }, 404)
    },
  }
}

export const PLATFORM_ADMIN = { email: 'root@plataforma.test', password: 'clave-segura-26' }

export const PLATFORM_TENANTS = [
  {
    id: '01',
    slug: 'regate',
    name: 'Regate',
    status: 'Active',
    orderNumberPrefix: 'RG',
    primaryDomain: 'regate.localhost',
    kind: 'Standard',
  },
  {
    id: '02',
    slug: 'indians',
    name: 'Indians',
    status: 'Active',
    orderNumberPrefix: 'IND',
    primaryDomain: 'indians.localhost',
    kind: 'Standard',
  },
]

export const INDIANS_CATEGORIES: Category[] = [{ slug: 'beisbol', name: 'Béisbol' }]

export const INDIANS_PRODUCTS: ProductSummary[] = [
  {
    slug: 'jersey-ctg',
    name: 'Camiseta Béisbol CTG',
    categorySlug: 'beisbol',
    categoryName: 'Béisbol',
    price: 54900,
    color: 'Blanco y celeste',
    badge: null,
    imageUrl: null,
    sizes: ['S', 'M'],
  },
]

// The pickup point of the pickup screen (/api/admin/pickup): answers like the real one, can be replaced and removed.
function createPickupAdmin() {
  const state = {
    settings: { configured: false, name: null, details: null } as PickupSettings,
    saves: [] as SavePickupSettings[],
    removes: 0,
  }

  return {
    state,
    handle(method: string, body: Record<string, unknown>) {
      if (method === 'GET') return json(state.settings)
      if (method === 'DELETE') {
        state.removes++
        state.settings = { configured: false, name: null, details: null }
        return json(state.settings)
      }
      if (method !== 'PUT') return json({}, 405)
      const request = body as unknown as SavePickupSettings
      if (!request.name) {
        return json(
          { errors: { name: ['Ingresá el nombre del lugar de retiro (hasta 80 caracteres).'] } },
          400,
        )
      }
      state.saves.push(request)
      state.settings = { configured: true, name: request.name, details: request.details ?? '' }
      return json(state.settings)
    },
  }
}

// The checkout settings of the Cobros y WhatsApp screen (/api/admin/checkout-settings): the number is normalized to digits
// and refused when it can't be dialed, like the real one. Saving also changes what the shopper's checkout offers.
function createCheckoutSettingsAdmin(checkoutOptions: CheckoutOptions) {
  const state = {
    settings: { whatsappNumber: null, cash: false, mercadoPago: true } as CheckoutSettings,
    saves: [] as CheckoutSettings[],
  }

  return {
    state,
    handle(method: string, body: Record<string, unknown>) {
      if (method === 'GET') return json(state.settings)
      if (method !== 'PUT') return json({}, 405)
      const request = body as unknown as CheckoutSettings
      const digits = (request.whatsappNumber ?? '').replace(/\D/g, '')
      if (digits.length > 0 && (digits.length < 8 || digits.length > 15)) {
        return json(
          {
            errors: {
              whatsappNumber: [
                'Ingresá el número con código de país, por ejemplo +54 9 11 5555-1234.',
              ],
            },
          },
          400,
        )
      }
      state.saves.push(request)
      state.settings = {
        whatsappNumber: digits || null,
        cash: request.cash,
        mercadoPago: request.mercadoPago,
      }
      Object.assign(checkoutOptions, state.settings)
      return json(state.settings)
    },
  }
}

// The delivery zones screen (/api/admin/delivery-zones): same rules as the real one (a name that is not repeated, amounts
// from 0), and the zones it holds are what the shopper's checkout offers (checkoutOptions.zones).
function createDeliveryZonesAdmin(checkoutOptions: CheckoutOptions) {
  const state = { saves: [] as SaveDeliveryZone[], deletes: [] as string[], next: 1 }

  function check(body: SaveDeliveryZone, id?: string) {
    const errors: Record<string, string[]> = {}
    if (!body.name) errors.name = ['Ingresá el nombre de la zona (hasta 80 caracteres).']
    else if (
      checkoutOptions.zones.some(
        (z) => z.id !== id && z.name.toLowerCase() === body.name.toLowerCase(),
      )
    ) {
      errors.name = ['Ya tenés una zona con ese nombre.']
    }
    if (body.cost === null || body.cost < 0) {
      errors.cost = ['Ingresá cuánto cuesta el envío (0 si es gratis).']
    }
    if (body.minimumOrder === null || body.minimumOrder < 0) {
      errors.minimumOrder = ['Ingresá el pedido mínimo (0 si no hay).']
    }
    return Object.keys(errors).length > 0 ? json({ errors }, 400) : null
  }

  return {
    state,
    handle(method: string, path: string, body: Record<string, unknown>) {
      const id = path.split('/')[4]
      if (method === 'GET') return json(checkoutOptions.zones)
      if (method === 'DELETE') {
        state.deletes.push(id!)
        checkoutOptions.zones = checkoutOptions.zones.filter((z) => z.id !== id)
        return new Response(null, { status: 204 })
      }
      const request = body as unknown as SaveDeliveryZone
      const refused = check(request, id)
      if (refused) return refused
      state.saves.push(request)
      const zone = {
        id: id ?? `zone-${state.next++}`,
        name: request.name,
        cost: request.cost!,
        minimumOrder: request.minimumOrder!,
      }
      checkoutOptions.zones = id
        ? checkoutOptions.zones.map((z) => (z.id === id ? zone : z))
        : [...checkoutOptions.zones, zone]
      return json(zone, method === 'POST' ? 201 : 200)
    },
  }
}

// The transfer details of the payments screen (/api/admin/transfer-account): answers like the real one, with the
// same rules (alias without spaces, a 22-digit CBU, a holder and a bank), and can be replaced but not removed.
function createTransferAdmin() {
  const state = {
    account: {
      configured: false,
      alias: null,
      cbu: null,
      holder: null,
      bank: null,
    } as TransferAccount,
    saves: [] as SaveTransferAccount[],
  }

  return {
    state,
    handle(method: string, body: Record<string, unknown>) {
      if (method === 'GET') return json(state.account)
      if (method !== 'PUT') return json({}, 405)
      const request = body as unknown as SaveTransferAccount
      const errors: Record<string, string[]> = {}
      if (!request.alias || /\s/.test(request.alias))
        errors.alias = ['Ingresá el alias, sin espacios (hasta 60 caracteres).']
      if (!/^\d{22}$/.test(request.cbu ?? '')) errors.cbu = ['El CBU o CVU tiene 22 números.']
      if (!request.holder)
        errors.holder = ['Ingresá el titular de la cuenta (hasta 120 caracteres).']
      if (!request.bank) errors.bank = ['Ingresá el banco o la billetera (hasta 80 caracteres).']
      if (Object.keys(errors).length) return json({ errors }, 400)
      state.saves.push(request)
      state.account = { configured: true, ...request }
      return json(state.account)
    },
  }
}

// The store payments screen's side of the Api (/api/admin/payment-account): it accepts the tokens in `validTokens`
// (Mercado Pago knows them) and answers like the real one, with no secret in any answer.
function createPaymentAdmin() {
  const state = {
    account: {
      provider: 'MercadoPago',
      status: 'Disconnected',
      providerAccountId: null,
      accessTokenHint: null,
      publicKey: null,
      hasWebhookSecret: false,
      connectedAt: null,
      lastVerifiedAt: null,
      webhookUrl: 'https://api.tienda.example/api/payments/webhooks/mercadopago/0197-regate',
    } as PaymentAccount,
    validTokens: new Map<string, string>([['APP_USR-regate-token-1234', '1000']]),
    connects: [] as ConnectPaymentAccount[],
    disconnects: 0,
    down: false,
  }

  return {
    state,
    handle(method: string, body: Record<string, unknown>) {
      if (method === 'GET') return json(state.account)
      if (method === 'PUT') {
        const request = body as unknown as ConnectPaymentAccount
        const errors: Record<string, string[]> = {}
        if (!request.accessToken) errors.accessToken = ['El access token es obligatorio.']
        if (!request.publicKey) errors.publicKey = ['La public key es obligatoria.']
        if (!request.webhookSecret)
          errors.webhookSecret = ['La clave secreta de webhooks es obligatoria.']
        if (Object.keys(errors).length) return json({ errors }, 400)
        if (state.down)
          return json(
            {
              title: 'Bad gateway',
              detail: 'No pudimos comunicarnos con Mercado Pago. Probá de nuevo en unos minutos.',
            },
            502,
          )
        const accountId = state.validTokens.get(request.accessToken)
        if (!accountId) {
          return json(
            { errors: { accessToken: ['Mercado Pago no reconoce este access token.'] } },
            400,
          )
        }
        state.connects.push(request)
        state.account = {
          ...state.account,
          status: 'Connected',
          providerAccountId: accountId,
          accessTokenHint: '…' + request.accessToken.slice(-4),
          publicKey: request.publicKey,
          hasWebhookSecret: true,
          connectedAt: '2026-11-05T15:00:00Z',
          lastVerifiedAt: '2026-11-05T15:00:00Z',
        }
        return json(state.account)
      }
      if (method === 'DELETE') {
        state.disconnects++
        state.account = {
          ...state.account,
          status: 'Disconnected',
          providerAccountId: null,
          accessTokenHint: null,
          publicKey: null,
          hasWebhookSecret: false,
        }
        return json(state.account)
      }
      return json({ status: 404 }, 404)
    },
  }
}

// The domains screen's side of the Api (/api/admin/domains): a store with its platform subdomain, claims proven by a
// TXT record a test "publishes" (`published`), the same refusals and status codes as the real one (its own tests
// cover the rules), and `taken` for hosts another store already verified.
// The home carousel (/api/admin/promos): answers like the real one, with its rules (a title and a button text, at most 8,
// a slide only shows once it has a photo). `state.slides` is also what GET /api/promos lists, minus the ones without a photo.
function createPromoAdmin() {
  const REGATE_PROMOS: AdminPromo[] = [
    {
      id: 'promo-1',
      imageUrl: '/media/brand/regate-promo-futbol.jpeg',
      alt: 'Fútbol',
      kicker: 'Fútbol',
      title: 'Hecho para la cancha',
      cta: 'Ver camisetas',
      category: 'camisetas',
      collection: null,
    },
    {
      id: 'promo-2',
      imageUrl: '/media/brand/regate-promo-estadio.jpeg',
      alt: 'Estadio',
      kicker: 'Temporada 26',
      title: 'Salí a la cancha con Regate',
      cta: 'Toda la tienda',
      category: null,
      collection: null,
    },
  ]
  const state = {
    slides: REGATE_PROMOS.map((p) => ({ ...p })),
    uploads: [] as { id: string; name: string }[],
    deleted: [] as string[],
    reorders: [] as string[][],
    next: 3,
  }

  function check(request: SavePromo) {
    const errors: Record<string, string[]> = {}
    if (!request.title) errors.title = ['Ingresá el título (hasta 80 caracteres).']
    if (!request.cta) errors.cta = ['Ingresá el texto del botón (hasta 30 caracteres).']
    if (request.category && request.collection)
      errors.category = ['Elegí una categoría o una colección, no las dos.']
    return errors
  }

  return {
    state,
    handle(method: string, path: string, body: Record<string, unknown>, form: FormData | null) {
      const id = path.split('/')[4]
      if (method === 'GET') return json(state.slides)
      if (method === 'POST' && path === '/api/admin/promos') {
        const request = body as unknown as SavePromo
        if (state.slides.length >= 8) {
          return json(
            {
              errors: {
                slides: ['Podés tener hasta 8 promociones. Borrá alguna para sumar otra.'],
              },
            },
            400,
          )
        }
        const errors = check(request)
        if (Object.keys(errors).length) return json({ errors }, 400)
        const created: AdminPromo = {
          id: `promo-${state.next++}`,
          imageUrl: null,
          ...request,
          alt: request.alt || request.title,
        }
        state.slides.push(created)
        return json(created, 201)
      }
      if (method === 'PUT' && path === '/api/admin/promos/order') {
        const ids = (body as { ids: string[] }).ids
        state.reorders.push(ids)
        state.slides = ids.map((i) => state.slides.find((s) => s.id === i)!)
        return json(state.slides)
      }
      const slide = state.slides.find((s) => s.id === id)
      if (!slide) return json({}, 404)
      if (method === 'PUT') {
        const request = body as unknown as SavePromo
        const errors = check(request)
        if (Object.keys(errors).length) return json({ errors }, 400)
        Object.assign(slide, request, { alt: request.alt || request.title })
        return json(slide)
      }
      if (method === 'DELETE') {
        state.deleted.push(slide.id)
        state.slides = state.slides.filter((s) => s.id !== slide.id)
        return new Response(null, { status: 204 })
      }
      if (method === 'POST' && path.endsWith('/image')) {
        const file = form?.get('file') as File | null
        if (!file || file.type === 'text/plain') {
          return json({ errors: { file: ['Subí una foto JPG, PNG o WebP.'] } }, 400)
        }
        state.uploads.push({ id: slide.id, name: file.name })
        slide.imageUrl = `/media/uploads/test/${file.name}`
        return json(slide)
      }
      return json({}, 405)
    },
  }
}

function createDomainAdmin() {
  const state = {
    domains: [
      {
        id: 'dom-sub',
        domain: 'regate.localhost',
        type: 'Subdomain',
        isPrimary: true,
        verified: true,
        verifiedAt: '2026-11-01T12:00:00Z',
        tlsStatus: 'None',
        tlsDetail: null,
        instructions: null,
      },
    ] as AdminDomain[],
    tokens: new Map<string, string>(),
    published: new Set<string>(),
    taken: new Set<string>(),
    dnsDown: false,
    certificate: { status: 'Pending', detail: 'Esperando el certificado.' } as {
      status: AdminDomain['tlsStatus']
      detail: string | null
    },
    removed: [] as string[],
    counter: 0,
  }

  const problem = (field: string, message: string, status = 400) =>
    json({ errors: { [field]: [message] } }, status)

  return {
    state,
    handle(method: string, path: string, body: Record<string, unknown>) {
      if (path === '/api/admin/domains' && method === 'GET') return json(state.domains)
      if (path === '/api/admin/domains' && method === 'POST') {
        const domain = String(body.domain ?? '')
          .trim()
          .toLowerCase()
        if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) {
          return problem(
            'domain',
            'Escribí un dominio como tienda.midominio.com, sin https:// ni barras.',
          )
        }
        if (state.domains.some((d) => d.domain === domain)) {
          return problem('domain', 'Ya agregaste este dominio.')
        }
        if (state.taken.has(domain)) {
          return json({ detail: 'Ese dominio ya está en uso por otra tienda.' }, 409)
        }
        const id = `dom-${++state.counter}`
        const token = `token${state.counter}`.padEnd(32, 'x')
        state.tokens.set(id, token)
        const claim: AdminDomain = {
          id,
          domain,
          type: 'Custom',
          isPrimary: false,
          verified: false,
          verifiedAt: null,
          tlsStatus: 'None',
          tlsDetail: null,
          instructions: {
            txtName: `_tiendazero.${domain}`,
            txtValue: `tiendazero-verification=${token}`,
            cnameTarget: 'stores.tienda.example',
          },
        }
        state.domains.push(claim)
        return json(claim, 201)
      }

      const match = /^\/api\/admin\/domains\/([^/]+)(?:\/(check|primary))?$/.exec(path)
      const domain = match && state.domains.find((d) => d.id === match[1])
      if (!match || !domain) return json({ status: 404 }, 404)

      if (match[2] === 'check' && method === 'POST') {
        if (domain.type !== 'Custom') return json({ status: 404 }, 404)
        if (!domain.verified) {
          if (state.dnsDown) {
            return json(
              { detail: 'No pudimos consultar el DNS ahora. Probá de nuevo en unos minutos.' },
              502,
            )
          }
          const value = `tiendazero-verification=${state.tokens.get(domain.id)}`
          if (!state.published.has(`${domain.instructions!.txtName}=${value}`)) {
            return problem(
              'domain',
              `Todavía no vemos el registro TXT en ${domain.instructions!.txtName}. Los cambios de DNS pueden tardar un rato en llegar.`,
            )
          }
          if (state.taken.has(domain.domain)) {
            return json({ detail: 'Ese dominio ya está en uso por otra tienda.' }, 409)
          }
          domain.verified = true
          domain.verifiedAt = '2026-11-05T15:00:00Z'
          domain.instructions = { ...domain.instructions!, txtValue: '' }
        }
        domain.tlsStatus = state.certificate.status
        domain.tlsDetail = state.certificate.detail
        return json(domain)
      }
      if (match[2] === 'primary' && method === 'POST') {
        if (!domain.verified) {
          return problem('domain', 'Verificá el dominio antes de hacerlo principal.')
        }
        state.domains.forEach((d) => (d.isPrimary = d.id === domain.id))
        return json(domain)
      }
      if (!match[2] && method === 'DELETE') {
        if (domain.type !== 'Custom') return json({ status: 404 }, 404)
        if (domain.isPrimary) {
          return problem(
            'domain',
            'Es el dominio principal. Elegí otro como principal antes de quitarlo.',
          )
        }
        state.domains = state.domains.filter((d) => d.id !== domain.id)
        state.removed.push(domain.domain)
        return new Response(null, { status: 204 })
      }
      return json({ status: 404 }, 404)
    },
  }
}

// The platform side of the Api: a platform admin's session (cookie-backed, like the real one), the store list, and
// the read-only preview of a store's public catalog. It is as strict as the real thing, so a Ui that forgets the
// token or the header fails here instead of passing.
function createPlatformServer() {
  let cookie = false // the httpOnly refresh cookie
  let counter = 0
  let validToken: string | null = null

  function session() {
    validToken = `platform-token-${++counter}`
    return {
      accessToken: validToken,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: {
        id: 'platform-1',
        email: PLATFORM_ADMIN.email,
        name: 'Root',
        roles: ['PlatformAdmin'],
      },
    }
  }

  return {
    // Makes the current access token stop working, as when it expires.
    expireToken() {
      validToken = null
    },
    isAuthorized: (authorization: string | null) =>
      !!validToken && authorization === `Bearer ${validToken}`,
    handleAuth(method: string, path: string, body: { email?: string; password?: string }) {
      if (path.endsWith('/login')) {
        if (body.email !== PLATFORM_ADMIN.email || body.password !== PLATFORM_ADMIN.password) {
          return json({ status: 401, detail: 'El email o la contraseña no son correctos.' }, 401)
        }
        cookie = true
        return json(session())
      }
      if (path.endsWith('/refresh')) return cookie ? json(session()) : json({ status: 401 }, 401)
      if (path.endsWith('/logout') && method === 'POST') {
        cookie = false
        validToken = null
        return new Response(null, { status: 204 })
      }
      return json({ status: 404 }, 404)
    },
  }
}

export type FakeApi = ReturnType<typeof stubApi>

// Stubs `fetch` with a tiny in-memory version of the Api (catalog, cart, auth, account). Returns
// the mock, so tests can inspect requested URLs, plus the fake servers' state.
export function stubApi() {
  const cartServer = createCartServer()
  const authServer = createAuthServer(cartServer)
  // What the store's checkout offers (GET /api/checkout-options). A test changes it to model a store without pickup or transfer.
  const checkoutOptions: CheckoutOptions = {
    pickup: { name: 'Showroom Regate', details: 'Lun a vie · 10 a 19 h · Listo en 48 h' },
    transfer: true,
    cash: false,
    mercadoPago: true,
    whatsappNumber: null,
    zones: [],
  }
  const orderServer = createOrderServer(cartServer, checkoutOptions)
  const adminServer = createAdminServer(orderServer, checkoutOptions)
  const platformServer = createPlatformServer()
  // The theme of the store the fake "host" belongs to: Regate unless a test swaps it.
  const theme: { current: Theme } = { current: REGATE_THEME }
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
    if (url.pathname.startsWith('/api/platform/auth/')) {
      return platformServer.handleAuth(method, url.pathname, body)
    }
    if (url.pathname === '/api/platform/tenants') {
      return platformServer.isAuthorized(headers.get('Authorization'))
        ? json(PLATFORM_TENANTS)
        : json({}, 401)
    }
    const previewing = headers.get('X-Preview-Tenant')
    if (previewing) {
      // A preview needs the platform admin's token, is read-only and reaches only the public catalog.
      if (!platformServer.isAuthorized(headers.get('Authorization'))) return json({}, 401)
      if (method !== 'GET') return json({}, 403)
      const store = PLATFORM_TENANTS.find((t) => t.slug === previewing)
      if (!store) return json({ status: 404 }, 404)
      const indians = store.slug === 'indians'
      if (url.pathname === '/api/theme') return json(indians ? INDIANS_THEME : REGATE_THEME)
      if (url.pathname === '/api/promos') {
        return json(indians ? [] : adminServer.promos.state.slides.filter((s) => s.imageUrl))
      }
      if (url.pathname === '/api/categories') return json(indians ? INDIANS_CATEGORIES : CATEGORIES)
      if (url.pathname === '/api/collections') return json([])
      if (url.pathname === '/api/products') {
        const items = indians ? INDIANS_PRODUCTS : PRODUCTS
        return json({ items, total: items.length, page: 1, pageSize: 48 })
      }
      if (url.pathname === '/api/products/cam-titular' && !indians) return json(TITULAR_DETAIL)
      if (url.pathname === '/api/products/bolso' && !indians) return json(BOLSO_DETAIL)
      return json({ status: 404 }, 404)
    }
    if (url.pathname.startsWith('/api/auth/')) {
      return authServer.handle(method, url.pathname, body, headers.get('X-Cart-Token'))
    }

    // Like the Api: a bearer token that doesn't validate is a 401 on every endpoint.
    const email = authServer.emailFor(headers.get('Authorization'))
    if (email === 'invalid') return json({ status: 401 }, 401)
    if (url.pathname.startsWith('/api/admin/')) {
      if (!email) return json({}, 401)
      const roles = api.auth.users.get(email)?.roles ?? []
      if (!roles.includes('TenantAdmin')) return json({}, 403)
      if (url.pathname.startsWith('/api/admin/domains')) {
        return adminServer.domains.handle(method, url.pathname, body)
      }
      if (url.pathname === '/api/admin/payment-account') {
        return adminServer.payments.handle(method, body)
      }
      if (url.pathname.startsWith('/api/admin/promos')) {
        const form = init?.body instanceof FormData ? init.body : null
        return adminServer.promos.handle(method, url.pathname, body, form)
      }
      if (url.pathname === '/api/admin/transfer-account') {
        return adminServer.transfer.handle(method, body)
      }
      if (url.pathname.startsWith('/api/admin/delivery-zones')) {
        return adminServer.deliveryZones.handle(method, url.pathname, body)
      }
      if (url.pathname === '/api/admin/checkout-settings') {
        return adminServer.checkoutSettings.handle(method, body)
      }
      if (url.pathname === '/api/admin/pickup') {
        return adminServer.pickup.handle(method, body)
      }
      if (url.pathname.startsWith('/api/admin/theme')) {
        const form = init?.body instanceof FormData ? init.body : null
        return adminServer.theme.handle(method, url.pathname, body, form)
      }
      return adminServer.handle(method, url.pathname, body)
    }
    if (url.pathname.startsWith('/api/orders') || url.pathname === '/api/account/orders') {
      if (url.pathname === '/api/account/orders' && !email) return json({}, 401)
      return orderServer.handle(method, url.pathname, headers, email, body)
    }
    if (url.pathname.startsWith('/api/account')) {
      return email ? authServer.handleAccount(method, url.pathname, email, body) : json({}, 401)
    }
    if (url.pathname.startsWith('/api/cart')) {
      const key = email ? `user:${email}` : headers.get('X-Cart-Token')
      if (email && !cartServer.carts.has(key!)) cartServer.carts.set(key!, [])
      return cartServer.handle(method, url.pathname, key, body)
    }
    if (url.pathname === '/api/checkout-options') return json(checkoutOptions)
    if (url.pathname === '/api/promos') {
      return json(adminServer.promos.state.slides.filter((s) => s.imageUrl))
    }
    if (url.pathname === '/api/theme') return json(theme.current)
    if (url.pathname === '/api/categories') return json(CATEGORIES)
    if (url.pathname === '/api/collections') return json([])
    if (url.pathname === '/api/products') {
      const category = url.searchParams.get('category')
      const items = PRODUCTS.filter((p) => !category || p.categorySlug === category)
      return json({ items, total: items.length, page: 1, pageSize: 48 })
    }
    if (url.pathname === '/api/products/cam-titular') return json(TITULAR_DETAIL)
    if (url.pathname === '/api/products/bolso') return json(BOLSO_DETAIL)
    return json({ status: 404 }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  const api = {
    fetchMock,
    carts: cartServer.carts,
    auth: authServer,
    orders: orderServer,
    admin: adminServer,
    platform: platformServer,
    theme,
    checkoutOptions,
  }
  return api
}

// What GET /api/theme answers, trimmed to the variables the tests look at (the Api's ThemeTests cover the full set).
export const REGATE_THEME: Theme = {
  mode: 'Dark',
  storeName: 'Regate',
  footerLegalName: 'Regate Indumentaria',
  cssVariables: { '--color-bg': '#161826', '--color-accent': '#9184d9' },
  logo: {
    url: '/media/brand/regate-logo.png',
    width: '44px',
    height: '44px',
    margin: '-4px -6px',
    filter: null,
    blendMode: null,
  },
  wordmark: 'REGATE',
  monogram: 'RG',
  faviconUrl: null,
  socialLinks: [
    { label: '@regate.indumentaria', url: 'https://www.instagram.com/regate.indumentaria/' },
  ],
  phone: null,
  storeKind: 'Standard',
}

export const INDIANS_THEME: Theme = {
  mode: 'Light',
  storeName: 'Indians',
  footerLegalName: 'Indians Indumentaria',
  cssVariables: { '--color-bg': '#f6f7fa', '--color-accent': '#2a73b8' },
  logo: {
    url: '/media/brand/indians-logo.png',
    width: '116px',
    height: '29px',
    margin: '0',
    filter: null,
    blendMode: null,
  },
  wordmark: null,
  monogram: 'IN',
  faviconUrl: '/media/brand/indians-favicon.png',
  socialLinks: [{ label: '@indians', url: 'https://www.instagram.com/' }],
  phone: null,
  storeKind: 'Standard',
}

import { vi } from 'vitest'

import type { Cart, CartItem } from '../api/cart'
import type { Category, ProductDetail, ProductSummary } from '../api/catalog'
import type { Order } from '../api/orders'

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
        const product = PRODUCTS.find((p) => p.slug === body.productSlug)!
        const size = String(body.size)
        const stock = STOCK[`${product.slug}/${size}`] ?? 99
        const existing = items.find((i) => i.productSlug === product.slug && i.size === size)
        const quantity = (existing?.quantity ?? 0) + 1
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
            quantity: 1,
            lineTotal: product.price,
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
      user: { id: user.id, email, name: user.name, roles: ['Customer'] },
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
function createOrderServer(cartServer: ReturnType<typeof createCartServer>) {
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
        const discount = transfer ? subtotal * 0.1 : 0
        const number = `RG-${20001 + orders.size}`
        const order = {
          number,
          status: 'pending' as const,
          paymentMethod: transfer ? ('transfer' as const) : ('mercadopago' as const),
          delivery: body.delivery as 'home' | 'pickup',
          email: String(body.email),
          customerName: String(body.name),
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
          shippingCost: 0,
          discount,
          total: subtotal - discount,
          createdAt: '2026-11-02T15:00:00Z',
          expiresAt: transfer ? '2026-11-04T15:00:00Z' : '2026-11-02T15:30:00Z',
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

export type FakeApi = ReturnType<typeof stubApi>

// Stubs `fetch` with a tiny in-memory version of the Api (catalog, cart, auth, account). Returns
// the mock, so tests can inspect requested URLs, plus the fake servers' state.
export function stubApi() {
  const cartServer = createCartServer()
  const authServer = createAuthServer(cartServer)
  const orderServer = createOrderServer(cartServer)
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    if (url.pathname.startsWith('/api/auth/')) {
      return authServer.handle(method, url.pathname, body, headers.get('X-Cart-Token'))
    }

    // Like the Api: a bearer token that doesn't validate is a 401 on every endpoint.
    const email = authServer.emailFor(headers.get('Authorization'))
    if (email === 'invalid') return json({ status: 401 }, 401)
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
    if (url.pathname === '/api/categories') return json(CATEGORIES)
    if (url.pathname === '/api/collections') return json([])
    if (url.pathname === '/api/products') {
      const category = url.searchParams.get('category')
      const items = PRODUCTS.filter((p) => !category || p.categorySlug === category)
      return json({ items, total: items.length, page: 1, pageSize: 48 })
    }
    if (url.pathname === '/api/products/cam-titular') return json(TITULAR_DETAIL)
    return json({ status: 404 }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, carts: cartServer.carts, auth: authServer, orders: orderServer }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { proxyToApi } from '../../worker/proxy'

// The Pages function that carries a store's /api and /media calls to the Api, as that store's host.
describe('the Worker proxy to the Api', () => {
  const env = { API_ORIGIN: 'https://api.example.up.railway.app', PROXY_SECRET: 'shared-secret' }
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    return { url, init, headers: new Headers(init.headers) }
  }

  it("sends the call to the Api's own address, keeping path and query", async () => {
    await proxyToApi(new Request('https://regate.tienda.example/api/products?q=remera&page=2'), env)

    expect(sent().url.href).toBe('https://api.example.up.railway.app/api/products?q=remera&page=2')
  })

  it("states the store's host, the shopper's address and the scheme, signed with the secret", async () => {
    await proxyToApi(
      new Request('https://regate.tienda.example/api/cart', {
        headers: { 'CF-Connecting-IP': '203.0.113.9' },
      }),
      env,
    )

    const { headers } = sent()
    expect(headers.get('X-Forwarded-Host')).toBe('regate.tienda.example')
    expect(headers.get('X-Forwarded-Proto')).toBe('https')
    expect(headers.get('X-Forwarded-For')).toBe('203.0.113.9')
    expect(headers.get('X-Proxy-Secret')).toBe('shared-secret')
  })

  it('replaces anything the browser sent under those names, never passes it on', async () => {
    await proxyToApi(
      new Request('https://regate.tienda.example/api/cart', {
        headers: {
          'X-Forwarded-Host': 'indians.tienda.example',
          'X-Forwarded-For': '6.6.6.6',
          'X-Proxy-Secret': 'guess',
          Forwarded: 'for=6.6.6.6',
        },
      }),
      env,
    )

    const { headers } = sent()
    expect(headers.get('X-Forwarded-Host')).toBe('regate.tienda.example')
    expect(headers.get('X-Forwarded-For')).toBeNull()
    expect(headers.get('X-Proxy-Secret')).toBe('shared-secret')
    expect(headers.get('Forwarded')).toBeNull()
  })

  it('keeps the cookie, the bearer token and custom headers the Api needs', async () => {
    await proxyToApi(
      new Request('https://regate.tienda.example/api/orders', {
        headers: {
          Cookie: 'tz_refresh=abc',
          Authorization: 'Bearer token',
          'X-Cart-Token': 'cart',
          'Idempotency-Key': 'key-12345',
        },
      }),
      env,
    )

    const { headers } = sent()
    expect(headers.get('Cookie')).toBe('tz_refresh=abc')
    expect(headers.get('Authorization')).toBe('Bearer token')
    expect(headers.get('X-Cart-Token')).toBe('cart')
    expect(headers.get('Idempotency-Key')).toBe('key-12345')
  })

  it('passes a body on POST, none on GET, and does not follow redirects', async () => {
    await proxyToApi(
      new Request('https://regate.tienda.example/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productSlug: 'remera', size: 'M', quantity: 1 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
    )
    const post = sent()
    expect(post.init.method).toBe('POST')
    expect(post.init.body).not.toBeNull()
    expect(post.init.redirect).toBe('manual')

    fetchMock.mockClear()
    await proxyToApi(new Request('https://regate.tienda.example/api/cart'), env)
    expect(sent().init.body).toBeNull()
  })

  it("returns the Api's answer as it is, status included", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"title":"Tienda no encontrada."}', { status: 404 }),
    )

    const response = await proxyToApi(new Request('https://nadie.example/api/categories'), env)

    expect(response.status).toBe(404)
    expect(await response.text()).toContain('Tienda no encontrada')
  })

  it('sends no secret header when none is configured', async () => {
    await proxyToApi(new Request('https://regate.tienda.example/api/cart'), {
      API_ORIGIN: env.API_ORIGIN,
    })

    expect(sent().headers.get('X-Proxy-Secret')).toBeNull()
  })

  it('fails loudly, not silently, when the Api address is not configured', async () => {
    const response = await proxyToApi(new Request('https://regate.tienda.example/api/cart'), {})

    expect(response.status).toBe(500)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

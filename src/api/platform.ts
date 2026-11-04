// Client for the platform admin endpoints of TiendaZero-Api (src/TiendaZero.Api/Tenancy and Auth/PlatformAuth).
// Platform admins belong to no store: they sign in on the platform host at /api/platform/auth (a separate
// surface from a store's /api/auth), and the refresh token is an httpOnly cookie scoped to that path.
import type { Session } from './auth'
import { request } from './http'

export interface PlatformTenant {
  id: string
  slug: string
  name: string
  status: 'Active' | 'Suspended'
  orderNumberPrefix: string
  primaryDomain: string | null
}

export function platformLogin(body: { email: string; password: string }): Promise<Session> {
  return request('POST', '/api/platform/auth/login', { body })
}

export function platformRefresh(): Promise<Session> {
  return request('POST', '/api/platform/auth/refresh')
}

export function platformLogout(): Promise<void> {
  return request('POST', '/api/platform/auth/logout')
}

export function getPlatformTenants(): Promise<PlatformTenant[]> {
  return request('GET', '/api/platform/tenants')
}

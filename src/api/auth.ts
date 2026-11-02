// Client for the TiendaZero-Api auth and account endpoints (src/TiendaZero.Api/Auth and /Account).
// The refresh token never reaches JavaScript: it's an httpOnly cookie the browser sends to /api/auth.
import type { ProductSummary } from './catalog'
import { request } from './http'

export interface User {
  id: string
  email: string
  name: string
  roles: string[]
}

export interface Session {
  accessToken: string
  expiresAt: string
  user: User
}

// Sign-in and registration move the guest cart named by this token into the account.
const cartHeader = (cartToken: string | null): Record<string, string> =>
  cartToken ? { 'X-Cart-Token': cartToken } : {}

export function register(
  body: { email: string; password: string; name: string },
  cartToken: string | null,
): Promise<Session> {
  return request('POST', '/api/auth/register', { body, headers: cartHeader(cartToken) })
}

export function login(
  body: { email: string; password: string },
  cartToken: string | null,
): Promise<Session> {
  return request('POST', '/api/auth/login', { body, headers: cartHeader(cartToken) })
}

export function refresh(): Promise<Session> {
  return request('POST', '/api/auth/refresh')
}

export function logout(): Promise<void> {
  return request('POST', '/api/auth/logout')
}

export function forgotPassword(email: string): Promise<void> {
  return request('POST', '/api/auth/forgot-password', { body: { email } })
}

export function resetPassword(body: {
  email: string
  token: string
  newPassword: string
}): Promise<void> {
  return request('POST', '/api/auth/reset-password', { body })
}

export function updateProfile(name: string): Promise<User> {
  return request('PATCH', '/api/account', { body: { name } })
}

export function getFavorites(): Promise<ProductSummary[]> {
  return request('GET', '/api/account/favorites')
}

export function addFavorite(slug: string): Promise<void> {
  return request('PUT', `/api/account/favorites/${encodeURIComponent(slug)}`)
}

export function removeFavorite(slug: string): Promise<void> {
  return request('DELETE', `/api/account/favorites/${encodeURIComponent(slug)}`)
}

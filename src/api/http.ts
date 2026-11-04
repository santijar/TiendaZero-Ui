// RFC 7807 problem details, as returned by the Api for 4xx responses.
export interface Problem {
  title?: string
  detail?: string
  errors?: Record<string, string[]>
  [extension: string]: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null

  constructor(method: string, path: string, status: number, problem: Problem | null) {
    super(`${method} ${path} failed with ${status}`)
    this.status = status
    this.problem = problem
  }

  // The first validation message for a form field, if the Api sent one.
  fieldError(field: string): string | undefined {
    return this.problem?.errors?.[field]?.[0]
  }
}

export interface RequestOptions {
  body?: unknown
  // Sent as multipart/form-data instead of JSON (file uploads).
  form?: FormData
  headers?: Record<string, string>
  signal?: AbortSignal
}

// Set by the auth store: how to get the current access token, and how to renew it when the Api
// answers 401 (the access token is short-lived; the refresh cookie renews it).
interface AuthHooks {
  accessToken(): string | null
  refresh(): Promise<boolean>
}

let auth: AuthHooks | null = null

export function configureAuth(hooks: AuthHooks | null) {
  auth = hooks
}

// On the platform host only: the store a platform admin is previewing. The Api answers the public catalog as
// that store when this header names it (see PreviewTenantMiddleware). Never sent to the platform's own endpoints.
const PREVIEW_HEADER = 'X-Preview-Tenant'
let previewTenant: (() => string | null) | null = null

export function configurePreview(slug: (() => string | null) | null) {
  previewTenant = slug
}

async function send(method: string, path: string, options: RequestOptions): Promise<Response> {
  const { body, form, headers, signal } = options
  const token = auth?.accessToken()
  const preview = path.startsWith('/api/platform/') ? null : previewTenant?.()
  return fetch(path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined || form ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(preview ? { [PREVIEW_HEADER]: preview } : {}),
      ...headers,
    },
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    signal,
  })
}

export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let response = await send(method, path, options)
  // The auth endpoints report their own 401s (wrong password, expired session); everything else
  // gets one transparent retry after renewing the access token.
  if (
    response.status === 401 &&
    auth &&
    !path.startsWith('/api/auth/') &&
    !path.startsWith('/api/platform/auth/') &&
    (await auth.refresh())
  ) {
    response = await send(method, path, options)
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as Problem | null
    throw new ApiError(method, path, response.status, problem)
  }
  if (response.status === 204 || response.status === 202) return undefined as T
  return (await response.json()) as T
}

export function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>('GET', path, { signal })
}

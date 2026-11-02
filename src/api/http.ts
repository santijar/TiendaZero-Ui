// RFC 7807 problem details, as returned by the Api for 4xx responses.
export interface Problem {
  title?: string
  detail?: string
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
}

export interface RequestOptions {
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

export async function request<T>(
  method: string,
  path: string,
  { body, headers, signal }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as Problem | null
    throw new ApiError(method, path, response.status, problem)
  }
  return (await response.json()) as T
}

export function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>('GET', path, { signal })
}

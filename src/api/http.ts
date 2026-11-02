export class ApiError extends Error {
  readonly status: number

  constructor(status: number, path: string) {
    super(`GET ${path} failed with ${status}`)
    this.status = status
  }
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new ApiError(response.status, path)
  return (await response.json()) as T
}

import { useAuth } from './auth'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuth.getState().token

  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  })

  if (res.status === 401) {
    const ok = await useAuth.getState().refresh()
    if (ok) return apiFetch(path, init)   // retry once
    useAuth.getState().logout()
    throw new ApiError(401, 'Session expired')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (body as any).error ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

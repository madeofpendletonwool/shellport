import { create } from 'zustand'

export interface User {
  id:        number
  username:  string
  role:      string
  email?:    string
  avatarUrl: string
}

interface AuthState {
  token:          string | null
  user:           User | null
  ready:          boolean
  login:          (username: string, password: string) => Promise<void>
  loginWithToken: (accessToken: string) => void
  logout:         () => Promise<void>
  refresh:        () => Promise<boolean>
  init:           () => Promise<void>
}

let _refreshTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRefresh(expiresIn: number, refreshFn: () => Promise<boolean>) {
  if (_refreshTimer) clearTimeout(_refreshTimer)
  const delay = Math.max((expiresIn - 60) * 1000, 5000)
  _refreshTimer = setTimeout(refreshFn, delay)
}

function userFromJwt(token: string): User {
  const b64     = token.split('.')[1]
  const payload = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')))
  return {
    id:        payload.id,
    username:  payload.username,
    role:      payload.role,
    email:     payload.email,
    avatarUrl: payload.avatarUrl ?? '',
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  token:  null,
  user:   null,
  ready:  false,

  init: async () => {
    const ok = await get().refresh()
    if (!ok) set({ ready: true })
  },

  loginWithToken: (accessToken: string) => {
    const user = userFromJwt(accessToken)
    set({ token: accessToken, user, ready: true })
    const b64       = accessToken.split('.')[1]
    const { exp, iat } = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')))
    scheduleRefresh(exp - iat, get().refresh)
  },

  login: async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ username, password }),
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as any).error ?? 'Login failed')
    }
    const { accessToken, expiresIn } = await res.json()
    set({ token: accessToken, user: userFromJwt(accessToken), ready: true })
    scheduleRefresh(expiresIn, get().refresh)
  },

  logout: async () => {
    if (_refreshTimer) clearTimeout(_refreshTimer)
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    set({ token: null, user: null })
  },

  refresh: async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      if (!res.ok) { set({ token: null, user: null, ready: true }); return false }
      const { accessToken, expiresIn } = await res.json()
      set({ token: accessToken, user: userFromJwt(accessToken), ready: true })
      scheduleRefresh(expiresIn, get().refresh)
      return true
    } catch {
      set({ token: null, user: null, ready: true })
      return false
    }
  },
}))

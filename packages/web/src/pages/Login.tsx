import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

interface OidcProvider { id: string; name: string }

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [providers, setProviders] = useState<OidcProvider[]>([])
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    fetch('/api/auth/oidc/providers')
      .then(r => r.ok ? r.json() : [])
      .then(setProviders)
      .catch(() => {})

    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) setError(`SSO error: ${err}`)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/terminals')
    } catch (err: any) {
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">

        {/* Login logo — drop logo-login.svg into packages/web/public/ */}
        <div className="flex items-center justify-center mb-10">
          {!logoError ? (
            <img
              src="/logo-login.png"
              alt="Shellport"
              className="w-80 h-auto max-h-28 object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="text-2xl font-bold text-white tracking-tight lowercase select-none">
              shellport
            </span>
          )}
        </div>

        <div className="bg-surface2 border border-border rounded-card p-6 space-y-4 shadow-float">

          {/* OIDC providers */}
          {providers.length > 0 && (
            <>
              <div className="space-y-2">
                {providers.map(p => (
                  <a
                    key={p.id}
                    href={`/api/auth/oidc/${p.id}/initiate`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium
                               text-white/90 bg-surface3 border border-border hover:border-accent/40
                               hover:bg-hover rounded-panel transition-all duration-180"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-muted" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                    Continue with {p.name}
                  </a>
                ))}
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-surface2 text-muted">or sign in with password</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-widest">Sign in</p>

            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Username</label>
              <input
                className="w-full bg-surface3 border border-border rounded-panel px-3 py-2.5 text-sm text-white
                           placeholder-muted/50 transition-all duration-180 focus-glow"
                placeholder="admin"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Password</label>
              <input
                type="password"
                className="w-full bg-surface3 border border-border rounded-panel px-3 py-2.5 text-sm text-white
                           placeholder-muted/50 transition-all duration-180 focus-glow"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-danger text-xs bg-danger/10 border border-danger/25 rounded-panel px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-surface font-semibold
                         rounded-panel py-2.5 text-sm transition-all duration-180 flex items-center justify-center gap-2
                         shadow-glow-xs hover:shadow-glow-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

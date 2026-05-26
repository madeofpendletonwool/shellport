import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cpu, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

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
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <Cpu size={28} className="text-accent" />
          <span className="text-2xl font-bold text-white tracking-tight">Shellport</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface2 border border-border rounded-xl p-6 space-y-4 shadow-2xl"
        >
          <h1 className="text-sm font-medium text-muted uppercase tracking-wider mb-2">Sign in</h1>

          <div className="space-y-1">
            <label className="text-xs text-muted">Username</label>
            <input
              className="w-full bg-surface3 border border-border rounded-lg px-3 py-2.5 text-sm text-white
                         placeholder-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="admin"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted">Password</label>
            <input
              type="password"
              className="w-full bg-surface3 border border-border rounded-lg px-3 py-2.5 text-sm text-white
                         placeholder-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-medium
                       rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

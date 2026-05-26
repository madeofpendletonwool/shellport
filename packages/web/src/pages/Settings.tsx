import { useState, useEffect, useCallback } from 'react'
import { Settings as SettingsIcon, Plus, Trash2, Eye, EyeOff, Copy, Check, Loader2, Pencil, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'

interface ApiKey { id: number; label: string; prefix: string; createdAt: number; lastUsedAt?: number }

interface OidcProvider {
  id:          string
  name:        string
  issuer:      string
  clientId:    string
  scopes:      string
  defaultRole: string
  enabled:     number
  createdAt:   number
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
      className="p-1 text-muted hover:text-white transition-colors"
    >
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  )
}

// ── OIDC Provider Modal ──────────────────────────────────────────────────────
interface OidcModalProps {
  provider?: OidcProvider
  onClose:   () => void
  onSaved:   () => void
}

function OidcProviderModal({ provider, onClose, onSaved }: OidcModalProps) {
  const [name,        setName]        = useState(provider?.name ?? '')
  const [issuer,      setIssuer]      = useState(provider?.issuer ?? '')
  const [clientId,    setClientId]    = useState(provider?.clientId ?? '')
  const [clientSecret,setClientSecret]= useState('')
  const [scopes,      setScopes]      = useState(provider?.scopes ?? 'openid email profile')
  const [defaultRole, setDefaultRole] = useState(provider?.defaultRole ?? 'user')
  const [enabled,     setEnabled]     = useState(provider ? provider.enabled === 1 : true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const callbackUrl = `${window.location.origin}/api/auth/oidc/callback`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body: Record<string, any> = { name, issuer, clientId, scopes, defaultRole, enabled }
      if (!provider || clientSecret) body.clientSecret = clientSecret

      if (provider) {
        await apiFetch(`/api/oidc-providers/${provider.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        if (!clientSecret) { setError('Client secret is required'); setSaving(false); return }
        await apiFetch('/api/oidc-providers', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
    } catch (err: any) {
      setError(err.message ?? 'Failed to save provider')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-[4px] flex items-center justify-center z-50 p-4">
      <div className="bg-surface2 border border-border rounded-card w-full max-w-md shadow-float">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-white">
            {provider ? 'Edit OIDC Provider' : 'Add OIDC Provider'}
          </h3>
          <button onClick={onClose} className="p-1 text-muted hover:text-white"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Callback URL for IdP config */}
          <div className="bg-surface3 border border-border rounded-panel p-3 space-y-1">
            <p className="text-xs text-muted">Redirect URI (paste into your IdP app config)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-accent font-mono break-all">{callbackUrl}</code>
              <CopyButton text={callbackUrl} />
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-muted">Display name</span>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Google SSO"
              className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted transition-all duration-180 focus-glow" />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">Issuer URL</span>
            <input value={issuer} onChange={e => setIssuer(e.target.value)} required placeholder="https://accounts.google.com"
              className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted transition-all duration-180 focus-glow font-mono" />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">Client ID</span>
            <input value={clientId} onChange={e => setClientId(e.target.value)} required
              className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted transition-all duration-180 focus-glow font-mono" />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">
              Client secret {provider ? '(leave blank to keep current)' : ''}
            </span>
            <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
              required={!provider}
              className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted transition-all duration-180 focus-glow font-mono" />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">Scopes</span>
            <input value={scopes} onChange={e => setScopes(e.target.value)} required
              className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted transition-all duration-180 focus-glow font-mono" />
          </label>

          <div className="flex gap-3">
            <label className="flex-1 block space-y-1">
              <span className="text-xs text-muted">Default role for new users</span>
              <select value={defaultRole} onChange={e => setDefaultRole(e.target.value)}
                className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white transition-all duration-180 focus-glow">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-5 cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
                className="w-4 h-4 accent-accent" />
              <span className="text-xs text-muted">Enabled</span>
            </label>
          </div>

          {error && (
            <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-muted hover:text-white border border-border rounded-panel transition-all duration-180 hover:bg-hover">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50
                         text-surface rounded-panel text-sm font-semibold transition-all duration-180">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Saving…' : (provider ? 'Save changes' : 'Add provider')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Settings page ───────────────────────────────────────────────────────
export default function Settings() {
  const { user }  = useAuth()
  const isAdmin   = user?.role === 'admin'

  const [keys,       setKeys]       = useState<ApiKey[]>([])
  const [newLabel,   setNewLabel]   = useState('')
  const [creating,   setCreating]   = useState(false)
  const [newKey,     setNewKey]     = useState('')
  const [showKey,    setShowKey]    = useState(false)

  const [curPw,      setCurPw]      = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [savingPw,   setSavingPw]   = useState(false)
  const [pwMsg,      setPwMsg]      = useState<{ok:boolean;text:string}|null>(null)

  const [email,      setEmail]      = useState(user?.email ?? '')
  const [savingEmail,setSavingEmail]= useState(false)
  const [emailMsg,   setEmailMsg]   = useState<{ok:boolean;text:string}|null>(null)

  const [shell,      setShell]      = useState('')
  const [shellInput, setShellInput] = useState('')
  const [savingShell,setSavingShell]= useState(false)
  const [shellMsg,   setShellMsg]   = useState<{ok:boolean;text:string}|null>(null)

  const [providers,  setProviders]  = useState<OidcProvider[]>([])
  const [oidcModal,  setOidcModal]  = useState<{ provider?: OidcProvider } | null>(null)

  const loadKeys = useCallback(async () => {
    const data = await apiFetch<ApiKey[]>('/api/auth/api-keys').catch(() => [])
    setKeys(data)
  }, [])

  const loadProviders = useCallback(async () => {
    if (!isAdmin) return
    const data = await apiFetch<OidcProvider[]>('/api/oidc-providers').catch(() => [])
    setProviders(data)
  }, [isAdmin])

  useEffect(() => { loadKeys() }, [loadKeys])
  useEffect(() => { loadProviders() }, [loadProviders])

  useEffect(() => {
    apiFetch<{ defaultShell: string }>('/api/server-config').then(d => {
      setShell(d.defaultShell)
      setShellInput(d.defaultShell)
    }).catch(() => {})
  }, [])

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEmail(true)
    setEmailMsg(null)
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body:   JSON.stringify({ email: email || null }),
      })
      setEmailMsg({ ok: true, text: 'Email updated. Gravatar will appear on next login.' })
    } catch {
      setEmailMsg({ ok: false, text: 'Failed to update email.' })
    } finally {
      setSavingEmail(false)
    }
  }

  const saveShell = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingShell(true)
    setShellMsg(null)
    try {
      const res = await apiFetch<{ defaultShell: string }>('/api/server-config', {
        method: 'PATCH',
        body:   JSON.stringify({ defaultShell: shellInput }),
      })
      setShell(res.defaultShell)
      setShellMsg({ ok: true, text: 'Shell updated for new sessions.' })
    } catch {
      setShellMsg({ ok: false, text: 'Failed to update shell.' })
    } finally {
      setSavingShell(false)
    }
  }

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await apiFetch<{ key: string } & ApiKey>('/api/auth/api-keys', {
        method: 'POST',
        body:   JSON.stringify({ label: newLabel }),
      })
      setNewKey(res.key)
      setShowKey(true)
      setNewLabel('')
      await loadKeys()
    } finally {
      setCreating(false)
    }
  }

  const revokeKey = async (id: number) => {
    await apiFetch(`/api/auth/api-keys/${id}`, { method: 'DELETE' })
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPw(true)
    setPwMsg(null)
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body:   JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      })
      setPwMsg({ ok: true, text: 'Password updated.' })
      setCurPw(''); setNewPw('')
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.message })
    } finally {
      setSavingPw(false)
    }
  }

  const deleteProvider = async (id: string) => {
    if (!confirm('Delete this OIDC provider? Users who only have this SSO login will lose access.')) return
    await apiFetch(`/api/oidc-providers/${id}`, { method: 'DELETE' }).catch(() => {})
    await loadProviders()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-8">
      <div className="flex items-center gap-3">
        <SettingsIcon size={20} className="text-accent" />
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </div>

      {/* Profile / Email */}
      <section className="bg-surface2 border border-border rounded-card p-5 space-y-4 shadow-float">
        <h2 className="text-sm font-semibold text-white">Profile</h2>
        <p className="text-xs text-muted">Set your email address to show a Gravatar avatar.</p>
        <form onSubmit={saveEmail} className="flex gap-2">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white
                       placeholder-muted transition-all duration-180 focus-glow transition-colors"
          />
          <button type="submit" disabled={savingEmail}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50
                       text-surface rounded-panel text-sm font-semibold transition-all duration-180">
            {savingEmail ? <Loader2 size={14} className="animate-spin" /> : null}
            Save
          </button>
        </form>
        {emailMsg && <p className={`text-xs ${emailMsg.ok ? 'text-success' : 'text-danger'}`}>{emailMsg.text}</p>}
      </section>

      {/* API Keys */}
      <section className="bg-surface2 border border-border rounded-card p-5 space-y-4 shadow-float">
        <h2 className="text-sm font-semibold text-white">API Keys</h2>
        <p className="text-xs text-muted">Keys allow programmatic access (mobile apps, scripts). Use <code className="text-accent">Authorization: ApiKey &lt;key&gt;</code> header.</p>

        <form onSubmit={createKey} className="flex gap-2">
          <input
            placeholder="Key label (e.g. iPhone)"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            required
            className="flex-1 bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white
                       placeholder-muted transition-all duration-180 focus-glow transition-colors"
          />
          <button type="submit" disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50
                       text-surface rounded-panel text-sm font-semibold transition-all duration-180">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </form>

        {newKey && (
          <div className="bg-success/10 border border-success/25 rounded-lg p-3 space-y-2">
            <p className="text-success text-xs font-medium">Copy this key now — it won't be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs text-green-300 break-all bg-surface3 px-2 py-1 rounded">
                {showKey ? newKey : '•'.repeat(40)}
              </code>
              <button onClick={() => setShowKey(v => !v)} className="p-1 text-muted hover:text-white">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <CopyButton text={newKey} />
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <p className="text-muted text-xs">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex items-center justify-between bg-surface3 border border-border/50 rounded-panel px-3 py-2.5">
                <div>
                  <p className="text-sm text-white">{k.label}</p>
                  <p className="text-xs text-muted font-mono">{k.prefix}••••••••</p>
                </div>
                <button onClick={() => revokeKey(k.id)} className="p-1.5 text-muted hover:text-danger transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* OIDC Providers (admin only) */}
      {isAdmin && (
        <section className="bg-surface2 border border-border rounded-card p-5 space-y-4 shadow-float">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">SSO / OIDC Providers</h2>
              <p className="text-xs text-muted mt-1">Configure OpenID Connect providers (Google, GitHub, Okta, etc.)</p>
            </div>
            <button
              onClick={() => setOidcModal({})}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-surface rounded-panel text-xs font-semibold transition-all duration-180"
            >
              <Plus size={13} /> Add provider
            </button>
          </div>

          {providers.length === 0 ? (
            <p className="text-muted text-xs">No SSO providers configured.</p>
          ) : (
            <div className="space-y-2">
              {providers.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-surface3 border border-border/50 rounded-panel px-3 py-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{p.name}</span>
                      {p.enabled === 0 && (
                        <span className="text-xs text-muted bg-surface2 px-1.5 py-0.5 rounded">disabled</span>
                      )}
                    </div>
                    <p className="text-xs text-muted font-mono">{p.issuer}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setOidcModal({ provider: p })}
                      className="p-1.5 text-muted hover:text-white transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteProvider(p.id)}
                      className="p-1.5 text-muted hover:text-danger transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Default shell */}
      <section className="bg-surface2 border border-border rounded-card p-5 space-y-4 shadow-float">
        <h2 className="text-sm font-semibold text-white">Default Shell</h2>
        <p className="text-xs text-muted">Shell used for new terminal sessions. Currently: <code className="text-accent">{shell || '…'}</code></p>
        <form onSubmit={saveShell} className="flex gap-2">
          <input
            placeholder="/bin/zsh"
            value={shellInput}
            onChange={e => setShellInput(e.target.value)}
            required
            className="flex-1 bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white font-mono
                       placeholder-muted transition-all duration-180 focus-glow transition-colors"
          />
          <button type="submit" disabled={savingShell}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50
                       text-surface rounded-panel text-sm font-semibold transition-all duration-180">
            {savingShell ? <Loader2 size={14} className="animate-spin" /> : null}
            Save
          </button>
        </form>
        {shellMsg && <p className={`text-xs ${shellMsg.ok ? 'text-success' : 'text-danger'}`}>{shellMsg.text}</p>}
        <p className="text-xs text-muted">Changes apply to new sessions immediately but reset on server restart. Set <code className="text-accent">DEFAULT_SHELL</code> in <code className="text-accent">.env</code> to persist.</p>
      </section>

      {/* Change password */}
      <section className="bg-surface2 border border-border rounded-card p-5 space-y-4 shadow-float">
        <h2 className="text-sm font-semibold text-white">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <input
            type="password" placeholder="Current password" value={curPw}
            onChange={e => setCurPw(e.target.value)} required autoComplete="current-password"
            className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white
                       placeholder-muted transition-all duration-180 focus-glow transition-colors"
          />
          <input
            type="password" placeholder="New password (min 8 chars)" value={newPw}
            onChange={e => setNewPw(e.target.value)} required minLength={8} autoComplete="new-password"
            className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white
                       placeholder-muted transition-all duration-180 focus-glow transition-colors"
          />
          {pwMsg && <p className={`text-xs ${pwMsg.ok ? 'text-success' : 'text-danger'}`}>{pwMsg.text}</p>}
          <button type="submit" disabled={savingPw}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50
                       text-surface rounded-panel text-sm font-semibold transition-all duration-180">
            {savingPw ? <Loader2 size={14} className="animate-spin" /> : null}
            Update Password
          </button>
        </form>
      </section>

      {/* OIDC modal */}
      {oidcModal !== null && (
        <OidcProviderModal
          provider={oidcModal.provider}
          onClose={() => setOidcModal(null)}
          onSaved={() => { setOidcModal(null); loadProviders() }}
        />
      )}
    </div>
  )
}

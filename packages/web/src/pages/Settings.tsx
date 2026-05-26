import { useState, useEffect, useCallback } from 'react'
import { Settings as SettingsIcon, Plus, Trash2, Eye, EyeOff, Copy, Check, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface ApiKey { id: number; label: string; prefix: string; createdAt: number; lastUsedAt?: number }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
      className="p-1 text-muted hover:text-white transition-colors"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  )
}

export default function Settings() {
  const [keys,       setKeys]       = useState<ApiKey[]>([])
  const [newLabel,   setNewLabel]   = useState('')
  const [creating,   setCreating]   = useState(false)
  const [newKey,     setNewKey]     = useState('')
  const [showKey,    setShowKey]    = useState(false)

  const [curPw,      setCurPw]      = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [savingPw,   setSavingPw]   = useState(false)
  const [pwMsg,      setPwMsg]      = useState<{ok:boolean;text:string}|null>(null)

  const [shell,      setShell]      = useState('')
  const [shellInput, setShellInput] = useState('')
  const [savingShell,setSavingShell]= useState(false)
  const [shellMsg,   setShellMsg]   = useState<{ok:boolean;text:string}|null>(null)

  const loadKeys = useCallback(async () => {
    const data = await apiFetch<ApiKey[]>('/api/auth/api-keys').catch(() => [])
    setKeys(data)
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  useEffect(() => {
    apiFetch<{ defaultShell: string }>('/api/server-config').then(d => {
      setShell(d.defaultShell)
      setShellInput(d.defaultShell)
    }).catch(() => {})
  }, [])

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

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-8">
      <div className="flex items-center gap-3">
        <SettingsIcon size={20} className="text-accent" />
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </div>

      {/* API Keys */}
      <section className="bg-surface2 border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">API Keys</h2>
        <p className="text-xs text-muted">Keys allow programmatic access (mobile apps, scripts). Use <code className="text-accent">Authorization: ApiKey &lt;key&gt;</code> header.</p>

        {/* Create new key */}
        <form onSubmit={createKey} className="flex gap-2">
          <input
            placeholder="Key label (e.g. iPhone)"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            required
            className="flex-1 bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white
                       placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit" disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50
                       text-white rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </form>

        {/* New key reveal */}
        {newKey && (
          <div className="bg-green-400/10 border border-green-400/30 rounded-lg p-3 space-y-2">
            <p className="text-green-400 text-xs font-medium">Copy this key now — it won't be shown again.</p>
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

        {/* Key list */}
        {keys.length === 0 ? (
          <p className="text-muted text-xs">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex items-center justify-between bg-surface3 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm text-white">{k.label}</p>
                  <p className="text-xs text-muted font-mono">{k.prefix}••••••••</p>
                </div>
                <button onClick={() => revokeKey(k.id)} className="p-1.5 text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Default shell */}
      <section className="bg-surface2 border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Default Shell</h2>
        <p className="text-xs text-muted">Shell used for new terminal sessions. Currently: <code className="text-accent">{shell || '…'}</code></p>
        <form onSubmit={saveShell} className="flex gap-2">
          <input
            placeholder="/bin/zsh"
            value={shellInput}
            onChange={e => setShellInput(e.target.value)}
            required
            className="flex-1 bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white font-mono
                       placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit" disabled={savingShell}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50
                       text-white rounded-lg text-sm font-medium transition-colors"
          >
            {savingShell ? <Loader2 size={14} className="animate-spin" /> : null}
            Save
          </button>
        </form>
        {shellMsg && (
          <p className={`text-xs ${shellMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{shellMsg.text}</p>
        )}
        <p className="text-xs text-muted">Changes apply to new sessions immediately but reset on server restart. Set <code className="text-accent">DEFAULT_SHELL</code> in <code className="text-accent">.env</code> to persist.</p>
      </section>

      {/* Change password */}
      <section className="bg-surface2 border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <input
            type="password" placeholder="Current password" value={curPw}
            onChange={e => setCurPw(e.target.value)} required autoComplete="current-password"
            className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white
                       placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />
          <input
            type="password" placeholder="New password (min 8 chars)" value={newPw}
            onChange={e => setNewPw(e.target.value)} required minLength={8} autoComplete="new-password"
            className="w-full bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white
                       placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />
          {pwMsg && (
            <p className={`text-xs ${pwMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{pwMsg.text}</p>
          )}
          <button
            type="submit" disabled={savingPw}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50
                       text-white rounded-lg text-sm font-medium transition-colors"
          >
            {savingPw ? <Loader2 size={14} className="animate-spin" /> : null}
            Update Password
          </button>
        </form>
      </section>
    </div>
  )
}

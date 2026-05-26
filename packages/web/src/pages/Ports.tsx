import { useState, useEffect, useCallback } from 'react'
import { Globe, Plus, Trash2, ExternalLink, Copy, Check, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Port { port: number; label: string; registeredAt: number }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 text-muted hover:text-accent transition-colors duration-180 rounded-md hover:bg-accent/10"
      title="Copy URL"
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
    </button>
  )
}

function PortCard({ entry, onDelete }: { entry: Port; onDelete: (p: number) => void }) {
  const url = `${location.origin}/proxy/${entry.port}/`
  return (
    <div className="group bg-surface2 border border-border rounded-panel px-4 py-3.5
                    flex items-center gap-4 hover:border-accent/30 transition-all duration-180 shadow-float">
      {/* Live status dot */}
      <div className="flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.55)]" />
      </div>

      {/* Port info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white text-sm font-medium">{entry.label}</span>
          <span className="text-[11px] text-muted font-mono bg-surface3 border border-border
                           px-1.5 py-0.5 rounded-md">:{entry.port}</span>
        </div>
        <code className="text-xs text-muted font-mono truncate block">{url}</code>
      </div>

      {/* Actions — revealed on hover */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-180">
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          className="p-1.5 text-muted hover:text-accent transition-colors duration-180 rounded-md hover:bg-accent/10"
          title="Open"
        >
          <ExternalLink size={13} />
        </a>
        <CopyButton text={url} />
        <button
          onClick={() => onDelete(entry.port)}
          className="p-1.5 text-muted hover:text-danger transition-colors duration-180 rounded-md hover:bg-danger/10"
          title="Remove"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

export default function Ports() {
  const [ports,   setPorts]   = useState<Port[]>([])
  const [loading, setLoading] = useState(true)
  const [port,    setPort]    = useState('')
  const [label,   setLabel]   = useState('')
  const [adding,  setAdding]  = useState(false)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Port[]>('/api/ports')
      setPorts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setAdding(true)
    try {
      await apiFetch('/api/ports', {
        method: 'POST',
        body:   JSON.stringify({ port: Number(port), label }),
      })
      setPort(''); setLabel('')
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const remove = async (p: number) => {
    await apiFetch(`/api/ports/${p}`, { method: 'DELETE' }).catch(() => {})
    setPorts(prev => prev.filter(x => x.port !== p))
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe size={18} className="text-accent" />
        <h1 className="text-base font-semibold text-white">Port Exposure</h1>
      </div>

      {/* Register form */}
      <form onSubmit={add} className="bg-surface2 border border-border rounded-card p-5 space-y-4 shadow-float">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Expose a local port</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            type="number" placeholder="Port (e.g. 8000)" required min={1} max={65535}
            value={port} onChange={e => setPort(e.target.value)}
            className="bg-surface3 border border-border rounded-panel px-3 py-2 text-sm text-white
                       placeholder-muted/50 w-40 transition-all duration-180 focus-glow"
          />
          <input
            type="text" placeholder="Label (e.g. trunk)" required
            value={label} onChange={e => setLabel(e.target.value)}
            className="bg-surface3 border border-border rounded-panel px-3 py-2 text-sm text-white
                       placeholder-muted/50 flex-1 min-w-32 transition-all duration-180 focus-glow"
          />
          <button
            type="submit" disabled={adding}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50
                       text-surface rounded-panel text-sm font-semibold transition-all duration-180
                       shadow-glow-xs hover:shadow-glow-sm"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Expose
          </button>
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <p className="text-muted text-xs">
          Accessible at <code className="text-accent font-mono">/proxy/{'<port>'}/ </code>
          on this host. The local service must be running for requests to succeed.
        </p>
      </form>

      {/* Port list */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm">
          <Loader2 size={15} className="animate-spin" /> Loading…
        </div>
      ) : ports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted gap-3">
          <Globe size={36} strokeWidth={1} className="text-muted/40" />
          <p className="text-sm text-muted/70">No ports exposed yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ports.map(p => <PortCard key={p.port} entry={p} onDelete={remove} />)}
        </div>
      )}
    </div>
  )
}

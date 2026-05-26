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
    <button onClick={copy} className="p-1 text-muted hover:text-white transition-colors" title="Copy URL">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  )
}

function PortCard({ entry, onDelete }: { entry: Port; onDelete: (p: number) => void }) {
  const url = `${location.origin}/proxy/${entry.port}/`
  return (
    <div className="bg-surface2 border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white font-medium text-sm">{entry.label}</p>
          <p className="text-muted text-xs mt-0.5">:{entry.port}</p>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Registered" />
        </div>
      </div>

      <code className="text-xs text-muted bg-surface3 rounded px-2 py-1.5 break-all font-mono">
        {url}
      </code>

      <div className="flex items-center gap-1">
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent/20 hover:bg-accent/30
                     text-accent border border-accent/30 rounded-lg transition-colors"
        >
          <ExternalLink size={12} /> Open
        </a>
        <CopyButton text={url} />
        <button
          onClick={() => onDelete(entry.port)}
          className="ml-auto p-1.5 text-muted hover:text-red-400 transition-colors"
          title="Remove"
        >
          <Trash2 size={14} />
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
        <Globe size={20} className="text-accent" />
        <h1 className="text-lg font-semibold text-white">Port Exposure</h1>
      </div>

      {/* Register form */}
      <form onSubmit={add} className="bg-surface2 border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-medium text-muted uppercase tracking-wider">Expose a local port</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            type="number" placeholder="Port (e.g. 8000)" required min={1} max={65535}
            value={port} onChange={e => setPort(e.target.value)}
            className="bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white
                       placeholder-muted focus:outline-none focus:border-accent w-40 transition-colors"
          />
          <input
            type="text" placeholder="Label (e.g. trunk)" required
            value={label} onChange={e => setLabel(e.target.value)}
            className="bg-surface3 border border-border rounded-lg px-3 py-2 text-sm text-white
                       placeholder-muted focus:outline-none focus:border-accent flex-1 min-w-32 transition-colors"
          />
          <button
            type="submit" disabled={adding}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50
                       text-white rounded-lg text-sm font-medium transition-colors"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Expose
          </button>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <p className="text-muted text-xs">
          Once exposed, the port is accessible at <code className="text-accent">/proxy/{'<port>'}/ </code>
          on this platform. Note: the host service must be running for requests to succeed.
        </p>
      </form>

      {/* Port cards */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : ports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted gap-3">
          <Globe size={40} strokeWidth={1} />
          <p className="text-sm">No ports exposed yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ports.map(p => <PortCard key={p.port} entry={p} onDelete={remove} />)}
        </div>
      )}
    </div>
  )
}

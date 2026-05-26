import { useState, useCallback } from 'react'
import { Plus, X, Bot, TerminalIcon } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import TerminalPane from '@/components/TerminalPane'

interface Session { id: number; name: string; type: string }

export default function Terminals() {
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [activeId,  setActiveId]  = useState<number | null>(null)
  const [spawning,  setSpawning]  = useState(false)

  const spawn = useCallback(async (type: 'shell' | 'claude') => {
    setSpawning(true)
    try {
      const sess = await apiFetch<Session>('/api/terminals', {
        method: 'POST',
        body:   JSON.stringify({ type, cols: 220, rows: 50 }),
      })
      setSessions(prev => [...prev, sess])
      setActiveId(sess.id)
    } finally {
      setSpawning(false)
    }
  }, [])

  const close = useCallback(async (id: number) => {
    await apiFetch(`/api/terminals/${id}`, { method: 'DELETE' }).catch(() => {})
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (activeId === id) setActiveId(next.at(-1)?.id ?? null)
      return next
    })
  }, [activeId])

  const handleExit = useCallback((id: number) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (activeId === id) setActiveId(next.at(-1)?.id ?? null)
      return next
    })
  }, [activeId])

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center bg-surface2 border-b border-border flex-shrink-0 min-h-[40px] overflow-x-auto">
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`flex items-center gap-2 px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
              activeId === s.id
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {s.type === 'claude'
              ? <Bot size={12} className="text-purple-400" />
              : <TerminalIcon size={12} />
            }
            {s.name}
            <span
              onClick={e => { e.stopPropagation(); close(s.id) }}
              className="ml-1 opacity-30 hover:opacity-100 transition-opacity cursor-pointer rounded hover:bg-surface3 p-0.5"
            >
              <X size={10} />
            </span>
          </button>
        ))}

        {/* New terminal buttons */}
        <div className="ml-auto flex items-center gap-1 px-2 flex-shrink-0">
          <button
            onClick={() => spawn('shell')}
            disabled={spawning}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted hover:text-white
                       hover:bg-surface3 rounded transition-colors disabled:opacity-50"
            title="New shell"
          >
            <Plus size={13} /><TerminalIcon size={12} />
          </button>
          <button
            onClick={() => spawn('claude')}
            disabled={spawning}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted hover:text-purple-400
                       hover:bg-surface3 rounded transition-colors disabled:opacity-50"
            title="New Claude Code session"
          >
            <Plus size={13} /><Bot size={12} />
          </button>
        </div>
      </div>

      {/* Terminal area */}
      <div className="flex-1 relative bg-black min-h-0">
        {sessions.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted">
            <TerminalIcon size={40} strokeWidth={1} />
            <p className="text-sm">No terminals open</p>
            <div className="flex gap-2">
              <button
                onClick={() => spawn('shell')}
                className="flex items-center gap-2 px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent
                           border border-accent/30 rounded-lg text-sm transition-colors"
              >
                <Plus size={14} /> Shell
              </button>
              <button
                onClick={() => spawn('claude')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400
                           border border-purple-500/30 rounded-lg text-sm transition-colors"
              >
                <Plus size={14} /> Claude Code
              </button>
            </div>
          </div>
        ) : (
          sessions.map(s => (
            <TerminalPane
              key={s.id}
              sessionId={s.id}
              active={activeId === s.id}
              onExit={handleExit}
            />
          ))
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { FileText, RefreshCw, Trash2, Loader2 } from 'lucide-react'
import { apiFetch }  from '@/lib/api'
import { useAuth }   from '@/lib/auth'

interface LogFile { path: string; name: string; size: number }
interface LogLine  { line: string; ts: number; cls: string }

function classify(line: string): string {
  const l = line.toLowerCase()
  if (l.includes('error') || l.includes('err['))   return 'text-danger'
  if (l.includes('warn'))                           return 'text-warning'
  if (l.includes('finish') || l.includes('success') || l.includes('emit') || l.includes('compil'))
                                                    return 'text-success'
  return 'text-[#94A3B8]'
}

export default function Logs() {
  const token            = useAuth(s => s.token)
  const [files,  setFiles]  = useState<LogFile[]>([])
  const [active, setActive] = useState<string>('')
  const [lines,  setLines]  = useState<LogLine[]>([])
  const [live,   setLive]   = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef     = useRef<EventSource | null>(null)

  const loadFiles = useCallback(async () => {
    const data = await apiFetch<LogFile[]>('/api/logs/files').catch(() => [])
    setFiles(data)
  }, [])

  useEffect(() => { loadFiles() }, [loadFiles])

  useEffect(() => {
    if (!active || !token) return
    setLines([])
    setLive(false)
    esRef.current?.close()

    const url = `/api/logs/stream?file=${encodeURIComponent(active)}`
    const es  = new EventSource(url)
    esRef.current = es

    es.onopen  = () => setLive(true)
    es.onerror = () => setLive(false)
    es.onmessage = e => {
      const { line } = JSON.parse(e.data) as { line: string; ts: number }
      setLines(prev => [...prev.slice(-2000), { line, ts: Date.now(), cls: classify(line) }])
    }
    return () => { es.close(); setLive(false) }
  }, [active, token])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, autoScroll])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface2 border-b border-border flex-shrink-0 flex-wrap">
        <FileText size={15} className="text-accent flex-shrink-0" />
        <select
          value={active}
          onChange={e => setActive(e.target.value)}
          className="bg-surface3 border border-border rounded-panel px-2 py-1.5 text-sm text-white
                     transition-all duration-180 focus-glow flex-1 min-w-0 max-w-xs"
        >
          <option value="">— select log file —</option>
          {files.map(f => (
            <option key={f.path} value={f.path}>{f.name}</option>
          ))}
        </select>

        <button
          onClick={loadFiles}
          className="p-1.5 text-muted hover:text-white transition-colors duration-180 rounded-md hover:bg-hover"
          title="Refresh file list"
        >
          <RefreshCw size={13} />
        </button>

        {/* Live indicator */}
        <div className={`flex items-center gap-1.5 text-xs font-medium ${live ? 'text-success' : 'text-muted'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-success animate-pulse shadow-[0_0_4px_rgba(34,197,94,0.6)]' : 'bg-muted'}`} />
          {live ? 'live' : active ? 'connecting…' : 'idle'}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer ml-auto">
          <input
            type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}
            className="accent-[#22D3EE]"
          />
          Auto-scroll
        </label>

        <button
          onClick={() => setLines([])}
          className="p-1.5 text-muted hover:text-danger transition-colors duration-180 rounded-md hover:bg-danger/10"
          title="Clear"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed p-3 bg-[#050816] min-h-0">
        {!active ? (
          <p className="text-muted/50 text-center mt-16 text-xs">Select a log file above to start streaming</p>
        ) : lines.length === 0 ? (
          <div className="flex items-center gap-2 text-muted/60 mt-8 justify-center text-xs">
            <Loader2 size={13} className="animate-spin" /> Waiting for output…
          </div>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={`${l.cls} whitespace-pre-wrap break-all leading-5`}>
              {l.line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

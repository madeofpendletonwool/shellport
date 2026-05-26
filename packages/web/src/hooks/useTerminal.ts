import { useEffect, useRef, useCallback } from 'react'
import { Terminal }    from '@xterm/xterm'
import { FitAddon }    from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useAuth }     from '@/lib/auth'

export type Modifier = 'ctrl' | 'alt' | null

export interface TerminalHandle {
  term:    Terminal
  fit:     () => void
  dispose: () => void
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  sessionId:    number,
  onExit?:      (id: number) => void,
) {
  const handleRef      = useRef<TerminalHandle | null>(null)
  const wsRef          = useRef<WebSocket | null>(null)
  const token          = useAuth(s => s.token)
  const ctrlRef        = useRef(false)
  const altRef         = useRef(false)
  const modConsumedRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!containerRef.current || !token) return

    const term = new Terminal({
      fontFamily:      "'JetBrains Mono','Menlo','Monaco',monospace",
      fontSize:        13,
      lineHeight:      1.25,
      cursorBlink:     true,
      macOptionIsMeta: true,
      theme: {
        background:    '#050816',
        foreground:    '#D1E7FF',
        cursor:        '#22D3EE',
        selectionBackground: 'rgba(34,211,238,0.2)',
        black:         '#1a2035',  red:     '#F87171',
        green:         '#4ADE80',  yellow:  '#FBBF24',
        blue:          '#60A5FA',  magenta: '#C084FC',
        cyan:          '#22D3EE',  white:   '#D1E7FF',
        brightBlack:   '#475569',  brightRed:     '#FCA5A5',
        brightGreen:   '#86EFAC',  brightYellow:  '#FDE68A',
        brightBlue:    '#93C5FD',  brightMagenta: '#D8B4FE',
        brightCyan:    '#67E8F9',  brightWhite:   '#F1F5F9',
      },
    })

    const fit   = new FitAddon()
    const links = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(links)
    term.open(containerRef.current)
    fit.fit()

    // WebSocket
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws    = new WebSocket(`${proto}//${location.host}/ws/terminals/${sessionId}?token=${token}`)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }

    ws.onmessage = e => {
      if (e.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(e.data))
      } else {
        try {
          const msg = JSON.parse(e.data as string)
          if (msg.type === 'exit') onExit?.(sessionId)
        } catch {}
      }
    }

    ws.onclose = () => {
      term.writeln('\r\n\x1b[31m[connection closed]\x1b[0m')
    }

    term.onData(data => {
      let out = data
      // Sticky modifier set by the mobile keybar: intercept next printable char
      if (ctrlRef.current && data.length === 1) {
        const c = data.toLowerCase()
        if (c >= 'a' && c <= 'z') out = String.fromCharCode(c.charCodeAt(0) - 96)
        ctrlRef.current = false
        modConsumedRef.current?.()
      } else if (altRef.current && data.length === 1) {
        out = '\x1b' + data
        altRef.current = false
        modConsumedRef.current?.()
      }
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'input', data: out }))
    })

    const ro = new ResizeObserver(() => {
      fit.fit()
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    })
    ro.observe(containerRef.current)

    handleRef.current = {
      term,
      fit: () => fit.fit(),
      dispose: () => {
        ro.disconnect()
        ws.close()
        term.dispose()
      },
    }

    return () => {
      ro.disconnect()
      ws.close()
      term.dispose()
      handleRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token])

  const fit = useCallback(() => handleRef.current?.fit(), [])

  const sendInput = useCallback((data: string) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'input', data }))
  }, [])

  // Called by MobileKeybar when a sticky modifier is toggled.
  // onConsumed fires (resetting keybar UI) when the next physical keypress absorbs it.
  const setModifier = useCallback((mod: Modifier, onConsumed?: () => void) => {
    ctrlRef.current        = mod === 'ctrl'
    altRef.current         = mod === 'alt'
    modConsumedRef.current = onConsumed ?? null
  }, [])

  return { handleRef, fit, sendInput, setModifier }
}

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
      fontFamily:      "'Menlo','Monaco','Cascadia Code',monospace",
      fontSize:        13,
      lineHeight:      1.2,
      cursorBlink:     true,
      macOptionIsMeta: true,
      theme: {
        background:    '#000000',
        foreground:    '#d4d4d4',
        cursor:        '#aeafad',
        black:         '#1e1e1e',  red:     '#f44747',
        green:         '#6a9955',  yellow:  '#d7ba7d',
        blue:          '#569cd6',  magenta: '#c586c0',
        cyan:          '#4ec9b0',  white:   '#d4d4d4',
        brightBlack:   '#808080',  brightRed:     '#f44747',
        brightGreen:   '#b5cea8',  brightYellow:  '#d7ba7d',
        brightBlue:    '#9cdcfe',  brightMagenta: '#c586c0',
        brightCyan:    '#4fc1ff',  brightWhite:   '#ffffff',
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

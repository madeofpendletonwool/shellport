import { useRef, useEffect } from 'react'
import { useTerminal }      from '@/hooks/useTerminal'
import '@xterm/xterm/css/xterm.css'

interface Props {
  sessionId: number
  active:    boolean
  onExit:    (id: number) => void
}

export default function TerminalPane({ sessionId, active, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { fit }      = useTerminal(containerRef, sessionId, onExit)

  useEffect(() => {
    if (active) setTimeout(fit, 30)
  }, [active, fit])

  return (
    <div
      ref={containerRef}
      className="absolute inset-1"
      style={{ display: active ? 'block' : 'none' }}
    />
  )
}

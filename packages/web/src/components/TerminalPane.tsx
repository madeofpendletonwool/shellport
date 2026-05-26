import { useRef, useEffect } from 'react'
import { useTerminal }  from '@/hooks/useTerminal'
import MobileKeybar     from './MobileKeybar'
import '@xterm/xterm/css/xterm.css'

interface Props {
  sessionId: number
  active:    boolean
  onExit:    (id: number) => void
}

export default function TerminalPane({ sessionId, active, onExit }: Props) {
  const containerRef             = useRef<HTMLDivElement>(null)
  const { fit, sendInput, setModifier } = useTerminal(containerRef, sessionId, onExit)

  useEffect(() => {
    if (active) setTimeout(fit, 30)
  }, [active, fit])

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ display: active ? 'flex' : 'none' }}
    >
      <div ref={containerRef} className="flex-1 min-h-0 p-1" />
      <MobileKeybar onInput={sendInput} onModifier={setModifier} />
    </div>
  )
}

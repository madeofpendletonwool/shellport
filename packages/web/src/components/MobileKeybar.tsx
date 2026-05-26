import { useState } from 'react'
import type { Modifier } from '@/hooks/useTerminal'

interface KeyDef {
  label: string
  seq?:  string
  mod?:  'ctrl' | 'alt'
}

const ROWS: KeyDef[][] = [
  [
    { label: 'ESC',  seq: '\x1b' },
    { label: '/',    seq: '/' },
    { label: '-',    seq: '-' },
    { label: 'HOME', seq: '\x1b[H' },
    { label: '↑',    seq: '\x1b[A' },
    { label: 'END',  seq: '\x1b[F' },
    { label: 'PGUP', seq: '\x1b[5~' },
  ],
  [
    { label: 'TAB',  seq: '\t' },
    { label: 'CTRL', mod: 'ctrl' },
    { label: 'ALT',  mod: 'alt' },
    { label: '←',    seq: '\x1b[D' },
    { label: '↓',    seq: '\x1b[B' },
    { label: '→',    seq: '\x1b[C' },
    { label: 'PGDN', seq: '\x1b[6~' },
  ],
]

// CTRL modifier map for special sequences
const CTRL_MAP: Record<string, string> = {
  '\x1b[A': '\x1b[1;5A',   // CTRL+up
  '\x1b[B': '\x1b[1;5B',   // CTRL+down
  '\x1b[C': '\x1b[1;5C',   // CTRL+right
  '\x1b[D': '\x1b[1;5D',   // CTRL+left
  '\x1b[H': '\x1b[1;5H',   // CTRL+home
  '\x1b[F': '\x1b[1;5F',   // CTRL+end
  '\x1b[5~': '\x1b[5;5~',  // CTRL+pgup
  '\x1b[6~': '\x1b[6;5~',  // CTRL+pgdn
  '/': '\x1f',
  '\x1b': '\x1b',
  '\t': '\t',
}

// ALT modifier: prefix with ESC
const ALT_MAP: Record<string, string> = {
  '\x1b[A': '\x1b[1;3A',
  '\x1b[B': '\x1b[1;3B',
  '\x1b[C': '\x1b[1;3C',
  '\x1b[D': '\x1b[1;3D',
}

function applyMod(seq: string, mod: Modifier): string {
  if (!mod) return seq
  if (mod === 'ctrl') return CTRL_MAP[seq] ?? seq
  return ALT_MAP[seq] ?? ('\x1b' + seq)
}

interface Props {
  onInput:      (data: string) => void
  onModifier:   (mod: Modifier, onConsumed: () => void) => void
}

export default function MobileKeybar({ onInput, onModifier }: Props) {
  const [mod, setMod] = useState<Modifier>(null)

  const clearMod = () => setMod(null)

  const handleKey = (key: KeyDef) => {
    if (key.mod) {
      const next: Modifier = mod === key.mod ? null : key.mod
      setMod(next)
      onModifier(next, clearMod)
      return
    }
    if (!key.seq) return
    onInput(applyMod(key.seq, mod))
    // one-shot: clear modifier after use
    if (mod) {
      setMod(null)
      onModifier(null, clearMod)
    }
  }

  return (
    <div className="flex-shrink-0 bg-surface2 border-t border-border select-none">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex border-b border-border last:border-b-0">
          {row.map(key => {
            const active = key.mod && mod === key.mod
            return (
              <button
                key={key.label}
                onPointerDown={e => { e.preventDefault(); handleKey(key) }}
                className={`flex-1 py-1.5 text-[11px] font-mono tracking-tight
                  border-r border-border last:border-r-0 transition-colors
                  ${active
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-white active:bg-surface3'
                  }`}
              >
                {key.label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

import { eq, max, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { terminalSessions } from '../db/schema.js'
import { config } from '../config.js'
import { Session } from './session.js'

function initNextId(): number {
  const row = db.select({ m: max(terminalSessions.id) }).from(terminalSessions).get()
  return (row?.m ?? 0) + 1
}

// On startup, any session without endedAt is an orphan — the PTY died with the
// previous server process. Mark them ended so the list stays clean.
function cleanupOrphans() {
  db.update(terminalSessions)
    .set({ endedAt: Math.floor(Date.now() / 1000) })
    .where(isNull(terminalSessions.endedAt))
    .run()
}

export class TerminalManager {
  private sessions = new Map<number, Session>()
  private _nextId  = initNextId()

  constructor() { cleanupOrphans() }

  create(opts: {
    name?:    string
    type?:    'shell' | 'claude'
    cols?:    number
    rows?:    number
    workdir?: string
  }): Session {
    const id   = this._nextId++
    const type = opts.type ?? 'shell'
    const name = opts.name ?? (type === 'claude' ? `claude-${id}` : `term-${id}`)
    const cols = opts.cols ?? 220
    const rows = opts.rows ?? 50

    const shell = type === 'claude' ? config.CLAUDE_BIN : config.DEFAULT_SHELL
    const args  = type === 'claude' ? [] : ['--login']

    const sess = new Session({ id, name, type, shell, args, cols, rows, workdir: opts.workdir })

    db.insert(terminalSessions).values({
      id,
      name,
      type,
      workdir:   opts.workdir ?? null,
      createdAt: Math.floor(Date.now() / 1000),
    }).run()

    sess['ptyProcess']?.onExit?.(() => this.markEnded(id))

    this.sessions.set(id, sess)
    return sess
  }

  private markEnded(id: number) {
    db.update(terminalSessions)
      .set({ endedAt: Math.floor(Date.now() / 1000) })
      .where(eq(terminalSessions.id, id))
      .run()
    this.sessions.delete(id)
  }

  get(id: number): Session | undefined {
    return this.sessions.get(id)
  }

  list() {
    return db.select().from(terminalSessions)
      .where(isNull(terminalSessions.endedAt))
      .all()
      .map(row => ({
        id:        row.id,
        name:      row.name,
        type:      row.type,
        alive:     this.sessions.get(row.id)?.alive ?? false,
        cols:      220,
        rows:      50,
        createdAt: row.createdAt,
      }))
  }

  delete(id: number) {
    const sess = this.sessions.get(id)
    if (sess) {
      sess.kill()
      this.markEnded(id)
    }
  }
}

export const terminalManager = new TerminalManager()

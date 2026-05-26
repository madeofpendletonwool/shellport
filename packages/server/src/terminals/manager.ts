import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { terminalSessions } from '../db/schema.js'
import { config } from '../config.js'
import { Session } from './session.js'

let _nextId = 1

export class TerminalManager {
  private sessions = new Map<number, Session>()

  create(opts: {
    name?:    string
    type?:    'shell' | 'claude'
    cols?:    number
    rows?:    number
    workdir?: string
  }): Session {
    const id      = _nextId++
    const type    = opts.type ?? 'shell'
    const name    = opts.name ?? (type === 'claude' ? `claude-${id}` : `term-${id}`)
    const cols    = opts.cols ?? 220
    const rows    = opts.rows ?? 50

    let shell: string
    let args:  string[]

    if (type === 'claude') {
      shell = config.CLAUDE_BIN
      args  = []
    } else {
      shell = config.DEFAULT_SHELL
      args  = ['--login']
    }

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

  list(): Array<{
    id: number; name: string; type: string
    alive: boolean; cols: number; rows: number; createdAt: number
  }> {
    return db.select().from(terminalSessions)
      .where(eq(terminalSessions.endedAt, null as unknown as number))
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

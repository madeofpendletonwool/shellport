import * as pty from 'node-pty'
import type { WebSocket } from 'ws'

const SCROLLBACK_SIZE = 64 * 1024   // 64 KiB

export class Session {
  readonly id:      number
  readonly name:    string
  readonly type:    'shell' | 'claude'
  readonly workdir: string | undefined

  private ptyProcess: pty.IPty
  private scrollback: Buffer[] = []
  private scrollbackLen = 0
  private subs = new Set<WebSocket>()
  private _alive = true

  constructor(opts: {
    id:      number
    name:    string
    type:    'shell' | 'claude'
    shell:   string
    args:    string[]
    cols:    number
    rows:    number
    workdir: string | undefined
  }) {
    this.id      = opts.id
    this.name    = opts.name
    this.type    = opts.type
    this.workdir = opts.workdir

    this.ptyProcess = pty.spawn(opts.shell, opts.args, {
      name:  'xterm-256color',
      cols:  opts.cols,
      rows:  opts.rows,
      cwd:   opts.workdir ?? process.env.HOME ?? '/',
      env:   { ...process.env, COLORTERM: 'truecolor', TERM: 'xterm-256color' } as Record<string, string>,
    })

    this.ptyProcess.onData(chunk => {
      const buf = Buffer.from(chunk, 'utf8')
      this.appendScrollback(buf)
      for (const ws of this.subs) {
        if (ws.readyState === ws.OPEN) ws.send(buf)
        else this.subs.delete(ws)
      }
    })

    this.ptyProcess.onExit(() => {
      this._alive = false
      const msg = JSON.stringify({ type: 'exit', id: this.id })
      for (const ws of this.subs) {
        if (ws.readyState === ws.OPEN) ws.send(msg)
      }
      this.subs.clear()
    })
  }

  get alive() { return this._alive }

  private appendScrollback(buf: Buffer) {
    this.scrollback.push(buf)
    this.scrollbackLen += buf.length
    while (this.scrollbackLen > SCROLLBACK_SIZE && this.scrollback.length > 0) {
      this.scrollbackLen -= this.scrollback[0].length
      this.scrollback.shift()
    }
  }

  getScrollback(): Buffer {
    return Buffer.concat(this.scrollback)
  }

  subscribe(ws: WebSocket) {
    this.subs.add(ws)
    const replay = this.getScrollback()
    if (replay.length > 0) ws.send(replay)
  }

  unsubscribe(ws: WebSocket) {
    this.subs.delete(ws)
  }

  write(data: string | Buffer) {
    if (!this._alive) return
    if (Buffer.isBuffer(data)) this.ptyProcess.write(data.toString('utf8'))
    else this.ptyProcess.write(data)
  }

  resize(cols: number, rows: number) {
    if (!this._alive) return
    this.ptyProcess.resize(cols, rows)
  }

  kill() {
    if (!this._alive) return
    this.ptyProcess.kill('SIGKILL')
  }
}

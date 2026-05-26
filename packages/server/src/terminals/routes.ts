import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../auth/middleware.js'
import { terminalManager } from './manager.js'

export async function terminalRoutes(app: FastifyInstance) {

  // GET /api/terminals
  app.get('/api/terminals', { preHandler: authenticate }, async () => {
    return terminalManager.list()
  })

  // GET /api/terminals/events — SSE stream for hot tab sync across devices
  app.get('/api/terminals/events', async (req, reply) => {
    const rawToken = (req.query as Record<string, string>).token
    if (!rawToken) return reply.status(401).send({ error: 'Unauthorized' })

    try {
      app.jwt.verify(rawToken)
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    reply.raw.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',  // disable nginx buffering
    })

    const send = (event: string, data: unknown) => {
      try {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch { /* client disconnected */ }
    }

    // Send current list immediately
    send('sync', terminalManager.list())

    const listener = (event: string, data: unknown) => send(event, data)
    terminalManager.onEvent(listener as any)

    // Keep-alive ping every 25s to prevent proxy timeouts
    const ping = setInterval(() => {
      try { reply.raw.write(':ping\n\n') } catch { clearInterval(ping) }
    }, 25_000)

    req.raw.on('close', () => {
      clearInterval(ping)
      terminalManager.offEvent(listener as any)
    })
  })

  // POST /api/terminals
  app.post('/api/terminals', { preHandler: authenticate }, async (req, reply) => {
    const body = z.object({
      name:    z.string().optional(),
      type:    z.enum(['shell', 'claude']).default('shell'),
      cols:    z.coerce.number().int().min(10).max(500).default(220),
      rows:    z.coerce.number().int().min(5).max(200).default(50),
      workdir: z.string().optional(),
    }).parse(req.body)

    const sess = terminalManager.create(body)
    reply.status(201)
    return { id: sess.id, name: sess.name, type: sess.type, alive: true }
  })

  // PATCH /api/terminals/:id  (rename)
  app.patch('/api/terminals/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id }   = z.object({ id: z.coerce.number() }).parse(req.params)
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)
    const sess = terminalManager.get(id)
    if (!sess) return reply.status(404).send({ error: 'Not found' })
    ;(sess as any).name = name
    return { ok: true }
  })

  // DELETE /api/terminals/:id
  app.delete('/api/terminals/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(req.params)
    if (!terminalManager.get(id)) return reply.status(404).send({ error: 'Not found' })
    terminalManager.delete(id)
    return { ok: true }
  })

  // WS /ws/terminals/:id
  app.get('/ws/terminals/:id', { websocket: true }, async (socket, req) => {
    const rawToken = (req.query as Record<string, string>).token
    if (!rawToken) { socket.close(4401, 'Unauthorized'); return }

    let userId: number
    try {
      const payload = app.jwt.verify<{ id: number }>(rawToken)
      userId = payload.id
    } catch {
      socket.close(4401, 'Unauthorized')
      return
    }

    const { id } = z.object({ id: z.coerce.number() }).parse(req.params)
    const sess = terminalManager.get(id)
    if (!sess) { socket.close(4404, 'Session not found'); return }

    sess.subscribe(socket)

    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString('utf8'))
        if (msg.type === 'input' && typeof msg.data === 'string') {
          sess.write(msg.data)
        } else if (msg.type === 'resize') {
          sess.resize(Number(msg.cols) || 80, Number(msg.rows) || 24)
        }
      } catch {
        sess.write(raw)
      }
    })

    socket.on('close', () => sess.unsubscribe(socket))
    socket.on('error', () => sess.unsubscribe(socket))
  })
}

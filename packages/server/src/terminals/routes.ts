import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../auth/middleware.js'
import { terminalManager } from './manager.js'

export async function terminalRoutes(app: FastifyInstance) {

  // GET /api/terminals
  app.get('/api/terminals', { preHandler: authenticate }, async () => {
    return terminalManager.list()
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
    return { id: sess.id, name: sess.name, type: sess.type }
  })

  // PATCH /api/terminals/:id  (rename)
  app.patch('/api/terminals/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id }   = z.object({ id: z.coerce.number() }).parse(req.params)
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)
    const sess = terminalManager.get(id)
    if (!sess) return reply.status(404).send({ error: 'Not found' })
    ;(sess as any).name = name   // update in-memory name for listing
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
    // Auth: validate JWT from ?token= query param (browsers can't set headers on WS)
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
        // binary input — write directly
        sess.write(raw)
      }
    })

    socket.on('close', () => sess.unsubscribe(socket))
    socket.on('error', () => sess.unsubscribe(socket))
  })
}

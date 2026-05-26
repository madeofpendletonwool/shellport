import type { FastifyInstance } from 'fastify'
import { WebSocketServer } from 'ws'
import { z } from 'zod'
import { authenticate } from '../auth/middleware.js'
import { portRegistry } from './registry.js'
import { proxyHttp, proxyWs } from './proxy.js'

// One WS server in noServer mode — used to upgrade raw sockets for the proxy.
const proxyWss = new WebSocketServer({ noServer: true })

export async function portRoutes(app: FastifyInstance) {

  // GET /api/ports
  app.get('/api/ports', { preHandler: authenticate }, async () => {
    return portRegistry.list()
  })

  // POST /api/ports
  app.post('/api/ports', { preHandler: authenticate }, async (req, reply) => {
    const { port, label } = z.object({
      port:  z.coerce.number().int().min(1).max(65535),
      label: z.string().min(1),
    }).parse(req.body)

    const entry = portRegistry.register(port, label)
    reply.status(201)
    return entry
  })

  // DELETE /api/ports/:port
  app.delete('/api/ports/:port', { preHandler: authenticate }, async (req, reply) => {
    const { port } = z.object({ port: z.coerce.number() }).parse(req.params)
    if (!portRegistry.isRegistered(port)) return reply.status(404).send({ error: 'Not registered' })
    portRegistry.unregister(port)
    return { ok: true }
  })

  // /proxy/:port/* — HTTP + WebSocket proxy
  // @fastify/websocket sets req.ws = true on any upgrade request via its onRequest hook.
  // We hijack the reply for WS upgrades so onResponse (which would destroy the socket) never fires.
  // Auth is skipped here; the port must be explicitly registered — that's the access gate.
  app.route({
    method:  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    url:     '/proxy/:port/*',
    handler: async (req, reply) => {
      const { port } = z.object({ port: z.coerce.number() }).parse(req.params)
      if (!portRegistry.isRegistered(port)) {
        return reply.status(404).send({ error: 'Port not registered' })
      }

      if (req.ws) {
        // WebSocket upgrade: hijack so Fastify/ws don't destroy the socket, then proxy.
        reply.hijack()
        proxyWss.handleUpgrade(req.raw, req.socket, Buffer.alloc(0), (ws) => {
          proxyWs(port, ws, req.raw.url ?? '/').catch(() => ws.close())
        })
        return
      }

      try {
        await proxyHttp(port, req, reply)
      } catch {
        if (!reply.sent) reply.status(502).send({ error: 'Upstream unreachable' })
      }
    },
  })
}

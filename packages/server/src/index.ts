import Fastify from 'fastify'
import fastifyCookie  from '@fastify/cookie'
import fastifyCors    from '@fastify/cors'
import fastifyJwt     from '@fastify/jwt'
import fastifyWs      from '@fastify/websocket'
import fastifyStatic  from '@fastify/static'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync }    from 'fs'

import { config }      from './config.js'
import { runMigrations } from './db/index.js'
import { seedAdmin }   from './auth/seed.js'
import { authRoutes }  from './auth/routes.js'
import { oidcRoutes }  from './auth/oidc.js'
import { terminalRoutes } from './terminals/routes.js'
import { portRoutes }  from './ports/routes.js'
import { portRegistry } from './ports/registry.js'
import { logRoutes }   from './logs/routes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = Fastify({ logger: { level: config.IS_PROD ? 'warn' : 'info' } })

// ── plugins ───────────────────────────────────────────────────────────────────
await app.register(fastifyCors, {
  origin:      config.IS_PROD ? false : 'http://localhost:5173',
  credentials: true,
})

await app.register(fastifyCookie)

await app.register(fastifyJwt, {
  secret: config.JWT_SECRET,
  cookie: { cookieName: 'accessToken', signed: false },
})

await app.register(fastifyWs)

// ── health ────────────────────────────────────────────────────────────────────
app.get('/api/health', async () => ({
  ok:      true,
  uptime:  process.uptime(),
  version: '0.1.0',
}))

// ── server config (read + runtime shell override) ─────────────────────────────
import { authenticate } from './auth/middleware.js'
app.get('/api/server-config', { preHandler: authenticate }, async () => ({
  defaultShell: config.DEFAULT_SHELL,
  claudeBin:    config.CLAUDE_BIN,
}))
app.patch('/api/server-config', { preHandler: authenticate }, async (req, reply) => {
  const { defaultShell } = req.body as { defaultShell?: string }
  if (typeof defaultShell === 'string' && defaultShell.trim()) {
    ;(config as any).DEFAULT_SHELL = defaultShell.trim()
  }
  return { defaultShell: config.DEFAULT_SHELL }
})

// ── routes ────────────────────────────────────────────────────────────────────
await app.register(authRoutes)
await app.register(oidcRoutes)
await app.register(terminalRoutes)
await app.register(portRoutes)
await app.register(logRoutes)

// ── static frontend (production) ──────────────────────────────────────────────
const webDist = join(__dirname, '../../web/dist')
if (existsSync(webDist)) {
  await app.register(fastifyStatic, {
    root:   webDist,
    prefix: '/',
  })
  // SPA fallback — serve index.html for any unmatched path
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.sendFile('index.html')
  })
}

// ── startup ───────────────────────────────────────────────────────────────────
runMigrations()
await seedAdmin()
portRegistry.load()

await app.listen({ host: '0.0.0.0', port: config.PORT })
console.log(`Shellport  →  http://0.0.0.0:${config.PORT}`)

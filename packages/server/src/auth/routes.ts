import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
const { compare, hash } = bcrypt
import { createHash, randomBytes } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { users, refreshTokens, apiKeys } from '../db/schema.js'
import { authenticate } from './middleware.js'

const ACCESS_TTL  = 15 * 60          // 15 minutes (seconds)
const REFRESH_TTL = 7 * 24 * 3600    // 7 days (seconds)

function now() { return Math.floor(Date.now() / 1000) }

export async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/login
  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = z.object({
      username: z.string(),
      password: z.string(),
    }).parse(req.body)

    const user = db.select().from(users).where(eq(users.username, username)).get()
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' })

    const ok = await compare(password, user.passwordHash)
    if (!ok) return reply.status(401).send({ error: 'Invalid credentials' })

    const accessToken = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: ACCESS_TTL }
    )

    const rawRefresh = randomBytes(40).toString('hex')
    const tokenHash  = createHash('sha256').update(rawRefresh).digest('hex')
    db.insert(refreshTokens).values({
      userId:    user.id,
      tokenHash,
      expiresAt: now() + REFRESH_TTL,
      createdAt: now(),
      revoked:   0,
    }).run()

    reply.setCookie('refreshToken', rawRefresh, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path:     '/api/auth',
      maxAge:   REFRESH_TTL,
    })

    return { accessToken, expiresIn: ACCESS_TTL }
  })

  // POST /api/auth/refresh
  app.post('/api/auth/refresh', async (req, reply) => {
    const rawRefresh = req.cookies.refreshToken
    if (!rawRefresh) return reply.status(401).send({ error: 'No refresh token' })

    const tokenHash = createHash('sha256').update(rawRefresh).digest('hex')
    const row = db.select().from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), eq(refreshTokens.revoked, 0)))
      .get()

    if (!row || row.expiresAt < now()) {
      return reply.status(401).send({ error: 'Refresh token expired or invalid' })
    }

    // rotate: revoke old, issue new
    db.update(refreshTokens).set({ revoked: 1 }).where(eq(refreshTokens.id, row.id)).run()

    const user = db.select().from(users).where(eq(users.id, row.userId)).get()
    if (!user) return reply.status(401).send({ error: 'User not found' })

    const accessToken = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: ACCESS_TTL }
    )

    const newRaw   = randomBytes(40).toString('hex')
    const newHash  = createHash('sha256').update(newRaw).digest('hex')
    db.insert(refreshTokens).values({
      userId:    user.id,
      tokenHash: newHash,
      expiresAt: now() + REFRESH_TTL,
      createdAt: now(),
      revoked:   0,
    }).run()

    reply.setCookie('refreshToken', newRaw, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path:     '/api/auth',
      maxAge:   REFRESH_TTL,
    })

    return { accessToken, expiresIn: ACCESS_TTL }
  })

  // POST /api/auth/logout
  app.post('/api/auth/logout', { preHandler: authenticate }, async (req, reply) => {
    const rawRefresh = req.cookies.refreshToken
    if (rawRefresh) {
      const tokenHash = createHash('sha256').update(rawRefresh).digest('hex')
      db.update(refreshTokens).set({ revoked: 1 })
        .where(eq(refreshTokens.tokenHash, tokenHash)).run()
    }
    reply.clearCookie('refreshToken', { path: '/api/auth' })
    return { ok: true }
  })

  // GET /api/auth/me
  app.get('/api/auth/me', { preHandler: authenticate }, async (req) => {
    return { id: req.user.id, username: req.user.username, role: req.user.role }
  })

  // GET /api/auth/api-keys
  app.get('/api/auth/api-keys', { preHandler: authenticate }, async (req) => {
    return db.select({
      id: apiKeys.id, label: apiKeys.label, prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt,
    }).from(apiKeys)
      .where(and(eq(apiKeys.userId, req.user.id), eq(apiKeys.revoked, 0)))
      .all()
  })

  // POST /api/auth/api-keys
  app.post('/api/auth/api-keys', { preHandler: authenticate }, async (req) => {
    const { label } = z.object({ label: z.string().min(1) }).parse(req.body)
    const rawKey  = randomBytes(32).toString('hex')
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const prefix  = rawKey.slice(0, 8)

    const result = db.insert(apiKeys).values({
      userId:    req.user.id,
      label,
      keyHash,
      prefix,
      createdAt: now(),
      revoked:   0,
    }).returning({ id: apiKeys.id }).get()

    return { id: result.id, label, prefix, key: rawKey }
  })

  // DELETE /api/auth/api-keys/:id
  app.delete('/api/auth/api-keys/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(req.params)
    const row = db.select().from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, req.user.id))).get()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    db.update(apiKeys).set({ revoked: 1 }).where(eq(apiKeys.id, id)).run()
    return { ok: true }
  })

  // POST /api/auth/change-password
  app.post('/api/auth/change-password', { preHandler: authenticate }, async (req, reply) => {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string(),
      newPassword:     z.string().min(8),
    }).parse(req.body)

    const user = db.select().from(users).where(eq(users.id, req.user.id)).get()
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const ok = await compare(currentPassword, user.passwordHash)
    if (!ok) return reply.status(401).send({ error: 'Wrong current password' })

    const passwordHash = await hash(newPassword, 12)
    db.update(users).set({ passwordHash }).where(eq(users.id, req.user.id)).run()
    return { ok: true }
  })
}

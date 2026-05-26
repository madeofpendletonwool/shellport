import type { FastifyInstance } from 'fastify'
import {
  discovery,
  buildAuthorizationUrl,
  authorizationCodeGrant,
  randomState,
  ClientSecretPost,
  allowInsecureRequests,
  type Configuration,
} from 'openid-client'
import { randomBytes, createCipheriv, createDecipheriv, randomFillSync } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
const { hash: bcryptHash } = bcrypt
import { db } from '../db/index.js'
import { users, oidcProviders, oidcIdentities, oidcStates } from '../db/schema.js'
import { authenticate } from './middleware.js'
import { issueTokens } from './routes.js'
import { config } from '../config.js'

function now() { return Math.floor(Date.now() / 1000) }

// ── Encryption helpers ────────────────────────────────────────────────────────
const CIPHER_ALG = 'aes-256-gcm'
const IV_LEN     = 12
const TAG_LEN    = 16

function getEncKey(): Buffer | null {
  if (!config.OIDC_SECRET_KEY) return null
  const buf = Buffer.from(config.OIDC_SECRET_KEY, 'hex')
  return buf.length === 32 ? buf : null
}

function encryptSecret(plaintext: string): string {
  const key = getEncKey()
  if (!key) return plaintext
  const iv     = Buffer.alloc(IV_LEN)
  randomFillSync(iv)
  const cipher = createCipheriv(CIPHER_ALG, key, iv)
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag    = (cipher as any).getAuthTag() as Buffer
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decryptSecret(stored: string): string {
  const key = getEncKey()
  if (!key) return stored
  try {
    const buf      = Buffer.from(stored, 'base64')
    const iv       = buf.subarray(0, IV_LEN)
    const tag      = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const enc      = buf.subarray(IV_LEN + TAG_LEN)
    const decipher = createDecipheriv(CIPHER_ALG, key, iv)
    ;(decipher as any).setAuthTag(tag)
    return decipher.update(enc) + decipher.final('utf8')
  } catch {
    return stored
  }
}

// ── Discovery cache ───────────────────────────────────────────────────────────
const configCache = new Map<string, Configuration>()

async function getOidcConfig(issuerUrl: string, clientId: string, clientSecret: string): Promise<Configuration> {
  const key = `${issuerUrl}::${clientId}`
  const cached = configCache.get(key)
  if (cached) return cached

  const server = new URL(issuerUrl)
  const opts = server.protocol === 'http:' ? { execute: [allowInsecureRequests] } : {}
  const cfg = await discovery(server, clientId, {}, ClientSecretPost(clientSecret), opts)
  configCache.set(key, cfg)
  return cfg
}

// ── URL helpers ────────────────────────────────────────────────────────────────
function getCallbackUrl(req: any): string {
  const origin = config.FRONTEND_URL
    ? new URL(config.FRONTEND_URL).origin
    : `${req.protocol}://${req.hostname}:${config.PORT}`
  return `${origin}/api/auth/oidc/callback`
}

function getFrontendBase(): string {
  return config.FRONTEND_URL ?? ''
}

// ── Cleanup expired states ────────────────────────────────────────────────────
function cleanExpiredStates() {
  const all = db.select().from(oidcStates).all()
  const ts  = now()
  for (const r of all) {
    if (r.expiresAt < ts) db.delete(oidcStates).where(eq(oidcStates.state, r.state)).run()
  }
}

export async function oidcRoutes(app: FastifyInstance) {

  // ── Public: list enabled providers ─────────────────────────────────────────
  app.get('/api/auth/oidc/providers', async () =>
    db.select({ id: oidcProviders.id, name: oidcProviders.name })
      .from(oidcProviders)
      .where(eq(oidcProviders.enabled, 1))
      .all()
  )

  // ── Public: initiate OIDC flow ──────────────────────────────────────────────
  app.get('/api/auth/oidc/:providerId/initiate', async (req, reply) => {
    const { providerId } = z.object({ providerId: z.string() }).parse(req.params)

    const provider = db.select().from(oidcProviders)
      .where(and(eq(oidcProviders.id, providerId), eq(oidcProviders.enabled, 1)))
      .get()
    if (!provider) return reply.status(404).send({ error: 'Provider not found' })

    const clientSecret = decryptSecret(provider.clientSecret)
    let oidcConfig: Configuration
    try {
      oidcConfig = await getOidcConfig(provider.issuer, provider.clientId, clientSecret)
    } catch (e: any) {
      return reply.status(502).send({ error: `OIDC discovery failed: ${e.message}` })
    }

    const state = randomState()
    db.insert(oidcStates).values({
      state,
      providerId: provider.id,
      expiresAt:  now() + 600,
      createdAt:  now(),
    }).run()
    cleanExpiredStates()

    const callbackUrl = getCallbackUrl(req)
    const url = buildAuthorizationUrl(oidcConfig, {
      redirect_uri: callbackUrl,
      scope:        provider.scopes,
      state,
    })

    return reply.redirect(url.href)
  })

  // ── Public: OIDC callback ───────────────────────────────────────────────────
  app.get('/api/auth/oidc/callback', async (req, reply) => {
    const query = req.query as Record<string, string>
    const fe    = getFrontendBase()

    if (query.error) {
      return reply.redirect(`${fe}/login?error=${encodeURIComponent(query.error)}`)
    }
    if (!query.state || !query.code) {
      return reply.redirect(`${fe}/login?error=missing_params`)
    }

    const stateRow = db.select().from(oidcStates).where(eq(oidcStates.state, query.state)).get()
    if (!stateRow || stateRow.expiresAt < now()) {
      db.delete(oidcStates).where(eq(oidcStates.state, query.state)).run()
      return reply.redirect(`${fe}/login?error=invalid_state`)
    }
    db.delete(oidcStates).where(eq(oidcStates.state, query.state)).run()

    const provider = db.select().from(oidcProviders).where(eq(oidcProviders.id, stateRow.providerId)).get()
    if (!provider) return reply.redirect(`${fe}/login?error=provider_not_found`)

    const clientSecret = decryptSecret(provider.clientSecret)
    let oidcConfig: Configuration
    try {
      oidcConfig = await getOidcConfig(provider.issuer, provider.clientId, clientSecret)
    } catch {
      return reply.redirect(`${fe}/login?error=provider_discovery_failed`)
    }

    const callbackUrl = getCallbackUrl(req)
    // Build the "current URL" that openid-client parses for code + state
    const currentUrl = new URL(`${callbackUrl}?${new URLSearchParams(query as Record<string, string>).toString()}`)

    let tokens: any
    try {
      tokens = await authorizationCodeGrant(oidcConfig, currentUrl, {
        expectedState: query.state,
      }, { redirect_uri: callbackUrl })
    } catch (e: any) {
      return reply.redirect(`${fe}/login?error=${encodeURIComponent(e.message ?? 'token_exchange_failed')}`)
    }

    const claims  = tokens.claims()
    const subject = claims.sub as string
    const email   = (claims.email as string | undefined) ?? null

    // Resolve or provision user
    const identity = db.select().from(oidcIdentities)
      .where(and(eq(oidcIdentities.providerId, provider.id), eq(oidcIdentities.subject, subject)))
      .get()

    let userId: number

    if (identity) {
      userId = identity.userId
    } else {
      let existingUser = email
        ? db.select().from(users).where(eq(users.email, email)).get()
        : null

      if (!existingUser) {
        const base = email?.split('@')[0]?.replace(/[^a-z0-9_-]/gi, '') || `oidc_${randomBytes(4).toString('hex')}`
        const username    = await ensureUniqueUsername(base)
        const passwordHash = await bcryptHash(randomBytes(20).toString('hex'), 10)
        const inserted = db.insert(users).values({
          username,
          email,
          passwordHash,
          role:      provider.defaultRole,
          createdAt: now(),
        }).returning({ id: users.id }).get()
        existingUser = db.select().from(users).where(eq(users.id, inserted.id)).get()!
      } else if (email && !existingUser.email) {
        db.update(users).set({ email }).where(eq(users.id, existingUser.id)).run()
      }

      userId = existingUser.id
      db.insert(oidcIdentities).values({
        id:         randomBytes(16).toString('hex'),
        userId,
        providerId: provider.id,
        subject,
        createdAt:  now(),
      }).run()
    }

    const user = db.select().from(users).where(eq(users.id, userId)).get()
    if (!user) return reply.redirect(`${fe}/login?error=user_not_found`)

    const { accessToken, rawRefresh } = issueTokens(app, user)

    reply.setCookie('refreshToken', rawRefresh, {
      httpOnly: true,
      secure:   config.IS_PROD,
      sameSite: 'lax',
      path:     '/api/auth',
      maxAge:   7 * 24 * 3600,
    })

    return reply.redirect(`${fe}/auth/callback?access_token=${encodeURIComponent(accessToken)}`)
  })

  // ── Admin: OIDC provider CRUD ───────────────────────────────────────────────
  app.get('/api/oidc-providers', { preHandler: authenticate }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' })
    return db.select({
      id: oidcProviders.id, name: oidcProviders.name,
      issuer: oidcProviders.issuer, clientId: oidcProviders.clientId,
      scopes: oidcProviders.scopes, defaultRole: oidcProviders.defaultRole,
      enabled: oidcProviders.enabled, createdAt: oidcProviders.createdAt,
    }).from(oidcProviders).all()
  })

  app.post('/api/oidc-providers', { preHandler: authenticate }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' })
    const body = z.object({
      name:         z.string().min(1),
      issuer:       z.string().url(),
      clientId:     z.string().min(1),
      clientSecret: z.string().min(1),
      scopes:       z.string().default('openid email profile'),
      defaultRole:  z.enum(['admin', 'user']).default('user'),
      enabled:      z.boolean().default(true),
    }).parse(req.body)

    try {
      await getOidcConfig(body.issuer, body.clientId, body.clientSecret)
    } catch {
      return reply.status(400).send({ error: 'Could not discover OIDC provider at that issuer URL' })
    }

    const id = randomBytes(16).toString('hex')
    db.insert(oidcProviders).values({
      id,
      name:         body.name,
      issuer:       body.issuer,
      clientId:     body.clientId,
      clientSecret: encryptSecret(body.clientSecret),
      scopes:       body.scopes,
      defaultRole:  body.defaultRole,
      enabled:      body.enabled ? 1 : 0,
      createdAt:    now(),
    }).run()
    return reply.status(201).send({ id })
  })

  app.patch('/api/oidc-providers/:id', { preHandler: authenticate }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' })
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z.object({
      name:         z.string().min(1).optional(),
      issuer:       z.string().url().optional(),
      clientId:     z.string().min(1).optional(),
      clientSecret: z.string().min(1).optional(),
      scopes:       z.string().optional(),
      defaultRole:  z.enum(['admin', 'user']).optional(),
      enabled:      z.boolean().optional(),
    }).parse(req.body)

    const existing = db.select().from(oidcProviders).where(eq(oidcProviders.id, id)).get()
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    if (body.issuer && body.issuer !== existing.issuer) {
      const secret = body.clientSecret ?? decryptSecret(existing.clientSecret)
      try { await getOidcConfig(body.issuer, body.clientId ?? existing.clientId, secret) }
      catch { return reply.status(400).send({ error: 'Could not discover OIDC provider at that issuer URL' }) }
      configCache.delete(`${existing.issuer}::${existing.clientId}`)
    }

    const update: Record<string, any> = {}
    if (body.name !== undefined)         update.name         = body.name
    if (body.issuer !== undefined)       update.issuer       = body.issuer
    if (body.clientId !== undefined)     update.clientId     = body.clientId
    if (body.clientSecret !== undefined) update.clientSecret = encryptSecret(body.clientSecret)
    if (body.scopes !== undefined)       update.scopes       = body.scopes
    if (body.defaultRole !== undefined)  update.defaultRole  = body.defaultRole
    if (body.enabled !== undefined)      update.enabled      = body.enabled ? 1 : 0

    db.update(oidcProviders).set(update).where(eq(oidcProviders.id, id)).run()
    return { ok: true }
  })

  app.delete('/api/oidc-providers/:id', { preHandler: authenticate }, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' })
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const existing = db.select().from(oidcProviders).where(eq(oidcProviders.id, id)).get()
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    configCache.delete(`${existing.issuer}::${existing.clientId}`)
    db.delete(oidcProviders).where(eq(oidcProviders.id, id)).run()
    return { ok: true }
  })
}

async function ensureUniqueUsername(base: string): Promise<string> {
  let candidate = base
  let suffix    = 0
  while (true) {
    const existing = db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).get()
    if (!existing) return candidate
    candidate = `${base}${++suffix}`
  }
}

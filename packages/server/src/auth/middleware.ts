import type { FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'crypto'
import { db } from '../db/index.js'
import { apiKeys, users } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; username: string; role: string; email?: string; avatarUrl?: string }
    user:    { id: number; username: string; role: string; email?: string; avatarUrl?: string }
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization ?? ''

  // API key auth
  if (auth.startsWith('ApiKey ')) {
    const rawKey = auth.slice(7).trim()
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const row = db
      .select({ id: apiKeys.id, userId: apiKeys.userId, revoked: apiKeys.revoked })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .get()

    if (!row || row.revoked) {
      return reply.status(401).send({ error: 'Invalid API key' })
    }

    db.update(apiKeys)
      .set({ lastUsedAt: Math.floor(Date.now() / 1000) })
      .where(eq(apiKeys.id, row.id))
      .run()

    const user = db.select().from(users).where(eq(users.id, row.userId)).get()
    if (!user) return reply.status(401).send({ error: 'User not found' })
    req.user = { id: user.id, username: user.username, role: user.role, email: user.email ?? undefined }
    return
  }

  // JWT bearer auth
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

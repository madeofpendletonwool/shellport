import bcrypt from 'bcryptjs'
const { hash } = bcrypt
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { config } from '../config.js'

export async function seedAdmin() {
  const existing = db.select().from(users).all()
  if (existing.length > 0) return

  const passwordHash = await hash(config.ADMIN_PASSWORD, 12)
  db.insert(users).values({
    username:     config.ADMIN_USERNAME,
    passwordHash,
    role:         'admin',
    createdAt:    Math.floor(Date.now() / 1000),
  }).run()

  console.log(`[seed] Created admin user: ${config.ADMIN_USERNAME}`)
}

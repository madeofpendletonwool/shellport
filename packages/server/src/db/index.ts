import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { config } from '../config.js'
import * as schema from './schema.js'

const dir = dirname(config.DB_PATH)
if (dir && dir !== '.') mkdirSync(dir, { recursive: true })

const sqlite = new Database(config.DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export function runMigrations() {
  migrate(db, { migrationsFolder: new URL('./migrations', import.meta.url).pathname })

  // Belt-and-suspenders: drizzle migrations can fail silently on existing DBs.
  // These statements are idempotent and ensure the schema is always current.
  patchSchema()
}

function patchSchema() {
  // Add email to users if the column is missing (existing DB upgrade path)
  const userCols = (sqlite.prepare('PRAGMA table_info(users)').all() as any[]).map((c: any) => c.name)
  if (!userCols.includes('email')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN email TEXT')
  }

  // OIDC tables — CREATE IF NOT EXISTS is already idempotent
  sqlite.exec(`CREATE TABLE IF NOT EXISTS oidc_providers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    issuer TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT 'openid email profile',
    default_role TEXT NOT NULL DEFAULT 'user',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`)

  sqlite.exec(`CREATE TABLE IF NOT EXISTS oidc_identities (
    id TEXT PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    provider_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES oidc_providers(id) ON DELETE CASCADE,
    UNIQUE (provider_id, subject)
  )`)

  sqlite.exec(`CREATE TABLE IF NOT EXISTS oidc_states (
    state TEXT PRIMARY KEY NOT NULL,
    provider_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES oidc_providers(id) ON DELETE CASCADE
  )`)
}

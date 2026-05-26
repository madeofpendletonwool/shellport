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
}

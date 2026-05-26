import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  username:     text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role').notNull().default('admin'),
  createdAt:    integer('created_at').notNull(),
})

export const refreshTokens = sqliteTable('refresh_tokens', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
  revoked:   integer('revoked').notNull().default(0),
})

export const apiKeys = sqliteTable('api_keys', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  userId:     integer('user_id').notNull().references(() => users.id),
  label:      text('label').notNull(),
  keyHash:    text('key_hash').notNull().unique(),
  prefix:     text('prefix').notNull(),
  createdAt:  integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at'),
  revoked:    integer('revoked').notNull().default(0),
})

export const terminalSessions = sqliteTable('terminal_sessions', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull(),
  type:      text('type').notNull().default('shell'),
  workdir:   text('workdir'),
  createdAt: integer('created_at').notNull(),
  endedAt:   integer('ended_at'),
})

export const registeredPorts = sqliteTable('registered_ports', {
  port:         integer('port').primaryKey(),
  label:        text('label').notNull(),
  registeredAt: integer('registered_at').notNull(),
})

import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  username:     text('username').notNull().unique(),
  email:        text('email'),
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

export const oidcProviders = sqliteTable('oidc_providers', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  issuer:      text('issuer').notNull().unique(),
  clientId:    text('client_id').notNull(),
  clientSecret:text('client_secret').notNull(),
  scopes:      text('scopes').notNull().default('openid email profile'),
  defaultRole: text('default_role').notNull().default('user'),
  enabled:     integer('enabled').notNull().default(1),
  createdAt:   integer('created_at').notNull(),
})

export const oidcIdentities = sqliteTable('oidc_identities', {
  id:         text('id').primaryKey(),
  userId:     integer('user_id').notNull().references(() => users.id),
  providerId: text('provider_id').notNull().references(() => oidcProviders.id),
  subject:    text('subject').notNull(),
  createdAt:  integer('created_at').notNull(),
})

export const oidcStates = sqliteTable('oidc_states', {
  state:      text('state').primaryKey(),
  providerId: text('provider_id').notNull().references(() => oidcProviders.id),
  expiresAt:  integer('expires_at').notNull(),
  createdAt:  integer('created_at').notNull(),
})

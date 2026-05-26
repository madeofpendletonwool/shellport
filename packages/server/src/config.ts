import { z } from 'zod'
import { execSync } from 'child_process'

const env = z.object({
  PORT:           z.coerce.number().default(3001),
  NODE_ENV:       z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET:     z.string().min(16),
  REFRESH_SECRET: z.string().min(16),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().min(8),
  DB_PATH:        z.string().default('./shellport.db'),
  LOG_DIRS:       z.string().default('/tmp'),
  DEFAULT_SHELL:  z.string().optional(),
  CLAUDE_BIN:     z.string().optional(),
}).parse(process.env)

function resolveClaude(): string {
  if (env.CLAUDE_BIN) return env.CLAUDE_BIN
  try { return execSync('which claude', { encoding: 'utf8' }).trim() }
  catch { return 'claude' }
}

function resolveShell(): string {
  if (env.DEFAULT_SHELL) return env.DEFAULT_SHELL
  return process.env.SHELL || '/bin/bash'
}

export const config = {
  ...env,
  LOG_DIR_LIST:  env.LOG_DIRS.split(':').filter(Boolean),
  CLAUDE_BIN:    resolveClaude(),
  DEFAULT_SHELL: resolveShell(),
  IS_PROD:       env.NODE_ENV === 'production',
}

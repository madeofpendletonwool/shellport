import type { FastifyInstance } from 'fastify'
import { createReadStream, statSync, existsSync, readdirSync } from 'fs'
import { resolve, join } from 'path'
import { z } from 'zod'
import { authenticate } from '../auth/middleware.js'
import { config } from '../config.js'

function isAllowed(filePath: string): boolean {
  const abs = resolve(filePath)
  return config.LOG_DIR_LIST.some(dir => abs.startsWith(resolve(dir) + '/') || abs === resolve(dir))
}

export async function logRoutes(app: FastifyInstance) {

  // GET /api/logs/files — list tailable log files from LOG_DIRS
  app.get('/api/logs/files', { preHandler: authenticate }, async () => {
    const files: Array<{ path: string; name: string; size: number }> = []
    for (const dir of config.LOG_DIR_LIST) {
      if (!existsSync(dir)) continue
      try {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          if (!e.isFile()) continue
          const fullPath = join(dir, e.name)
          try {
            const stat = statSync(fullPath)
            files.push({ path: fullPath, name: e.name, size: stat.size })
          } catch {}
        }
      } catch {}
    }
    return files
  })

  // GET /api/logs/stream?file=/tmp/trunk-build.log — SSE tail
  app.get('/api/logs/stream', { preHandler: authenticate }, async (req, reply) => {
    const { file } = z.object({ file: z.string() }).parse(req.query)

    if (!isAllowed(file)) {
      return reply.status(403).send({ error: 'File path not in allowed directories' })
    }

    if (!existsSync(file)) {
      return reply.status(404).send({ error: 'File not found' })
    }

    reply.raw.setHeader('Content-Type',      'text/event-stream')
    reply.raw.setHeader('Cache-Control',     'no-cache')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.setHeader('Connection',        'keep-alive')
    reply.raw.writeHead(200)

    let position = statSync(file).size   // start from EOF

    const send = (line: string) => {
      const data = `data: ${JSON.stringify({ line, ts: Date.now() })}\n\n`
      reply.raw.write(data)
    }

    let buf = ''

    const check = () => {
      try {
        const current = statSync(file).size
        if (current > position) {
          const stream = createReadStream(file, { start: position, end: current - 1 })
          stream.on('data', (chunk: string | Buffer) => {
            buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) if (line) send(line)
          })
          stream.on('end', () => { position = current })
        }
      } catch {}
    }

    const timer = setInterval(check, 150)

    req.raw.on('close', () => clearInterval(timer))
    req.raw.on('error', () => clearInterval(timer))
  })
}

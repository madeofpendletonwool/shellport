import http from 'http'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { WebSocket } from 'ws'

const HOST = process.env.PROXY_HOST ?? 'host.docker.internal'

const SKIP_HEADERS = new Set([
  'host', 'content-length', 'transfer-encoding', 'connection',
])

function forwardHeaders(src: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(src)) {
    if (!SKIP_HEADERS.has(k.toLowerCase()) && typeof v === 'string') out[k] = v
  }
  return out
}

// Rewrite absolute paths in HTML to go through /proxy/{port}/
class HtmlRewriter {
  private port: number
  constructor(port: number) { this.port = port }

  rewrite(chunk: Buffer): Buffer {
    let s = chunk.toString('utf8')
    const prefix = `/proxy/${this.port}/`
    s = s
      .replace(/href="\/(?!\/)/g,   `href="${prefix}`)
      .replace(/src="\/(?!\/)/g,    `src="${prefix}`)
      .replace(/action="\/(?!\/)/g, `action="${prefix}`)
      .replace(/url\(\//g,          `url(${prefix}`)
    return Buffer.from(s, 'utf8')
  }
}

export async function proxyHttp(
  port: number,
  req:  FastifyRequest,
  reply: FastifyReply,
) {
  // Strip /proxy/:port prefix from path
  const rawPath = (req.raw.url ?? '/').replace(/^\/proxy\/\d+/, '') || '/'

  return new Promise<void>((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: HOST,
      port,
      path:     rawPath,
      method:   req.method,
      headers:  forwardHeaders(req.headers as Record<string, string>),
    }

    const upstream = http.request(options, (upRes) => {
      const ct = upRes.headers['content-type'] ?? ''
      const isHtml = ct.includes('text/html')
      const rewriter = isHtml ? new HtmlRewriter(port) : null

      const outHeaders: Record<string, string | string[]> = {}
      for (const [k, v] of Object.entries(upRes.headers)) {
        if (!SKIP_HEADERS.has(k.toLowerCase()) && v !== undefined) {
          outHeaders[k] = v as string | string[]
        }
      }
      outHeaders['x-accel-buffering'] = 'no'

      reply.raw.writeHead(upRes.statusCode ?? 200, outHeaders)

      upRes.on('data', (chunk: Buffer) => {
        const out = rewriter ? rewriter.rewrite(chunk) : chunk
        reply.raw.write(out)
      })
      upRes.on('end',   () => { reply.raw.end(); resolve() })
      upRes.on('error', reject)
    })

    upstream.on('error', reject)

    req.raw.pipe(upstream)
  })
}

export async function proxyWs(
  port:      number,
  clientWs:  WebSocket,
  reqUrl:    string,
) {
  const rawPath = reqUrl.replace(/^\/proxy\/\d+/, '') || '/'
  const upUrl   = `ws://${HOST}:${port}${rawPath}`

  const upstream = new WebSocket(upUrl)

  upstream.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary })
  })
  clientWs.on('message', (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary })
  })

  const close = () => {
    try { upstream.close() }  catch {}
    try { clientWs.close() }  catch {}
  }
  upstream.on('close', close)
  clientWs.on('close', close)
  upstream.on('error', close)
  clientWs.on('error', close)
}

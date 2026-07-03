import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

function sendJson(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  body: Record<string, string>,
) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

function rssProxyPlugin() {
  const handler = async (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')

    if (requestUrl.pathname !== '/api/rss') {
      return false
    }

    const targetUrl = requestUrl.searchParams.get('url')

    if (!targetUrl) {
      sendJson(response, 400, { error: 'Missing "url" query parameter.' })
      return true
    }

    try {
      const upstreamResponse = await fetch(targetUrl, {
        headers: {
          'user-agent': 'Pulseboard RSS Proxy',
          accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        },
      })

      if (!upstreamResponse.ok) {
        sendJson(response, upstreamResponse.status, {
          error: `Feed request failed with ${upstreamResponse.status}.`,
        })
        return true
      }

      const xml = await upstreamResponse.text()
      const contentType = upstreamResponse.headers.get('content-type') ?? 'application/xml; charset=utf-8'

      response.statusCode = 200
      response.setHeader('Content-Type', contentType)
      response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
      response.end(xml)
      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected proxy error while loading the feed.'

      sendJson(response, 502, { error: message })
      return true
    }
  }

  return {
    name: 'rss-local-proxy',
    configureServer(server: {
      middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse<IncomingMessage>, next: () => void) => void) => void }
    }) {
      server.middlewares.use((request, response, next) => {
        void handler(request, response).then((handled) => {
          if (!handled) {
            next()
          }
        })
      })
    },
    configurePreviewServer(server: {
      middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse<IncomingMessage>, next: () => void) => void) => void }
    }) {
      server.middlewares.use((request, response, next) => {
        void handler(request, response).then((handled) => {
          if (!handled) {
            next()
          }
        })
      })
    },
  }
}

function llamaDigestProxyPlugin(options: {
  apiUrl: string
  model: string
}) {
  const handler = async (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')

    if (requestUrl.pathname !== '/api/llama-digest') {
      return false
    }

    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Use POST for /api/llama-digest.' })
      return true
    }

    try {
      const rawBody = await new Promise<string>((resolve, reject) => {
        let body = ''

        request.on('data', (chunk) => {
          body += chunk
        })
        request.on('end', () => resolve(body))
        request.on('error', reject)
      })

      const payload = JSON.parse(rawBody) as { prompt?: string }
      const prompt = payload.prompt?.trim()

      if (!prompt) {
        sendJson(response, 400, { error: 'Missing prompt body.' })
        return true
      }

      const upstreamResponse = await fetch(options.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.2,
          },
        }),
      })

      if (!upstreamResponse.ok) {
        const upstreamText = await upstreamResponse.text()
        sendJson(response, upstreamResponse.status, {
          error: `Llama request failed with ${upstreamResponse.status}: ${upstreamText}`,
        })
        return true
      }

      const upstreamJson = (await upstreamResponse.json()) as { response?: string }

      response.statusCode = 200
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(
        JSON.stringify({
          content: upstreamJson.response ?? '',
        }),
      )
      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected proxy error while generating digest.'

      sendJson(response, 502, { error: message })
      return true
    }
  }

  return {
    name: 'llama-digest-proxy',
    configureServer(server: {
      middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse<IncomingMessage>, next: () => void) => void) => void }
    }) {
      server.middlewares.use((request, response, next) => {
        void handler(request, response).then((handled) => {
          if (!handled) {
            next()
          }
        })
      })
    },
    configurePreviewServer(server: {
      middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse<IncomingMessage>, next: () => void) => void) => void }
    }) {
      server.middlewares.use((request, response, next) => {
        void handler(request, response).then((handled) => {
          if (!handled) {
            next()
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      rssProxyPlugin(),
      llamaDigestProxyPlugin({
        apiUrl: env.LLAMA_API_URL || 'http://127.0.0.1:11434/api/generate',
        model: env.LLAMA_MODEL || 'llama3.2',
      }),
    ],
  }
})

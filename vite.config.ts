import type { IncomingMessage, ServerResponse } from "node:http"
import { defineConfig } from "vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import babel from "@rolldown/plugin-babel"

function sendJson(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  body: Record<string, string>,
) {
  response.statusCode = statusCode
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.end(JSON.stringify(body))
}

function rssProxyPlugin() {
  const handler = async (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost")

    if (requestUrl.pathname !== "/api/rss") {
      return false
    }

    const targetUrl = requestUrl.searchParams.get("url")

    if (!targetUrl) {
      sendJson(response, 400, { error: "Missing url query parameter." })
      return true
    }

    try {
      const upstreamResponse = await fetch(targetUrl, {
        headers: {
          "user-agent": "Pulseboard RSS Proxy",
          accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
        },
      })

      if (!upstreamResponse.ok) {
        sendJson(response, upstreamResponse.status, {
          error: "Feed request failed with " + upstreamResponse.status + ".",
        })
        return true
      }

      const xml = await upstreamResponse.text()
      const contentType = upstreamResponse.headers.get("content-type") ?? "application/xml; charset=utf-8"

      response.statusCode = 200
      response.setHeader("Content-Type", contentType)
      response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600")
      response.end(xml)
      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected proxy error while loading the feed."

      sendJson(response, 502, { error: message })
      return true
    }
  }

  return {
    name: "rss-local-proxy",
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

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), rssProxyPlugin()],
})

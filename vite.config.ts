import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { handleLiveSearch } from './server/liveSearch.ts'
import { handleMcp } from './server/mcp.ts'
import { handleDiscoveryInterpret } from './server/discovery.ts'
import { handleRealtimeSession } from './server/realtimeSession.ts'

function liveSearchDevApi() {
  const bridge = (handler: (request: Request) => Promise<Response>) => async (request: any, response: any) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const requestHost = request.headers.host || 'localhost'
    const webRequest = new Request(`http://${requestHost}${request.originalUrl || request.url}`, {
      method: request.method,
      headers: request.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    })
    const webResponse = await handler(webRequest)
    response.statusCode = webResponse.status
    webResponse.headers.forEach((value, key) => response.setHeader(key, value))
    if (!webResponse.body) return response.end()
    const reader = webResponse.body.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      response.write(Buffer.from(value))
    }
    response.end()
  }
  return {
    name: 'co-cart-live-search-api',
    configureServer(server: { middlewares: { use: (path: string, handler: (request: any, response: any) => void) => void } }) {
      server.middlewares.use('/api/search', bridge(handleLiveSearch))
      server.middlewares.use('/api/discovery', bridge(handleDiscoveryInterpret))
      server.middlewares.use('/api/mcp', bridge(handleMcp))
      server.middlewares.use('/api/realtime-session', bridge(handleRealtimeSession))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), '')
  if (serverEnv.OPENAI_API_KEY) process.env.OPENAI_API_KEY = serverEnv.OPENAI_API_KEY
  if (serverEnv.OPENAI_MODEL) process.env.OPENAI_MODEL = serverEnv.OPENAI_MODEL
  if (serverEnv.OPENAI_REALTIME_MODEL) process.env.OPENAI_REALTIME_MODEL = serverEnv.OPENAI_REALTIME_MODEL
  if (serverEnv.COCART_REALTIME_RATE_LIMIT) process.env.COCART_REALTIME_RATE_LIMIT = serverEnv.COCART_REALTIME_RATE_LIMIT
  return {
    plugins: [liveSearchDevApi(), react(), tailwindcss()],
  }
})

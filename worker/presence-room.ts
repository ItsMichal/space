import { DurableObject } from 'cloudflare:workers'

/**
 * Stub presence room. Accepts WebSocket upgrades and echoes every message
 * to all OTHER sockets (Hibernation API). Another agent fleshes this out.
 */
export class PresenceRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(sender: WebSocket, message: string | ArrayBuffer) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== sender) {
        try {
          ws.send(message)
        } catch {
          /* socket closing */
        }
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason)
    } catch {
      /* already closed */
    }
  }
}

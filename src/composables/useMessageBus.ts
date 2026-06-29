import io from 'socket.io-client'

export function extractProps(msg: unknown): unknown {
  if (msg && typeof msg === 'object') {
    const m = msg as Record<string, unknown>
    if (m.Properties != null) return m.Properties
    if (m.properties != null) return m.properties
  }
  return msg
}

type Handler = (props: unknown, raw: unknown) => void

let socket: ReturnType<typeof io> | null = null
const listeners: Record<string, Set<Handler>> = {}
const bound = new Set<string>()

function dispatch(event: string, raw: unknown) {
  const set = listeners[event]
  if (!set) return
  const props = extractProps(raw)
  set.forEach((cb) => { try { cb(props, raw) } catch (e) { console.error('[messageBus]', event, e) } })
}

function ensureSocket() {
  if (!socket) {
    socket = io({ path: '/v2/message_bus/socket.io/', transports: ['websocket', 'polling'] })
    Object.keys(listeners).forEach(bind)
  }
  return socket
}

function bind(event: string) {
  if (socket && !bound.has(event)) {
    bound.add(event)
    socket.on(event, (raw: unknown) => dispatch(event, raw))
  }
}

export function useMessageBus() {
  return {
    on(event: string, cb: Handler): () => void {
      ;(listeners[event] || (listeners[event] = new Set())).add(cb)
      ensureSocket()
      bind(event)
      return () => { listeners[event]?.delete(cb) }
    },
  }
}

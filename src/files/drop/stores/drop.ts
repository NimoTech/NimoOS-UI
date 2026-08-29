// Engine↔UI single bridge: engine callbacks land here as reactive state; the engine module itself
// does not import Vue/Pinia.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { refreshAccessToken } from '@nimotech/nimoos-service'
import { ServerConnection } from '../serverConnection'
import { PeersManager } from '../peersManager'
import type { PeerInfo, ReceivedFile, ServerMessage, TransferBrokenReason } from '../protocol'
import { useToast } from '../../../stores/toast'
import { i18n } from '../../../i18n'

// `progress` is a rounded integer percent, for display. `raw` is the same value
// unrounded (0..1) -- the receiving side updates it on every 64 KB chunk, while
// `progress` can only change once per 1 % of the file, which on a big file over
// a slow link is minutes apart. Anything watching for liveness must use `raw`.
export interface TransferState { progress: number; raw: number; sending: boolean; count: number }

export const useDropStore = defineStore('drop', () => {
  const peers = ref<PeerInfo[]>([])
  const selfId = ref('')
  const selfName = ref<{ deviceName: string; displayName: string } | null>(null)
  const connected = ref(false)
  const transfers = ref<Record<string, TransferState>>({})
  const receiveQueue = ref<{ file: ReceivedFile; from: string }[]>([])
  const unreachable = ref<Set<string>>(new Set())

  let server: ServerConnection | null = null
  let manager: PeersManager | null = null
  let receivingCount: Record<string, number> = {} // "Will receive N" count reported via text message by peer
  // Devices the user aimed a send at. Gates the "cannot connect" message: a
  // dial the page made on its own is not something to interrupt the user
  // about (see onPeerUnreachable).
  let attempted = new Set<string>()
  const t = (key: string, arg?: Record<string, unknown>) =>
    arg ? i18n.global.t(key, arg) : i18n.global.t(key)

  function onVisibility() { if (!document.hidden) void server?.connect() }
  // Hard close tab/refresh fallback (spec §5): non-permanent disconnect, do not call destroy()
  // (see serverConnection.suspend comment) — pagehide also fires on bfcache navigation, and
  // onVisibility's reconnection path matches Vue2.
  function onPageHide() { server?.suspend() }

  function handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'peers':
        peers.value = msg.peers.slice()
        upsertSelf()
        break
      case 'peer-joined': {
        const idx = peers.value.findIndex((p) => p.id === msg.peer.id)
        if (idx === -1) peers.value.push(msg.peer)
        else peers.value[idx] = msg.peer
        break
      }
      case 'peer-left':
        peers.value = peers.value.filter((p) => p.id !== msg.peerId)
        delete transfers.value[msg.peerId]
        break
      case 'display-name':
        selfId.value = msg.message.id
        localStorage.setItem('peerid', msg.message.id) // same key as Vue2, same-device old/new pages keep consistent identity
        selfName.value = { deviceName: msg.message.deviceName, displayName: msg.message.displayName }
        upsertSelf(msg.message)
        break
      default: break
    }
    manager?.handleServerMessage(msg)
  }

  function upsertSelf(m?: { id: string; deviceName: string; displayName: string }) {
    if (!selfId.value && !m) return
    const id = m?.id ?? selfId.value
    const rest = peers.value.filter((p) => p.id !== id)
    const existing = peers.value.find((p) => p.id === id)
    const self: PeerInfo = existing ?? {
      id,
      name: { model: 'desktop', deviceName: m?.deviceName ?? selfName.value?.deviceName ?? '', displayName: m?.displayName ?? selfName.value?.displayName ?? '' },
      rtcSupported: true,
    }
    peers.value = [self, ...rest] // self pinned first, UI always has it at position 0
  }

  function init() {
    if (server) return // idempotency guard (P3b lesson: singleton store × component remount)
    server = new ServerConnection({
      getToken: () => localStorage.getItem('access_token'),
      getPeerId: () => localStorage.getItem('peerid') ?? '',
      getExpiresAt: () => {
        const raw = localStorage.getItem('expires_at')
        return raw != null && raw !== '' ? Number(raw) : null
      },
      refresh: refreshAccessToken,
      now: () => Date.now(),
      makeSocket: (u) => new WebSocket(u),
      wsBase: () => `${location.protocol.startsWith('https') ? 'wss:' : 'ws:'}//${location.host}`,
      onMessage: handleServerMessage,
      onConnectionChange: (c) => { connected.value = c },
      onReconnectScheduled: () => useToast().show(t('filesDropLost'), 3000),
    })
    manager = new PeersManager(server, {
      onFileProgress: (e) => {
        const sending = e.files.length > 0
        const count = sending ? e.filesQueue : (receivingCount[e.sender] ?? 1)
        if (e.progress >= 1) { delete transfers.value[e.sender]; return }
        transfers.value[e.sender] = { progress: Math.round(e.progress * 100), raw: e.progress, sending, count }
      },
      onFileReceived: (e) => { receiveQueue.value.push(e) },
      onTextReceived: (e) => { receivingCount[e.sender] = Number(e.text) || 1 },
      onTransferComplete: () => useToast().show(t('filesDropDone'), 3000),
      onPeerConnected: (peerId) => { unreachable.value.delete(peerId); attempted.delete(peerId) },
      // Signaling worked but the two devices could not open a direct
      // connection (blocked UDP between them, no TURN relay configured).
      // Latched per peer so a device we cannot reach does not repeat itself
      // on every reconnect.
      //
      // Only for a device the user actually aimed at. Opening the page dials
      // EVERY device the server lists, and that list can hold a session whose
      // page is long gone -- a phone swiped away without closing its socket
      // stays listed until the server's 90s heartbeat sweep. Toasting those
      // background failures told both devices "cannot connect" while files
      // were transferring perfectly well between them (2026-08-13 acceptance).
      onPeerUnreachable: (peerId) => {
        if (!attempted.has(peerId) || unreachable.value.has(peerId)) return
        unreachable.value.add(peerId)
        useToast().show(t('filesDropUnreachable'), 4000)
      },
      onTransferBroken: (e) => {
        delete transfers.value[e.peerId]
        // A transfer the user stopped themselves is not an interruption -- both
        // ends route through the same event, so the wording has to split here.
        // 'disconnected' / 'timeout' keep the interrupted wording.
        useToast().show(t(e.reason === 'cancelled' ? 'filesDropCancelled' : 'filesDropInterrupted'), 3000)
      },
    })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    void server.connect()
  }

  function destroy() {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    manager?.destroy(); manager = null
    server?.destroy(); server = null
    peers.value = []; transfers.value = {}; receiveQueue.value = []; unreachable.value = new Set()
    receivingCount = {}; attempted = new Set(); connected.value = false; selfId.value = ''; selfName.value = null
  }

  function sendFiles(peerId: string, files: File[]) {
    if (!files.length || !manager) return
    attempted.add(peerId)
    const result = manager.sendFiles(peerId, files, selfId.value)
    if (result === 'ok') return
    // 'not-ready' means a dial is now in flight -- tell the user to retry
    // instead of leaving the press with no effect at all.
    useToast().show(t(result === 'unsupported' ? 'filesDropUnsupported' : 'filesDropNotReady'), 3000)
  }

  function deviceName(peerId: string): string {
    return peers.value.find((p) => p.id === peerId)?.name.displayName ?? ''
  }

  function saveCurrent() {
    const head = receiveQueue.value[0]
    if (!head) return
    const url = URL.createObjectURL(head.file.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = head.file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    receiveQueue.value.shift()
  }

  function ignoreCurrent() { receiveQueue.value.shift() }

  function hasActiveTransfers(): boolean {
    return manager?.hasActiveTransfers() ?? false
  }

  // `reason` decides the toast wording: the stall watchdog passes 'timeout'
  // because nobody chose to stop, a menu click leaves it at the default.
  function cancelTransfer(peerId: string, reason?: TransferBrokenReason): void {
    manager?.cancelTransfer(peerId, reason)
  }

  return {
    peers, selfId, connected, transfers, receiveQueue, init, destroy, sendFiles,
    saveCurrent, ignoreCurrent, deviceName, hasActiveTransfers, cancelTransfer,
  }
})

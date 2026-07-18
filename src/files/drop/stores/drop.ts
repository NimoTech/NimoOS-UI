// 引擎↔UI 唯一桥:引擎回调在此落成响应式状态;引擎模块自身不 import Vue/Pinia。
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { refreshAccessToken } from '@nimotech/nimoos-service'
import { ServerConnection } from '../serverConnection'
import { PeersManager } from '../peersManager'
import type { PeerInfo, ReceivedFile, ServerMessage } from '../protocol'
import { useToast } from '../../../stores/toast'
import { i18n } from '../../../i18n'

export interface TransferState { progress: number; sending: boolean; count: number }

export const useDropStore = defineStore('drop', () => {
  const peers = ref<PeerInfo[]>([])
  const selfId = ref('')
  const connected = ref(false)
  const transfers = ref<Record<string, TransferState>>({})
  const receiveQueue = ref<{ file: ReceivedFile; from: string }[]>([])

  let server: ServerConnection | null = null
  let manager: PeersManager | null = null
  let receivingCount: Record<string, number> = {} // 对端 text 报的「将收 N 个」
  const t = (key: string, arg?: Record<string, unknown>) =>
    arg ? i18n.global.t(key, arg) : i18n.global.t(key)

  function onVisibility() { if (!document.hidden) void server?.connect() }

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
        localStorage.setItem('peerid', msg.message.id) // 与 Vue2 同键,同设备新旧页身份一致
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
      name: { model: 'desktop', deviceName: m?.deviceName ?? '', displayName: m?.displayName ?? '' },
      rtcSupported: true,
    }
    peers.value = [self, ...rest] // self 置顶,UI 恒在第一个位
  }

  function init() {
    if (server) return // 幂等守卫(P3b 教训:单例 store × 组件 remount)
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
        transfers.value[e.sender] = { progress: Math.round(e.progress * 100), sending, count }
      },
      onFileReceived: (e) => { receiveQueue.value.push(e) },
      onTextReceived: (e) => { receivingCount[e.sender] = Number(e.text) || 1 },
      onTransferComplete: () => useToast().show(t('filesDropDone'), 3000),
    })
    document.addEventListener('visibilitychange', onVisibility)
    void server.connect()
  }

  function destroy() {
    document.removeEventListener('visibilitychange', onVisibility)
    manager?.destroy(); manager = null
    server?.destroy(); server = null
    peers.value = []; transfers.value = {}; receiveQueue.value = []
    receivingCount = {}; connected.value = false
  }

  function sendFiles(peerId: string, files: File[]) {
    if (!files.length || !manager) return
    if (!manager.sendFiles(peerId, files, selfId.value)) {
      useToast().show(t('filesDropUnsupported'), 3000)
    }
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

  return { peers, selfId, connected, transfers, receiveQueue, init, destroy, sendFiles, saveCurrent, ignoreCurrent, deviceName }
})

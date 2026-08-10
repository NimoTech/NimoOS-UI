import { describe, it, expect, vi } from 'vitest'
import { PeersManager } from './peersManager'
import type { PeerEvents } from './rtcPeer'
import type { TransferBrokenReason } from './protocol'

function makeFakePeer(opts: { hasActiveTransfer?: () => boolean } = {}) {
  return {
    onServerMessage: vi.fn(), refresh: vi.fn(), close: vi.fn(),
    sendText: vi.fn(), sendFiles: vi.fn(), handleDisconnect: vi.fn(),
    hasActiveTransfer: opts.hasActiveTransfer ?? vi.fn(() => false),
    cancelTransfer: vi.fn(),
  }
}
const events: PeerEvents = {
  onFileProgress: vi.fn(), onFileReceived: vi.fn(), onTextReceived: vi.fn(),
  onTransferComplete: vi.fn(), onTransferBroken: vi.fn(),
}
const peerInfo = (id: string, rtc = true) => ({ id, name: { model: 'desktop', deviceName: 'd', displayName: 'D' }, rtcSupported: rtc })

describe('PeersManager', () => {
  it('peers 消息:RTC 双方支持才建 peer;已存在则 refresh;不支持 RTC 跳过', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => { const p = makeFakePeer(); made.push(p); return p as never },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a'), peerInfo('b', false)] })
    expect(made.length).toBe(1) // 只有 a
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    expect(made.length).toBe(1)
    expect(made[0].refresh).toHaveBeenCalledOnce()
  })
  it('signal:无 peer 先按被叫建(peerId=null),再转 onServerMessage', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, { makePeer: () => { const p = makeFakePeer(); made.push(p); return p as never } })
    const sig = { type: 'signal' as const, sender: 'x', sdp: { type: 'offer' as const, sdp: '' } }
    pm.handleServerMessage(sig)
    expect(made.length).toBe(1)
    expect(made[0].onServerMessage).toHaveBeenCalledWith(sig)
  })
  it('sendFiles:先发计数文本再发文件(Vue2 顺序);无 peer 返回 false', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, { rtcSupported: true, makePeer: () => { const p = makeFakePeer(); made.push(p); return p as never } })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    const files = [new File(['x'], 'x.txt')]
    expect(pm.sendFiles('a', files, 'self1')).toBe(true)
    expect(made[0].sendText).toHaveBeenCalledWith('1')
    expect(made[0].sendFiles).toHaveBeenCalledWith(files, 'self1')
    expect(pm.sendFiles('nope', files, 'self1')).toBe(false)
  })
  it('peer-left 关连接删表;destroy 全关', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, { rtcSupported: true, makePeer: () => { const p = makeFakePeer(); made.push(p); return p as never } })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a'), peerInfo('b')] })
    pm.handleServerMessage({ type: 'peer-left', peerId: 'a' })
    expect(made[0].close).toHaveBeenCalledOnce()
    pm.destroy()
    expect(made[1].close).toHaveBeenCalledOnce()
  })

  it('peer-left with an in-flight transfer reports onTransferBroken exactly once with reason disconnected', () => {
    const order: string[] = []
    const ev: PeerEvents = {
      onFileProgress: vi.fn(), onFileReceived: vi.fn(), onTextReceived: vi.fn(),
      onTransferComplete: vi.fn(), onTransferBroken: vi.fn(() => order.push('onTransferBroken')),
    }
    const pm = new PeersManager({ send: vi.fn() }, ev, {
      rtcSupported: true,
      makePeer: () => ({
        onServerMessage: vi.fn(), refresh: vi.fn(),
        close: vi.fn(() => order.push('close')),
        sendText: vi.fn(), sendFiles: vi.fn(),
        // Mirrors the real Peer.handleDisconnect's wasActive guard: only
        // report when something was actually in flight. handleDisconnect
        // must run while transfer state is still live -- if PeersManager
        // called close() first, the real Peer's own resetTransferState()
        // would make this peer look idle and the guard would suppress it.
        handleDisconnect: vi.fn((reason: TransferBrokenReason) => {
          order.push('handleDisconnect')
          ev.onTransferBroken({ peerId: 'a', reason })
        }),
      } as never),
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })

    pm.handleServerMessage({ type: 'peer-left', peerId: 'a' })

    expect(ev.onTransferBroken).toHaveBeenCalledOnce()
    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'a', reason: 'disconnected' })
    expect(order).toEqual(['handleDisconnect', 'onTransferBroken', 'close'])
  })

  it('peer-left for an idle peer reports nothing', () => {
    const ev: PeerEvents = {
      onFileProgress: vi.fn(), onFileReceived: vi.fn(), onTextReceived: vi.fn(),
      onTransferComplete: vi.fn(), onTransferBroken: vi.fn(),
    }
    const pm = new PeersManager({ send: vi.fn() }, ev, {
      rtcSupported: true,
      makePeer: () => ({
        onServerMessage: vi.fn(), refresh: vi.fn(), close: vi.fn(),
        sendText: vi.fn(), sendFiles: vi.fn(),
        // Idle: the real Peer's wasActive guard would suppress the report,
        // so this fake's handleDisconnect (like the real one when idle)
        // never calls onTransferBroken.
        handleDisconnect: vi.fn(),
      } as never),
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })

    pm.handleServerMessage({ type: 'peer-left', peerId: 'a' })

    expect(ev.onTransferBroken).not.toHaveBeenCalled()
  })
})

describe('PeersManager transfer control', () => {
  it('reports an active transfer when any peer has one', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => {
        const p = makeFakePeer({ hasActiveTransfer: () => made.length === 1 })
        made.push(p)
        return p as never
      },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    expect(pm.hasActiveTransfers()).toBe(true)
  })

  it('reports no active transfer when no peer has one', () => {
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => makeFakePeer() as never,
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    expect(pm.hasActiveTransfers()).toBe(false)
  })

  it('cancels only the peer it was asked about', () => {
    const made: Record<string, ReturnType<typeof makeFakePeer>> = {}
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: (_s, id) => {
        const p = makeFakePeer({ hasActiveTransfer: () => true })
        made[String(id)] = p
        return p as never
      },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a'), peerInfo('b')] })

    pm.cancelTransfer('b')

    expect(made.a.cancelTransfer).not.toHaveBeenCalled()
    expect(made.b.cancelTransfer).toHaveBeenCalledOnce()
  })

  it('ignores a cancel for a peer that is not connected', () => {
    const pm = new PeersManager({ send: vi.fn() }, events, { rtcSupported: true })
    expect(() => pm.cancelTransfer('nobody')).not.toThrow()
  })
})

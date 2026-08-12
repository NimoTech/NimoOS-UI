import { describe, it, expect, vi } from 'vitest'
import { PeersManager } from './peersManager'
import type { PeerEvents } from './rtcPeer'
import type { TransferBrokenReason } from './protocol'

function makeFakePeer(opts: { hasActiveTransfer?: () => boolean; hasOpenChannel?: () => boolean } = {}) {
  return {
    onServerMessage: vi.fn(), refresh: vi.fn(), close: vi.fn(),
    sendText: vi.fn(), sendFiles: vi.fn(), handleDisconnect: vi.fn(),
    hasActiveTransfer: opts.hasActiveTransfer ?? vi.fn(() => false),
    hasOpenChannel: opts.hasOpenChannel ?? vi.fn(() => false),
    cancelTransfer: vi.fn(),
  }
}
const events: PeerEvents = {
  onFileProgress: vi.fn(), onFileReceived: vi.fn(), onTextReceived: vi.fn(),
  onTransferComplete: vi.fn(), onTransferBroken: vi.fn(),
}
const peerInfo = (id: string, rtc = true) => ({ id, name: { model: 'desktop', deviceName: 'd', displayName: 'D' }, rtcSupported: rtc })

describe('PeersManager', () => {
  it('peers 消息:RTC 双方支持才建 peer;已存在且 channel 开着则只 refresh;不支持 RTC 跳过', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => { const p = makeFakePeer({ hasOpenChannel: () => true }); made.push(p); return p as never },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a'), peerInfo('b', false)] })
    expect(made.length).toBe(1) // 只有 a
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    expect(made.length).toBe(1)
    expect(made[0].refresh).toHaveBeenCalledOnce()
  })

  // 验收 bug #90 的根因回归测试:手机端信令 ws 断线重连后拿到新 'peers',
  // 手上却是上一轮当被叫留下的旧 peer(channel 已死)—— 旧逻辑 refresh() 只会
  // 被动等对方拨号,而对方(电脑)在 peer-left 时已删掉 peer 且 peer-joined 不建连,
  // 双方永远僵持。新逻辑:channel 没开的旧 peer 一律关掉,以主叫身份重建拨号。
  it('peers 消息:已存在但 channel 未打开 → 关旧 peer,重建为主叫拨号', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const madeIds: (string | null)[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: (_s, id) => { const p = makeFakePeer(); made.push(p); madeIds.push(id); return p as never },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    expect(made.length).toBe(2)
    expect(made[0].close).toHaveBeenCalledOnce()
    expect(made[0].refresh).not.toHaveBeenCalled()
    expect(madeIds[1]).toBe('a') // 传了 peerId ⇒ 主叫(被叫是 null)
    // 之后发文件走的是新 peer
    const files = [new File(['x'], 'x.txt')]
    expect(pm.sendFiles('a', files, 'self1')).toBe(true)
    expect(made[1].sendFiles).toHaveBeenCalledWith(files, 'self1')
    expect(made[0].sendFiles).not.toHaveBeenCalled()
  })

  it('signal 收到 offer:已有 peer 但 channel 未打开 → 换成全新被叫应答', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const madeIds: (string | null)[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: (_s, id) => { const p = makeFakePeer(); made.push(p); madeIds.push(id); return p as never },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] }) // 旧 peer,channel 未开
    const offer = { type: 'signal' as const, sender: 'a', sdp: { type: 'offer' as const, sdp: '' } }
    pm.handleServerMessage(offer)
    expect(made[0].close).toHaveBeenCalledOnce()
    expect(made.length).toBe(2)
    expect(madeIds[1]).toBe(null) // 被叫
    expect(made[1].onServerMessage).toHaveBeenCalledWith(offer)
    expect(made[0].onServerMessage).not.toHaveBeenCalled()
  })

  it('signal 收到 offer:channel 开着(重协商)或非 offer(ice)→ 交给现有 peer,不重建', () => {
    const open = makeFakePeer({ hasOpenChannel: () => true })
    const dead = makeFakePeer()
    const made = [open, dead]
    let i = 0
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => made[i++] as never,
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] }) // open channel peer
    const offer = { type: 'signal' as const, sender: 'a', sdp: { type: 'offer' as const, sdp: '' } }
    pm.handleServerMessage(offer)
    expect(open.close).not.toHaveBeenCalled()
    expect(open.onServerMessage).toHaveBeenCalledWith(offer)
    // 换一个 channel 没开的 manager:ice(无 sdp)也不触发重建
    i = 0
    const pm2 = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => made[i++] as never,
    })
    i = 1
    pm2.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] }) // dead channel peer
    const ice = { type: 'signal' as const, sender: 'a', ice: { candidate: '' } }
    pm2.handleServerMessage(ice)
    expect(dead.close).not.toHaveBeenCalled()
    expect(dead.onServerMessage).toHaveBeenCalledWith(ice)
  })

  // 信令层的 peer-left 不杀还开着的数据通道:手机锁屏/切后台时 ws 会断而 RTC 通道
  // 活着(Vue2 时代靠 _onPeerLeft 的 close 恒不生效"歪打正着"保住了它)。真离开的
  // 对端,通道自己会关,走 onChannelClosed 收尾。
  it('peer-left:channel 还开着 → 不 close 不删表,传输继续、还能继续发', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => { const p = makeFakePeer({ hasOpenChannel: () => true }); made.push(p); return p as never },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    pm.handleServerMessage({ type: 'peer-left', peerId: 'a' })
    expect(made[0].close).not.toHaveBeenCalled()
    expect(made[0].handleDisconnect).not.toHaveBeenCalled()
    expect(pm.sendFiles('a', [new File(['x'], 'x.txt')], 'self1')).toBe(true)
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
        hasOpenChannel: vi.fn(() => false),
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
        hasOpenChannel: vi.fn(() => false),
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

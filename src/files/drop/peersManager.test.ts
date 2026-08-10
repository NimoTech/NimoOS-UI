import { describe, it, expect, vi } from 'vitest'
import { PeersManager } from './peersManager'
import type { PeerEvents } from './rtcPeer'

function makeFakePeer() {
  return {
    onServerMessage: vi.fn(), refresh: vi.fn(), close: vi.fn(),
    sendText: vi.fn(), sendFiles: vi.fn(),
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
})

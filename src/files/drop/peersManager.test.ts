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
  it('peers message: creates peer only if both support RTC; if exists and channel is open, only refresh; skips if RTC not supported', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => { const p = makeFakePeer({ hasOpenChannel: () => true }); made.push(p); return p as never },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a'), peerInfo('b', false)] })
    expect(made.length).toBe(1) // only a
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    expect(made.length).toBe(1)
    expect(made[0].refresh).toHaveBeenCalledOnce()
  })

  // Regression test for bug #90 root cause: after phone-side signaling ws
  // reconnect, a new 'peers' msg arrives, but the old peer (channel dead)
  // remains from the last call-receiver role — old logic refresh() only waits
  // passively for the other side to dial, but that side (desktop) already
  // deleted the peer at peer-left and doesn't re-establish at peer-joined,
  // so both sides deadlock. New logic: close any stale peer with closed
  // channel, rebuild as caller.
  it('peers message: if exists but channel not open → close old peer, rebuild as caller', () => {
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
    expect(madeIds[1]).toBe('a') // peerId passed — caller (callee is null)
    // File send after this goes through new peer (after channel connected)
    made[1].hasOpenChannel = vi.fn(() => true)
    const files = [new File(['x'], 'x.txt')]
    expect(pm.sendFiles('a', files, 'self1')).toBe('ok')
    expect(made[1].sendFiles).toHaveBeenCalledWith(files, 'self1')
    expect(made[0].sendFiles).not.toHaveBeenCalled()
  })

  it('signal receives offer: if peer exists but channel not open → replace with fresh callee response', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const madeIds: (string | null)[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: (_s, id) => { const p = makeFakePeer(); made.push(p); madeIds.push(id); return p as never },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] }) // old peer, channel not open
    const offer = { type: 'signal' as const, sender: 'a', sdp: { type: 'offer' as const, sdp: '' } }
    pm.handleServerMessage(offer)
    expect(made[0].close).toHaveBeenCalledOnce()
    expect(made.length).toBe(2)
    expect(madeIds[1]).toBe(null) // callee
    expect(made[1].onServerMessage).toHaveBeenCalledWith(offer)
    expect(made[0].onServerMessage).not.toHaveBeenCalled()
  })

  it('signal receives offer: if channel open (renegotiation) or non-offer (ice) → pass to existing peer, do not rebuild', () => {
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
    // Switch to a manager with closed channel: ice (no sdp) also doesn't trigger rebuild
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

  // Signaling peer-left does not kill an open data channel: when phone locks
  // or goes to background, ws breaks but RTC channel stays alive (Vue2 era
  // kept it by accident because _onPeerLeft.close never worked). True
  // departure of peer — the channel closes itself, handled by onChannelClosed.
  it('peer-left: if channel still open → do not close, do not delete from table, transfers continue and can still send', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => { const p = makeFakePeer({ hasOpenChannel: () => true }); made.push(p); return p as never },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    pm.handleServerMessage({ type: 'peer-left', peerId: 'a' })
    expect(made[0].close).not.toHaveBeenCalled()
    expect(made[0].handleDisconnect).not.toHaveBeenCalled()
    expect(pm.sendFiles('a', [new File(['x'], 'x.txt')], 'self1')).toBe('ok')
  })
  // True root cause of #90 acceptance steps 7/8 (2026-08-13 dual-browser
  // probe test): after peer closes their tab, the local data channel keeps
  // reporting 'open' for tens of seconds in Chrome—hasOpenChannel() is not
  // proof that the peer is alive. When the peer reopens the same page with
  // the same peerId, old logic treats this offer as renegotiation and feeds
  // it to that zombie peer: the zombie's busy/filesQueue state stays, so
  // every send queues behind a transfer that never ends, peer gets zero
  // bytes, no error. Criterion: any offer arriving after a signaling session
  // change (peer-left or peer-joined) must be treated as a new page — close
  // the old peer (report disconnect first), rebuild as callee.
  it('signal receives offer: if peer signaling session restarted → rebuild even if channel reports open, report disconnect', () => {
    const order: string[] = []
    const ev: PeerEvents = {
      onFileProgress: vi.fn(), onFileReceived: vi.fn(), onTextReceived: vi.fn(),
      onTransferComplete: vi.fn(), onTransferBroken: vi.fn(() => order.push('onTransferBroken')),
    }
    const made: ReturnType<typeof makeFakePeer>[] = []
    const madeIds: (string | null)[] = []
    const pm = new PeersManager({ send: vi.fn() }, ev, {
      rtcSupported: true,
      makePeer: (_s, id) => {
        const p = makeFakePeer({ hasOpenChannel: () => made.length === 1 })
        p.close = vi.fn(() => order.push('close'))
        p.handleDisconnect = vi.fn((reason: TransferBrokenReason) => {
          order.push('handleDisconnect')
          ev.onTransferBroken({ peerId: 'a', reason })
        })
        made.push(p)
        madeIds.push(id)
        return p as never
      },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    // Peer closes tab: signaling layer knows immediately, but data channel
    // still reports open (so we don't kill it; phone lock screen relies on this)
    pm.handleServerMessage({ type: 'peer-left', peerId: 'a' })
    expect(made[0].close).not.toHaveBeenCalled()
    // Peer reopens the page with same peerId, dials again
    pm.handleServerMessage({ type: 'peer-joined', peer: peerInfo('a') })
    const offer = { type: 'signal' as const, sender: 'a', sdp: { type: 'offer' as const, sdp: '' } }
    pm.handleServerMessage(offer)

    expect(made.length).toBe(2)
    expect(madeIds[1]).toBe(null) // callee
    expect(made[1].onServerMessage).toHaveBeenCalledWith(offer)
    expect(made[0].onServerMessage).not.toHaveBeenCalled()
    // Dead transfer must report disconnect, before close() (close resets state to idle)
    expect(order).toEqual(['handleDisconnect', 'onTransferBroken', 'close'])
    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'a', reason: 'disconnected' })
    // Unlock proof: file send after rebuild uses new peer, no longer queues to zombie
    made[1].hasOpenChannel = vi.fn(() => true)
    const files = [new File(['x'], 'x.txt')]
    expect(pm.sendFiles('a', files, 'self1')).toBe('ok')
    expect(made[1].sendFiles).toHaveBeenCalledWith(files, 'self1')
    expect(made[0].sendFiles).not.toHaveBeenCalled()
  })

  it('signal: if no peer, build as callee first (peerId=null), then forward to onServerMessage', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, { makePeer: () => { const p = makeFakePeer(); made.push(p); return p as never } })
    const sig = { type: 'signal' as const, sender: 'x', sdp: { type: 'offer' as const, sdp: '' } }
    pm.handleServerMessage(sig)
    expect(made.length).toBe(1)
    expect(made[0].onServerMessage).toHaveBeenCalledWith(sig)
  })
  it('sendFiles: send count text first then files (Vue2 order); if no peer, dial and report not-ready', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, { rtcSupported: true, makePeer: () => { const p = makeFakePeer({ hasOpenChannel: () => true }); made.push(p); return p as never } })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    const files = [new File(['x'], 'x.txt')]
    expect(pm.sendFiles('a', files, 'self1')).toBe('ok')
    expect(made[0].sendText).toHaveBeenCalledWith('1')
    expect(made[0].sendFiles).toHaveBeenCalledWith(files, 'self1')
    expect(pm.sendFiles('nope', files, 'self1')).toBe('not-ready')
  })

  // Silent failure from today's (08-13) acceptance hits this path: peer
  // exists, channel not open, old code sends anyway, data goes to empty
  // channel, no feedback. Now must redial and report truthfully.
  it('sendFiles: if peer exists but channel not open → redial and report not-ready, do not dump data to empty channel', () => {
    const made: ReturnType<typeof makeFakePeer>[] = []
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => { const p = makeFakePeer(); made.push(p); return p as never },
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    expect(pm.sendFiles('a', [new File(['x'], 'x.txt')], 'self1')).toBe('not-ready')
    expect(made[0].refresh).toHaveBeenCalledOnce()
    expect(made[0].sendFiles).not.toHaveBeenCalled()
    expect(made[0].sendText).not.toHaveBeenCalled()
  })

  it('sendFiles: if server reports peer does not support RTC → unsupported (distinguish from not-ready)', () => {
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: true,
      makePeer: () => makeFakePeer() as never,
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a', false)] })
    expect(pm.sendFiles('a', [new File(['x'], 'x.txt')], 'self1')).toBe('unsupported')
    // peer-joined must also record rtcSupported (often arrives first after reconnect)
    pm.handleServerMessage({ type: 'peer-joined', peer: peerInfo('c', false) })
    expect(pm.sendFiles('c', [new File(['x'], 'x.txt')], 'self1')).toBe('unsupported')
  })

  it('sendFiles: if local does not support RTC → unsupported', () => {
    const pm = new PeersManager({ send: vi.fn() }, events, {
      rtcSupported: false,
      makePeer: () => makeFakePeer() as never,
    })
    pm.handleServerMessage({ type: 'peers', peers: [peerInfo('a')] })
    expect(pm.sendFiles('a', [new File(['x'], 'x.txt')], 'self1')).toBe('unsupported')
  })
  it('peer-left closes connection and removes from table; destroy closes all', () => {
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

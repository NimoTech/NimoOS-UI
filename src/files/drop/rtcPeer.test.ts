import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Peer, RTCPeer, type PeerEvents } from './rtcPeer'
import { encodeText, ACK_TIMEOUT_MS, type TransferBrokenReason } from './protocol'

// 测试用子类:捕获 sendRaw,免 WebRTC
class TestPeer extends Peer {
  out: (string | ArrayBuffer)[] = []
  protected sendRaw(d: string | ArrayBuffer) { this.out.push(d) }
}
function makeEvents(): PeerEvents {
  return {
    onFileProgress: vi.fn(), onFileReceived: vi.fn(), onTextReceived: vi.fn(),
    onTransferComplete: vi.fn(), onTransferBroken: vi.fn(),
  }
}
const jsonOut = (p: TestPeer) => p.out.filter((x): x is string => typeof x === 'string').map((s) => JSON.parse(s))

describe('Peer 传输状态机(wire 形状=Vue2)', () => {
  it('sendFiles 先发 header{name,mime,size,from},分区末发 partition;收 partition-received 续下一分区', async () => {
    const p = new TestPeer({ send: vi.fn() }, 'peer2', makeEvents())
    const file = new File([new Uint8Array(70000)], 'a.bin', { type: 'application/x-test' })
    p.sendFiles([file], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))
    const header = jsonOut(p).find((m) => m.type === 'header')
    expect(header).toEqual({ type: 'header', name: 'a.bin', mime: 'application/x-test', size: 70000, from: 'self1' })
    expect(p.out.filter((x) => typeof x !== 'string').length).toBe(2) // 64000+6000 两块
  })
  it('接收:header→二进制块→组装回调 onFileReceived + 回发 transfer-complete;进度按 ≥1% 阈值回发', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'b.bin', mime: '', size: 8, from: 'peer2' }))
    p.handleChannelMessage(new Uint8Array(8).buffer)
    expect(ev.onFileReceived).toHaveBeenCalledOnce()
    const received = (ev.onFileReceived as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(received.from).toBe('peer2')
    expect(received.file.blob.size).toBe(8)
    expect(jsonOut(p).some((m) => m.type === 'transfer-complete')).toBe(true)
    expect(ev.onFileProgress).toHaveBeenCalled() // 接收侧进度上报给 UI
  })
  it('收 transfer-complete:busy 复位、出队下一个、onTransferComplete', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    const f = (n: string) => new File([new Uint8Array(10)], n)
    p.sendFiles([f('1'), f('2')], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(1))
    p.handleChannelMessage(JSON.stringify({ type: 'transfer-complete' }))
    expect(ev.onTransferComplete).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(2)) // 第二个文件开始
  })
  it('sendText base64;收 text 解码回调', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.sendText('2')
    expect(jsonOut(p)).toContainEqual({ type: 'text', text: encodeText('2') })
    p.handleChannelMessage(JSON.stringify({ type: 'text', text: encodeText('中文') }))
    expect(ev.onTextReceived).toHaveBeenCalledWith({ text: '中文', sender: 'peer2' })
  })
})

describe('Peer disconnect handling', () => {
  it('reports a broken transfer and unblocks the queue when the peer goes away mid-send', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    const f = (n: string) => new File([new Uint8Array(10)], n)
    p.sendFiles([f('1')], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(1))

    p.handleDisconnect('disconnected')

    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'disconnected' })
    expect(p.hasActiveTransfer()).toBe(false)
  })

  it('accepts a brand new send after a disconnect, instead of staying wedged forever', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    const f = (n: string) => new File([new Uint8Array(10)], n)
    p.sendFiles([f('first')], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(1))
    p.handleDisconnect('disconnected')

    p.sendFiles([f('second')], 'self1')

    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(2))
    const headers = jsonOut(p).filter((m) => m.type === 'header')
    expect(headers[1].name).toBe('second')
  })

  it('drops the half-assembled incoming file so a later transfer does not inherit its bytes', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'x.bin', mime: '', size: 16, from: 'peer2' }))
    p.handleChannelMessage(new Uint8Array(8).buffer)
    expect(p.hasActiveTransfer()).toBe(true)

    p.handleDisconnect('disconnected')

    expect(p.hasActiveTransfer()).toBe(false)
    p.handleChannelMessage(new Uint8Array(8).buffer)
    expect(ev.onFileReceived).not.toHaveBeenCalled()
  })

  it('stays silent when nothing was in flight, so idle reconnects do not nag the user', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.handleDisconnect('disconnected')
    expect(ev.onTransferBroken).not.toHaveBeenCalled()
  })

  it('a completed receive does not leave the peer looking active, so a later idle disconnect stays silent', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'b.bin', mime: '', size: 8, from: 'peer2' }))
    p.handleChannelMessage(new Uint8Array(8).buffer)
    expect(ev.onFileReceived).toHaveBeenCalledOnce()

    expect(p.hasActiveTransfer()).toBe(false)

    p.handleDisconnect('disconnected')

    expect(ev.onTransferBroken).not.toHaveBeenCalled()
  })

  it('does not leak stale chunks from an aborted send into the next transfer', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    const big = new File([new Uint8Array(200000)], 'big.bin')
    p.sendFiles([big], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(1))

    p.handleDisconnect('disconnected')
    const small = new File([new Uint8Array(10)], 'small.bin')
    p.sendFiles([small], 'self1')

    // Wait for the small file's own transfer to finish, then give any stale
    // reads from the aborted big-file chunker a chance to leak in if the
    // abort didn't actually stop them.
    await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition' && m.offset === 10)).toBe(true))
    await new Promise((resolve) => setTimeout(resolve, 50))

    const smallHeaderIndex = p.out.findIndex(
      (m) => typeof m === 'string' && (JSON.parse(m) as { type: string; name?: string }).name === 'small.bin',
    )
    const framesAfterSmallHeader = p.out.slice(smallHeaderIndex + 1)
    const binaryFramesAfter = framesAfterSmallHeader.filter((f): f is ArrayBuffer => typeof f !== 'string')
    // The small file is a single 10-byte chunk -- any other binary frame
    // arriving after its header is a stale chunk from the big file.
    expect(binaryFramesAfter).toEqual([expect.any(ArrayBuffer)])
    expect(binaryFramesAfter[0].byteLength).toBe(10)
  })
})

describe('RTCPeer disconnect branches', () => {
  class FakeConn {
    connectionState = 'new'
    onicecandidate: unknown = null
    onconnectionstatechange: unknown = null
    ondatachannel: unknown = null
    createDataChannel() { return { send: vi.fn(), close: vi.fn(), readyState: 'connecting' } }
    createOffer() { return Promise.resolve({ type: 'offer', sdp: '' }) }
    setLocalDescription() { return Promise.resolve() }
    setRemoteDescription() { return Promise.resolve() }
    addIceCandidate() { return Promise.resolve() }
    close() {}
  }

  beforeEach(() => { vi.stubGlobal('RTCPeerConnection', FakeConn) })
  afterEach(() => { vi.unstubAllGlobals() })

  function makeRtcPeer(ev: PeerEvents) {
    // A null peerId skips the constructor's connectRtc() -- this is the real
    // "callee waits for the caller to dial" path, not a test-only backdoor.
    const p = new RTCPeer({ send: vi.fn() }, null, ev)
    ;(p as unknown as { _peerId: string })._peerId = 'peer2'
    return p
  }

  function startIncoming(p: RTCPeer) {
    // Deliberately far short of `size` (8 / 10000 bytes) and below
    // PROGRESS_NOTIFY_STEP (1%), so the partial chunk does not itself trigger
    // a `progress` message back out through sendRaw. With a null channel,
    // that outbound message would call handleDisconnect from inside this
    // helper, making every test below pass regardless of the branch it
    // claims to exercise -- caught by the Step 5 mutation check.
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'x.bin', mime: '', size: 10000, from: 'peer2' }))
    p.handleChannelMessage(new Uint8Array(8).buffer)
  }

  it('reports a disconnect when the data channel closes on the receiving side', () => {
    const ev = makeEvents()
    const p = makeRtcPeer(ev)
    startIncoming(p)

    ;(p as unknown as { onChannelClosed: () => void }).onChannelClosed()

    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'disconnected' })
  })

  it('reports a disconnect when the connection reaches the closed state', () => {
    const ev = makeEvents()
    const p = makeRtcPeer(ev)
    startIncoming(p)
    const inner = (p as unknown as { conn: FakeConn | null })
    inner.conn = new FakeConn()
    inner.conn.connectionState = 'closed'

    ;(p as unknown as { onConnectionStateChange: () => void }).onConnectionStateChange()

    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'disconnected' })
  })

  it('rides out a transient ICE disconnected state without touching the incoming file', () => {
    // 'disconnected' is not a termination: Chrome enters it after a few seconds
    // of failed consent checks and routinely returns to 'connected' (Wi-Fi roam,
    // interface flap) with the data channel intact. Reporting here threw away a
    // receiver's half-assembled multi-GB file over a two-second blip.
    const ev = makeEvents()
    const p = makeRtcPeer(ev)
    startIncoming(p)
    const inner = (p as unknown as { conn: FakeConn | null })
    inner.conn = new FakeConn()
    inner.conn.connectionState = 'disconnected'

    ;(p as unknown as { onConnectionStateChange: () => void }).onConnectionStateChange()

    expect(ev.onTransferBroken).not.toHaveBeenCalled()
    expect(p.hasActiveTransfer()).toBe(true) // digester still holding the bytes
  })

  it('reports through the data channel own onclose handler, not only the private method', () => {
    // The wiring, not just the callback: onChannelOpened is what installs
    // onclose, and a channel that really closes is a real termination.
    const ev = makeEvents()
    const p = makeRtcPeer(ev)
    startIncoming(p)
    const channel = { binaryType: '', onmessage: null, onclose: null as null | (() => void) }
    ;(p as unknown as { onChannelOpened: (c: unknown) => void }).onChannelOpened(channel)

    channel.onclose!()

    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'disconnected' })
  })

  it('replaces the connection when it reaches the closed state, so the re-dial can open a channel', () => {
    // 'failed' already nulled conn; 'closed' did not, and connectRtc() only
    // builds a new RTCPeerConnection when conn is null -- so the caller re-dialled
    // on the dead object and createDataChannel would throw on a real one.
    const ev = makeEvents()
    const p = new RTCPeer({ send: vi.fn() }, 'peer2', ev) // non-null peerId => caller
    const inner = (p as unknown as { conn: FakeConn | null })
    const original = inner.conn
    expect(original).not.toBeNull()
    original!.connectionState = 'closed'

    ;(p as unknown as { onConnectionStateChange: () => void }).onConnectionStateChange()

    expect(inner.conn).not.toBeNull()
    expect(inner.conn).not.toBe(original)
  })

  it('reports the cancellation once even when the channel is already gone', () => {
    // The real RTCPeer.sendRaw, with channel === null, routes into
    // handleDisconnect('disconnected') -- which reports and resets by itself. If
    // the cancel message goes out before this transfer is reset, that report
    // fires first and cancelTransfer's own report follows: two "transfer broken"
    // toasts from one click on Cancel.
    const ev = makeEvents()
    const p = makeRtcPeer(ev)
    startIncoming(p)
    expect((p as unknown as { channel: unknown }).channel).toBeNull()

    p.cancelTransfer()

    expect(ev.onTransferBroken).toHaveBeenCalledTimes(1)
    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'cancelled' })
  })

  it('reports a disconnect when a chunk cannot be sent because the channel is gone', () => {
    const ev = makeEvents()
    const p = makeRtcPeer(ev)
    startIncoming(p) // makes hasActiveTransfer() true so the report is not suppressed
    expect((p as unknown as { channel: unknown }).channel).toBeNull()

    ;(p as unknown as { sendRaw: (d: string) => void }).sendRaw('anything')

    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'disconnected' })
  })
})

describe('Peer send-side timeouts', () => {
  it('gives up on a partition acknowledgement that never comes, and unblocks the queue', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(70000)], 'a.bin')
      p.sendFiles([file], 'self1')
      // FileReader is async even under fake timers; drain the microtask/macro
      // queue until the first partition marker has gone out.
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'timeout' })
      expect(p.hasActiveTransfer()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire once the acknowledgement arrives in time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      // Must span two partitions (MAX_PARTITION_SIZE = 1e6): a file that fits
      // in a single partition makes the only 'partition-received' the FINAL
      // one, which by design re-arms the timer to wait for transfer-complete
      // -- that would make this fixture indistinguishable from the "arms the
      // final wait" test below. Acking both partitions plus transfer-complete
      // is what "arrives in time" actually means end to end.
      const file = new File([new Uint8Array(1100000)], 'a.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'partition').length).toBe(1))
      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 1024000 }))

      await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'partition').length).toBe(2))
      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 1100000 }))
      p.handleChannelMessage(JSON.stringify({ type: 'transfer-complete' }))

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('arms the same timeout while waiting for the final transfer-complete', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(10)], 'small.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))
      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 10 }))

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'timeout' })
    } finally {
      vi.useRealTimers()
    }
  })

  // ── The real end-of-file wire order ──────────────────────────────────────
  // The two tests below used to feed `partition-received` BEFORE
  // `transfer-complete`, an order the protocol cannot produce: the receiver
  // completes on the last *chunk* and only then reads the trailing `partition`
  // message, so over an ordered channel `transfer-complete` always goes out
  // first and the final ack trails it. Fed the impossible order, both tests
  // passed against code that leaked a 30s timer onto every successful send --
  // they certified the bug they were written to catch. They now use the real
  // order.
  it('clears the timer on transfer-complete so a finished send never reports a timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(10)], 'small.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))
      p.handleChannelMessage(JSON.stringify({ type: 'transfer-complete' }))
      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 10 }))

      // Check the timer handle directly, not just the absence of a report:
      // onTransferCompleted() already sets busy=false, so a leaked timer
      // firing later would find hasActiveTransfer() false and get swallowed
      // by the wasActive guard in handleDisconnect -- silently, with no
      // onTransferBroken call either way. That would make this test pass
      // whether or not the timer was actually cleared. The real danger is a
      // stale native timeout handle: it is NOT cancelled just because
      // `ackTimer` gets reassigned later (armAck() clears the old handle
      // first, but only if something calls arm/clear again before the
      // handle's own deadline). It survives untouched until the next arm or
      // clear call, and fires on its own 30s later if nothing ever makes
      // one. The test right after this one shows what that firing can do to
      // an unrelated later transfer.
      expect((p as unknown as { ackTimer: unknown }).ackTimer).toBeNull()
      // Postcondition of the other half of the fix: a completed send releases
      // its chunker, so nothing that arrives later can be mistaken for that
      // send still being in flight.
      expect((p as unknown as { chunker: unknown }).chunker).toBeNull()

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a timer surviving transfer-complete cannot kill a later unrelated incoming transfer to the same peer', async () => {
    // Observable-behaviour companion to the internal-state check above: even
    // without reaching into `ackTimer`, a leaked timer's real-world damage is
    // visible here. The receive path never touches ackTimer, so a stray timer
    // from a completed send would misfire straight into an in-flight receive.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(10)], 'small.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))
      p.handleChannelMessage(JSON.stringify({ type: 'transfer-complete' }))
      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 10 }))

      // A healthy, unrelated incoming transfer starts afterwards and is
      // still in flight (well short of size and below PROGRESS_NOTIFY_STEP,
      // so it doesn't itself send anything back out) when the timer's
      // original deadline would have arrived.
      p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'x.bin', mime: '', size: 10000, from: 'peer2' }))
      p.handleChannelMessage(new Uint8Array(8).buffer)
      expect(p.hasActiveTransfer()).toBe(true)

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).not.toHaveBeenCalled()
      expect(p.hasActiveTransfer()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not let a finished file\'s trailing acknowledgement derail the next file in the queue', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    const first = new File([new Uint8Array(10)], 'first.bin')
    // Spans two partitions so it is still mid-read when the stale ack lands.
    const second = new File([new Uint8Array(1100000)], 'second.bin')
    p.sendFiles([first, second], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition' && m.offset === 10)).toBe(true))

    // Both messages arrive in the same batch of channel.onmessage callbacks, so
    // no await in between: transfer-complete synchronously dequeues second.bin
    // and starts its first FileReader read, and the trailing ack for first.bin
    // then lands with that read still in flight.
    p.handleChannelMessage(JSON.stringify({ type: 'transfer-complete' }))
    expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(2)
    expect(() =>
      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 10 })),
    ).not.toThrow() // pre-fix: nextPartition() on a reading FileReader -> InvalidStateError

    // second.bin keeps its own flow control: 16 x 64000 = 1024000 >= 1 MB.
    await vi.waitFor(() =>
      expect(jsonOut(p).some((m) => m.type === 'partition' && m.offset === 1024000)).toBe(true),
    )
  })

  it('cancels the previous partition timer the moment its acknowledgement arrives', async () => {
    // The leading clearAck() in the partition-received branch is what does
    // this. Without it the previous partition's 30s handle stays live for the
    // whole of the next partition's read; armAck() only replaces it once that
    // read ends, so a read slower than the timeout would kill a healthy send.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(1100000)], 'a.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'partition').length).toBe(1))
      expect((p as unknown as { ackTimer: unknown }).ackTimer).not.toBeNull()

      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 1024000 }))

      // Synchronously after the ack the next partition's read has only just
      // started, so nothing has re-armed yet -- any handle still sitting here
      // is the previous partition's.
      expect((p as unknown as { ackTimer: unknown }).ackTimer).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores a stray partition-received while idle, so it cannot arm a timer that later kills an unrelated incoming transfer', () => {
    // Two real routes reach this: a stray/duplicate ack arriving after a
    // reset-plus-re-dial, or chunker.abort() racing an in-flight
    // onPartitionEnd. Either way, chunker is null when the ack lands.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)

      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 0 }))

      // A healthy, unrelated incoming transfer starts and is still in flight.
      p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'x.bin', mime: '', size: 10000, from: 'peer2' }))
      p.handleChannelMessage(new Uint8Array(8).buffer)
      expect(p.hasActiveTransfer()).toBe(true)

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).not.toHaveBeenCalled()
      expect(p.hasActiveTransfer()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Peer cancellation', () => {
  it('tells the peer, clears local state, and reports the cancellation', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.sendFiles([new File([new Uint8Array(10)], 'x')], 'self1')
    await vi.waitFor(() => expect(p.hasActiveTransfer()).toBe(true))

    p.cancelTransfer()

    expect(jsonOut(p).some((m) => m.type === 'transfer-cancel')).toBe(true)
    expect(p.hasActiveTransfer()).toBe(false)
    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'cancelled' })
  })

  it('can report the stop under a different reason while sending the same message', async () => {
    // The stall watchdog stops a transfer through this same method, but nobody
    // chose to stop it -- so it must not be reported as a user cancellation. The
    // peer on the other end still gets the identical transfer-cancel.
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.sendFiles([new File([new Uint8Array(10)], 'x')], 'self1')
    await vi.waitFor(() => expect(p.hasActiveTransfer()).toBe(true))

    p.cancelTransfer('timeout')

    expect(jsonOut(p).some((m) => m.type === 'transfer-cancel')).toBe(true)
    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'timeout' })
  })

  it('does nothing at all when there is no transfer to cancel', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.cancelTransfer()
    expect(p.out.length).toBe(0)
    expect(ev.onTransferBroken).not.toHaveBeenCalled()
  })

  it('discards the partly received file when the sender cancels', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'x.bin', mime: '', size: 16, from: 'peer2' }))
    p.handleChannelMessage(new Uint8Array(8).buffer)

    p.handleChannelMessage(JSON.stringify({ type: 'transfer-cancel' }))

    expect(p.hasActiveTransfer()).toBe(false)
    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'cancelled' })
    p.handleChannelMessage(new Uint8Array(8).buffer)
    expect(ev.onFileReceived).not.toHaveBeenCalled()
  })

  it('ignores a stray transfer-cancel while idle, so it cannot report a broken transfer that never existed on this side', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)

    p.handleChannelMessage(JSON.stringify({ type: 'transfer-cancel' }))

    expect(ev.onTransferBroken).not.toHaveBeenCalled()
    expect(p.hasActiveTransfer()).toBe(false)
  })
})

describe('RTCPeer close() resets transfer state', () => {
  class FakeConn {
    connectionState = 'new'
    onicecandidate: unknown = null
    onconnectionstatechange: unknown = null
    ondatachannel: unknown = null
    createDataChannel() { return { send: vi.fn(), close: vi.fn(), readyState: 'connecting' } }
    createOffer() { return Promise.resolve({ type: 'offer', sdp: '' }) }
    setLocalDescription() { return Promise.resolve() }
    setRemoteDescription() { return Promise.resolve() }
    addIceCandidate() { return Promise.resolve() }
    close() {}
  }
  class TestRTCPeer extends RTCPeer {
    out: (string | ArrayBuffer)[] = []
    protected sendRaw(d: string | ArrayBuffer) { this.out.push(d) }
  }

  beforeEach(() => { vi.stubGlobal('RTCPeerConnection', FakeConn) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('clears an in-flight ack timer, so leaving the page never reports a broken transfer 30s later', async () => {
    // RTCPeerConnection.close() does not fire connectionstatechange, so
    // nothing else routes into the disconnect trunk -- close() itself has to
    // do the reset, or the timer armed by the send in progress outlives the
    // page.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestRTCPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(10)], 'small.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() =>
        expect(p.out.some((m) => typeof m === 'string' && (JSON.parse(m) as { type: string }).type === 'partition')).toBe(true),
      )

      p.close()

      // Positive postconditions, not only "nobody complained": the absence of a
      // report is also what a peer that never armed anything looks like, so
      // assert the state close() is responsible for.
      expect((p as unknown as { ackTimer: unknown }).ackTimer).toBeNull()
      expect(p.hasActiveTransfer()).toBe(false)

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

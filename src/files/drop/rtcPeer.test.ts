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

  it('clears the timer on transfer-complete so a finished send never reports a timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(10)], 'small.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))
      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 10 }))
      p.handleChannelMessage(JSON.stringify({ type: 'transfer-complete' }))

      // Check the timer handle directly, not just the absence of a report:
      // onTransferCompleted() already sets busy=false, so a leaked timer
      // firing later would find hasActiveTransfer() false and get swallowed
      // by the wasActive guard in handleDisconnect -- silently, with no
      // onTransferBroken call either way. That would make this test pass
      // whether or not the timer was actually cleared. The real danger is a
      // stale native timeout still pending underneath: it survives
      // reassigning `ackTimer` and can misfire mid-flight against whatever
      // transfer to this peer happens to be active 30s later.
      expect((p as unknown as { ackTimer: unknown }).ackTimer).toBeNull()

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

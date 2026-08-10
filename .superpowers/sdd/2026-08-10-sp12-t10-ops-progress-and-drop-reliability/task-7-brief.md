### Task 7: 通道关闭 / 连接失败 / 无通道发送 三条路径接上断连主干

**Files:**
- Modify: `src/files/drop/rtcPeer.ts`, `src/files/drop/rtcPeer.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `handleDisconnect`

**现状缺口**:`onChannelClosed()` 对**非主叫直接 `return`**(接收端断连完全静默);`onConnectionStateChange` 只认 `disconnected`/`failed`,漏 `closed`;`sendRaw` 无通道时**静默丢掉这一片数据**再 `refresh()`,传输就此停住且无人知情。

- [ ] **Step 1: 写失败测试(追加)**

⚠️ 先把测试文件顶部的 import 补齐 —— 现在只 import 了 `Peer` 和 `PeerEvents`:

```ts
import { Peer, RTCPeer, type PeerEvents } from './rtcPeer'
import { encodeText, type TransferBrokenReason } from './protocol'
```

这三条分支都在 `RTCPeer` 上,必须真的走到那些分支才算数 —— **不要用「直接调 `handleDisconnect()`」冒充**,那只是重测了 Task 6,测试名会说谎。

`RTCPeer` 的构造与 `refresh()` 都会 `new RTCPeerConnection(...)`,而 jsdom 没有这个全局,所以先备一个最小替身:

```ts
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
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'x.bin', mime: '', size: 16, from: 'peer2' }))
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
```

⚠️ 最后一条会顺带走进 `refresh()` → `connectRtc()`,这就是上面必须备 `FakeConn` 的原因。**若它因为替身缺方法而报错,补替身,不要改生产代码去迁就测试。**

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`
Expected: 「reports a disconnect when the data channel closes on the receiving side」FAIL —— 现在接收端会静默 return

- [ ] **Step 3: 写实现**

`RTCPeer` 里改三处:

```ts
  private onChannelClosed(): void {
    // Both roles must surface the break; only the caller re-dials. The old
    // code returned early for the callee, which meant a receiver whose sender
    // vanished got no signal at all.
    this.handleDisconnect('disconnected')
    if (!this.isCaller) return
    this.connectRtc(this._peerId, true)
  }

  private onConnectionStateChange(): void {
    if (!this.conn) return
    switch (this.conn.connectionState) {
      case 'disconnected': this.onChannelClosed(); break
      case 'closed': this.onChannelClosed(); break
      case 'failed': this.conn = null; this.onChannelClosed(); break
    }
  }

  protected sendRaw(data: string | ArrayBuffer): void {
    if (!this.channel) {
      // Previously this dropped the chunk and called refresh(), so the
      // transfer stalled with nobody told. Treat a missing channel as what it
      // is -- the transfer cannot continue.
      this.handleDisconnect('disconnected')
      this.refresh()
      return
    }
    // TS's send overloads do not accept the union, so dispatch on the runtime type
    if (typeof data === 'string') this.channel.send(data)
    else this.channel.send(data)
  }
```

⚠️ `onChannelClosed` 必须从 `private` 改成 `protected`(测试要调它),或在测试里用 `as unknown as` 断言访问 —— **选后者,不要为了测试放宽生产代码的可见性**。上面的测试代码已按后者写好。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `onChannelClosed` 里 `handleDisconnect` 那行挪回 `if (!this.isCaller) return` **之后**,重跑 → 接收端那条必须真红。恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/rtcPeer.ts src/files/drop/rtcPeer.test.ts
git commit -m "fix(drop): stop swallowing disconnects on the receiving side

The callee returned early from onChannelClosed, so a receiver whose sender
vanished was never told. A missing channel in sendRaw dropped the chunk just
as quietly. Both now report; the caller still re-dials.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---


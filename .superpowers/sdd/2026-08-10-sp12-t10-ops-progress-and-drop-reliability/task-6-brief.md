### Task 6: 断连主干 —— `onTransferBroken` + 传输态复位

**Files:**
- Modify: `src/files/drop/rtcPeer.ts`, `src/files/drop/rtcPeer.test.ts`
- Modify: `src/files/drop/stores/drop.ts`(补上新回调,否则类型不过)

**Interfaces:**
- Produces: `PeerEvents.onTransferBroken(e: { peerId: string; reason: TransferBrokenReason }): void` · `type TransferBrokenReason = 'disconnected' | 'timeout' | 'cancelled'` · `Peer.hasActiveTransfer(): boolean` · `Peer.handleDisconnect(reason: TransferBrokenReason): void`

**这是 Part B 的地基**,后面三个任务都调 `handleDisconnect`。

- [ ] **Step 1: 写失败测试(追加到 `rtcPeer.test.ts`)**

```ts
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
})
```

⚠️ 同时把文件顶部的 `makeEvents()` 补上新回调:

```ts
function makeEvents(): PeerEvents {
  return {
    onFileProgress: vi.fn(), onFileReceived: vi.fn(), onTextReceived: vi.fn(),
    onTransferComplete: vi.fn(), onTransferBroken: vi.fn(),
  }
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`
Expected: FAIL —— `p.handleDisconnect is not a function`

- [ ] **Step 3: 写实现**

`src/files/drop/protocol.ts` 加类型(放在 `ChannelMessage` 定义下方):

```ts
export type TransferBrokenReason = 'disconnected' | 'timeout' | 'cancelled'
```

`src/files/drop/rtcPeer.ts`:

```ts
import { ..., type TransferBrokenReason } from './protocol'

export interface PeerEvents {
  onFileProgress: (e: { sender: string; progress: number; filesQueue: number; files: File[] }) => void
  onFileReceived: (e: { file: ReceivedFile; from: string }) => void
  onTextReceived: (e: { text: string; sender: string }) => void
  onTransferComplete: () => void
  onTransferBroken: (e: { peerId: string; reason: TransferBrokenReason }) => void
}
```

在 `Peer` 类里加:

```ts
  /** True while this peer is sending or assembling something. */
  hasActiveTransfer(): boolean {
    return this.busy || this.digester !== null
  }

  /**
   * The single place a transfer dies. Resets the peer so the next send starts
   * clean, then tells the UI -- but only when something was actually in
   * flight. Channels close routinely during idle reconnects; reporting those
   * would train the user to ignore the message that matters.
   */
  handleDisconnect(reason: TransferBrokenReason): void {
    const wasActive = this.hasActiveTransfer()
    this.resetTransferState()
    if (wasActive) this.events.onTransferBroken({ peerId: this._peerId, reason })
  }

  protected resetTransferState(): void {
    this.busy = false
    this.chunker = null
    this.digester = null
    this.filesQueue = []
    this.files = []
    this.lastProgress = 0
    this.incomingFrom = ''
  }
```

`src/files/drop/stores/drop.ts` 的 `new PeersManager(server, { ... })` 回调表里补一条,先接成清状态 + toast(Task 10 会再细化,这里必须先有,否则 TS 不过):

```ts
      onTransferBroken: (e) => {
        delete transfers.value[e.peerId]
        useToast().show(t('filesDropInterrupted'), 3000)
      },
```

并加 i18n 键 —— `zh_cn.base.ts`: `filesDropInterrupted: '传输已中断',`;`en_us.base.ts`: `filesDropInterrupted: 'Transfer interrupted',`

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/ src/i18n/parity.test.ts`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `handleDisconnect` 里的 `if (wasActive)` 去掉(改成无条件 emit),重跑 → 「stays silent when nothing was in flight」必须真红。再把 `resetTransferState()` 整行注释掉 → 前两条必须真红。两次都恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/protocol.ts src/files/drop/rtcPeer.ts src/files/drop/rtcPeer.test.ts src/files/drop/stores/drop.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(drop): report broken transfers and reset the peer that lost one

Until now a vanished peer left busy=true forever, so its queue could never
accept another file. Idle channel closes stay silent on purpose.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---


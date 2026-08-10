### Task 8: 发送端等待超时 —— 解开「队列永久卡死」

**Files:**
- Modify: `src/files/drop/protocol.ts`, `src/files/drop/rtcPeer.ts`, `src/files/drop/rtcPeer.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `handleDisconnect`
- Produces: `ACK_TIMEOUT_MS` from `protocol.ts`

**这是本批最核心的行为。** 发送端发完一个分区就等对端的 `partition-received`,发完最后一片就等 `transfer-complete`;对端一旦消失,这两个等待**永远不会结束**,`busy` 恒真 ⇒ 该 peer 从此彻底卡死。

- [ ] **Step 1: 写失败测试(追加)**

⚠️ **fake timers 必须用 `{ shouldAdvanceTime: true }`**(下面代码里已经是)。`FileChunker` 靠 `FileReader` 真异步推进,而 `vi.waitFor` 用 `setTimeout` 轮询 —— 普通 fake timers 会把两者一起冻住,测试挂死而不是变红。这一条同样适用于 Task 12。

```ts
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
      const file = new File([new Uint8Array(70000)], 'a.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))

      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 64000 }))
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

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
```

顶部 import 补 `ACK_TIMEOUT_MS`。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`
Expected: FAIL —— `ACK_TIMEOUT_MS` 未导出

- [ ] **Step 3: 写实现**

`protocol.ts`:

```ts
// A sender that has shipped a partition waits for the peer's acknowledgement.
// Without a bound, a peer that simply vanished leaves the queue wedged for the
// lifetime of the tab.
export const ACK_TIMEOUT_MS = 30000
```

`rtcPeer.ts` 的 `Peer` 类:

```ts
  private ackTimer: ReturnType<typeof setTimeout> | null = null

  private armAck(): void {
    this.clearAck()
    this.ackTimer = setTimeout(() => this.handleDisconnect('timeout'), ACK_TIMEOUT_MS)
  }

  private clearAck(): void {
    if (this.ackTimer === null) return
    clearTimeout(this.ackTimer)
    this.ackTimer = null
  }
```

`resetTransferState()` 里第一行加 `this.clearAck()`。

`sendFile` 的分区回调改成发完就武装:

```ts
    this.chunker = new FileChunker(
      file,
      (chunk) => this.sendRaw(chunk),
      (offset) => { this.sendJSON({ type: 'partition', offset }); this.armAck() },
    )
```

`handleChannelMessage` 的两个 case 改成:

```ts
      case 'partition-received':
        this.clearAck()
        if (this.chunker && !this.chunker.isFileEnd()) this.chunker.nextPartition()
        // Last partition acknowledged: now we are waiting for the receiver to
        // finish assembling and say transfer-complete. Same bound applies.
        else this.armAck()
        break
      case 'transfer-complete': this.clearAck(); this.onTransferCompleted(); break
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `case 'partition-received'` 里的 `else this.armAck()` 删掉,重跑 → 「arms the same timeout while waiting for the final transfer-complete」必须真红。再把 `clearAck()` 从 `transfer-complete` 分支删掉 → 最后一条必须真红。两次都恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/protocol.ts src/files/drop/rtcPeer.ts src/files/drop/rtcPeer.test.ts
git commit -m "fix(drop): bound the sender's waits so a vanished peer cannot wedge it

Waiting for partition-received or transfer-complete had no timeout, so busy
stayed true forever and that peer accepted no further files for the life of
the tab.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---


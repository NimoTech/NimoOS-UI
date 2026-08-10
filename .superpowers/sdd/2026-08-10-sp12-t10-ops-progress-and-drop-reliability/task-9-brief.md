### Task 9: 真取消 —— `cancelTransfer` 两端生效

**Files:**
- Modify: `src/files/drop/protocol.ts`, `src/files/drop/chunker.ts`, `src/files/drop/chunker.test.ts`, `src/files/drop/rtcPeer.ts`, `src/files/drop/rtcPeer.test.ts`

**Interfaces:**
- Produces: `FileChunker.abort(): void` · `Peer.cancelTransfer(): void`;`ChannelMessage` 新增 `{ type: 'transfer-cancel' }`

**为什么必须动 chunker**:`resetTransferState()` 只是把 `this.chunker` 置空,而 `FileReader` 的 load 回调**握着 chunker 自己的引用**,会继续读下一块并调 `sendRaw` —— 取消后字节照发。

- [ ] **Step 1: 写失败测试**

`src/files/drop/chunker.test.ts` 追加:

```ts
it('stops feeding chunks once aborted', async () => {
  const chunks: ArrayBuffer[] = []
  const file = new File([new Uint8Array(200000)], 'big.bin')
  const c = new FileChunker(file, (ch) => { chunks.push(ch); c.abort() }, () => {})
  c.nextPartition()
  await new Promise((r) => setTimeout(r, 20))
  expect(chunks.length).toBe(1)
})
```

`src/files/drop/rtcPeer.test.ts` 追加:

```ts
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
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/chunker.test.ts src/files/drop/rtcPeer.test.ts`
Expected: FAIL —— `c.abort is not a function` / `p.cancelTransfer is not a function`

- [ ] **Step 3: 写实现**

`protocol.ts` 的 `ChannelMessage` 联合加一项:

```ts
  | { type: 'transfer-cancel' }
```

`chunker.ts`:

```ts
  private aborted = false

  /** Stops the read loop. The FileReader's load callback holds its own
   *  reference to this chunker, so nulling the caller's handle is not enough
   *  to stop bytes from flowing. */
  abort(): void {
    this.aborted = true
    try { this.reader.abort() } catch { /* reader may already be idle */ }
  }
```

`onChunkRead` 第一行加 `if (this.aborted) return`。

`rtcPeer.ts` 的 `Peer`:

```ts
  /** User-initiated stop. Silent when nothing is running so a stray click
   *  cannot spam the peer with cancel messages. */
  cancelTransfer(): void {
    if (!this.hasActiveTransfer()) return
    this.sendJSON({ type: 'transfer-cancel' })
    this.chunker?.abort()
    this.resetTransferState()
    this.events.onTransferBroken({ peerId: this._peerId, reason: 'cancelled' })
  }
```

`resetTransferState()` 里,在把 `chunker` 置空**之前**加 `this.chunker?.abort()`,这样任何复位路径(断连/超时/取消)都停得住读循环。**顺带把 `cancelTransfer` 里那句重复的 `this.chunker?.abort()` 去掉。**

`handleChannelMessage` 加一个 case:

```ts
      case 'transfer-cancel':
        // The other side gave up. Drop whatever we were assembling; a later
        // transfer must not inherit these bytes.
        this.resetTransferState()
        this.events.onTransferBroken({ peerId: this._peerId, reason: 'cancelled' })
        break
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `chunker.ts` 的 `if (this.aborted) return` 删掉,重跑 → 「stops feeding chunks once aborted」必须真红。恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/protocol.ts src/files/drop/chunker.ts src/files/drop/chunker.test.ts src/files/drop/rtcPeer.ts src/files/drop/rtcPeer.test.ts
git commit -m "feat(drop): make cancelling a transfer actually stop it

Nulling the chunker was never enough -- the FileReader callback holds its own
reference and keeps shipping bytes. Aborting it is now part of every reset
path, and the receiving side discards its partial file.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---


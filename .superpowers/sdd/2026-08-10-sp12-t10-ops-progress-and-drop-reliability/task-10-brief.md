### Task 10: `PeersManager` 转发 + drop store 暴露

**Files:**
- Modify: `src/files/drop/peersManager.ts`, `src/files/drop/peersManager.test.ts`, `src/files/drop/stores/drop.ts`

**Interfaces:**
- Produces: `PeersManager.hasActiveTransfers(): boolean` · `PeersManager.cancelTransfer(peerId: string): void` · store 的 `hasActiveTransfers()` / `cancelTransfer(peerId)`

- [ ] **Step 1: 写失败测试(追加到 `peersManager.test.ts`)**

```ts
describe('PeersManager transfer control', () => {
  it('reports an active transfer when any peer has one', () => {
    const made: Array<{ hasActiveTransfer: () => boolean; cancelTransfer: () => void }> = []
    const mgr = new PeersManager({ send: vi.fn() }, makeEvents(), {
      rtcSupported: true,
      makePeer: () => {
        const p = { hasActiveTransfer: () => made.length === 1, cancelTransfer: vi.fn(), refresh: vi.fn(), close: vi.fn() }
        made.push(p as never)
        return p as never
      },
    })
    mgr.handleServerMessage({ type: 'peers', peers: [{ id: 'p1', name: { model: 'desktop', deviceName: 'd', displayName: 'D' }, rtcSupported: true }] })
    expect(mgr.hasActiveTransfers()).toBe(true)
  })

  it('cancels only the peer it was asked about', () => {
    const cancels: string[] = []
    const mgr = new PeersManager({ send: vi.fn() }, makeEvents(), {
      rtcSupported: true,
      makePeer: (_s, id) => ({
        hasActiveTransfer: () => true,
        cancelTransfer: () => cancels.push(String(id)),
        refresh: vi.fn(), close: vi.fn(),
      }) as never,
    })
    mgr.handleServerMessage({ type: 'peers', peers: [
      { id: 'p1', name: { model: 'desktop', deviceName: 'a', displayName: 'A' }, rtcSupported: true },
      { id: 'p2', name: { model: 'desktop', deviceName: 'b', displayName: 'B' }, rtcSupported: true },
    ] })

    mgr.cancelTransfer('p2')

    expect(cancels).toEqual(['p2'])
  })

  it('ignores a cancel for a peer that is not connected', () => {
    const mgr = new PeersManager({ send: vi.fn() }, makeEvents(), { rtcSupported: true })
    expect(() => mgr.cancelTransfer('nobody')).not.toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/peersManager.test.ts`
Expected: FAIL —— `mgr.hasActiveTransfers is not a function`

- [ ] **Step 3: 写实现**

`peersManager.ts`:

```ts
  hasActiveTransfers(): boolean {
    return Object.values(this.peers).some((p) => p.hasActiveTransfer())
  }

  cancelTransfer(peerId: string): void {
    this.peers[peerId]?.cancelTransfer()
  }
```

`stores/drop.ts`:把 Task 6 临时接的 `onTransferBroken` 保留(已经是最终形态),并在文件末尾的 `return { ... }` 里补两个方法:

```ts
  function hasActiveTransfers(): boolean {
    return manager?.hasActiveTransfers() ?? false
  }

  function cancelTransfer(peerId: string): void {
    manager?.cancelTransfer(peerId)
  }
```

```ts
  return {
    peers, selfId, connected, transfers, receiveQueue, init, destroy, sendFiles,
    saveCurrent, ignoreCurrent, deviceName, hasActiveTransfers, cancelTransfer,
  }
```

⚠️ **Pinia setup store 的坑**:忘了写进 `return` 不会报错,外部读到的是 `undefined`(本仓已栽过一次)。加完立刻用下一步的测试确认。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/`
Expected: 全绿

- [ ] **Step 5: 变异验证**

从 store 的 `return` 里删掉 `cancelTransfer`,跑 `pnpm exec vue-tsc --noEmit` —— **预期它不报错**(这正是那个坑),再跑 Task 11 之后的组件测试才会红。**把这个观察如实写进报告**,说明这条只能靠组件层测试保护。恢复。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/peersManager.ts src/files/drop/peersManager.test.ts src/files/drop/stores/drop.ts
git commit -m "feat(drop): expose transfer state and cancellation to the UI layer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---


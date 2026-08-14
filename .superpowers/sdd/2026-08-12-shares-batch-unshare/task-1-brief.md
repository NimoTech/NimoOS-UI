### Task 1: i18n keys + `removeMany` store action

**Files:**
- Modify: `src/i18n/zh_cn.base.ts` (after `filesUnshareConfirmMsg`, ~line 209)
- Modify: `src/i18n/en_us.base.ts` (after `filesUnshareConfirmMsg`, ~line 209)
- Modify: `src/files/stores/shares.ts`
- Test: `src/files/stores/shares.test.ts`

**Interfaces:**
- Consumes: `service.samba.deleteShare(id: number): Promise<void>` (existing, `packages/service/src/samba.ts:33`).
- Produces: `useSharesStore().removeMany(ids: number[]): Promise<{ failedIds: number[] }>` — resolves after list reload and toast; `failedIds` preserves the order of `ids`. i18n keys `filesUnshareBatchConfirmMsg` / `filesUnshareBatchDone` / `filesUnshareBatchPartial` (Task 3 uses the first one).

- [ ] **Step 1: Add i18n keys**

In `src/i18n/zh_cn.base.ts`, directly after the `filesUnshareConfirmMsg` line:

```ts
  filesUnshareBatchConfirmMsg: '确定取消共享这 {count} 个文件夹吗?局域网将无法再访问它们。',
  filesUnshareBatchDone: '已取消共享 {count} 项',
  filesUnshareBatchPartial: '已取消共享 {ok} 项,{fail} 项失败',
```

In `src/i18n/en_us.base.ts`, directly after the `filesUnshareConfirmMsg` line:

```ts
  filesUnshareBatchConfirmMsg: 'Stop sharing these {count} folders? They will no longer be accessible on the local network.',
  filesUnshareBatchDone: 'Unshared {count} item(s)',
  filesUnshareBatchPartial: 'Unshared {ok} item(s), {fail} failed',
```

- [ ] **Step 2: Run the i18n guards to verify parity**

Run: `pnpm exec vitest run src/i18n/parity.test.ts src/i18n/messageSyntax.test.ts`
Expected: PASS (both files got all three keys; placeholder syntax valid).

- [ ] **Step 3: Write the failing store tests**

Append to `src/files/stores/shares.test.ts` inside the existing `describe('useSharesStore', …)` block. Note the file's existing hoisted mocks (`listShares`, `deleteShare`) are reused; toast text is asserted via `useToast().msg` (the store-level pattern — do not query DOM). Add the import at the top of the file: `import { useToast } from '../../stores/toast'`.

```ts
  it('removeMany deletes every id, reloads once, toasts batch-done on full success', async () => {
    listShares.mockResolvedValue([])
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([3, 7])
    expect(deleteShare).toHaveBeenCalledTimes(2)
    expect(deleteShare).toHaveBeenCalledWith(3)
    expect(deleteShare).toHaveBeenCalledWith(7)
    expect(listShares).toHaveBeenCalledTimes(1)
    expect(failedIds).toEqual([])
    expect(useToast().msg).toBe('已取消共享 2 项')
  })

  it('removeMany reports partial failure and returns the failed ids', async () => {
    listShares.mockResolvedValue([])
    deleteShare.mockImplementation(async (id: number) => {
      if (id === 7) throw new Error('boom')
    })
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([3, 7, 9])
    expect(failedIds).toEqual([7])
    expect(listShares).toHaveBeenCalledTimes(1) // still reloads exactly once
    expect(useToast().msg).toBe('已取消共享 2 项,1 项失败')
  })

  it('removeMany surfaces the backend message when every id fails', async () => {
    listShares.mockResolvedValue([])
    deleteShare.mockRejectedValue({ response: { data: { message: 'smb busy' } } })
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([3, 7])
    expect(failedIds).toEqual([3, 7])
    expect(useToast().msg).toBe('smb busy')
  })

  it('removeMany with empty ids is a no-op (no network, no toast)', async () => {
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([])
    expect(failedIds).toEqual([])
    expect(deleteShare).not.toHaveBeenCalled()
    expect(listShares).not.toHaveBeenCalled()
  })
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm exec vitest run src/files/stores/shares.test.ts`
Expected: 4 new tests FAIL with `s.removeMany is not a function`; the 4 pre-existing tests still PASS.

- [ ] **Step 5: Implement `removeMany`**

In `src/files/stores/shares.ts`, add after the existing `remove` function (before the `return`), and add `removeMany` to the returned object:

```ts
  // Batch unshare. The backend only has a per-id DELETE endpoint, so fan out
  // concurrently and settle all: one reload, one toast, failed ids returned so
  // the page can keep them selected for retry.
  async function removeMany(ids: number[]): Promise<{ failedIds: number[] }> {
    if (!ids.length) return { failedIds: [] }
    const results = await Promise.allSettled(ids.map((id) => service.samba.deleteShare(id)))
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected')
    await load()
    const ok = ids.length - failedIds.length
    if (!failedIds.length) {
      toast.show(t('filesUnshareBatchDone', { count: ok }))
    } else if (!ok) {
      const first = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      toast.show(errMsg(first?.reason) || t('filesShareFailed'))
    } else {
      toast.show(t('filesUnshareBatchPartial', { ok, fail: failedIds.length }))
    }
    return { failedIds }
  }
```

Change the return line to:

```ts
  return { items, loading, load, create, remove, removeMany }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/files/stores/shares.test.ts src/i18n/parity.test.ts`
Expected: PASS (8 store tests + parity).

- [ ] **Step 7: Commit**

```bash
git add src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/stores/shares.ts src/files/stores/shares.test.ts
git commit -m "feat(shares): add removeMany store action for batch unshare" -- src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/stores/shares.ts src/files/stores/shares.test.ts
```

---


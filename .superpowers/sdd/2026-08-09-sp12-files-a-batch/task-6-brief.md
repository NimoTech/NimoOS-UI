### Task 6: 给编排件加 `resolvePaste`

**Files:**
- Modify: `src/files/composables/useFileConflicts.ts`
- Test: `src/files/composables/useFileConflicts.test.ts`

**Interfaces:**
- Consumes: Task 4 的 `computePasteConflicts` / `splitPasteItems`；Task 3 的 `OperateItem`
- Produces（新增在既有返回对象上，既有导出一个不动）：
  `resolvePaste(items: OperateItem[], destDir: string): Promise<{ overwriteItems: OperateItem[]; renameItems: OperateItem[]; skippedCount: number }>`

- [ ] **Step 1: 写失败的测试**

```ts
describe('resolvePaste', () => {
  it('splits by the answers the user gives to each collision', async () => {
    const c = useFileConflicts({
      listFolder: async () => ({ content: [{ name: 'a.txt', is_dir: false }] }),
    })
    const items = [
      { from: '/DATA/src/a.txt', is_dir: false },
      { from: '/DATA/src/b.txt', is_dir: false },
    ]
    const p = c.resolvePaste(items, '/DATA/dst')
    await flushPromises()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('a.txt')
    c.answer({ action: 'overwrite' })
    const out = await p
    expect(out.overwriteItems.map((i) => i.from)).toEqual(['/DATA/src/a.txt'])
    expect(out.renameItems.map((i) => i.from)).toEqual(['/DATA/src/b.txt'])
  })

  it('never opens the dialog when nothing collides', async () => {
    const c = useFileConflicts({ listFolder: async () => ({ content: [] }) })
    const items = [{ from: '/DATA/src/a.txt', is_dir: false }]
    const out = await c.resolvePaste(items, '/DATA/dst')
    expect(c.dialog.value.open).toBe(false)
    expect(out.renameItems).toEqual(items)
  })

  it('never offers Merge for a paste collision', async () => {
    // The backend's move/copy style switch has no merge case; offering it
    // would render a button that does nothing.
    const c = useFileConflicts({
      listFolder: async () => ({ content: [{ name: 'Trip', is_dir: true }] }),
    })
    const p = c.resolvePaste([{ from: '/DATA/src/Trip', is_dir: true }], '/DATA/dst')
    await flushPromises()
    expect(c.dialog.value.allowMerge).toBe(false)
    expect(c.dialog.value.isDir).toBe(true)
    c.answer({ action: 'skip' })
    await p
  })

  it('runs on the same serial chain as upload batches', async () => {
    // Two flows must never have a dialog open at once.
    const c = useFileConflicts({
      listFolder: async () => ({ content: [{ name: 'a.txt', is_dir: false }] }),
    })
    const first = c.resolvePaste([{ from: '/DATA/x/a.txt', is_dir: false }], '/DATA/dst')
    const second = c.resolvePaste([{ from: '/DATA/y/a.txt', is_dir: false }], '/DATA/dst')
    await flushPromises()
    expect(c.dialog.value.targetPath).toBe('/DATA/dst')
    expect(c.dialog.value.name).toBe('a.txt')
    c.answer({ action: 'skip' })
    await flushPromises()
    // The second batch only gets the dialog after the first one is answered.
    expect(c.dialog.value.open).toBe(true)
    c.answer({ action: 'skip' })
    await Promise.all([first, second])
  })
})
```

> `answer` / `flushPromises` 的用法照该文件既有的上传用例；若既有测试用的是别的方法名（如 `choose`），照既有的来，别新造。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/composables/useFileConflicts.test.ts
```

- [ ] **Step 3: 实现**

在 `useFileConflicts` 内部新增（复用既有的 `ask` / `chain` / `listFolder`，一个都不要新造）：

```ts
/**
 * Paste's counterpart to `run()`. Shares this composable's dialog, resolver and
 * serial chain, so an upload batch and a paste can never both be asking.
 *
 * `allowMerge` is deliberately never set: the backend's move/copy conflict
 * switch (NimoOS service/file.go) implements skip / overwrite / rename only.
 */
async function resolvePaste(items: OperateItem[], destDir: string) {
  const task = async () => {
    const conflicts = await computePasteConflicts({ items, destDir, listFolder })
    const resolutions = conflicts.length
      ? await resolveConflictQueue(conflicts, (conflict, ctx) => ask(conflict, destDir, ctx))
      : []
    return splitPasteItems(items, resolutions)
  }
  const p = chain.then(task, task)
  chain = p.then(() => undefined, () => undefined)
  return p
}
```

把 `resolvePaste` 加进 return 对象。

> **注意**：`ask` 目前用 `conflict.mergeable` 推 `allowMerge`。`computePasteConflicts` 产出的候选**不带 `mergeable`**（可选字段留空），所以 `!!undefined === false`，自动就是不给 merge —— 不需要改 `ask`。测试第三条就是钉这一点的。

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/composables/useFileConflicts.test.ts
```

- [ ] **Step 5: 变异验证**

把 `chain` 那两行临时改成直接 `return task()`（绕开串行链），重跑 —— 「runs on the same serial chain」那条必须变红。确认后改回。

- [ ] **Step 6: 提交**

```bash
git add src/files/composables/useFileConflicts.ts src/files/composables/useFileConflicts.test.ts
git commit -m "feat(files): resolve paste collisions through the shared conflict chain

Paste asks the same questions uploads do, so it reuses the same dialog and
the same serial chain rather than being free to open a second one."
```

---


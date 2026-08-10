### Task 11: 时间机器 —— 批量恢复给出进度

**用户看到什么**：在快照里选几十项点恢复，后端一次只收一个 path，前端串行提交 —— 全程只有一个禁用态按钮，看不出还要多久、也看不出是不是卡死了。改完后能看到 `正在恢复 3/40`。

**串行本身改不了**（后端 `POST /v2/snapshot/restore` 一次一个 path，这是它的形状），本任务只让进度可见。

**Files:**
- Modify: `src/files/stores/snapshotBrowse.ts:94-137`
- Modify: `src/files/snapshot/SnapshotSelectionToolbar.vue`（显示进度）
- Modify: `src/i18n/zh_cn.base.ts` / `en_us.base.ts`
- Test: `src/files/stores/snapshotBrowse.test.ts`、`src/files/snapshot/SnapshotSelectionToolbar.test.ts`

**Interfaces:**
- Produces: store 新增 `restoreProgress: Ref<{ done: number; total: number } | null>`（不在恢复中时为 `null`）
- Produces: i18n 键 `snapBrowseRestoringProgress`

- [ ] **Step 1: 写失败的测试**

```ts
// snapshotBrowse.test.ts
it('reports how far a batch restore has got', async () => {
  // 每条 restore 都挂在一个受测试控制的 deferred 上，好在中途断言进度。
  const gates: Array<() => void> = []
  const restore = vi.fn(() => new Promise((res) => {
    gates.push(() => res({ restored_path: '/DATA/x.restored-1' }))
  }))
  const store = useSnapshotBrowseStore(/* 注入 restore，装配照该文件既有用例 */)

  const p = store.restoreEntries(threeEntries)
  await flushPromises()
  expect(store.restoreProgress).toEqual({ done: 0, total: 3 })

  gates[0]!(); await flushPromises()
  expect(store.restoreProgress).toEqual({ done: 1, total: 3 })

  gates[1]!(); await flushPromises()
  expect(store.restoreProgress).toEqual({ done: 2, total: 3 })

  gates[2]!(); await p
  expect(store.restoreProgress).toBeNull()
})

it('clears the progress even when a restore throws', async () => {
  const store = useSnapshotBrowseStore()
  await store.restoreEntries(entriesThatFail)
  expect(store.restoreProgress).toBeNull()
})
```

```ts
// SnapshotSelectionToolbar.test.ts
it('shows the running count while a batch restore is in flight', () => {
  const w = mountToolbar({ restoreProgress: { done: 2, total: 5 } })
  expect(w.text()).toContain('2')
  expect(w.text()).toContain('5')
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/stores/snapshotBrowse.test.ts src/files/snapshot/SnapshotSelectionToolbar.test.ts
```

- [ ] **Step 3: 实现**

`snapshotBrowse.ts`：新增 ref 并在循环里推进。

```ts
// The backend takes one path per call, so the loop below stays serial. What
// it cannot stay is silent: picking forty files meant a disabled button and
// no sign of life until every one of them had come back.
const restoreProgress = ref<{ done: number; total: number } | null>(null)
```

循环改成：

```ts
const results = []
restoreProgress.value = { done: 0, total: list.length }
for (const item of list) {
  results.push(await performSnapshotRestore({ /* 既有四个参数一字不动 */ }))
  restoreProgress.value = { done: results.length, total: list.length }
}
```

`finally` 块里补 `restoreProgress.value = null`（与既有的 `restoring.value = false` 并列 —— 抛错路径也必须清）。把 `restoreProgress` 加进 store 的 return。

> **Pinia 陷阱**：setup store 的 ref **必须写进 return 才能被外部读到**，漏写不报错、外部读恒 `undefined`。加完自己 grep 一遍 return 列表。

`SnapshotSelectionToolbar.vue`：恢复按钮在 `restoreProgress` 非空时显示进度文案，颜色/尺寸沿用按钮既有 token，不新增样式语义。

i18n：

```ts
// zh_cn.base.ts
snapBrowseRestoringProgress: '正在恢复 {done}/{total}',
// en_us.base.ts
snapBrowseRestoringProgress: 'Restoring {done}/{total}',
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/stores/snapshotBrowse.test.ts src/files/snapshot/ src/i18n/
```

- [ ] **Step 5: 提交**

```bash
git add -A src/
git commit -m "feat(files): show progress while restoring a batch from a snapshot

The backend restores one path per call, so the loop is serial by
necessity; forty files meant a disabled button and no sign of life."
```

---


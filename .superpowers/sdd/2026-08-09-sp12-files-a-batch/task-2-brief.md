### Task 2: `cut` 跟上 F10，改筛选而非整批拒绝

**用户看到什么**：选一批文件按剪切，只要里面混进一个受保护项（系统文件夹 / 已共享 / 挂载点），**整批都剪不动**，剪贴板里什么都没有。上一批已经把「删除」改成筛选了，剪切漏了。

**Files:**
- Modify: `src/files/util/protect.ts:28-40`（`deletableEntries` 更名 + JSDoc 改写）
- Modify: `src/files/composables/useFileOps.ts:61-70`（`remove` 跟着改调用名）、`:89-92`（`cut`）
- Modify: `src/i18n/zh_cn.base.ts`、`src/i18n/en_us.base.ts`
- Test: `src/files/util/protect.test.ts`、`src/files/composables/useFileOps.test.ts`

**Interfaces:**
- Produces: `operableEntries(entries: FileEntry[]): { targets: FileEntry[]; skipped: number }`（原 `deletableEntries` 更名，签名与行为一字不变）
- Produces: i18n 键 `filesCutSkippedProtected`

- [ ] **Step 1: 写失败的测试**

`src/files/util/protect.test.ts` 追加（把既有 `deletableEntries` 的用例整体改用新名，行为断言不动）：

```ts
it('operableEntries keeps the operable ones and counts the rest', () => {
  const entries = [
    { name: 'notes.txt', path: '/DATA/notes.txt', is_dir: false },
    { name: 'Documents', path: '/DATA/Documents', is_dir: true },
  ] as FileEntry[]
  const { targets, skipped } = operableEntries(entries)
  expect(targets.map((e) => e.name)).toEqual(['notes.txt'])
  expect(skipped).toBe(1)
})
```

`src/files/composables/useFileOps.test.ts` 追加三个用例（fixture 里的受保护目录**用 `Downloads`，不要用 `Gallery`** —— `Gallery` 是开源导出守卫的敏感词，上一批已因此改过一次）：

```ts
it('cut copies the operable subset to the clipboard instead of refusing the batch', () => {
  const entries = [
    { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
    { name: 'Downloads', path: '/DATA/Downloads', is_dir: true },
  ] as FileEntry[]
  ops.cut(entries)
  expect(clipboard.operateObject?.item.map((i) => i.from)).toEqual(['/DATA/a.txt'])
})

it('cut reports how many protected items it skipped', () => {
  const entries = [
    { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
    { name: 'Downloads', path: '/DATA/Downloads', is_dir: true },
  ] as FileEntry[]
  ops.cut(entries)
  expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('1'))
})

it('cut still refuses outright when nothing in the selection can be moved', () => {
  const entries = [{ name: 'Downloads', path: '/DATA/Downloads', is_dir: true }] as FileEntry[]
  ops.cut(entries)
  expect(clipboard.operateObject).toBeNull()
})
```

> `ops` / `clipboard` / `toastSpy` 的搭建照该文件顶部既有的 `remove` 用例写法，不要新造一套。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/util/protect.test.ts src/files/composables/useFileOps.test.ts
```
预期：`operableEntries is not defined` + 三个 cut 用例 FAIL。

- [ ] **Step 3: 实现**

`protect.ts`：把 `deletableEntries` 更名为 `operableEntries`，注释改写成中性说法：

```ts
// Split a selection into what a destructive batch may actually touch and a
// count of what it must leave alone.
//
// Both delete and cut used to be all-or-nothing: one protected member -- a
// system folder, a shared folder, a mount point -- and the whole batch was
// refused, so selecting everything in /DATA and pressing delete removed
// nothing at all (pending-ledger F10). Filtering lets the rest through and
// leaves the caller to say how many were skipped, in its own wording: delete
// and cut are different verbs and cannot share one message.
export function operableEntries(entries: FileEntry[]): { targets: FileEntry[]; skipped: number } {
  const targets = entries.filter((e) => canOperate(e))
  return { targets, skipped: entries.length - targets.length }
}
```

`useFileOps.ts` 的 `remove` 把 `deletableEntries(` 换成 `operableEntries(`（其余不动），`cut` 改成：

```ts
function cut(entries: FileEntry[]) {
  const { targets, skipped } = operableEntries(entries)
  if (!targets.length) { toast.show(t('filesProtectedMove')); return }
  if (skipped > 0) toast.show(t('filesCutSkippedProtected', { count: skipped }))
  clipboard.operate('move', targets)
}
```

> `clipboard.operate` 的第二参在 Task 3 之前仍是 `string[]`。**本任务里先写成 `targets.map((e) => e.path)`**，Task 3 会把它改成传 entry。

i18n 双写（中文照 `filesDeleteSkippedProtected` 的句式）：

```ts
// zh_cn.base.ts —— 紧挨 filesDeleteSkippedProtected 那行
filesCutSkippedProtected: '已跳过 {count} 个受保护项',
// en_us.base.ts —— 同一位置
filesCutSkippedProtected: 'Skipped {count} protected item(s)',
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/util/protect.test.ts src/files/composables/useFileOps.test.ts src/i18n/parity.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/files/util/protect.ts src/files/composables/useFileOps.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/util/protect.test.ts src/files/composables/useFileOps.test.ts
git commit -m "fix(files): cut the operable subset instead of refusing the whole batch

Delete stopped being all-or-nothing last batch; cut kept the old rule, so
one protected member still emptied the clipboard for everything selected."
```

---


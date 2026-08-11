### Task 6: Bug 4 — 空文件夹拖拽上传被静默丢弃

上传管线只有"文件"一种实体:`dropEntries.ts` 的 `walk()` 只收集文件,空目录在遍历中消失;`Files.vue onDrop:332` 对空结果直接 `return`,连提示都没有。修法:`walk` 额外产出空目录相对路径,落点处逐个调 `service.folder.create`(容忍业务码 20001「目录已存在」)。注:`webkitdirectory` 文件选择器按浏览器规范拿不到空目录,该入口无法修,属平台限制,代码注释里写明。

**Files:**
- Modify: `src/files/upload/dropEntries.ts`(walk 收集空目录;返回类型改为 `{ files, emptyDirs }`)
- Create: `src/files/upload/emptyDirs.ts`(建目录 util,容忍已存在)
- Modify: `src/views/Files.vue`(`onDrop` ~324-334 行、`commitSelectedFiles` ~237-301 行)
- Modify: `src/i18n/zh_cn.base.ts` / `en_us.base.ts`(新增 `filesEmptyDirsCreated`)
- Test: `src/files/upload/dropEntries.test.ts`(15 行有 createReader fake 可直接扩)、Create `src/files/upload/emptyDirs.test.ts`

**Interfaces:**
- Consumes: `service.folder.create(path)`(`POST /v1/folder`,来自 `@nimotech/nimoos-service`;失败时 `unwrap` 抛 `Error & { code?: number; detail?: string }`,`code` 为业务码,**20001 = DIR_ALREADY_EXISTS 视为成功**);`joinPath`(`src/files/util/pathOps`);`splitProtectedUploads`(`src/files/util/protect.ts:15`,接受 `{ relativePath }[]`)。
- Produces:
  - `readDroppedEntries(dt): Promise<{ files: DroppedFile[]; emptyDirs: string[] }>`(**破坏性签名变更**,改前 `grep -rn "readDroppedEntries" src/` 找齐所有调用方一并更新 —— 已知 `src/views/Files.vue:331` 与 `src/files/upload/dropEntries.test.ts`)
  - `createEmptyDirs(relPaths: string[], targetPath: string): Promise<{ created: number; failed: string[] }>`
  - `commitSelectedFiles(entries, emptyDirs?: string[])` 追加可选参数,缺省 `[]`,旧调用方(`handleSelectedFiles`、`onPaste`)不受影响。
  - i18n key `filesEmptyDirsCreated`。

- [ ] **Step 1: 写红测试(dropEntries)**

在 `src/files/upload/dropEntries.test.ts` 用现有 fake 惯例新增(所有既有用例的返回值断言同步改成 `.files`):

```ts
it('空目录被收进 emptyDirs 而不是消失', async () => {
  const dt = fakeDataTransfer([dirEntry('empty', [])])
  const r = await readDroppedEntries(dt)
  expect(r.files).toEqual([])
  expect(r.emptyDirs).toEqual(['empty'])
})
it('只含空子目录的目录:收叶子空目录(父目录由后端 MkdirAll 顺带创建)', async () => {
  const dt = fakeDataTransfer([dirEntry('a', [dirEntry('a/b', [])])])
  const r = await readDroppedEntries(dt)
  expect(r.emptyDirs).toEqual(['a/b'])
})
it('有文件的目录不进 emptyDirs', async () => {
  const dt = fakeDataTransfer([dirEntry('d', [fileEntry('d/x.txt')])])
  const r = await readDroppedEntries(dt)
  expect(r.files.map((f) => f.relativePath)).toEqual(['d/x.txt'])
  expect(r.emptyDirs).toEqual([])
})
```

(fake 构造器名按该测试文件现有写法适配。)
Run: `pnpm vitest run src/files/upload/dropEntries.test.ts` — Expected: FAIL

- [ ] **Step 2: 实现 dropEntries**

`src/files/upload/dropEntries.ts`:

```ts
export interface DroppedTree { files: DroppedFile[]; emptyDirs: string[] }

async function walk(entry: FsEntry | null, out: DroppedFile[], emptyDirs: string[]): Promise<void> {
  if (!entry) return
  if (entry.isFile) {
    const f = await entryToFile(entry)
    if (f) out.push({ file: f, relativePath: stripLead(entry.fullPath || entry.name) })
    return
  }
  if (entry.isDirectory && entry.createReader) {
    const children = await readAllEntries(entry.createReader())
    // 空目录:整条管线只有"文件"实体,目录本是文件落盘的副作用;不在这里记下相对
    // 路径,空目录就从上传里消失(bug.txt #4)。只记叶子:父链由后端 MkdirAll 补齐。
    // webkitdirectory 选择器按规范拿不到空目录,那个入口无法修,只有拖拽走得到这里。
    if (!children.length) { emptyDirs.push(stripLead(entry.fullPath || entry.name)); return }
    for (const child of children) await walk(child, out, emptyDirs)
  }
}
```

`readDroppedEntries` 返回 `{ files, emptyDirs }`(两条分支与 fallback 相应调整;fallback flat 列表 `emptyDirs` 恒为 `[]`)。

- [ ] **Step 3: 写红测试(emptyDirs util)**

Create `src/files/upload/emptyDirs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@nimotech/nimoos-service', () => ({ service: { folder: { create: vi.fn() } } }))
import { service } from '@nimotech/nimoos-service'
import { createEmptyDirs } from './emptyDirs'

const create = service.folder.create as ReturnType<typeof vi.fn>
beforeEach(() => create.mockReset())

describe('createEmptyDirs', () => {
  it('对每个相对路径调 folder.create(target + rel)', async () => {
    create.mockResolvedValue(undefined)
    const r = await createEmptyDirs(['a/b', 'c'], '/DATA/Documents')
    expect(create).toHaveBeenCalledWith('/DATA/Documents/a/b')
    expect(create).toHaveBeenCalledWith('/DATA/Documents/c')
    expect(r).toEqual({ created: 2, failed: [] })
  })
  it('业务码 20001(已存在)按成功计——合并进已有文件夹是正常场景', async () => {
    create.mockRejectedValue(Object.assign(new Error('Fail'), { code: 20001 }))
    const r = await createEmptyDirs(['a'], '/DATA')
    expect(r).toEqual({ created: 1, failed: [] })
  })
  it('其他错误进 failed', async () => {
    create.mockRejectedValue(Object.assign(new Error('Fail'), { code: 500 }))
    const r = await createEmptyDirs(['a'], '/DATA')
    expect(r).toEqual({ created: 0, failed: ['a'] })
  })
})
```

Run: `pnpm vitest run src/files/upload/emptyDirs.test.ts` — Expected: FAIL(模块不存在)

- [ ] **Step 4: 实现 emptyDirs util**

Create `src/files/upload/emptyDirs.ts`:

```ts
import { service } from '@nimotech/nimoos-service'
import { joinPath } from '../util/pathOps'

// 为拖拽上传里的空目录补建文件夹。后端 POST /v1/folder 走 MkdirAll,父链自动补齐;
// 目录已存在时返回业务码 20001(unwrap 抛 Error{code:20001}),对"把文件夹合并进
// 已有同名文件夹"的上传语义而言就是成功,必须容忍。
const DIR_ALREADY_EXISTS = 20001

export async function createEmptyDirs(
  relPaths: string[],
  targetPath: string,
): Promise<{ created: number; failed: string[] }> {
  let created = 0
  const failed: string[] = []
  for (const rel of relPaths) {
    try { await service.folder.create(joinPath(targetPath, rel)); created++ }
    catch (e) {
      if ((e as { code?: number }).code === DIR_ALREADY_EXISTS) created++
      else failed.push(rel)
    }
  }
  return { created, failed }
}
```

Run: `pnpm vitest run src/files/upload/emptyDirs.test.ts` — Expected: PASS

- [ ] **Step 5: 接线 Files.vue**

1. `onDrop`(~324 行):

```ts
const dropped = await readDroppedEntries(e.dataTransfer)
if (!dropped.files.length && !dropped.emptyDirs.length) return
await commitSelectedFiles(dropped.files.map((d) => ({ file: d.file, relativePath: d.relativePath })), dropped.emptyDirs)
```

2. `commitSelectedFiles` 签名加 `emptyDirs: string[] = []`;在 snapshot 拦截之后、`if (!allowed.length) return`(279 行)之前不动 —— 在函数尾部(`addFilesToQueue` 之后)追加空目录处理,并把 279 行的早退改成"没有文件但有空目录时不早退":

```ts
if (!allowed.length && !dirsAllowed.length) return
```

具体:在 `splitProtectedUploads(normalized)` 后对空目录做同样的保护过滤:

```ts
const { accepted: dirsAllowed, rejected: dirsProtected } =
  splitProtectedUploads(emptyDirs.map((p) => ({ relativePath: p })))
for (const { relativePath } of dirsProtected.map((p) => ({ relativePath: p })))
  toast.show(t('filesUploadProtected', { name: relativePath }))
```

(注意 `splitProtectedUploads` 的 `rejected` 是 string[],直接 `for (const name of dirsProtected) toast.show(t('filesUploadProtected', { name }))`。)
函数尾部追加:

```ts
if (dirsAllowed.length) {
  const { created, failed } = await createEmptyDirs(dirsAllowed.map((d) => d.relativePath), targetPath)
  if (created) toast.show(t('filesEmptyDirsCreated', { count: created }))
  for (const name of failed) toast.show(t('filesUploadProtected', { name })) // 复用「已拒绝」样式?不——见下
  if (created && targetPath === files.currentPath) await files.load(files.currentPath)
}
```

失败提示不复用 filesUploadProtected(语义不对),改为 `toast.show(t('filesOpFailed'))`(失败聚合一条即可):`if (failed.length) toast.show(t('filesOpFailed'))`。
另注意:纯空目录批(`allowed.length === 0`)会跳过 conflicts/addFilesToQueue,直接走到尾部的目录创建 —— 确认代码路径上 275-301 行之间的每个 `return` 都考虑了 `dirsAllowed`(只需改 279 行与 287-290 行两处早退条件:`if (!resolved.accepted.length)` 分支在 `dirsAllowed.length` 时不 return,继续落到目录创建;实现时以控制流清晰为准,可把目录创建提成本地函数先行调用)。

3. i18n:

```ts
// zh_cn.base.ts(filesUploadSkipped 附近)
  filesEmptyDirsCreated: '已创建 {count} 个空文件夹',
// en_us.base.ts
  filesEmptyDirsCreated: 'Created {count} empty folder(s)',
```

- [ ] **Step 6: 跑文件区相关测试**

Run: `pnpm vitest run src/files/upload/dropEntries.test.ts src/files/upload/emptyDirs.test.ts src/views/Files.upload.test.ts src/views/__tests__/Files.uploadConflict.test.ts src/i18n/parity.test.ts`
Expected: PASS(`Files.upload.test.ts` 若 mock 了 `readDroppedEntries` 旧返回形状,按新形状更新)

- [ ] **Step 7: Commit**

```bash
git add src/files/upload/dropEntries.ts src/files/upload/emptyDirs.ts src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/upload/dropEntries.test.ts src/files/upload/emptyDirs.test.ts src/views/Files.upload.test.ts
git commit -m "fix(files): create empty folders from drag-drop uploads

The upload pipeline only modeled files; directories existed as a side
effect of file ingest, so an empty folder vanished during traversal with
no feedback at all. Collect leaf empty directories while walking the drop
and create them via POST /v1/folder, tolerating 20001 (already exists) as
success. The webkitdirectory picker never reports empty dirs (platform
limitation), so only the drag path can be fixed."
```

---


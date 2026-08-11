### Task 7: Bug 2 — 最深路径下新建/上传:前置校验 + 报错不再只有 "Fail"

后端对超长路径(内核 ENAMETOOLONG)一路丢弃 error,新建返回字面 "Fail",tus 上传则在异步 ingest 阶段静默失败而前端已报成功。后端不在本分支范围;前端修两点:(1) 新建与上传前按 Linux 限制(单段 NAME_MAX 255 字节、全路径 PATH_MAX 4096 字节)前置校验并给出明确文案;(2) `useFileOps.errMsg` 换用 `folderListErrorMsg` 的取值顺序(detail → response.data.data → message)并把无信息量的字面 "Fail" 落回本地文案。

**Files:**
- Create: `src/files/util/pathLimits.ts` + `src/files/util/pathLimits.test.ts`
- Modify: `src/files/composables/useFileOps.ts`(`errMsg` 18-21 行;`createFolder`/`createFile` 42-52 行)
- Modify: `src/views/Files.vue` `commitSelectedFiles`(~269 行 `normalized` 之后插入过滤)
- Modify: `src/i18n/zh_cn.base.ts` / `en_us.base.ts`(新增 3 个 key)
- Test: `src/files/composables/useFileOps.test.ts`

**Interfaces:**
- Consumes: `joinPath`(`src/files/util/pathOps`);`folderListErrorMsg(e): string`(`src/files/util/folderListError.ts:8`,空串表示取不到);`files.currentPath` 是**真实路径**(非虚拟路径,见 Files.vue:257 注释)。
- Produces:
  - `nameTooLong(name: string): boolean`、`pathTooLong(path: string): boolean`、`createBlocked(dir: string, name: string): 'name' | 'path' | null`(均按 UTF-8 字节数,`TextEncoder`)
  - i18n key:`filesNameTooLong`、`filesPathTooLong`、`filesUploadPathTooLong`

- [ ] **Step 1: 写红测试(pathLimits)**

Create `src/files/util/pathLimits.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nameTooLong, pathTooLong, createBlocked } from './pathLimits'

describe('pathLimits(Linux NAME_MAX=255 / PATH_MAX=4096 字节,UTF-8)', () => {
  it('255 字节名可用,256 字节名过长', () => {
    expect(nameTooLong('a'.repeat(255))).toBe(false)
    expect(nameTooLong('a'.repeat(256))).toBe(true)
  })
  it('多字节按字节数算:86 个中文字 = 258 字节 → 过长', () => {
    expect(nameTooLong('文'.repeat(85))).toBe(false) // 255 字节
    expect(nameTooLong('文'.repeat(86))).toBe(true)  // 258 字节
  })
  it('全路径超 4095 字节 → 过长', () => {
    expect(pathTooLong('/' + 'a'.repeat(4094))).toBe(false)
    expect(pathTooLong('/' + 'a'.repeat(4095))).toBe(true)
  })
  it('createBlocked:名字先判,再判拼接后的全路径', () => {
    expect(createBlocked('/DATA', 'x'.repeat(256))).toBe('name')
    expect(createBlocked('/' + 'd'.repeat(4000), 'x'.repeat(100))).toBe('path')
    expect(createBlocked('/DATA', 'ok')).toBe(null)
  })
})
```

Run: `pnpm vitest run src/files/util/pathLimits.test.ts` — Expected: FAIL(模块不存在)

- [ ] **Step 2: 实现 pathLimits**

Create `src/files/util/pathLimits.ts`:

```ts
import { joinPath } from './pathOps'

// Linux 限制:单个路径段 NAME_MAX = 255 字节;全路径 PATH_MAX = 4096 字节(含结尾 NUL,
// 可用 4095)。按 UTF-8 字节数算(中文 3 字节/字)。后端对 ENAMETOOLONG 一路丢 error、
// 只回字面 "Fail"(route/v1/file.go MkdirAll / service/system.go),tus 上传更是在异步
// ingest 里静默失败 —— 前端前置校验是唯一能给出明确文案的地方(bug.txt #2)。
const NAME_MAX = 255
const PATH_MAX = 4095
const bytes = (s: string) => new TextEncoder().encode(s).length

export function nameTooLong(name: string): boolean { return bytes(name) > NAME_MAX }
export function pathTooLong(path: string): boolean { return bytes(path) > PATH_MAX }

/** 在 dir 下以 name 新建是否会超限。'name' = 名字本身超长;'path' = 拼接后全路径超长。 */
export function createBlocked(dir: string, name: string): 'name' | 'path' | null {
  if (nameTooLong(name)) return 'name'
  if (pathTooLong(joinPath(dir, name))) return 'path'
  return null
}
```

Run: `pnpm vitest run src/files/util/pathLimits.test.ts` — Expected: PASS

- [ ] **Step 3: 接线 useFileOps(校验 + errMsg)**

`src/files/composables/useFileOps.ts`:

1. imports 加:`import { createBlocked } from '../util/pathLimits'` 与 `import { folderListErrorMsg } from '../util/folderListError'`。
2. `errMsg` 替换为:

```ts
function errMsg(e: unknown, fallback: string): string {
  // detail → response.data.data → message 的取值顺序与目录列表报错一致;后端把
  // 意外 errno(如 ENAMETOOLONG)映射成字面 "Fail",无信息量,落回本地文案。
  const m = folderListErrorMsg(e)
  return !m || m === 'Fail' ? fallback : m
}
```

3. `createFolder` 与 `createFile` 的 try 之前各加(两处相同):

```ts
const blocked = createBlocked(files.currentPath, name)
if (blocked) { toast.show(t(blocked === 'name' ? 'filesNameTooLong' : 'filesPathTooLong')); return }
```

- [ ] **Step 4: 上传前过滤超长路径**

`src/views/Files.vue` `commitSelectedFiles`,`const normalized = toSelectedFiles(wanted, targetPath)`(269 行)之后、`splitProtectedUploads` 之前插入:

```ts
// 超长路径前置过滤:后端 tus ingest 对 ENAMETOOLONG 是异步静默失败,前端会先报
// "上传成功"(bug.txt #2)。relativePath 逐段查 NAME_MAX,拼接目标全路径查 PATH_MAX。
const fitsLimits = (rel: string) =>
  !rel.split('/').some(nameTooLong) && !pathTooLong(joinPath(targetPath, rel))
const withinLimits = normalized.filter((e) => fitsLimits(e.relativePath))
const tooLong = normalized.length - withinLimits.length
if (tooLong > 0) toast.show(t('filesUploadPathTooLong', { count: tooLong }))
```

后续 `splitProtectedUploads(normalized)` 改为 `splitProtectedUploads(withinLimits)`。imports 补 `nameTooLong, pathTooLong`(from `../files/util/pathLimits`)与 `joinPath`(若尚未引入,from `../files/util/pathOps`)。

4. i18n:

```ts
// zh_cn.base.ts(filesOpFailed 附近)
  filesNameTooLong: '名称过长(最多 255 字节)',
  filesPathTooLong: '路径过长,无法在此创建',
  filesUploadPathTooLong: '{count} 个文件路径过长,已跳过',
// en_us.base.ts
  filesNameTooLong: 'Name too long (max 255 bytes)',
  filesPathTooLong: 'Path too long to create here',
  filesUploadPathTooLong: 'Skipped {count} file(s): path too long',
```

- [ ] **Step 5: 补 useFileOps 行为测试**

在 `src/files/composables/useFileOps.test.ts` 按现有 mock 惯例新增:

```ts
it('createFolder:名字超 255 字节 → toast filesNameTooLong,不发请求', async () => {
  await ops.createFolder('x'.repeat(256))
  expect(folderCreateMock).not.toHaveBeenCalled()
  // 断言 toast 收到 filesNameTooLong 的文案(按该文件现有 toast 断言写法)
})
it('createFolder:后端 message 为字面 "Fail" → 显示本地 filesOpFailed 而非 "Fail"', async () => {
  folderCreateMock.mockRejectedValue(new Error('Fail'))
  await ops.createFolder('ok')
  // 断言 toast 文案 === zh_cn 的 '操作失败'
})
it('createFolder:错误带 detail → 显示 detail 原文', async () => {
  folderCreateMock.mockRejectedValue(Object.assign(new Error('Fail'), { detail: 'no space left on device' }))
  await ops.createFolder('ok')
  // 断言 toast 文案 === 'no space left on device'
})
```

Run: `pnpm vitest run src/files/composables/useFileOps.test.ts src/files/util/pathLimits.test.ts src/views/Files.upload.test.ts src/i18n/parity.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/files/util/pathLimits.ts src/files/util/pathLimits.test.ts src/files/composables/useFileOps.ts src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/composables/useFileOps.test.ts
git commit -m "fix(files): preflight NAME_MAX/PATH_MAX and surface real error detail

At maximum folder depth the backend drops the ENAMETOOLONG error and
answers with the literal string \"Fail\" for create, while tus uploads fail
silently in the async ingest step after the client already reported
success. Validate name (255 bytes) and full path (4096 bytes) up front
with clear copy, and route errMsg through folderListErrorMsg so a backend
detail wins over the useless \"Fail\" literal."
```

> 后端遗留(本分支不修,验收报告里挂账):`route/v1/file.go` MkdirAll/PostCreateFile 丢弃 error、`service/system.go:283` MkdirAll 返回值被丢、tus ingest 失败无前端可见信号(需要 task 状态轮询或事件)。

---


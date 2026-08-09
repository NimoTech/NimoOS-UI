# SP12 Plan C —— 加载健壮性(T9)+ 网格虚拟滚动(T11)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 `66ba0b69`(#88 加载健壮性)与 `edd9ae72`(#94 网格虚拟滚动)两条增量补迁到 New-UI，并按机主 2026-08-09 拍板把 Vue2 侧栏的磁盘用量悬浮窗一并补齐。

**Architecture:** 两条互不相干的线。A 线(T9)修「加载失败就永久空白 / 用户看不到任何错误」——纯函数重试 + 错误文案 + 默认目录兜底，外加新建一套侧栏用量数据源与 ⋮ 悬浮窗。B 线(T11)把 `FileGridView` 从「一次性渲染全部卡片」改成「按行切片 + 可视窗口」，并把框选的矩形来源从「量 DOM」换成「按几何算」——屏幕外没有 DOM 了。两线都是纯函数先行(TDD)、组件层补挂载测试。

**Tech Stack:** Vue 3 `<script setup>` · TypeScript(strict) · Pinia · vue-i18n 9 · Vitest + @vue/test-utils(全局 jsdom) · **不引入任何新依赖**(Vue2 用了 `vue-virtual-scroller`，本期按 SP12 既定决策自写虚拟化)。

## Global Constraints

- **工作树 = `.claude/worktrees/sp12-plan-c`,分支 `sp12-plan-c`**(从本地 `master` 4d8485b 切出;**不是** `origin/master`,后者落后 100+ 提交、不含 Plan A)。
- **代码注释一律英文**(工作区 CLAUDE.md 硬要求)。本计划、spec、台账仍中文。
- **颜色一律 theme token**,新语义要在 `src/styles/theme.css` 的 `:root` 与 `:root[data-theme="light"]` **两个块**都给值。禁止裸 hex / `rgba()` / 具名色。
- **i18n 新键必须同时加到 `src/i18n/zh_cn.base.ts` 与 `src/i18n/en_us.base.ts`**,键名扁平 camelCase(照 `filesUploadRetry` 一类既有键),否则 `src/i18n/parity.test.ts` 红。
- **提交信息英文**,imperative subject,body 讲「为什么」。
- **本工作树 commit 可以裸 `git add -A`**——3 个 `design-export` staged 删除与 `oss/*` 改动只存在于主工作树,本工作树是干净的。仍建议带 pathspec。
- **改了 `packages/service/` 后必须重启 dev server + 浏览器硬刷新**;`vite.config.ts` 的 `optimizeDeps.exclude` 不要删。
- **fixture 逐字取自真机**,不得手编(`newui-fixture-from-imagination-trap`:裸信封 unwrap 已栽三次)。
- **每个任务收尾必须前台跑测试**(`pnpm test` 约 3.5 分钟),不要丢后台。
- **基线**(2026-08-09 于本工作树 4d8485b 实测):`pnpm test` = 644 文件 / 10408 例全过,exit 0。任务结束时的数只应比它多。
- **已知非缺陷,别去追**:全量套件会打 jsdom `Not implemented: navigation` 噪声(来自 photos favorites 测试);`src/home/components/DesktopContextMenu.test.ts` 单独跑那一个文件时会失败(SP11 遗留 reka-ui 隔离 flake),全量里是绿的。

---

## 取证结论(开工前已做,直接用,不要重查)

| 事实 | 证据 |
|---|---|
| `loadDisks()` 一 catch 就清空,无重试 | `src/home/stores/folders.ts:46` |
| 磁盘列表空 → 文件页永久空白 | `disks=[]` → `files.defaultRootReal()` 返 `''` → `src/views/Files.vue:351` `if (!rootReal) return` |
| `files.load()` 吞掉所有错误,用户看到「空文件夹」 | `src/files/stores/files.ts:68-72` 只 `console.warn` |
| 后端真错误文本在信封的 `data` 字段,`message` 常只是 "Fail" | Vue2 `folderListError.js` 注释;而 New-UI `packages/service/src/unwrap.ts:6` **只取 `message`,把 `data` 丢了** |
| New-UI 侧栏零用量显示 | `src/files/components/FilesSidebar.vue:171-186` 只有 icon + name |
| RAID API 齐备且已 curl 核实是标准信封 | `packages/service/src/raid.ts:34/57`,`RaidStatus` 已含 `total_bytes/used_bytes/free_bytes` |
| 滚动容器是 `.area-body` | `src/components/shell/AreaShell.vue:32` `overflow: auto`;`.files-layout` 只有 `min-height:100%`,自己不滚 |
| 框选矩形现在靠量 DOM | `src/views/Files.vue:411-416` `querySelectorAll('[data-path]')` + `getBoundingClientRect()` |
| 深链高亮定位也靠量 DOM | `src/views/Files.vue:367` |
| `marqueeSelect(items, selRect)` 收的是**视口坐标** | `src/files/util/marquee.ts:18`;selRect 由 `e.clientX/clientY` 来 |
| 网格卡几何 | `.file-grid` = `repeat(auto-fill, minmax(120px,1fr))` + `gap:14px`(`FileGridView.vue:29`);`.file-tile` padding `14px 8px`、icon 64px、name 13px(`FileTile.vue:57-61`)⇒ 行高约 130px,**实现时必须实测,常量只作兜底** |

**本期不做 T10**,理由与缺口清单写进 Task 12 的交接票。

---

## File Structure

**新建(A 线)**
- `src/util/retryRequest.ts` — 通用有限重试。放 `src/util/`(不是 `src/files/util/`)因为消费方 `src/home/stores/folders.ts` 属 home 区。
- `src/files/util/folderListError.ts` — 目录列表错误文案归一。
- `src/files/util/defaultRoot.ts` — 默认起始目录决议(含 `/DATA` 兜底)。
- `src/files/util/raidSpaceFallback.ts` — RAID 用量兜底映射。
- `src/files/util/diskUsageFormat.ts` — `usedPercent` 纯函数。
- `src/files/stores/diskUsage.ts` — 挂载点 → `{space, raid}` 的数据源(storage + raid + raid 兜底)。
- `src/files/components/DiskUsageTip.vue` — ⋮ 悬浮窗(纯展示,只收 props)。

**新建(B 线)**
- `src/files/util/gridVirtual.ts` — `columnsFor` / `chunkRows` / `computeVisibleRange`。
- `src/files/util/gridGeometry.ts` — `rectsFromGeometry`(按几何生成 `ItemRect[]`,喂给不变的 `marqueeSelect`)。

**修改**
- `packages/service/src/unwrap.ts` — 抛错时附带 `detail`(信封 `data` 里的真错误文本)。
- `src/home/stores/folders.ts` — `loadDisks` 套 `retryRequest`。
- `src/files/stores/files.ts` — 新增 `error` 状态。
- `src/views/Files.vue` — 错误面 + 默认目录兜底 + 框选/高亮改走网格几何。
- `src/files/components/FilesSidebar.vue` — ⋮ 与悬浮窗接线。
- `src/files/components/FileGridView.vue` — 虚拟滚动。
- `src/styles/theme.css` — 用量条新 token。
- `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts` — 新键。

**每个新建 `.ts` 同目录配 `.test.ts`;两个组件配 `.test.ts` 挂载测试。**

---

# A 线 —— T9 加载健壮性 + 侧栏用量

### Task 1: `retryRequest` 有限重试 + 接进磁盘列表加载

**Files:**
- Create: `src/util/retryRequest.ts`
- Test: `src/util/retryRequest.test.ts`
- Modify: `src/home/stores/folders.ts:24-47`

**Interfaces:**
- Produces: `retryRequest<T>(fn: () => Promise<T>, delays?: number[]): Promise<T>` — 默认 `delays = [1000, 3000]`,即最多尝试 3 次、约 4s 窗口。全败时抛**最后一次**错误。

- [ ] **Step 1: 写失败测试**

`src/util/retryRequest.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retryRequest } from './retryRequest'

describe('retryRequest', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns the first successful result without waiting', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(retryRequest(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries after the configured delays and resolves on a later attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('boom1'))
      .mockRejectedValueOnce(new Error('boom2'))
      .mockResolvedValue('ok')
    const p = retryRequest(fn, [1000, 3000])
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(3000)
    await expect(p).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws the LAST error after exhausting every delay', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValue(new Error('last'))
    const p = retryRequest(fn, [1000, 3000])
    const assertion = expect(p).rejects.toThrow('last')
    await vi.advanceTimersByTimeAsync(4000)
    await assertion
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('makes exactly one attempt when the delay list is empty', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'))
    await expect(retryRequest(fn, [])).rejects.toThrow('nope')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm exec vitest run src/util/retryRequest.test.ts`
Expected: FAIL — `Failed to resolve import "./retryRequest"`

- [ ] **Step 3: 实现**

`src/util/retryRequest.ts`:

```ts
// Bounded retry for a one-shot request. `delays` are the waits BETWEEN attempts,
// so N delays means at most N+1 attempts; the default spans roughly 4s, which
// covers a service restart window or a transient backend stall.
//
// Why this exists: the sidebar's storage list used to give up after a single
// failure, leaving the Location list permanently empty (and, downstream, the
// whole Files page blank because there is no default root to navigate to).
export async function retryRequest<T>(fn: () => Promise<T>, delays: number[] = [1000, 3000]): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < delays.length) await new Promise((r) => setTimeout(r, delays[i]))
    }
  }
  throw lastErr
}
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm exec vitest run src/util/retryRequest.test.ts`
Expected: PASS(4 例)

- [ ] **Step 5: 接进 `loadDisks`**

`src/home/stores/folders.ts`,顶部加 `import { retryRequest } from '../../util/retryRequest'`,并把第 27 行改为:

```ts
      // SP12-T9: a single transient failure used to blank the disk list for good.
      const groups = ((await retryRequest(() => service.storage.list({ system: 'show' }) as Promise<any[]>)) as any[]) || []
```

- [ ] **Step 6: 补 store 层回归测试**

在 `src/home/stores/folders.test.ts` 末尾追加(照该文件既有的 mock 写法):

```ts
  it('retries the storage list before giving up on the disk roots', async () => {
    vi.useFakeTimers()
    const list = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue([{ type: 'sata', children: [{ mount_point: '/DATA', label: 'NimoOS-HD' }] }])
    ;(service as any).storage = { list }
    const store = useFoldersStore()
    const p = store.loadDisks()
    await vi.advanceTimersByTimeAsync(1000)
    await p
    expect(list).toHaveBeenCalledTimes(2)
    expect(store.disks).toEqual([{ name: 'NimoOS-HD', path: '/DATA', usb: false }])
    vi.useRealTimers()
  })
```

> 若该文件现有的 service mock 形状与上面不同,**照它现有的写法改**,别新造一套。

- [ ] **Step 7: 变异验证**

临时把 `retryRequest(() => ...)` 改回裸 `service.storage.list(...)`,跑 `pnpm exec vitest run src/home/stores/folders.test.ts` 确认**新增那条真的红**,再改回来。

- [ ] **Step 8: 跑全量 + 提交**

Run: `pnpm test`(前台等完,约 3.5 分钟)
Expected: 0 failures,例数 ≥ 10408 + 5

```bash
git add src/util/retryRequest.ts src/util/retryRequest.test.ts src/home/stores/folders.ts src/home/stores/folders.test.ts
git commit -m "fix(files): retry the storage list instead of blanking the sidebar

A single transient failure of GET /storage left the Location list empty for
good, and with no disk roots the Files page has no default directory to
navigate to -- it just sits blank with no error and no way back. Wrap the
call in a bounded retry spanning roughly 4s, which covers a service restart."
```

---

### Task 2: 目录加载错误文案归一 + 错误面

**Files:**
- Modify: `packages/service/src/unwrap.ts`
- Test: `packages/service/src/unwrap.test.ts`(追加)
- Create: `src/files/util/folderListError.ts` + `src/files/util/folderListError.test.ts`
- Modify: `src/files/stores/files.ts:32,60-75`
- Modify: `src/files/stores/files.test.ts`(追加)
- Modify: `src/views/Files.vue`(模板 + 样式)
- Modify: `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts`

**Interfaces:**
- Consumes: 无
- Produces: `folderListErrorMsg(error: unknown): string`;`useFilesStore().error: Ref<string>`;`unwrap` 抛出的 Error 带可选 `detail?: string`。

- [ ] **Step 1: 写 unwrap 的失败测试**

在 `packages/service/src/unwrap.test.ts` 追加:

```ts
  it('carries the envelope data string as `detail` when it fails', () => {
    try {
      unwrap({ success: 500, message: 'Fail', data: 'open /DATA/x: permission denied' } as any)
      throw new Error('should have thrown')
    } catch (e) {
      expect((e as Error).message).toBe('Fail')
      expect((e as Error & { detail?: string }).detail).toBe('open /DATA/x: permission denied')
    }
  })

  it('leaves `detail` undefined when data is not a string', () => {
    try {
      unwrap({ success: 500, message: 'Fail', data: { a: 1 } } as any)
      throw new Error('should have thrown')
    } catch (e) {
      expect((e as Error & { detail?: string }).detail).toBeUndefined()
    }
  })
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm exec vitest run packages/service/src/unwrap.test.ts`
Expected: FAIL — `expected undefined to be 'open /DATA/x: permission denied'`

- [ ] **Step 3: 改 unwrap**

`packages/service/src/unwrap.ts` 整个替换为:

```ts
import type { StdEnvelope } from './types.js'

// success===200 → 返回 data;否则抛带 message + code 的错误
export function unwrap<T>(body: StdEnvelope<T>): T {
  if (body && body.success === 200) return body.data as T
  const err = new Error(body?.message || `request failed (${body?.success})`)
  ;(err as Error & { code?: number }).code = body?.success
  // On failure the backend usually puts the real err.Error() text in `data` and
  // leaves `message` as a generic "Fail". Keep it so callers can show something
  // actionable; `message` stays untouched so existing consumers are unaffected.
  if (typeof body?.data === 'string') (err as Error & { detail?: string }).detail = body.data
  throw err
}
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm exec vitest run packages/service/src/unwrap.test.ts`
Expected: PASS

- [ ] **Step 5: 写 folderListError 的失败测试**

`src/files/util/folderListError.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { folderListErrorMsg } from './folderListError'

describe('folderListErrorMsg', () => {
  it('prefers the unwrapped envelope detail over the generic message', () => {
    const e = Object.assign(new Error('Fail'), { detail: 'open /DATA/x: permission denied' })
    expect(folderListErrorMsg(e)).toBe('open /DATA/x: permission denied')
  })

  it('falls back to an axios response body data string', () => {
    const e = { response: { data: { data: 'no such directory', message: 'Fail' } }, message: 'Request failed' }
    expect(folderListErrorMsg(e)).toBe('no such directory')
  })

  it('falls back to the response message when data is not a string', () => {
    const e = { response: { data: { data: { x: 1 }, message: 'Fail' } }, message: 'Request failed' }
    expect(folderListErrorMsg(e)).toBe('Fail')
  })

  it('falls back to the error message when there is no response body', () => {
    expect(folderListErrorMsg(new Error('Network Error'))).toBe('Network Error')
  })

  it('returns an empty string for a thrown value with nothing usable', () => {
    expect(folderListErrorMsg(null)).toBe('')
    expect(folderListErrorMsg({})).toBe('')
  })
})
```

- [ ] **Step 6: 跑测试确认红**

Run: `pnpm exec vitest run src/files/util/folderListError.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 7: 实现**

`src/files/util/folderListError.ts`:

```ts
// One lookup order for every way a folder listing can fail, so the two paths
// (envelope business failure, which `unwrap` turns into a throw, and a genuine
// transport error) can never drift apart into separately-maintained copies.
//
// `detail` is what unwrap salvages from the envelope's `data` field: on a
// business failure the backend puts the real err.Error() text there and leaves
// `message` as a generic "Fail", so `detail` has to win.
export function folderListErrorMsg(error: unknown): string {
  const e = error as
    | { detail?: unknown; message?: unknown; response?: { data?: { data?: unknown; message?: unknown } } }
    | null
    | undefined
  if (!e) return ''
  if (typeof e.detail === 'string' && e.detail) return e.detail
  const body = e.response?.data
  if (typeof body?.data === 'string' && body.data) return body.data
  if (typeof body?.message === 'string' && body.message) return body.message
  return typeof e.message === 'string' ? e.message : ''
}
```

- [ ] **Step 8: 跑测试确认绿**

Run: `pnpm exec vitest run src/files/util/folderListError.test.ts`
Expected: PASS(5 例)

- [ ] **Step 9: 给 files store 加 error 状态**

`src/files/stores/files.ts`:第 32 行下面加 `const error = ref('')`;`load()`(60-75 行)整体替换为:

```ts
  async function load(realPath: string) {
    clearSelection()
    loading.value = true
    error.value = ''
    try {
      const data = await service.folder.getList(realPath)
      const content: FileEntry[] = (data && (data as { content?: FileEntry[] }).content) || []
      entries.value = content.filter((e) => !e.name.startsWith('.') && !HIDDEN.has(e.name))
      currentPath.value = realPath
    } catch (e) {
      // Used to be swallowed into an empty listing, which renders exactly like a
      // genuinely empty folder -- the user could not tell "load failed" from
      // "nothing here" and had nothing to retry.
      console.warn('[files] load failed', realPath, e)
      entries.value = []
      currentPath.value = realPath
      error.value = folderListErrorMsg(e)
    } finally {
      loading.value = false
    }
  }
```

顶部加 `import { folderListErrorMsg } from '../util/folderListError'`,并把 `error` 加进 return 的导出列表(第 158 行那一串)。

- [ ] **Step 10: 补 store 测试**

在 `src/files/stores/files.test.ts` 追加(照该文件既有 mock 写法):

```ts
  it('surfaces the backend error text instead of showing an empty folder', async () => {
    const err = Object.assign(new Error('Fail'), { detail: 'open /DATA/x: permission denied' })
    ;(service.folder.getList as any).mockRejectedValueOnce(err)
    const store = useFilesStore()
    await store.load('/DATA/x')
    expect(store.error).toBe('open /DATA/x: permission denied')
    expect(store.entries).toEqual([])
  })

  it('clears a previous error once a later load succeeds', async () => {
    const store = useFilesStore()
    ;(service.folder.getList as any).mockRejectedValueOnce(new Error('boom'))
    await store.load('/DATA/x')
    expect(store.error).toBe('boom')
    ;(service.folder.getList as any).mockResolvedValueOnce({ content: [] })
    await store.load('/DATA')
    expect(store.error).toBe('')
  })
```

- [ ] **Step 11: 加 i18n 键**

`src/i18n/zh_cn.base.ts`(与 `filesUploadRetry` 同一区块):

```ts
  filesLoadFailed: '加载失败',
  filesRetry: '重试',
```

`src/i18n/en_us.base.ts` 同位置:

```ts
  filesLoadFailed: 'Failed to load',
  filesRetry: 'Retry',
```

- [ ] **Step 12: Files.vue 渲染错误面**

在 `src/views/Files.vue` 的 `<div ref="listwrap" class="files-listwrap" ...>` **内部最前面**插入:

```html
          <div v-if="files.error && !files.loading" class="files-error" role="alert">
            <span class="files-error-title">{{ t('filesLoadFailed') }}</span>
            <span class="files-error-detail">{{ files.error }}</span>
            <button class="chip" @click="files.load(files.currentPath)">{{ t('filesRetry') }}</button>
          </div>
```

样式加到 `<style scoped>`(全部走 token):

```css
.files-error {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  margin-bottom: 12px; padding: 12px 14px; border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--remove-fg) 40%, transparent);
  background: color-mix(in srgb, var(--remove-fg) 10%, transparent);
}
.files-error-title { font-size: 13px; font-weight: 600; color: var(--remove-fg); }
.files-error-detail { font-size: 12px; color: var(--fg-muted); word-break: break-all; }
```

> `--remove-fg` / `--fg-muted` 都是既有 token,两套主题都有值,**不要新增 token**。落地前用 `grep -n "\-\-remove-fg\|--fg-muted" src/styles/theme.css` 核实两个主题块都在。

- [ ] **Step 13: 补 Files.vue 挂载测试**

在 `src/views/Files.test.ts` 追加:

```ts
  it('shows the failure banner with the backend text, and retrying reloads', async () => {
    const w = await mountFiles()   // 照该文件既有的挂载 helper
    const files = useFilesStore()
    files.error = 'open /DATA/x: permission denied'
    files.loading = false
    await w.vm.$nextTick()
    expect(w.find('.files-error').exists()).toBe(true)
    expect(w.find('.files-error-detail').text()).toBe('open /DATA/x: permission denied')
    const spy = vi.spyOn(files, 'load')
    await w.find('.files-error button').trigger('click')
    expect(spy).toHaveBeenCalled()
  })

  it('hides the failure banner while a load is in flight', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.error = 'boom'
    files.loading = true
    await w.vm.$nextTick()
    expect(w.find('.files-error').exists()).toBe(false)
  })
```

> `mountFiles()` 用该文件已有的挂载方式;若没有 helper,照文件里现成的 `mount(Files, {...})` 调用抄一份。

- [ ] **Step 14: 跑全量 + 提交**

Run: `pnpm test`
Expected: 0 failures

```bash
git add packages/service/src/unwrap.ts packages/service/src/unwrap.test.ts src/files/util/folderListError.ts src/files/util/folderListError.test.ts src/files/stores/files.ts src/files/stores/files.test.ts src/views/Files.vue src/views/Files.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): surface directory load failures instead of faking an empty folder

A failed listing was swallowed into an empty entry list, which renders exactly
like a genuinely empty directory -- indistinguishable from success and with
nothing to retry. Keep the envelope's data field (where the backend puts the
real error text, leaving message as a generic Fail) through unwrap, normalize
the lookup order in one place, and show a banner with a retry."
```

---

### Task 3: 默认起始目录兜底(空白页自愈)

**Files:**
- Create: `src/files/util/defaultRoot.ts` + `src/files/util/defaultRoot.test.ts`
- Modify: `src/views/Files.vue:348-354`
- Modify: `src/views/Files.test.ts`(追加)

**Interfaces:**
- Produces: `resolveDefaultRoot(input: { persisted: string; diskRoot: string }): string` — 永不返回空串。

- [ ] **Step 1: 写失败测试**

`src/files/util/defaultRoot.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveDefaultRoot, DATA_ROOT } from './defaultRoot'

describe('resolveDefaultRoot', () => {
  it('prefers the persisted location the user last picked', () => {
    expect(resolveDefaultRoot({ persisted: '/DATA/Media', diskRoot: '/DATA' })).toBe('/DATA/Media')
  })

  it('falls back to the first disk root when nothing is persisted', () => {
    expect(resolveDefaultRoot({ persisted: '', diskRoot: '/mnt/usb1' })).toBe('/mnt/usb1')
  })

  it('falls back to /DATA when the disk list failed to load', () => {
    expect(resolveDefaultRoot({ persisted: '', diskRoot: '' })).toBe(DATA_ROOT)
  })

  it('never returns an empty string', () => {
    expect(resolveDefaultRoot({ persisted: '', diskRoot: '' })).not.toBe('')
  })
})
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm exec vitest run src/files/util/defaultRoot.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

`src/files/util/defaultRoot.ts`:

```ts
// /DATA is the one mount the product guarantees exists (LocalStorage creates it
// and its default subdirectories on startup), so it is the last-resort landing
// spot when everything else is unknown.
export const DATA_ROOT = '/DATA'

// Deciding where "/files" with no path should land. Returning an empty string
// used to be possible -- when the disk list had failed to load there was no
// root to navigate to, and the route sync simply returned, leaving the page
// blank forever with no error and no way out.
export function resolveDefaultRoot({ persisted, diskRoot }: { persisted: string; diskRoot: string }): string {
  return persisted || diskRoot || DATA_ROOT
}
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm exec vitest run src/files/util/defaultRoot.test.ts`
Expected: PASS(4 例)

- [ ] **Step 5: 接进 Files.vue**

顶部加 `import { resolveDefaultRoot } from '../files/util/defaultRoot'`,把 348-354 行的 `if (vp === '/')` 分支改为:

```ts
  if (vp === '/') {
    // Never bail out here: with no persisted default AND no disk roots (the
    // storage list failed), returning left the page blank forever.
    const rootReal = resolveDefaultRoot({ persisted: readDefault() || '', diskRoot: files.defaultRootReal() })
    router.replace('/files/' + virtualPathToRouteParam(toVirtualPath(rootReal, files.displayNames)))
    return
  }
```

- [ ] **Step 6: 补挂载测试**

`src/views/Files.test.ts` 追加:

```ts
  it('lands on /DATA instead of staying blank when the disk list failed', async () => {
    // no persisted default, no disks -- what a failed GET /storage looks like
    localStorage.removeItem('nimoos:location-default')
    const files = useFilesStore()
    files.disks = []
    const w = await mountFilesAtRoot()   // 路由停在 /files(vp === '/')
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith(expect.stringContaining('DATA'))
    void w
  })
```

> 若该文件的 router 是真 router 而非 mock,改成断言 `router.currentRoute.value.path` 含 `DATA`;**照文件现有写法**,别新造 router mock。

- [ ] **Step 7: 变异验证**

把 `resolveDefaultRoot(...)` 临时换回 `readDefault() || files.defaultRootReal()` 并补回 `if (!rootReal) return`,确认新增那条红;再改回来。

- [ ] **Step 8: 跑全量 + 提交**

Run: `pnpm test`

```bash
git add src/files/util/defaultRoot.ts src/files/util/defaultRoot.test.ts src/views/Files.vue src/views/Files.test.ts
git commit -m "fix(files): land on /DATA rather than a blank page when disks are unknown

With no persisted default and no disk roots -- which is exactly what a failed
storage list looks like -- the route sync returned early and the Files page
stayed blank forever, with no error and no navigation out of it."
```

---

### Task 4: RAID 用量兜底纯函数

**Files:**
- Create: `src/files/util/raidSpaceFallback.ts` + `src/files/util/raidSpaceFallback.test.ts`

**Interfaces:**
- Produces:
  - `export interface DiskSpace { used: number; total: number; avail: number }`
  - `raidFallbackSpaceFrom(status: { total_bytes?: number; used_bytes?: number; free_bytes?: number } | null | undefined): DiskSpace | null`

- [ ] **Step 1: 写失败测试**

`src/files/util/raidSpaceFallback.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { raidFallbackSpaceFrom } from './raidSpaceFallback'

describe('raidFallbackSpaceFrom', () => {
  it('maps a RAID status onto the sidebar space shape', () => {
    expect(raidFallbackSpaceFrom({ total_bytes: 1000, used_bytes: 400, free_bytes: 600 }))
      .toEqual({ used: 400, total: 1000, avail: 600 })
  })

  it('returns null when total_bytes is missing, zero or negative', () => {
    expect(raidFallbackSpaceFrom({ used_bytes: 400 })).toBeNull()
    expect(raidFallbackSpaceFrom({ total_bytes: 0, used_bytes: 0, free_bytes: 0 })).toBeNull()
    expect(raidFallbackSpaceFrom({ total_bytes: -1 })).toBeNull()
  })

  it('returns null for a missing status rather than inventing a 0/0 array', () => {
    expect(raidFallbackSpaceFrom(null)).toBeNull()
    expect(raidFallbackSpaceFrom(undefined)).toBeNull()
  })

  it('defaults the two optional byte counts to 0 when total is known', () => {
    expect(raidFallbackSpaceFrom({ total_bytes: 1000 })).toEqual({ used: 0, total: 1000, avail: 0 })
  })
})
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm exec vitest run src/files/util/raidSpaceFallback.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

`src/files/util/raidSpaceFallback.ts`:

```ts
export interface DiskSpace {
  used: number
  total: number
  avail: number
}

// GET /storage builds the mount-point -> space map the sidebar reads. When it
// omits a RAID array's mount point the array shows up with no usage at all, so
// we re-derive it from GET /v2/raid/:id/status.
//
// A total of 0 means "not reported yet / not ready", not "an empty array" --
// returning a 0/0 space there would render a fake, permanently-full-looking bar.
export function raidFallbackSpaceFrom(
  status: { total_bytes?: number; used_bytes?: number; free_bytes?: number } | null | undefined,
): DiskSpace | null {
  const total = status?.total_bytes
  if (!(typeof total === 'number' && total > 0)) return null
  return { used: status?.used_bytes || 0, total, avail: status?.free_bytes || 0 }
}
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm exec vitest run src/files/util/raidSpaceFallback.test.ts`
Expected: PASS(4 例)

- [ ] **Step 5: 提交**

```bash
git add src/files/util/raidSpaceFallback.ts src/files/util/raidSpaceFallback.test.ts
git commit -m "feat(files): map RAID status onto the sidebar space shape

Groundwork for the sidebar usage popup: when the storage list omits a RAID
array's mount point, its usage has to come from the array status endpoint."
```

---

### Task 5: 磁盘用量数据源 store

**Files:**
- Create: `src/files/stores/diskUsage.ts` + `src/files/stores/diskUsage.test.ts`

**Interfaces:**
- Consumes: `retryRequest`(Task 1)、`raidFallbackSpaceFrom` / `DiskSpace`(Task 4)
- Produces:
  - `export interface RaidInfo { id: number | string; name?: string; level?: string | number; mount_point?: string }`
  - `export interface DiskDetail { space: DiskSpace | null; raid: RaidInfo | null }`
  - `useDiskUsageStore()` → `{ details: Ref<Record<string, DiskDetail>>, load(): Promise<void>, detailFor(mountPoint: string): DiskDetail | null }`

**取真机 fixture(本步必须先做,不得手编):**

```bash
# 网关公网口在 80;/storage 与 /v2/raid 都要
curl -s 'http://127.0.0.1/v1/storage?system=show' | head -c 2000
curl -s 'http://127.0.0.1/v2/raid' | head -c 1000
```

> 本机是**单盘设备**,`/v2/raid` 极可能返回空数组 —— 那就照实记录,RAID 分支只能靠单测覆盖,**在任务报告里写明「RAID 兜底未经真机验证」**(与 SP6 快照卷同类约束)。**不要**因为拿不到真数据就凭想象编 RAID fixture。

- [ ] **Step 1: 抓 fixture 并记进测试文件顶部注释**

把上面两条 curl 的真实输出(截断到有代表性的一段)贴进 `diskUsage.test.ts` 顶部注释,注明抓取日期。

- [ ] **Step 2: 写失败测试**

`src/files/stores/diskUsage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { useDiskUsageStore } from './diskUsage'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: vi.fn() },
    raid: { list: vi.fn(), getStatus: vi.fn() },
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('diskUsage store', () => {
  it('builds a mount-point space map from the storage list, coercing string bytes', async () => {
    ;(service.storage.list as any).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA', used: '400', size: '1000', avail: '600' }] },
    ])
    ;(service.raid.list as any).mockResolvedValue([])
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA')).toEqual({ space: { used: 400, total: 1000, avail: 600 }, raid: null })
  })

  it('remaps the system partition mounted at / onto /DATA', async () => {
    ;(service.storage.list as any).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/', used: '10', size: '100', avail: '90' }] },
    ])
    ;(service.raid.list as any).mockResolvedValue([])
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA')?.space).toEqual({ used: 10, total: 100, avail: 90 })
  })

  it('attaches RAID info to its mount point', async () => {
    ;(service.storage.list as any).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA/raid0', used: '1', size: '10', avail: '9' }] },
    ])
    ;(service.raid.list as any).mockResolvedValue([{ id: 1, name: 'md0', level: '1', mount_point: '/DATA/raid0' }])
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA/raid0')?.raid).toMatchObject({ id: 1, level: '1' })
  })

  it('falls back to the RAID status endpoint when the storage list omits the mount point', async () => {
    ;(service.storage.list as any).mockResolvedValue([])
    ;(service.raid.list as any).mockResolvedValue([{ id: 7, name: 'md0', level: '5', mount_point: '/DATA/raid5' }])
    ;(service.raid.getStatus as any).mockResolvedValue({ total_bytes: 2000, used_bytes: 500, free_bytes: 1500 })
    const store = useDiskUsageStore()
    await store.load()
    expect(service.raid.getStatus).toHaveBeenCalledWith(7)
    expect(store.detailFor('/DATA/raid5')?.space).toEqual({ used: 500, total: 2000, avail: 1500 })
  })

  it('does NOT call the status endpoint when the storage list already has that mount point', async () => {
    ;(service.storage.list as any).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA/raid5', used: '1', size: '10', avail: '9' }] },
    ])
    ;(service.raid.list as any).mockResolvedValue([{ id: 7, mount_point: '/DATA/raid5' }])
    const store = useDiskUsageStore()
    await store.load()
    expect(service.raid.getStatus).not.toHaveBeenCalled()
  })

  it('keeps the rest of the map when one RAID status call fails', async () => {
    ;(service.storage.list as any).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA', used: '1', size: '10', avail: '9' }] },
    ])
    ;(service.raid.list as any).mockResolvedValue([{ id: 7, mount_point: '/DATA/raid5' }])
    ;(service.raid.getStatus as any).mockRejectedValue(new Error('boom'))
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA')?.space).toEqual({ used: 1, total: 10, avail: 9 })
    expect(store.detailFor('/DATA/raid5')?.space).toBeNull()
  })

  it('survives a RAID list outage without losing the plain disk usage', async () => {
    ;(service.storage.list as any).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA', used: '1', size: '10', avail: '9' }] },
    ])
    ;(service.raid.list as any).mockRejectedValue(new Error('no raid service'))
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA')?.space).toEqual({ used: 1, total: 10, avail: 9 })
  })

  it('returns null for a mount point it knows nothing about', async () => {
    ;(service.storage.list as any).mockResolvedValue([])
    ;(service.raid.list as any).mockResolvedValue([])
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/nope')).toBeNull()
  })
})
```

- [ ] **Step 3: 跑测试确认红**

Run: `pnpm exec vitest run src/files/stores/diskUsage.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 4: 实现**

`src/files/stores/diskUsage.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { retryRequest } from '../../util/retryRequest'
import { raidFallbackSpaceFrom, type DiskSpace } from '../util/raidSpaceFallback'

export interface RaidInfo {
  id: number | string
  name?: string
  level?: string | number
  mount_point?: string
}

export interface DiskDetail {
  space: DiskSpace | null
  raid: RaidInfo | null
}

// GET /storage reports the system partition as mount_point "/", but the product
// never browses from the real filesystem root -- everywhere else calls it /DATA.
const SYSTEM_MOUNT = '/'
const SYSTEM_MOUNT_AS = '/DATA'

export const useDiskUsageStore = defineStore('files-disk-usage', () => {
  const details = ref<Record<string, DiskDetail>>({})

  function detailFor(mountPoint: string): DiskDetail | null {
    return details.value[mountPoint] ?? null
  }

  async function load(): Promise<void> {
    // The storage list is the primary source and worth retrying; the RAID list
    // is supplementary, so a machine with no RAID service still gets plain
    // disk usage instead of an empty popup.
    const groups = (await retryRequest(() => service.storage.list({ system: 'show' }) as Promise<unknown[]>).catch(
      (e) => {
        console.warn('[files] storage list failed', e)
        return [] as unknown[]
      },
    )) as any[]
    const raidList = (await (service.raid.list() as Promise<unknown[]>).catch((e) => {
      console.warn('[files] raid list failed', e)
      return [] as unknown[]
    })) as RaidInfo[]

    // storage reports size/used/avail as strings.
    const spaceByMount: Record<string, DiskSpace> = {}
    for (const g of groups || []) {
      for (const part of g?.children || []) {
        const mp = part?.mount_point === SYSTEM_MOUNT ? SYSTEM_MOUNT_AS : part?.mount_point
        if (!mp) continue
        const total = Number(part.size)
        if (!(total > 0)) continue
        spaceByMount[mp] = { used: Number(part.used) || 0, total, avail: Number(part.avail) || 0 }
      }
    }

    const raidByMount: Record<string, RaidInfo> = {}
    for (const r of raidList || []) if (r?.mount_point) raidByMount[r.mount_point] = r

    // Only for arrays the storage list left out -- each failure is ignored on
    // its own so one bad array cannot blank the others.
    const fallback: Record<string, DiskSpace> = {}
    await Promise.all(
      (raidList || [])
        .filter((r) => r?.mount_point && !spaceByMount[r.mount_point!])
        .map((r) =>
          (service.raid.getStatus(r.id) as Promise<unknown>)
            .then((st) => {
              const space = raidFallbackSpaceFrom(st as any)
              if (space) fallback[r.mount_point!] = space
            })
            .catch((e) => console.warn('[files] raid status failed', r.id, e)),
        ),
    )

    const next: Record<string, DiskDetail> = {}
    for (const mp of new Set([...Object.keys(spaceByMount), ...Object.keys(raidByMount)])) {
      next[mp] = { space: spaceByMount[mp] || fallback[mp] || null, raid: raidByMount[mp] || null }
    }
    details.value = next
  }

  return { details, load, detailFor }
})
```

- [ ] **Step 5: 跑测试确认绿**

Run: `pnpm exec vitest run src/files/stores/diskUsage.test.ts`
Expected: PASS(8 例)

- [ ] **Step 6: 提交**

```bash
git add src/files/stores/diskUsage.ts src/files/stores/diskUsage.test.ts
git commit -m "feat(files): add the sidebar disk usage data source

Combines the storage list with the RAID list, and re-derives usage from the
array status endpoint for any array the storage list left out."
```

---

### Task 6: 用量悬浮窗组件 + 接进侧栏

**Files:**
- Create: `src/files/util/diskUsageFormat.ts` + `src/files/util/diskUsageFormat.test.ts`
- Create: `src/files/components/DiskUsageTip.vue` + `src/files/components/DiskUsageTip.test.ts`
- Modify: `src/files/components/FilesSidebar.vue`
- Modify: `src/files/components/FilesSidebar.test.ts`(追加)
- Modify: `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `DiskDetail`(Task 5)、`renderSize`(既有 `src/files/util/format.ts`)
- Produces: `usedPercent(space: DiskSpace | null): number`;`<DiskUsageTip :detail="d" />`

- [ ] **Step 1: 写 usedPercent 失败测试**

`src/files/util/diskUsageFormat.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { usedPercent } from './diskUsageFormat'

describe('usedPercent', () => {
  it('rounds the used share to a whole percent', () => {
    expect(usedPercent({ used: 400, total: 1000, avail: 600 })).toBe(40)
    expect(usedPercent({ used: 336, total: 1000, avail: 664 })).toBe(34)
  })

  it('floors a non-empty disk at 1% so the bar is never invisible', () => {
    expect(usedPercent({ used: 1, total: 1_000_000, avail: 999_999 })).toBe(1)
  })

  it('reports 0 for a genuinely empty disk', () => {
    expect(usedPercent({ used: 0, total: 1000, avail: 1000 })).toBe(0)
  })

  it('reports 0 rather than dividing by zero or by nothing', () => {
    expect(usedPercent({ used: 5, total: 0, avail: 0 })).toBe(0)
    expect(usedPercent(null)).toBe(0)
  })

  it('clamps a backend overshoot to 100', () => {
    expect(usedPercent({ used: 1200, total: 1000, avail: 0 })).toBe(100)
  })
})
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm exec vitest run src/files/util/diskUsageFormat.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

`src/files/util/diskUsageFormat.ts`:

```ts
import type { DiskSpace } from './raidSpaceFallback'

// A disk with a little data on it must not round down to a 0%-wide bar that
// reads as "empty"; and a backend overshoot must not overflow the track.
export function usedPercent(space: DiskSpace | null | undefined): number {
  if (!space || !(space.total > 0)) return 0
  const p = Math.round((space.used / space.total) * 100)
  if (space.used > 0 && p < 1) return 1
  return Math.max(0, Math.min(100, p))
}
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm exec vitest run src/files/util/diskUsageFormat.test.ts`
Expected: PASS(5 例)

- [ ] **Step 5: 加 i18n 键**

`zh_cn.base.ts`:

```ts
  filesDiskUsed: '已用',
  filesDiskAvailable: '可用',
  filesDiskCapacity: '容量',
  filesDiskDetails: '容量详情',
```

`en_us.base.ts`:

```ts
  filesDiskUsed: 'Used',
  filesDiskAvailable: 'Available',
  filesDiskCapacity: 'Capacity',
  filesDiskDetails: 'Capacity details',
```

- [ ] **Step 6: 加 theme token**

`src/styles/theme.css`,在 `:root` 与 `:root[data-theme="light"]` **两个块**各加一条(值按各自主题既有风格挑,深色用偏亮的中性色、浅色用偏深的中性色):

```css
  --usage-track: <该主题下的轨道底色>;
```

> 落地前先读 `docs/THEMING.md` 的 token 目录,若已有语义等价的 token(如 `--chip-bg`)**就直接复用、不要新增**。新增了就必须两块都给值。

- [ ] **Step 7: 写组件失败测试**

`src/files/components/DiskUsageTip.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import DiskUsageTip from './DiskUsageTip.vue'

// 注:不新建 i18n 实例会与 vitest.setup 的全局单例重复安装 —— 照本仓既有组件
// 测试的做法接全局插件即可;此处沿用文件内既有 helper 若有。
function mountTip(detail: any) {
  return mount(DiskUsageTip, { props: { detail } })
}

describe('DiskUsageTip', () => {
  it('renders used / total, the bar width and available', () => {
    const w = mountTip({ space: { used: 400, total: 1000, avail: 600 }, raid: null })
    expect(w.text()).toContain('40%')
    expect(w.find('.disk-tip-bar-fill').attributes('style')).toContain('width: 40%')
    expect(w.findAll('.disk-tip-row').length).toBeGreaterThanOrEqual(2)
  })

  it('renders the RAID level when the mount point is an array', () => {
    const w = mountTip({ space: { used: 1, total: 10, avail: 9 }, raid: { id: 1, level: '5' } })
    expect(w.text()).toContain('RAID 5')
  })

  it('shows a capacity dash when neither space nor RAID is known', () => {
    const w = mountTip({ space: null, raid: null })
    expect(w.text()).toContain('—')
    expect(w.find('.disk-tip-bar').exists()).toBe(false)
  })

  it('renders the RAID row with no bar when only RAID info is known', () => {
    const w = mountTip({ space: null, raid: { id: 1, level: '1' } })
    expect(w.text()).toContain('RAID 1')
    expect(w.find('.disk-tip-bar').exists()).toBe(false)
  })
})
```

- [ ] **Step 8: 跑测试确认红**

Run: `pnpm exec vitest run src/files/components/DiskUsageTip.test.ts`
Expected: FAIL — 组件不存在

- [ ] **Step 9: 实现组件**

`src/files/components/DiskUsageTip.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderSize } from '../util/format'
import { usedPercent } from '../util/diskUsageFormat'
import type { DiskDetail } from '../stores/diskUsage'

const props = defineProps<{ detail: DiskDetail }>()
const { t } = useI18n()

const space = computed(() => props.detail?.space ?? null)
const raid = computed(() => props.detail?.raid ?? null)
const pct = computed(() => usedPercent(space.value))
</script>

<template>
  <div class="disk-tip">
    <template v-if="space">
      <div class="disk-tip-row">
        <span class="disk-tip-l">{{ t('filesDiskUsed') }}</span>
        <span class="disk-tip-v">{{ renderSize(space.used) }} / {{ renderSize(space.total) }}</span>
      </div>
      <div class="disk-tip-bar-wrap">
        <div class="disk-tip-bar"><div class="disk-tip-bar-fill" :style="{ width: pct + '%' }"></div></div>
        <span class="disk-tip-pct">{{ pct }}%</span>
      </div>
      <div class="disk-tip-row">
        <span class="disk-tip-l">{{ t('filesDiskAvailable') }}</span>
        <span class="disk-tip-v">{{ renderSize(space.avail) }}</span>
      </div>
    </template>
    <div v-if="raid" class="disk-tip-row">
      <span class="disk-tip-l">RAID</span>
      <span class="disk-tip-v">RAID {{ raid.level }}</span>
    </div>
    <div v-if="!space && !raid" class="disk-tip-row">
      <span class="disk-tip-l">{{ t('filesDiskCapacity') }}</span>
      <span class="disk-tip-v">—</span>
    </div>
  </div>
</template>

<style scoped>
.disk-tip {
  min-width: 190px; padding: 10px 12px; border-radius: 12px;
  background: var(--popup-bg); border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur); color: var(--fg);
  display: flex; flex-direction: column; gap: 6px;
}
.disk-tip-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 12px; }
.disk-tip-l { color: var(--fg-muted); }
.disk-tip-v { font-variant-numeric: tabular-nums; }
.disk-tip-bar-wrap { display: flex; align-items: center; gap: 8px; }
.disk-tip-bar { flex: 1 1 auto; height: 6px; border-radius: 999px; background: var(--usage-track); overflow: hidden; }
.disk-tip-bar-fill { height: 100%; background: var(--accent); }
.disk-tip-pct { flex: 0 0 auto; font-size: 11px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
</style>
```

> Step 6 若决定复用既有 token,把 `var(--usage-track)` 换成那个 token。

- [ ] **Step 10: 跑测试确认绿**

Run: `pnpm exec vitest run src/files/components/DiskUsageTip.test.ts`
Expected: PASS(4 例)

- [ ] **Step 11: 接进侧栏**

`src/files/components/FilesSidebar.vue`:

1. `<script setup>` 顶部加:

```ts
import DiskUsageTip from './DiskUsageTip.vue'
import { useDiskUsageStore } from '../stores/diskUsage'
```

2. 在 `const mounts = useMountsStore()` 下面加:

```ts
const diskUsage = useDiskUsageStore()
onMounted(() => { diskUsage.load().catch((e) => console.warn('[files] disk usage load failed', e)) })

// Fixed positioning, anchored to the viewport: the sidebar is a scroll
// container, so an absolutely-positioned tip would be clipped by it.
const tipFor = ref<string | null>(null)
const tipStyle = ref<Record<string, string>>({})
function showTip(mountPoint: string, e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  tipStyle.value = { position: 'fixed', left: `${r.right + 8}px`, top: `${r.top + r.height / 2}px`, transform: 'translateY(-50%)', zIndex: '160' }
  tipFor.value = mountPoint
}
function hideTip() { tipFor.value = null }
```

并把 `onUnmounted` 那行上方的 `import { computed, ref, watch, onUnmounted } from 'vue'` 补上 `onMounted`。

3. 磁盘 `<li>`(171-186 行)里,在 `<span class="side-name">` 之后、eject 按钮之前插入:

```html
          <button
            v-if="diskUsage.detailFor(disk.path)"
            class="side-dots"
            type="button"
            :aria-label="t('filesDiskDetails')"
            @click.stop
            @mouseenter="showTip(disk.path, $event)"
            @mouseleave="hideTip"
          >⋮</button>
```

4. 在 `</aside>` 之前插入浮层:

```html
    <DiskUsageTip v-if="tipFor && diskUsage.detailFor(tipFor)" :detail="diskUsage.detailFor(tipFor)!" :style="tipStyle" />
```

5. 样式补:

```css
.side-dots { opacity: 0; background: none; border: none; color: var(--fg-muted); cursor: default; font-size: 14px; line-height: 1; padding: 0 2px; }
.side-item:hover .side-dots { opacity: 1; }
```

- [ ] **Step 12: 补侧栏挂载测试**

`src/files/components/FilesSidebar.test.ts` 追加:

```ts
  it('shows the ⋮ affordance only for disks it has usage for', async () => {
    const usage = useDiskUsageStore()
    usage.details = { '/DATA': { space: { used: 1, total: 10, avail: 9 }, raid: null } }
    const files = useFilesStore()
    files.disks = [
      { name: 'NimoOS-HD', path: '/DATA', usb: false },
      { name: 'Unknown', path: '/mnt/x', usb: false },
    ]
    const w = await mountSidebar()   // 照该文件既有 helper
    expect(w.findAll('.side-dots').length).toBe(1)
  })

  it('opens the usage tip on hover and closes it on leave', async () => {
    const usage = useDiskUsageStore()
    usage.details = { '/DATA': { space: { used: 4, total: 10, avail: 6 }, raid: null } }
    const files = useFilesStore()
    files.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }]
    const w = await mountSidebar()
    expect(w.find('.disk-tip').exists()).toBe(false)
    await w.find('.side-dots').trigger('mouseenter')
    expect(w.find('.disk-tip').exists()).toBe(true)
    expect(w.find('.disk-tip').text()).toContain('40%')
    await w.find('.side-dots').trigger('mouseleave')
    expect(w.find('.disk-tip').exists()).toBe(false)
  })

  it('does not navigate when the ⋮ is clicked', async () => {
    const usage = useDiskUsageStore()
    usage.details = { '/DATA': { space: { used: 4, total: 10, avail: 6 }, raid: null } }
    const files = useFilesStore()
    files.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }]
    const w = await mountSidebar()
    await w.find('.side-dots').trigger('click')
    expect(w.emitted('navigate')).toBeFalsy()
  })
```

> `mouseenter` 在 jsdom 里 `currentTarget.getBoundingClientRect()` 全 0,`tipStyle` 会是 `0px` —— 这是**预期**的,断言只查开合与内容,**不要**断言坐标数值。

- [ ] **Step 13: 变异验证**

删掉 `@click.stop`,确认第三条测试变红;还原。

- [ ] **Step 14: 跑三门 + 提交**

```bash
pnpm exec vue-tsc --noEmit
pnpm exec vitest run src/i18n/parity.test.ts
pnpm test
```
Expected: 全绿

```bash
git add src/files/util/diskUsageFormat.ts src/files/util/diskUsageFormat.test.ts src/files/components/DiskUsageTip.vue src/files/components/DiskUsageTip.test.ts src/files/components/FilesSidebar.vue src/files/components/FilesSidebar.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/styles/theme.css
git commit -m "feat(files): show disk usage in the sidebar behind a hover affordance

Ports the Vue2 capacity popup: used/total with a bar, available, and the RAID
level for arrays. Without it the RAID usage fallback had nothing to attach to."
```

---

# B 线 —— T11 网格虚拟滚动

### Task 7: 虚拟化纯函数

**Files:**
- Create: `src/files/util/gridVirtual.ts` + `src/files/util/gridVirtual.test.ts`

**Interfaces:**
- Produces:
  - `columnsFor(containerWidth: number, minColWidth: number, gap: number): number` — 至少 1
  - `chunkRows<T>(list: T[], cols: number): T[][]`
  - `computeVisibleRange(input: { scrollTop: number; viewportHeight: number; rowHeight: number; rowCount: number; buffer: number }): { start: number; end: number }` — `end` 独占

- [ ] **Step 1: 写失败测试**

`src/files/util/gridVirtual.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { columnsFor, chunkRows, computeVisibleRange } from './gridVirtual'

describe('columnsFor', () => {
  it('matches CSS auto-fill: floor((width + gap) / (min + gap))', () => {
    expect(columnsFor(614, 120, 14)).toBe(4)   // (614+14)/134 = 4.68
    expect(columnsFor(134, 120, 14)).toBe(1)
    expect(columnsFor(268, 120, 14)).toBe(2)
  })

  it('never returns less than one column, even at zero width', () => {
    expect(columnsFor(0, 120, 14)).toBe(1)
    expect(columnsFor(-5, 120, 14)).toBe(1)
  })
})

describe('chunkRows', () => {
  it('slices a flat list into rows of `cols`', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns an empty array for an empty list', () => {
    expect(chunkRows([], 3)).toEqual([])
  })

  it('coerces a nonsense column count to 1 rather than looping forever', () => {
    expect(chunkRows([1, 2], 0)).toEqual([[1], [2]])
    expect(chunkRows([1, 2], -3)).toEqual([[1], [2]])
    expect(chunkRows([1, 2], 1.7)).toEqual([[1], [2]])
  })
})

describe('computeVisibleRange', () => {
  const base = { rowHeight: 130, rowCount: 100, buffer: 2 }

  it('covers the viewport plus the buffer on both sides', () => {
    // scrollTop 1300 -> row 10 at top; 600px viewport -> ~4.6 rows
    const r = computeVisibleRange({ ...base, scrollTop: 1300, viewportHeight: 600 })
    expect(r.start).toBe(8)          // 10 - buffer
    expect(r.end).toBe(17)           // ceil((1300+600)/130)=15, +2 buffer
  })

  it('clamps to the start of the list', () => {
    expect(computeVisibleRange({ ...base, scrollTop: 0, viewportHeight: 600 }).start).toBe(0)
  })

  it('clamps to the end of the list', () => {
    const r = computeVisibleRange({ ...base, scrollTop: 99999, viewportHeight: 600 })
    expect(r.end).toBe(100)
    expect(r.start).toBeLessThanOrEqual(100)
  })

  it('renders everything when the row height is unknown, rather than nothing', () => {
    const r = computeVisibleRange({ ...base, rowHeight: 0, scrollTop: 0, viewportHeight: 600 })
    expect(r).toEqual({ start: 0, end: 100 })
  })

  it('returns an empty range for an empty list', () => {
    expect(computeVisibleRange({ ...base, rowCount: 0, scrollTop: 0, viewportHeight: 600 })).toEqual({ start: 0, end: 0 })
  })
})
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm exec vitest run src/files/util/gridVirtual.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

`src/files/util/gridVirtual.ts`:

```ts
// Mirrors what `grid-template-columns: repeat(auto-fill, minmax(N, 1fr))` does,
// so the virtualized geometry lines up with what CSS actually lays out.
export function columnsFor(containerWidth: number, minColWidth: number, gap: number): number {
  if (!(containerWidth > 0) || !(minColWidth > 0)) return 1
  return Math.max(1, Math.floor((containerWidth + gap) / (minColWidth + gap)))
}

export function chunkRows<T>(list: T[], cols: number): T[][] {
  const n = Math.max(1, Math.floor(cols) || 1)
  const rows: T[][] = []
  if (!Array.isArray(list)) return rows
  for (let i = 0; i < list.length; i += n) rows.push(list.slice(i, i + n))
  return rows
}

// `end` is exclusive. A row height of 0 means "not measured yet"; render the
// whole list in that case -- rendering nothing would leave a blank grid that
// never recovers, because the measurement comes from a rendered row.
export function computeVisibleRange({
  scrollTop,
  viewportHeight,
  rowHeight,
  rowCount,
  buffer,
}: {
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  rowCount: number
  buffer: number
}): { start: number; end: number } {
  if (rowCount <= 0) return { start: 0, end: 0 }
  if (!(rowHeight > 0)) return { start: 0, end: rowCount }
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const last = Math.ceil((Math.max(0, scrollTop) + Math.max(0, viewportHeight)) / rowHeight)
  return {
    start: Math.max(0, Math.min(rowCount, first - buffer)),
    end: Math.max(0, Math.min(rowCount, last + buffer)),
  }
}
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm exec vitest run src/files/util/gridVirtual.test.ts`
Expected: PASS(11 例)

- [ ] **Step 5: 提交**

```bash
git add src/files/util/gridVirtual.ts src/files/util/gridVirtual.test.ts
git commit -m "feat(files): add the pure geometry for grid virtualization"
```

---

### Task 8: 框选矩形改按几何生成

**Files:**
- Create: `src/files/util/gridGeometry.ts` + `src/files/util/gridGeometry.test.ts`

**Interfaces:**
- Consumes: `ItemRect` / `Rect`(既有 `src/files/util/marquee.ts`)
- Produces: `rectsFromGeometry(input: { paths: string[]; cols: number; colWidth: number; rowHeight: number; gap: number; originLeft: number; originTop: number }): ItemRect[]`

**为什么要它:** 虚拟化后屏幕外的卡片没有 DOM,`Files.vue:412` 的 `querySelectorAll('[data-path]')` 只能量到可视那几行,框选会漏选。`marqueeSelect` 本身是纯几何、**不动**;换的是喂给它的矩形从哪来。矩形必须是**视口坐标**,因为选框来自 `e.clientX/clientY`。

- [ ] **Step 1: 写失败测试**

`src/files/util/gridGeometry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rectsFromGeometry } from './gridGeometry'
import { marqueeSelect, rectFromPoints } from './marquee'

const geom = { cols: 3, colWidth: 100, rowHeight: 130, gap: 14, originLeft: 50, originTop: 200 }

describe('rectsFromGeometry', () => {
  it('places item 0 at the grid origin', () => {
    const [first] = rectsFromGeometry({ ...geom, paths: ['/a'] })
    expect(first).toEqual({ path: '/a', rect: { left: 50, top: 200, right: 150, bottom: 330 } })
  })

  it('advances by colWidth + gap across a row', () => {
    const rects = rectsFromGeometry({ ...geom, paths: ['/a', '/b', '/c'] })
    expect(rects[1].rect.left).toBe(50 + 100 + 14)
    expect(rects[2].rect.left).toBe(50 + 2 * (100 + 14))
  })

  it('wraps to the next row after `cols` items, advancing by rowHeight', () => {
    const rects = rectsFromGeometry({ ...geom, paths: ['/a', '/b', '/c', '/d'] })
    expect(rects[3].rect.left).toBe(50)
    expect(rects[3].rect.top).toBe(200 + 130)
  })

  it('emits one rect per path, in order', () => {
    const rects = rectsFromGeometry({ ...geom, paths: ['/a', '/b', '/c', '/d', '/e'] })
    expect(rects.map((r) => r.path)).toEqual(['/a', '/b', '/c', '/d', '/e'])
  })

  it('returns nothing for an empty list', () => {
    expect(rectsFromGeometry({ ...geom, paths: [] })).toEqual([])
  })

  it('feeds marqueeSelect so off-screen rows are still selectable', () => {
    // 200 items = 67 rows; a box over rows 40-41 must select them even though
    // nothing in that range would ever be in the DOM.
    const paths = Array.from({ length: 200 }, (_, i) => `/f${i}`)
    const rects = rectsFromGeometry({ ...geom, paths })
    const y = 200 + 40 * 130 + 5
    const sel = rectFromPoints(40, y, 400, y + 130)
    const picked = marqueeSelect(rects, sel)
    expect(picked).toContain('/f120')   // row 40, col 0
    expect(picked).toContain('/f122')   // row 40, col 2
  })
})
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm exec vitest run src/files/util/gridGeometry.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

`src/files/util/gridGeometry.ts`:

```ts
import type { ItemRect } from './marquee'

// Marquee selection used to measure real DOM nodes. Once the grid is
// virtualized the off-screen rows have no nodes at all, so their rects have to
// be derived from the layout instead -- otherwise dragging past the viewport
// silently selects nothing.
//
// Coordinates are VIEWPORT coordinates, because the selection rectangle comes
// from pointer clientX/clientY. `originLeft`/`originTop` are the grid
// container's own getBoundingClientRect(), which already moves with scrolling.
export function rectsFromGeometry({
  paths,
  cols,
  colWidth,
  rowHeight,
  gap,
  originLeft,
  originTop,
}: {
  paths: string[]
  cols: number
  colWidth: number
  rowHeight: number
  gap: number
  originLeft: number
  originTop: number
}): ItemRect[] {
  const n = Math.max(1, Math.floor(cols) || 1)
  return paths.map((path, i) => {
    const row = Math.floor(i / n)
    const col = i % n
    const left = originLeft + col * (colWidth + gap)
    const top = originTop + row * rowHeight
    return { path, rect: { left, top, right: left + colWidth, bottom: top + rowHeight } }
  })
}
```

> 注意 `rowHeight` **已含行间 gap**(实现侧按「一行占用的垂直步进」测量),所以纵向不再另加 gap;横向 `colWidth` 是卡片自身宽度,要另加 gap。这条不对称在测试里被第 2、3 条钉住了。

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm exec vitest run src/files/util/gridGeometry.test.ts`
Expected: PASS(6 例)

- [ ] **Step 5: 提交**

```bash
git add src/files/util/gridGeometry.ts src/files/util/gridGeometry.test.ts
git commit -m "feat(files): derive marquee rects from grid geometry

Off-screen rows have no DOM once the grid is virtualized, so measuring nodes
would silently stop selecting anything the user dragged past."
```

---

### Task 9: `FileGridView` 虚拟滚动

**Files:**
- Modify: `src/files/components/FileGridView.vue`
- Create: `src/files/components/FileGridView.test.ts`

**Interfaces:**
- Consumes: `columnsFor` / `chunkRows` / `computeVisibleRange`(Task 7)、`rectsFromGeometry`(Task 8)
- Produces(`defineExpose`,供 Task 10 用):
  - `itemRects(): ItemRect[]`
  - `scrollToPath(path: string): void`

**约束:**
- 常量:`MIN_COL = 120`、`GAP = 14`(与 `.file-grid` 的 CSS 逐字一致)、`BUFFER_ROWS = 3`、`FALLBACK_ROW_HEIGHT = 130`。
- **滚动源是 `.area-body`**(`AreaShell.vue:32`),但不要写死类名 —— 向上找第一个 `overflow` 为 `auto|scroll` 的祖先,找不到则退回 `window`。
- 行高**实测优先**:渲染出第一行后量 `offsetHeight + GAP`;量到之前用 `FALLBACK_ROW_HEIGHT`。
- 上下用 spacer `<div>` 撑出总高,保证滚动条长度不跳。
- **`:key` 保持 `entry.path`**(不要换成行索引):Vue 的 keyed diff 会销毁/重建卡片而不是回收复用,Vue2 那两条「实例回收致缩略图串台」的守卫(spec §8 风险 4)在这里不成立;换成索引 key 才会把那个坑引进来。

- [ ] **Step 1: 写失败测试**

`src/files/components/FileGridView.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FileGridView from './FileGridView.vue'

function entries(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    name: `f${i}`, path: `/DATA/f${i}`, is_dir: false, size: 1, date: '', extensions: {},
  })) as any[]
}

// jsdom lays nothing out: clientWidth/offsetHeight are 0. Stub the two
// measurements the component takes so the virtualization has real numbers.
function stubLayout(width = 614, rowHeight = 116) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => rowHeight })
}

beforeEach(() => {
  stubLayout()
  ;(globalThis as any).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  }
})

describe('FileGridView virtualization', () => {
  it('renders every tile when the list is short', async () => {
    const w = mount(FileGridView, { props: { entries: entries(8) }, global: { stubs: { FileTile: { template: '<div class="tile"/>' } } } })
    await w.vm.$nextTick()
    expect(w.findAll('.tile').length).toBe(8)
  })

  it('renders far fewer tiles than entries for a large list', async () => {
    const w = mount(FileGridView, { props: { entries: entries(5000) }, global: { stubs: { FileTile: { template: '<div class="tile"/>' } } } })
    await w.vm.$nextTick()
    const rendered = w.findAll('.tile').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(500)
  })

  it('exposes a rect for EVERY entry, including ones with no DOM', async () => {
    const w = mount(FileGridView, { props: { entries: entries(5000) }, global: { stubs: { FileTile: { template: '<div class="tile"/>' } } } })
    await w.vm.$nextTick()
    const rects = (w.vm as any).itemRects()
    expect(rects.length).toBe(5000)
    expect(rects[4999].path).toBe('/DATA/f4999')
    expect(w.findAll('.tile').length).toBeLessThan(500)
  })

  it('keeps the total scroll height stable via spacers', async () => {
    const w = mount(FileGridView, { props: { entries: entries(5000) }, global: { stubs: { FileTile: { template: '<div class="tile"/>' } } } })
    await w.vm.$nextTick()
    const top = w.find('.grid-spacer-top').attributes('style') || ''
    const bottom = w.find('.grid-spacer-bottom').attributes('style') || ''
    expect(top + bottom).toContain('height')
  })

  it('still forwards open / select / contextmenu / open-batch from a tile', async () => {
    const w = mount(FileGridView, {
      props: { entries: entries(3) },
      global: { stubs: { FileTile: { template: '<div class="tile" @click="$emit(\'open-batch\', \'b1\')"/>' } } },
    })
    await w.vm.$nextTick()
    await w.find('.tile').trigger('click')
    expect(w.emitted('open-batch')?.[0]).toEqual(['b1'])
  })
})
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm exec vitest run src/files/components/FileGridView.test.ts`
Expected: FAIL — `itemRects is not a function` / 全部 5000 个 tile 都渲染了

- [ ] **Step 3: 实现**

`src/files/components/FileGridView.vue` 整体替换:

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import type { FileEntry } from '../stores/files'
import { columnsFor, chunkRows, computeVisibleRange } from '../util/gridVirtual'
import { rectsFromGeometry } from '../util/gridGeometry'
import type { ItemRect } from '../util/marquee'
import FileTile from './FileTile.vue'

const props = defineProps<{ entries: FileEntry[]; selectedPaths?: Set<string> }>()
const emit = defineEmits<{
  (e: 'open', entry: FileEntry): void
  (e: 'select', payload: { entry: FileEntry; mode: 'toggle' | 'range' }): void
  (e: 'contextmenu', payload: { entry: FileEntry; event: MouseEvent }): void
  (e: 'open-batch', batchId: string): void
}>()

// Must stay in lockstep with the .file-grid CSS below.
const MIN_COL = 120
const GAP = 14
const BUFFER_ROWS = 3
// Used until a real row has been rendered and measured; roughly one tile
// (14px padding + 64px icon + 6px gap + ~18px label + 14px padding) plus GAP.
const FALLBACK_ROW_HEIGHT = 130

const root = ref<HTMLElement | null>(null)
const rowsWrap = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const rowHeight = ref(FALLBACK_ROW_HEIGHT)
const scrollTop = ref(0)
const viewportHeight = ref(0)

const cols = computed(() => columnsFor(containerWidth.value, MIN_COL, GAP))
const colWidth = computed(() =>
  cols.value > 0 ? (containerWidth.value - GAP * (cols.value - 1)) / cols.value : MIN_COL,
)
const rows = computed(() => chunkRows(props.entries, cols.value))
const range = computed(() =>
  computeVisibleRange({
    scrollTop: scrollTop.value,
    viewportHeight: viewportHeight.value,
    rowHeight: rowHeight.value,
    rowCount: rows.value.length,
    buffer: BUFFER_ROWS,
  }),
)
const visibleRows = computed(() => rows.value.slice(range.value.start, range.value.end))
const padTop = computed(() => range.value.start * rowHeight.value)
const padBottom = computed(() => Math.max(0, (rows.value.length - range.value.end) * rowHeight.value))

// The nearest scrollable ancestor -- AreaShell's .area-body in practice, but
// resolved rather than hard-coded so a different host still works.
function scrollParent(el: HTMLElement | null): HTMLElement | Window {
  let node = el?.parentElement ?? null
  while (node) {
    const overflow = getComputedStyle(node).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return node
    node = node.parentElement
  }
  return window
}
let scroller: HTMLElement | Window = window
let rafId = 0

function readScroll() {
  const el = root.value
  if (!el) return
  // Distance the grid's top has travelled above the scroll viewport's top.
  const gridTop = el.getBoundingClientRect().top
  const viewTop = scroller === window ? 0 : (scroller as HTMLElement).getBoundingClientRect().top
  const viewH = scroller === window ? window.innerHeight : (scroller as HTMLElement).clientHeight
  scrollTop.value = Math.max(0, viewTop - gridTop)
  viewportHeight.value = viewH
}
function onScroll() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    readScroll()
  })
}

function measure() {
  const el = root.value
  if (!el) return
  containerWidth.value = el.clientWidth
  const firstRow = rowsWrap.value?.firstElementChild as HTMLElement | null
  if (firstRow && firstRow.offsetHeight > 0) rowHeight.value = firstRow.offsetHeight + GAP
  readScroll()
}

let ro: ResizeObserver | null = null
onMounted(async () => {
  scroller = scrollParent(root.value)
  measure()
  await nextTick()
  measure()
  ro = new ResizeObserver(() => measure())
  if (root.value) ro.observe(root.value)
  scroller.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', measure)
})
onUnmounted(() => {
  ro?.disconnect()
  scroller.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', measure)
  if (rafId) cancelAnimationFrame(rafId)
})

// Re-measure after the list changes: the first row may only exist now.
watch(() => props.entries.length, async () => {
  await nextTick()
  measure()
})

// Every entry gets a rect, not just the rendered ones -- see gridGeometry.ts.
function itemRects(): ItemRect[] {
  const el = root.value
  const box = el ? el.getBoundingClientRect() : { left: 0, top: 0 }
  return rectsFromGeometry({
    paths: props.entries.map((e) => e.path),
    cols: cols.value,
    colWidth: colWidth.value,
    rowHeight: rowHeight.value,
    gap: GAP,
    originLeft: box.left,
    originTop: box.top,
  })
}

// Scrolling to an off-screen item cannot go through scrollIntoView -- there is
// no element to scroll to. Compute the row offset instead.
function scrollToPath(path: string): void {
  const i = props.entries.findIndex((e) => e.path === path)
  if (i < 0 || !root.value) return
  const row = Math.floor(i / cols.value)
  const target = root.value.getBoundingClientRect().top + window.scrollY + row * rowHeight.value
  if (scroller === window) window.scrollTo({ top: Math.max(0, target - window.innerHeight / 2) })
  else {
    const s = scroller as HTMLElement
    s.scrollTop = Math.max(0, s.scrollTop + (row * rowHeight.value - scrollTop.value) - s.clientHeight / 2)
  }
}

defineExpose({ itemRects, scrollToPath })
</script>

<template>
  <div ref="root" class="file-grid-root">
    <div class="grid-spacer-top" :style="{ height: padTop + 'px' }"></div>
    <div ref="rowsWrap">
      <div v-for="(row, ri) in visibleRows" :key="range.start + ri" class="file-grid">
        <FileTile
          v-for="entry in row"
          :key="entry.path"
          :entry="entry"
          :selected="props.selectedPaths?.has(entry.path)"
          @open="emit('open', $event)"
          @select="emit('select', $event)"
          @contextmenu="emit('contextmenu', $event)"
          @open-batch="emit('open-batch', $event)"
        />
      </div>
    </div>
    <div class="grid-spacer-bottom" :style="{ height: padBottom + 'px' }"></div>
  </div>
</template>

<style scoped>
/* Column geometry duplicated in gridVirtual's MIN_COL/GAP constants -- keep
   both sides in step if either changes. */
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 14px; margin-bottom: 14px; }
.file-grid:last-child { margin-bottom: 0; }
</style>
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm exec vitest run src/files/components/FileGridView.test.ts`
Expected: PASS(5 例)

- [ ] **Step 5: 变异验证**

把 `visibleRows` 临时改成 `rows`,确认第 2、3 条测试变红;还原。

- [ ] **Step 6: 跑全量 + 提交**

Run: `pnpm test`

```bash
git add src/files/components/FileGridView.vue src/files/components/FileGridView.test.ts
git commit -m "perf(files): virtualize the grid view by row

A folder with a few thousand files rendered every tile up front. Slice into
rows, render only the visible window plus a buffer, and hold the scroll height
with spacers. Rects for marquee selection now come from geometry, since the
off-screen rows deliberately have no DOM."
```

---

### Task 10: `Files.vue` 改用网格几何(框选 + 深链高亮)

**Files:**
- Modify: `src/views/Files.vue:361-373,389-416`
- Modify: `src/views/Files.test.ts`(追加)

**Interfaces:**
- Consumes: `FileGridView` 的 `itemRects()` / `scrollToPath()`(Task 9)

- [ ] **Step 1: 写失败测试**

`src/views/Files.test.ts` 追加:

```ts
  it('takes marquee rects from the grid component in grid mode', async () => {
    const files = useFilesStore()
    files.setView('grid')
    const w = await mountFiles()
    const grid = w.findComponent({ name: 'FileGridView' })
    const spy = vi.spyOn(grid.vm as any, 'itemRects').mockReturnValue([])
    const wrap = w.find('.files-listwrap')
    await wrap.trigger('mousedown', { clientX: 0, clientY: 0, button: 0 })
    await wrap.trigger('mousemove', { clientX: 50, clientY: 50 })
    expect(spy).toHaveBeenCalled()
  })

  it('falls back to measuring DOM nodes in list mode', async () => {
    const files = useFilesStore()
    files.setView('list')
    const w = await mountFiles()
    expect(w.findComponent({ name: 'FileGridView' }).exists()).toBe(false)
    const wrap = w.find('.files-listwrap')
    await wrap.trigger('mousedown', { clientX: 0, clientY: 0, button: 0 })
    await wrap.trigger('mousemove', { clientX: 50, clientY: 50 })
    // no throw is the assertion: the DOM path must still work
    expect(true).toBe(true)
  })
```

> 若 `FileGridView.vue` 没有 `name` 选项,`findComponent({ name: ... })` 会失败 —— 改用 `w.findComponent(FileGridView)` 并 import 该组件。

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm exec vitest run src/views/Files.test.ts`
Expected: FAIL — `itemRects` 从未被调用

- [ ] **Step 3: 改 Files.vue**

1. 给网格组件加 ref。找到模板里 `<FileGridView ... />` 那一处,加 `ref="gridRef"`。
2. `<script setup>` 里加:

```ts
const gridRef = ref<InstanceType<typeof FileGridView> | null>(null)
```

3. 把 411-416 行的矩形收集改为:

```ts
  // Grid mode is virtualized: off-screen rows have no DOM, so their rects come
  // from the layout geometry instead of from measuring nodes. List mode is not
  // virtualized and keeps measuring.
  const items: ItemRect[] =
    files.viewMode === 'grid' && gridRef.value
      ? gridRef.value.itemRects()
      : (() => {
          const acc: ItemRect[] = []
          listwrap.value?.querySelectorAll<HTMLElement>('[data-path]').forEach((node) => {
            const b = node.getBoundingClientRect()
            acc.push({ path: node.dataset.path as string, rect: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } })
          })
          return acc
        })()
  files.setSelection(marqueeSelect(items, selRect))
```

> 保持原来那段收集 DOM 矩形的**逐字逻辑**(含 `node.dataset.path` 的取法),只是挪进 fallback 分支。改写前先读 411-416 行原文照抄。

4. `applyHighlight()`(361-373 行)里,`nextTick` 回调开头加:

```ts
    if (files.viewMode === 'grid' && gridRef.value) {
      gridRef.value.scrollToPath(entry.path)
      // The flash still needs a node; in grid mode it may only exist after the
      // scroll brings that row into the window, so re-query on the next frame.
      requestAnimationFrame(() => {
        const node = listwrap.value?.querySelector(`[data-path="${CSS.escape(entry.path)}"]`)
        if (!node) return
        node.classList.add('file-flash')
        setTimeout(() => node.classList.remove('file-flash'), 2500)
      })
      return
    }
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm exec vitest run src/views/Files.test.ts`
Expected: PASS

- [ ] **Step 5: 跑三门 + 提交**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
```

```bash
git add src/views/Files.vue src/views/Files.test.ts
git commit -m "fix(files): source marquee rects and highlight scrolling from grid geometry

With the grid virtualized, querying [data-path] only ever finds the handful of
rendered rows -- dragging past the viewport selected nothing, and a deep-linked
highlight below the fold scrolled to an element that does not exist."
```

---

### Task 11: 真机验收 + T10 交接票 + 台账

**Files:**
- Create: `docs/superpowers/2026-08-09-sp12-t10-progress-merge-handoff.md`
- Create: `.superpowers/sdd/2026-08-09-sp12-plan-c/progress.md`

- [ ] **Step 1: 收尾门(控制器亲自跑,不转述)**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
pnpm exec vitest run src/i18n/parity.test.ts
pnpm build
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/7354d3e5-43fa-4aeb-bc18-edda93b26044/scratchpad/oss-out --no-commit --allow-dirty-oss
```

全部记录实际输出的数字,不要写「应该通过」。

- [ ] **Step 2: 起 dev server 供机主验收**

```bash
pnpm dev --host --port 5273
```

> 验收 = dev server,**不是** `deploy.sh`(本期不是 cutover 期)。注意 5273 是 master 那条线的端口,若被占用改用 5299 并在报告里写明。

验收清单(写进台账,逐条给机主):
1. 侧栏磁盘行悬停 → 出现 ⋮;鼠标移上 ⋮ → 弹出用量窗,显示「已用 x / y」+ 进度条 + 百分比 + 可用。
2. 点 ⋮ **不会**跳转目录。
3. **浅色和深色都要看**用量窗(颜色走 token,jsdom 照不出)。
4. 进一个不存在的目录(地址栏改 `#/files/xxx`)→ 出现红色错误条,显示后端真实错误文本,点「重试」重新加载。
5. 断网(DevTools Offline)刷新 → 侧栏磁盘列表**不再一次判死**,约 4 秒内重试;仍失败则文件页落到 /DATA 而**不是空白**。
6. 进一个几千文件的目录(可用 `for i in $(seq 1 5000); do touch /DATA/bigdir/f$i; done` 造)→ 网格滚动流畅;DevTools Elements 里 `.file-tile` 数量远小于 5000。
7. 在该目录里**从顶部拖框选到底部**(拖到边缘触发滚动)→ 屏幕外的文件也被选中(看左上角计数)。
8. 深链 `#/files/<dir>?highlight=f4999` → 页面滚到该文件并闪烁。
9. **列表视图**下重复第 7 条 → 框选照常(列表未虚拟化,走 DOM 路径)。

- [ ] **Step 3: 写 T10 交接票**

`docs/superpowers/2026-08-09-sp12-t10-progress-merge-handoff.md`,必须写清:
- **为什么本期不做**:T10 要动 `src/files/components/UploadPanel.vue` 的头部与新增分组,而并行的 sp12-plan-b(T1/T7/T8)要整体替换该文件 227-234 行那套逐文件冲突 Dialog。两条线同期改同一文件,机主 2026-08-09 拍板由 plan-b 落地后再单独做。
- **没做什么**(逐条,照 spec §5 T10):
  - 纯函数 `opsTaskPercent` / `opsTaskLabelKey` / `opsTaskBasename` 未建(New-UI 现有 `src/files/util/fileOps.ts:37` 的 `taskPercent` 语义**不同** —— 它在 `total_size<=0` 时返回 0,而 Vue2 的 `opsTaskPercent` 返回 `null` 以区分「大小未知的进行中」)。
  - `resolveUploaderHeader` 未建。**New-UI 目前根本没有上传框头部三态** —— `UploadPanel.vue:153` 是写死的 `t('filesUploadTitle')`,不是「有三态但漏了 ops 这一路」。做 T10 时这是新增而非修补。
  - 上传框「文件操作」分组未加。
  - `src/files/components/OperationStatusBar.vue` 与其在 `src/views/Files.vue:17,622` 的挂载**仍在**(左下角独立浮层形态)。
  - Vue2 `fileOpsRow.js` 还有一个 `attachOpsTaskSpeeds`(按相邻两次推送算瞬时速度),spec §5 的 T10 条目**没列它** —— 做的时候要决定收不收。
- **一个结构性前提**:`UploadPanel.vue:146` 是 `v-if="totalCount"`(上传队列长度)。文件操作并进来之后,只有粘贴任务、没有上传时面板必须也能出现 —— 这个显示条件要跟着改,否则并入的分组永远看不见。
- 复核过的现场坐标:`fileOps` store 在 `src/files/stores/fileOps.ts`,`ops.cancelAll()` 已存在(第 19 行),T10 要求保留。

- [ ] **Step 4: 写台账**

`.superpowers/sdd/2026-08-09-sp12-plan-c/progress.md`:记录每个任务的实际测试数字、真机验收结果、遇到的偏差、以及「RAID 兜底是否经真机验证」。
台账入库要 `git add -f`(`.superpowers/sdd/.gitignore` 仍是一行裸 `*`)。

- [ ] **Step 5: 提交**

```bash
git add docs/superpowers/2026-08-09-sp12-t10-progress-merge-handoff.md
git add -f .superpowers/sdd/2026-08-09-sp12-plan-c/progress.md
git commit -m "docs(sp12): record Plan C results and hand off the T10 progress merge"
```

---

## 自查(写完计划后已做)

**1. spec 覆盖**
- T9「retryRequest 有限重试」→ Task 1 ✅
- T9「骨架屏卡死」→ Task 3(New-UI 无骨架屏,同源病灶是「默认目录解析不出来就永久空白」,已按此落地并在计划中写明差异)✅
- T9「RAID 用量兜底」→ Task 4 + Task 5,宿主界面 Task 6 ✅(机主 2026-08-09 拍板扩张)
- T9「错误文案归一化」→ Task 2 ✅(New-UI 只有一条 catch 分支,归一落在 unwrap 保留 `detail` + 单一取值顺序)
- T11「chunkRows + 可视窗口 + buffer」→ Task 7、Task 9 ✅
- T11「行高与现有 .grid-card CSS 一致 / 借用外层滚动容器」→ Task 9(实测行高 + `scrollParent` 解析,不嵌套新滚动层)✅
- T11「框选 ItemRect[] 来源要改」→ Task 8 + Task 10 ✅
- T11「滚动到高亮项改按行索引」→ Task 9 `scrollToPath` + Task 10 ✅
- spec §8 风险 4(虚拟化 + 缩略图串台)→ Task 9 的 `:key` 约束已写明为何在 New-UI 不成立 ✅
- spec §8 风险 5(jsdom 照不出布局)→ Task 11 验收清单第 6-9 条走真浏览器 ✅
- T10 → **本期不做**,Task 11 Step 3 出交接票 ✅

**2. 占位符扫描**:无 TBD / 「适当处理错误」/「照 Task N」。三处「照该文件既有 helper/mock 写法」是有意的 —— 那些文件的既有约定我没有逐字读过,写死会误导;每处都给了具体判据。

**3. 类型一致性**:`DiskSpace`(Task 4 定义)→ Task 5 `DiskDetail.space` → Task 6 `usedPercent` 参数,一致。`ItemRect`(既有 marquee.ts)→ Task 8 产出 → Task 9 `itemRects()` → Task 10 消费,一致。`retryRequest`(Task 1)→ Task 5 复用,签名一致。

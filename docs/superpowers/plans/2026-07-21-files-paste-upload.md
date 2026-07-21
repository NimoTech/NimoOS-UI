# 文件页 Ctrl+V 粘贴上传 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在文件页按 Ctrl+V,把剪贴板里的截图/复制的文件上传到当前浏览目录,复用现有 TUS 上传管线(含重名冲突弹窗)。

**Architecture:** 新增纯逻辑模块 `pasteFiles.ts`(从 ClipboardEvent 提取 File 并给无名截图生成默认文件名),在 `Files.vue` 挂 window `paste` 监听,产出 `{file, relativePath}[]` 后调用现有 `commitSelectedFiles` —— 目录注入、受保护目录拦截、服务端重名预检、跳过/保留两者/覆盖弹窗、TUS 上传全部复用,零后端改动。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript(strict)、vitest(co-located `*.test.ts`)、vue-i18n。

**Spec:** `/home/nimo/NimoTech/nimo_os_docs/docs/design/2026-07-21-files-paste-upload-design.md`

## Global Constraints

- 仓库 `/home/nimo/NimoTech/NimoOS-New-UI`,包管理器 **pnpm**(勿用 yarn/npm)。
- 不引入任何颜色字面量(本功能无 UI 样式,天然满足)。
- **新增 i18n 键必须同时加进 `src/i18n/zh_cn.ts` 和 `src/i18n/en_us.ts`**(`parity.test.ts` 强制)。
- 不改 `uploads.ts` / `scheduler.ts` / `tusClient.ts` / `conflict.ts` / `UploadPanel.vue` / 任何后端代码。
- 默认命名:`粘贴图片 YYYY-MM-DD HH-mm-ss.png`(baseName 走 i18n,英文 `Pasted image`);同批次重名追加 ` (2)`、` (3)`;浏览器占位名(`image.png` 等)视为无名。
- 部署一律 `./scripts/deploy.sh`。

---

### Task 1: 剪贴板提取 + 默认命名纯逻辑模块 `pasteFiles.ts`

**Files:**
- Create: `src/files/upload/pasteFiles.ts`
- Test: `src/files/upload/pasteFiles.test.ts`

**Interfaces:**
- Produces: `extractClipboardFiles(dt: DataTransfer | null, baseName: string, now: Date): { file: File; relativePath: string }[]` — Task 2 的 `Files.vue` 以 `extractClipboardFiles(e.clipboardData, t('filesPastedImage'), new Date())` 调用,返回值直接喂给现有 `commitSelectedFiles`。
- Consumes: 无(纯逻辑,无 Vue/store 依赖,风格对齐同目录 `dropEntries.ts`)。

- [ ] **Step 1: Write the failing test**

创建 `src/files/upload/pasteFiles.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractClipboardFiles } from './pasteFiles'

// 构造最小 DataTransfer 桩:只需 files 属性(paste 事件里截图/复制文件都出现在
// clipboardData.files);items 兜底路径用另一个桩覆盖。
function dtWithFiles(files: File[]): DataTransfer {
  return { files, items: [] } as unknown as DataTransfer
}

const NOW = new Date(2026, 6, 21, 15, 30, 0) // 2026-07-21 15:30:00(月份从 0 起)

describe('extractClipboardFiles', () => {
  it('null DataTransfer 返回空数组', () => {
    expect(extractClipboardFiles(null, '粘贴图片', NOW)).toEqual([])
  })

  it('纯文本剪贴板(无文件)返回空数组', () => {
    expect(extractClipboardFiles(dtWithFiles([]), '粘贴图片', NOW)).toEqual([])
  })

  it('无名截图按 baseName+时间戳命名,扩展名取自 MIME', () => {
    const blob = new File([new Uint8Array([1])], '', { type: 'image/png' })
    const out = extractClipboardFiles(dtWithFiles([blob]), '粘贴图片', NOW)
    expect(out).toHaveLength(1)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
    expect(out[0].file.name).toBe('粘贴图片 2026-07-21 15-30-00.png')
    expect(out[0].file.type).toBe('image/png')
  })

  it('浏览器占位名 image.png 也视为无名并改名', () => {
    const blob = new File([new Uint8Array([1])], 'image.png', { type: 'image/png' })
    const out = extractClipboardFiles(dtWithFiles([blob]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
  })

  it('jpeg MIME 得到 .jpg 扩展名', () => {
    const blob = new File([new Uint8Array([1])], '', { type: 'image/jpeg' })
    const out = extractClipboardFiles(dtWithFiles([blob]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.jpg')
  })

  it('同批次多张无名图片追加序号,互不重名', () => {
    const a = new File([new Uint8Array([1])], '', { type: 'image/png' })
    const b = new File([new Uint8Array([2])], '', { type: 'image/png' })
    const out = extractClipboardFiles(dtWithFiles([a, b]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
    expect(out[1].relativePath).toBe('粘贴图片 2026-07-21 15-30-00 (2).png')
  })

  it('复制的真实文件保留原名', () => {
    const f = new File([new Uint8Array([1])], '报告.pdf', { type: 'application/pdf' })
    const out = extractClipboardFiles(dtWithFiles([f]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('报告.pdf')
    expect(out[0].file).toBe(f) // 有名文件不重建 File 对象
  })

  it('files 为空时兜底走 items(kind=file)', () => {
    const f = new File([new Uint8Array([1])], '', { type: 'image/png' })
    const dt = {
      files: [],
      items: [
        { kind: 'string', getAsFile: () => null },
        { kind: 'file', getAsFile: () => f },
      ],
    } as unknown as DataTransfer
    const out = extractClipboardFiles(dt, '粘贴图片', NOW)
    expect(out).toHaveLength(1)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/files/upload/pasteFiles.test.ts`
Expected: FAIL — `Cannot find module './pasteFiles'`(或等价的模块不存在报错)。

- [ ] **Step 3: Write minimal implementation**

创建 `src/files/upload/pasteFiles.ts`:

```ts
// Ctrl+V 粘贴上传:从 ClipboardEvent.clipboardData 提取 File。截图 blob 天生无
// 文件名(或被浏览器给统一占位名 image.png——保留会导致每次粘贴互相撞名),按
// baseName+秒级时间戳生成默认名;复制的真实文件保留原名。纯逻辑,无 Vue/store
// 依赖(对齐 dropEntries.ts)。剪贴板不携带目录结构,relativePath 恒为文件名。

export interface PastedFile { file: File; relativePath: string }

// 各浏览器给剪贴板图片的统一占位名(Chrome/Firefox: image.png 等)
const PLACEHOLDER_RE = /^image\.(png|jpe?g|gif|webp|bmp)$/i

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
}

function pad(n: number): string { return String(n).padStart(2, '0') }

function stampedName(baseName: string, now: Date, seq: number, ext: string): string {
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    + ` ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const suffix = seq > 1 ? ` (${seq})` : ''
  return `${baseName} ${stamp}${suffix}.${ext}`
}

function collectFiles(dt: DataTransfer): File[] {
  const fromFiles = Array.from(dt.files || [])
  if (fromFiles.length) return fromFiles
  const out: File[] = []
  for (const item of Array.from(dt.items || [])) {
    if (item.kind !== 'file') continue
    const f = item.getAsFile()
    if (f) out.push(f)
  }
  return out
}

export function extractClipboardFiles(
  dt: DataTransfer | null,
  baseName: string,
  now: Date,
): PastedFile[] {
  if (!dt) return []
  let seq = 0
  return collectFiles(dt).map((f) => {
    if (f.name && !PLACEHOLDER_RE.test(f.name)) {
      return { file: f, relativePath: f.name }
    }
    seq += 1
    const name = stampedName(baseName, now, seq, MIME_EXT[f.type] || 'png')
    return { file: new File([f], name, { type: f.type }), relativePath: name }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/files/upload/pasteFiles.test.ts`
Expected: PASS(8 个用例全绿)。

- [ ] **Step 5: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/files/upload/pasteFiles.ts src/files/upload/pasteFiles.test.ts
git commit -m "feat(files): clipboard file extraction with default naming for paste upload"
```

---

### Task 2: `Files.vue` 挂粘贴监听 + i18n 键

**Files:**
- Modify: `src/views/Files.vue`(上传区,`onDrop` 之后约 187 行处;import 区约 33 行处)
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(各加一键)

**Interfaces:**
- Consumes: Task 1 的 `extractClipboardFiles(dt, baseName, now)`;现有 `commitSelectedFiles(entries: { file: File; relativePath: string }[])`(`Files.vue:152`)。
- Produces: 无(终端消费者)。

- [ ] **Step 1: 加 i18n 键(两个文件都加,parity 测试强制)**

`src/i18n/zh_cn.ts` 在 `filesUploadProtected` 键附近加:

```ts
  filesPastedImage: '粘贴图片',
```

`src/i18n/en_us.ts` 同位置加:

```ts
  filesPastedImage: 'Pasted image',
```

- [ ] **Step 2: Run parity test to verify keys match**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/i18n/parity.test.ts`
Expected: PASS。

- [ ] **Step 3: 在 `Files.vue` 接线**

import 区(`readDroppedEntries` 那行之后)加:

```ts
import { extractClipboardFiles } from '../files/upload/pasteFiles'
```

`onDrop` 函数(约 `Files.vue:181-187`)之后加:

```ts
// ── Ctrl+V 粘贴上传:截图/复制的文件传到当前目录,复用 commitSelectedFiles ──
// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴;剪贴板只有文字时静默忽略。
function isEditableTarget(el: EventTarget | null): boolean {
  const node = el instanceof HTMLElement ? el : null
  if (!node) return false
  return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable
}
async function onPaste(e: ClipboardEvent) {
  if (isEditableTarget(e.target)) return
  const pasted = extractClipboardFiles(e.clipboardData, t('filesPastedImage'), new Date())
  if (!pasted.length) return
  e.preventDefault()
  await commitSelectedFiles(pasted)
}
onMounted(() => window.addEventListener('paste', onPaste))
onUnmounted(() => window.removeEventListener('paste', onPaste))
```

说明:文件页是路由组件,`onUnmounted` 移除监听 ⇒ 只在文件页生效(方案 A);`onMounted`/`onUnmounted` 已在文件顶部 import,Vue 允许多次调用注册。

- [ ] **Step 4: 类型检查 + 全量测试**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vue-tsc --noEmit && pnpm test`
Expected: 类型检查零错误;vitest 全绿。

- [ ] **Step 5: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/views/Files.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(files): Ctrl+V paste-to-upload into current directory"
```

---

### Task 3: 部署真机 + 手动验收

**Files:** 无代码改动。

**Interfaces:**
- Consumes: Task 1+2 的完整功能;`./scripts/deploy.sh`(部署唯一入口,勿手写 rsync)。

- [ ] **Step 1: 部署**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && ./scripts/deploy.sh`
Expected: pnpm build 成功 + rsync 到 `/var/lib/nimoos/www/app/` 完成。

- [ ] **Step 2: 手动验收(用户在浏览器 /app/ 执行)**

1. 截图 → 文件页 Ctrl+V → 当前目录出现「粘贴图片 …png」,右下角进度面板正常;
2. 制造同名(把已上传文件重命名成下一次粘贴将使用的名字不可行——名字带秒;改为:复制系统里一个文件粘贴两次)→ 第二次弹出 跳过/保留两者/覆盖 弹窗,三个选项各验证一次;
3. 重命名输入框聚焦时 Ctrl+V → 文字正常粘进输入框,不触发上传;
4. 只复制文字后 Ctrl+V → 无任何反应、无报错;
5. 系统文件管理器复制一个文件 → 粘贴 → 原名上传;
6. 受保护目录下粘贴 → 现有 toast 拦截提示。

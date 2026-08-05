### Task 5: 纯模块 —— composer 文本/光标数学 + 附件元信息 + mention 格式化 + 占用环几何

**Files:**
- Create: `src/ai/util/composerText.ts` + `src/ai/util/composerText.test.ts`
- Create: `src/ai/util/attachmentMeta.ts` + `src/ai/util/attachmentMeta.test.ts`
- Create: `src/ai/util/mentionFormat.ts` + `src/ai/util/mentionFormat.test.ts`
- Create: `src/ai/util/contextUsage.ts` + `src/ai/util/contextUsage.test.ts`

**Interfaces:**
- Produces(后续任务全靠这些签名):
  ```ts
  // composerText.ts —— 港自 AgentComposer.vue:180-196 / 300-335 / 355-428
  export function getExt(name: string): string
  export function basename(p: string): string
  export function dirname(p: string): string
  export interface MentionScan { open: boolean; start: number; segments: string[]; query: string }
  export function scanMention(text: string, caret: number): MentionScan
  export function buildDrillText(text: string, start: number, caret: number, segments: string[], name: string):
    { text: string; segments: string[]; caretPos: number }
  export function buildPopText(text: string, start: number, caret: number, segments: string[]):
    { text: string; segments: string[]; caretPos: number }
  export function stripMentionToken(text: string, start: number, caret: number): { text: string; caretPos: number }

  // attachmentMeta.ts —— 港自 AgentComposer.vue:160-171 / 460-504
  export const TEXT_EXTS: string[]
  export const DOCUMENT_EXTS: string[]
  export const ACCEPT_TYPES: string
  export const MAX_ATTACHMENT_BYTES: number            // 500 * 1024 * 1024
  export function docErrorKey(code: string): { key: string; params?: Record<string, unknown> }       // → i18n 键
  export function docErrorShortKey(code: string): string
  export type PendingKind = 'image' | 'document' | 'binary' | 'text' | 'video' | 'audio' | string

  // mentionFormat.ts —— 港自 MentionPopover.vue:87-107 / 273-299
  export const DRIVE_PALETTE: string[]
  export function driveColor(label: string): string
  export function formatBytes(n: number): string
  export function formatTime(t: number | string): string
  export function escapeHtml(s: string): string
  export function highlightMatch(name: string, query: string): string   // 返回带 <mark> 的**已转义** HTML

  // contextUsage.ts —— 港自 ContextUsageBar.vue:2-28
  export const RING_R: number       // 15.5
  export const RING_C: number       // 2πR
  export function formatTokens(n: number): string
  export function levelFor(pct: number): 'ok' | 'warn' | 'danger'
  export function dashArrayFor(pct: number): string
  ```

- [ ] **Step 1: 写失败测试(四个测试文件)**

`composerText.test.ts` 必含:
```ts
import { describe, it, expect } from 'vitest'
import { getExt, basename, dirname, scanMention, buildDrillText, buildPopText, stripMentionToken } from './composerText'

describe('composerText 路径小工具(AgentComposer.vue:180-196)', () => {
  it('getExt:无点或首字符为点时返回空串', () => {
    expect(getExt('a.TXT')).toBe('txt')
    expect(getExt('noext')).toBe('')
    expect(getExt('.bashrc')).toBe('')
  })
  it('basename:先剥尾部斜杠', () => {
    expect(basename('/DATA/docs/')).toBe('docs')
    expect(basename('/DATA/a.txt')).toBe('a.txt')
  })
  it('dirname:根一级返回 /', () => {
    expect(dirname('/DATA/docs/a.txt')).toBe('/DATA/docs')
    expect(dirname('/a')).toBe('/')
  })
})

describe('scanMention 触发判定(AgentComposer.vue:300-335)', () => {
  it('@ 在开头即触发,segments 取除末段外全部', () => {
    const t = '@Drive1/docs/re'
    expect(scanMention(t, t.length)).toEqual({ open: true, start: 0, segments: ['Drive1', 'docs'], query: 're' })
  })
  it('@ 前是空白也触发', () => {
    const t = 'look @doc'
    expect(scanMention(t, t.length)).toMatchObject({ open: true, start: 5, query: 'doc' })
  })
  it('@ 前是单词字符(邮箱)不触发', () => {
    const t = 'me@host'
    expect(scanMention(t, t.length).open).toBe(false)
  })
  it('遇到空白先于 @ 则不触发(mention 路径不含空格)', () => {
    const t = '@Drive1 docs'
    expect(scanMention(t, t.length).open).toBe(false)
  })
  it('无 @ 时不触发', () => {
    expect(scanMention('hello', 5).open).toBe(false)
  })
})

describe('mention 文本改写与光标(AgentComposer.vue:355-428)', () => {
  it('buildDrillText:追加 "<name>/" 并把光标落在其后', () => {
    const r = buildDrillText('@Dr', 0, 3, [], 'Drive1')
    expect(r.text).toBe('@Drive1/')
    expect(r.segments).toEqual(['Drive1'])
    expect(r.caretPos).toBe(8)
  })
  it('buildDrillText:保留光标之后的原文', () => {
    const r = buildDrillText('@Dr tail', 0, 3, [], 'Drive1')
    expect(r.text).toBe('@Drive1/ tail')
  })
  it('buildPopText:弹掉最后一段;段全空时只留 @', () => {
    const r1 = buildPopText('@Drive1/docs/', 0, 13, ['Drive1', 'docs'])
    expect(r1.text).toBe('@Drive1/')
    expect(r1.segments).toEqual(['Drive1'])
    const r2 = buildPopText('@Drive1/', 0, 8, ['Drive1'])
    expect(r2.text).toBe('@')
    expect(r2.segments).toEqual([])
  })
  it('stripMentionToken:整段 @token 删掉、不插入任何文本', () => {
    const r = stripMentionToken('see @Drive1/a.txt now', 4, 17)
    expect(r.text).toBe('see  now')
    expect(r.caretPos).toBe(4)
  })
})
```

`attachmentMeta.test.ts` 必含:8 个 `extract_error` code 各自映射到独立 i18n 键、未知 code 落 `aiDocErrGeneric` 且带 `{ code }` 参数、短标签 8 映射 + 未知落 `aiDocErrShortParse`、`ACCEPT_TYPES` 与 Vue2 `AgentComposer.vue:167-171` 字符串**完全一致**(测试里内联 Vue2 原串比对)、`MAX_ATTACHMENT_BYTES === 524288000`。

`mentionFormat.test.ts` 必含:`driveColor` 同名同色(确定性)、`formatBytes` 四档(B/KB/MB/GB,阈值与 Vue2 `MentionPopover.vue:95-101` 一致)、`formatTime` 三种入参(unix 秒 ≤1e12 要 ×1000 / unix 毫秒 / ISO 串)且同年只出月日、`escapeHtml` 五字符、`highlightMatch` 大小写不敏感首次匹配 + 三段都转义(用 `'<b>a'` 这种输入验证 `&lt;b&gt;` 出现在结果里且只有 `<mark>` 是真标签)。

`contextUsage.test.ts` = 移植 Vue2 `ContextUsageBar.spec.js:8-52` 的 8 个纯函数例:`formatTokens` 5 例(1200→'1.2K'、8192→'8.2K'、500→'500'、128000→'128K'、200000→'200K')、`levelFor` 3 例(69→'ok'、75→'warn'、95→'danger')+ **补两个边界例**(70→'warn'、90→'danger',Vue2 spec 未覆盖)、`dashArrayFor` 3 例(15、110 截顶、0)。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/util/composerText.test.ts src/ai/util/attachmentMeta.test.ts src/ai/util/mentionFormat.test.ts src/ai/util/contextUsage.test.ts`
Expected: 4 个文件全 FAIL(模块不存在)。

- [ ] **Step 3: 实现四个模块**

逐字港,文件头注明 Vue2 出处。关键实现细节(照 Vue2,不许"改良"):
- `scanMention`:从 `caret-1` 往前走;遇 `@` 且(`i===0` 或前一字符是 `\s`)→ 命中,`after = text.slice(i+1, caret)`,`parts = after.split('/')`,`segments = parts.slice(0,-1)`,`query = parts[parts.length-1] || ''`;遇 `@` 但前面是单词字符 → `break` 不命中;遇空白 → `break` 不命中;走完 → 不命中。不命中时返回 `{ open:false, start:-1, segments:[], query:'' }`。
- `buildDrillText`:`newSegs=[...segments,name]`;`newPath='@'+newSegs.join('/')+'/'`;`before=text.slice(0,start)`;`after=text.slice(caret)`;`caretPos=(before+newPath).length`。
- `buildPopText`:`newSegs=segments.slice(0,-1)`;`newPath='@'+(newSegs.length ? newSegs.join('/')+'/' : '')`;其余同上。
- `stripMentionToken`:`text.slice(0,start)+text.slice(caret)`,`caretPos=start`。
- `docErrorKey`:8 个 code(`scanned_pdf`/`encrypted_pdf`/`too_large`/`timeout`/`corrupted`/`cache_failed`/`not_installed`/`lost` —— **实现前先读 Vue2 `AgentComposer.vue:460-486` 拿到确切的 code 字面量**,以源码为准)→ 各自 i18n 键 `aiDocErrScannedPdf` 等;未知 → `{ key:'aiDocErrGeneric', params:{ code } }`。
- `formatTokens`:`n>=1000` → `(n/1000).toFixed(1).replace(/\.0$/,'')+'K'`,否则 `String(n)`。
- `dashArrayFor`:`p=Math.min(100,Math.max(0,pct))`;`filled=(p/100)*RING_C`;返回 `` `${filled.toFixed(2)} ${RING_C.toFixed(2)}` ``。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/util/composerText.test.ts src/ai/util/attachmentMeta.test.ts src/ai/util/mentionFormat.test.ts src/ai/util/contextUsage.test.ts`
Expected: 全绿。`pnpm exec vue-tsc --noEmit` → 0 error。

- [ ] **Step 5: Commit**

```bash
git add src/ai/util/composerText.* src/ai/util/attachmentMeta.* src/ai/util/mentionFormat.* src/ai/util/contextUsage.*
git commit -m "SP8-P1c1: pure modules for composer text/cursor math, attachment meta, mention format, ctx-usage geometry"
```

---


// SP8-P5b Task 7 —— 1:1 移植自 Vue2
// `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/IndexedFilesView.vue:396-444`。
//
// 蓝本这五个函数(`fmtBytes`/`fmtRel`/`fmtAbs`/`simplifyMime`/`topSegment`)是
// "presentation helpers (pure, no side-effects)" 段落里的纯展示帮助函数,先于
// T8/T9/T10(整体搬运 `IndexedFilesView.vue` 826 行)单独抽出并测透(K12),让
// 消费该组件的测试不用再覆盖这些分支。
//
// 🔴 `fmtRel` 与 store 里的 `fmtAgo`(`knowledgeStore.ts:23-31`)看起来很像但
// **不是同一个函数,不合并**:`fmtAgo` 只有 4 档(0/分钟/小时/天),`fmtRel` 是
// 5 档(45 秒/60 分/24 时/30 天/月),秒粒度也不同(`fmtAgo` 从毫秒差直接算
// 分钟,`fmtRel` 先落到秒)。两者分别搬自两个不同的蓝本文件
// (`QueueView.vue:405-414`/`store/knowledgeStore.js` 对 `knowledgeStore.ts` 的
// fmtAgo,与 `IndexedFilesView.vue:404-415` 对本文件的 fmtRel)。
//
// 以下是蓝本自身的「怪行为」,K12/任务书明确要求逐字照抄,不许「顺手改对」:
//   1. fmtBytes:`n == null`(宽松相等)只拦 `null`/`undefined`,`n === 0` 不
//      命中,会走 `n < 1024` 分支返回 `'0 B'`(不是 `'—'`)。
//   2. fmtBytes:KB 档与 MB 档的 `toFixed` 位数是**条件式**
//      (`n < 10240 ? 1 : 0`、`n < 10485760 ? 1 : 0`),GB 档恒 2 位。
//   3. fmtRel:与 `fmtAgo` 不同,`!ts`(含 `ts === 0`)返回 `'—'`。
//   4. fmtAbs:不接 i18n,读的是**本地时间**(`getFullYear`/`getMonth`/
//      `getDate`/`getHours`/`getMinutes` 均为本地 getter,非 UTC)。
//   5. simplifyMime:8 条 if 的顺序有意义 —— `docling`/`wordprocessing` 在
//      `legacy-office` 之前,`legacy-office` 又在 `ms-powerpoint`/
//      `presentation` 之前。`legacy: true` 只出现在 `legacy-office` 与
//      `ms-powerpoint`/`presentation` 两条上,其余分支没有这个字段。
//   6. topSegment:正则 `/^\/([^/]+)\//` 要求路径**第一段之后还有第二个
//      斜杠**——`/DATA`(没有第二个斜杠)返回 `null`,`/DATA/x` 才返回 `'DATA'`。

import { i18n } from '../../../i18n'

/** 蓝本 :396-402 —— 4 档(B/KB/MB/GB),`n == null` 用宽松相等,`0` 不命中。 */
export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

/**
 * 蓝本 :404-415 —— 5 档相对时间(45 秒/60 分/24 时/30 天/月)。
 * i18n 键与 T7 任务书点名的一致:`aiKbJustNow`/`aiKbMinAgo`/`aiKbHrAgo`/
 * `aiKbDaysAgo`/`aiKbMonthsAgo`。写法照 `knowledgeStore.ts` 里 `fmtAgo` 的
 * `i18n.global.t(...)` 既有用法,不自己发明。
 */
export function fmtRel(ts: number | null | undefined): string {
  if (!ts) return '—'
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 45) return i18n.global.t('aiKbJustNow')
  const m = Math.floor(s / 60)
  if (m < 60) return i18n.global.t('aiKbMinAgo', { m })
  const h = Math.floor(m / 60)
  if (h < 24) return i18n.global.t('aiKbHrAgo', { h })
  const d = Math.floor(h / 24)
  if (d < 30) return i18n.global.t('aiKbDaysAgo', { d })
  return i18n.global.t('aiKbMonthsAgo', { n: Math.floor(d / 30) })
}

/** 蓝本 :417-422 —— 绝对时间 `YYYY-MM-DD HH:mm`,不接 i18n,读本地时间。 */
export function fmtAbs(ts: number | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** mime → 简短友好标签。蓝本 :425-436。 */
export interface MimeTag {
  label: string
  kind: string
  legacy?: boolean
}

/**
 * 蓝本 :425-436 —— 8 条 if 的顺序有意义,逐字照抄,不调整顺序、不合并分支。
 * `legacy: true` 只在 `legacy-office` 与 `ms-powerpoint`/`presentation` 两条上。
 */
export function simplifyMime(m: string | null | undefined): MimeTag {
  if (!m) return { label: 'FILE', kind: 'doc' }
  if (m.includes('docling') || m.includes('wordprocessing')) return { label: 'DOCX', kind: 'doc' }
  if (m.startsWith('application/legacy-office')) return { label: 'DOC', kind: 'doc', legacy: true }
  if (m.startsWith('application/pdf')) return { label: 'PDF', kind: 'pdf' }
  if (m.includes('spreadsheet')) return { label: 'XLSX', kind: 'txt' }
  if (m.includes('ms-powerpoint') || m.includes('presentation')) return { label: 'PPT', kind: 'code', legacy: true }
  if (m.startsWith('text/markdown')) return { label: 'MD', kind: 'md' }
  if (m.startsWith('text/x-')) return { label: 'CODE', kind: 'code' }
  if (m.startsWith('text/plain')) return { label: 'TXT', kind: 'txt' }
  return { label: 'FILE', kind: 'doc' }
}

/**
 * 蓝本 :439-444 —— 提取路径首段。正则要求首段之后**还有第二个斜杠**,
 * 否则返回 `null`(例:`/DATA` 没有第二个斜杠 → `null`,`/DATA/x` → `'DATA'`）。
 */
export function topSegment(path: string | null | undefined): string | null {
  if (!path) return null
  const m = path.match(/^\/([^/]+)\//)
  return m ? m[1] : null
}

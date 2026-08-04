// SP8-P5d Task 3 —— 1:1 移植自 Vue2
// `NimoOS-UI`(main@7a6ee6b7)`src/views/AI/Knowledge/notesViewHelpers.js`(50 行)。
//
// 🔴 K40:`NOTE_TYPES[*].color` 从蓝本的色字面量渐变改成 `var(--grad-note-*)` 字符串——
// 这四个 token 已在 T2 的 `knowledge.scss` 两档里声明(见附录 B §B.1 / K39)。
// `color-guard.test.ts` 的 glob 只有 `../**/*.vue` 与 `../**/*.css`,压根不扫 `.ts` →
// 这四个渐变在任何既有守卫下都是裸奔的。配套的 `notesViewHelpers.test.ts` 补了一条
// 定向断言(四个值必须形如 `var(--…)`,零 `#`/`rgb(`/`rgba(`/具名色)+ RED 探针,
// 这是「产品代码对、守卫为零」的预防式堵法,不是事后补(附录 B §B.5)。
//
// 附录 A §A.4 落地口径:蓝本 `NOTE_TYPES`/`NOTE_SOURCES` 的 `labelKey` 字段值是英文
// 原串(`'Note item'`/`'Summary'`/…),Vue2 里被直接当 i18n key 用($t(labelKey))——
// 「英文原串即 key」是 Vue2 的巧合,New-UI 的键名是 T1 已建的 aiKb* 家族,不成立
// (与 P5b N14 同一个坑)。本仓 `labelKey` 字段的值改写成 New-UI 键名,消费方
// (NotesView/NoteEditPane,T6/T7)用 `$t(m.labelKey)` 渲染。
//
// `relativeTime` 不在组件 setup 上下文里 → 必须用 `i18n.global.t(...)`,不许改用
// `useI18n()`(不在组件 setup 上下文里会抛)。先例 `indexedFilesView.ts:31/51-58`。

import { i18n } from '../../../i18n'

export interface NoteTypeMeta {
  labelKey: string
  icon: string
  color: string
}

/**
 * 蓝本 :5-10 —— 四种笔记类型的展示元数据(图标 + 渐变)。
 * K40:color 是 `var(--grad-note-*)` token 引用,不是色字面量。
 */
export const NOTE_TYPES: Record<string, NoteTypeMeta> = {
  note: { labelKey: 'aiKbNoteTypeNote', icon: 'edit', color: 'var(--grad-note-note)' },
  summary: { labelKey: 'aiKbNoteTypeSummary', icon: 'layers', color: 'var(--grad-note-summary)' },
  insight: { labelKey: 'aiKbNoteTypeInsight', icon: 'sparkle', color: 'var(--grad-note-insight)' },
  digest: { labelKey: 'aiKbNoteTypeDigest', icon: 'file', color: 'var(--grad-note-digest)' },
}

/** 蓝本 :12-14 —— 未知 / 未传 type 都兜底到 `NOTE_TYPES.note`。 */
export function noteTypeMeta(type: string | undefined | null): NoteTypeMeta {
  return (type && NOTE_TYPES[type]) || NOTE_TYPES.note
}

export interface NoteSourceMeta {
  labelKey: string
  icon: string
}

/** 蓝本 :16-20 —— 三种笔记来源的展示元数据。 */
export const NOTE_SOURCES: Record<string, NoteSourceMeta> = {
  human: { labelKey: 'aiKbNoteSrcHuman', icon: 'user' },
  agent: { labelKey: 'aiKbNoteSrcAgent', icon: 'bot' },
  pipeline: { labelKey: 'aiKbNoteSrcPipeline', icon: 'sparkle' },
}

/** 蓝本 :22-24 —— 未知 / 未传 createdBy 都兜底到 `NOTE_SOURCES.human`。 */
export function noteSourceMeta(createdBy: string | undefined | null): NoteSourceMeta {
  return (createdBy && NOTE_SOURCES[createdBy]) || NOTE_SOURCES.human
}

export interface StatusBadge {
  label: string
  tone: 'warn' | 'muted'
}

/**
 * 蓝本 :26-30 —— draft/archived 各出一个徽标,curated 及其它状态不出徽标(null)。
 * 🔴 全仓零生产消费者(协调者已 grep 核实:蓝本模板里徽标是内联 `kn-badge` 标记,
 * 只有 Vue2 `__tests__/notesView.spec.js` 引用这个函数)—— 依据治理 §4.3,
 * 照抄导出 + 照抄下面对应的 3 条用例,**不许因为「没人用」就删**(K7 同族:反转不删)。
 */
export function statusBadge(note: { status?: string | null }): StatusBadge | null {
  if (note.status === 'draft') return { label: 'AI draft', tone: 'warn' }
  if (note.status === 'archived') return { label: 'Archived', tone: 'muted' }
  return null
}

export interface FilterableNote {
  type?: string | null
  status?: string | null
}

/**
 * 蓝本 :32-38 —— `status`:`''` = 全部,`'active'` = 非 archived(draft+curated 都算),
 * 其余 = 精确匹配。`type` 与 `status` 两个筛选条件各自独立生效(逻辑 AND)。
 */
export function applyFilters<T extends FilterableNote>(
  list: T[],
  { type, status }: { type?: string | null; status?: string | null },
): T[] {
  return list.filter(
    (n) =>
      (!type || n.type === type) &&
      (!status || (status === 'active' ? n.status !== 'archived' : n.status === status)),
  )
}

/**
 * 蓝本 :40-49 —— `updated_at` 来自 agent 服务是 unix **秒**,不是毫秒(蓝本注释 :41)。
 * 五档:`d<60` 刚刚 · `d<3600` N 分钟前 · `d<86400` N 小时前 · `d<86400*30` N 天前 ·
 * 否则 `toLocaleDateString()`(本地日期,不接 i18n)。
 * 🔴 K42:相对时间用的 4 个键(`aiKbJustNow`/`aiKbRelMinAgo`/`aiKbRelHrAgo`/
 * `aiKbRelDaysAgo`)是本期新建/复用的 `aiKb*` 键,占位符全是 `{n}`,不复用既有
 * `aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`(占位符是 `{m}`/`{h}`/`{d}`,复用会渲染出
 * 字面量 `{n}`)。
 * 🔴 不在组件 setup 上下文里 → 用 `i18n.global.t(...)`,不许 `useI18n()`(会抛)。
 */
export function relativeTime(unixSec: number | null | undefined): string {
  if (!unixSec) return ''
  const d = Date.now() / 1000 - unixSec
  if (d < 60) return i18n.global.t('aiKbJustNow')
  if (d < 3600) return i18n.global.t('aiKbRelMinAgo', { n: Math.floor(d / 60) })
  if (d < 86400) return i18n.global.t('aiKbRelHrAgo', { n: Math.floor(d / 3600) })
  if (d < 86400 * 30) return i18n.global.t('aiKbRelDaysAgo', { n: Math.floor(d / 86400) })
  return new Date(unixSec * 1000).toLocaleDateString()
}

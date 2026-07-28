// 从 NimoOS-UI/src/service/snapshot.js 逐字移植(SP6-P5)。
// 未迁:snapshotBrowsePath / parseSnapshotBrowsePath / liveVolumePath / parseSnapshotName /
// formatSnapshotBannerTime / findVolumeForPath —— 属文件区快照浏览套件,随该期一起迁(见 P5 计划台账)。

import type { SnapshotVolume } from '@nimotech/nimoos-service'

export interface SnapshotVolumeView {
  volume_uuid: string
  mount: string
  supported: boolean
  enabled: boolean
  count: number
  last_at: string
  paused_reason: string
}

export interface SnapshotRaw {
  id?: number | string
  name: string
  label?: string
  type?: string
  created_at: string | number
}

export interface SnapshotItemView {
  id: number | string | undefined
  name: string
  label: string
  type: string | undefined
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
  time: string
  createdAt: string | number
}

export interface SnapshotDayGroup {
  dayKey: string
  label: { i18nKey?: string; text?: string }
  items: SnapshotItemView[]
}

export interface PolicyForm {
  hourly_keep: number
  daily_keep: number
  weekly_keep: number
  pause_threshold_pct: number
}

export type SnapshotState = 'unsupported' | 'disabled' | 'enabled'

// list() 返回 SnapshotVolume[](索引签名透传 volume_uuid/mount 等);收窄为 SnapshotVolumeView。
// New-UI 新增(不在 Vue2 snapshot.js 中)——照 raidView.asRaidArray 范式补的收窄映射,让
// TS strict 下的 unknown 索引访问有安全默认值,语义与 Vue2 直接读字段一致。
export function asSnapshotVolume(raw: SnapshotVolume | Record<string, unknown>): SnapshotVolumeView {
  const r = raw as Record<string, unknown>
  return {
    volume_uuid: (r.volume_uuid as string) || '',
    mount: (r.mount as string) || '',
    supported: r.supported === true,
    enabled: r.enabled === true,
    count: Number(r.count) || 0,
    last_at: (r.last_at as string) || '',
    paused_reason: (r.paused_reason as string) || '',
  }
}

// Pure state-mapping helper: turns a /v2/snapshot/volumes entry into the
// three card states the UI cares about. Kept side-effect free so it can be
// unit tested without mounting anything.
// (snapshot.js:6-9)
export function resolveSnapshotState(v: SnapshotVolumeView | null): SnapshotState {
  if (!v || !v.supported) return 'unsupported'
  return v.enabled ? 'enabled' : 'disabled'
}

// Pure validation for the advanced policy form. Keep counts must be positive
// whole numbers; the pause threshold is a whole percentage between 1 and 100.
// Returns { valid, errors } where `errors` maps field name -> i18n key.
// (snapshot.js:15-31)
// 偏离 Vue2:错误值从英文原文改为具名 i18n key('snapErrPositiveInt' / 'snapErrPercent') ——
// 见 Global Constraints 偏离 3,判定条件/边界值本身逐字照搬,只改了 key 的表示形式。
export function validatePolicyForm(form: PolicyForm): { valid: boolean; errors: Partial<Record<keyof PolicyForm, string>> } {
  const errors: Partial<Record<keyof PolicyForm, string>> = {}
  const isPositiveInt = (v: number) => Number.isInteger(v) && v >= 1

  if (!isPositiveInt(form.hourly_keep)) errors.hourly_keep = 'snapErrPositiveInt'
  if (!isPositiveInt(form.daily_keep)) errors.daily_keep = 'snapErrPositiveInt'
  if (!isPositiveInt(form.weekly_keep)) errors.weekly_keep = 'snapErrPositiveInt'

  const pct = form.pause_threshold_pct
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
    errors.pause_threshold_pct = 'snapErrPercent'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

// --- Timeline pure mapping helpers (M2-T2) ---------------------------------
// Kept side-effect free (no `this.$t`, no Vue) so they can be unit tested
// without mounting anything. Callers resolve the returned i18n keys via
// `$t()` at the render point.

const TYPE_LABEL_KEYS: Record<'auto' | 'manual' | 'preop', string> = {
  auto: 'snapTypeAuto',
  manual: 'snapTypeManual',
  preop: 'snapTypePreop',
}

// auto-hourly/auto-daily/auto-weekly (and any future auto-* variant, or an
// unrecognized type) all collapse to "auto" — only manual/preop are called
// out separately per the product design.
// (snapshot.js:45-49)
export function classifySnapshotType(type: string | undefined): 'auto' | 'manual' | 'preop' {
  if (type === 'manual') return 'manual'
  if (type === 'preop') return 'preop'
  return 'auto'
}

// 偏离 Vue2:label 从英文原文("Auto"/"Manual"/"Pre-op protection")改为具名 i18n key,
// 同上一处偏离 3,分类逻辑本身不变。
export function snapshotTypeLabelKey(type: string | undefined): string {
  return TYPE_LABEL_KEYS[classifySnapshotType(type)]
}

// "HH:mm" in local wall-clock time.
// (snapshot.js:64-69,原行号注释为 61-66,以实际源码行号为准)
export function formatSnapshotClockTime(createdAt: string | number | Date): string {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Returns either { i18nKey: 'snapToday' | 'snapYesterday' } for the caller to
// run through $t(), or { text } already formatted via toLocaleDateString()
// for anything older.
// (snapshot.js:80-89,原行号注释为 76-86)
// 偏离 Vue2:i18nKey 值从 'Today'/'Yesterday' 改为具名 key 'snapToday'/'snapYesterday',
// 同偏离 3,日期比较逻辑逐字照搬。
export function snapshotDayLabel(createdAt: string | number | Date, now: Date = new Date()): { i18nKey?: string; text?: string } {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const todayKey = dayKeyOf(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = dayKeyOf(yesterday)
  const key = dayKeyOf(d)
  if (key === todayKey) return { i18nKey: 'snapToday' }
  if (key === yesterdayKey) return { i18nKey: 'snapYesterday' }
  return { text: d.toLocaleDateString() }
}

// Maps one raw /v2/snapshot list entry to the flat shape the timeline
// template renders directly. (No "now" here — nothing in this mapping is
// relative to the current time; that's snapshotDayLabel's job.)
// (snapshot.js:95-108,原行号注释为 91-103)
export function toSnapshotViewModel(snap: SnapshotRaw): SnapshotItemView {
  const typeKind = classifySnapshotType(snap.type)
  return {
    id: snap.id,
    name: snap.name,
    label: snap.label || '',
    type: snap.type,
    typeKind,
    typeLabelKey: TYPE_LABEL_KEYS[typeKind],
    time: formatSnapshotClockTime(snap.created_at),
    createdAt: snap.created_at,
  }
}

// Groups a flat snapshot list into day buckets, newest day first, newest
// item first within each day. Does not mutate the input.
// (snapshot.js:112-131,原行号注释为 107-122)
// Vue2 直接用 `new Date(b.created_at) - new Date(a.created_at)`(Date 相减隐式转 number);
// TS strict 下改用 `.getTime()` 显式相减,结果等价,非逻辑偏离。
export function groupSnapshotsByDay(snapshots: SnapshotRaw[], now: Date = new Date()): SnapshotDayGroup[] {
  const sorted = [...(snapshots || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const groups: SnapshotDayGroup[] = []
  const byKey = new Map<string, SnapshotDayGroup>()
  for (const snap of sorted) {
    const key = dayKeyOf(new Date(snap.created_at))
    let group = byKey.get(key)
    if (!group) {
      group = { dayKey: key, label: snapshotDayLabel(snap.created_at, now), items: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.items.push(toSnapshotViewModel(snap))
  }
  return groups
}

// Which day groups should start expanded — the most recent `limit` (default
// 2) of an already newest-first `groups` array.
// (snapshot.js:135-137,原行号注释为 126-128)
export function defaultExpandedDayKeys(groups: SnapshotDayGroup[], limit = 2): string[] {
  return (groups || []).slice(0, limit).map((g) => g.dayKey)
}

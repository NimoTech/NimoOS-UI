// 1:1 移植自 Vue2 src/views/AI/Agent/tabs/ResourcesTab.vue:136-232(groupedStagedChanges
// computed + badgeFor/formatPath/formatSize/kindIcon/relativeTime 方法)。SP8-P1c2 Task 12。
//
// relativeTime 返回 i18n 键名 + 参数,不返回译文 —— 与 attachmentMeta.ts 的
// docErrorKey()/systemTiles.ts 的 subKey 同款"返回键名而非译文"约定;真正的
// zh_cn/en_us 文案由 ResourcesTab.vue 消费时 t() 渲染。
import type { StagedGroup, StagedItem } from '../stores/agentStore'

export interface StagedBatch {
  batchId: string | number
  items: StagedItem[]
  summary: { mkdir: number; rename: number; delete: number }
}

export interface GroupedStagedGroup extends StagedGroup {
  batches: StagedBatch[]
  looseItems: StagedItem[]
}

/**
 * Vue2:164-189 groupedStagedChanges。关键不变量(逐字港,不是我方新增):
 *   - 用 `batch_id != null` 判定"已分批" —— batch_id === 0 是合法值,必须落进
 *     batchMap,不能因为 `0` falsy 就误落进 looseItems(用 !==null && !==undefined
 *     显式判断,不用 `!=`/truthy 简写)。
 *   - `Map` 保插入顺序:batches 数组按 batch_id 第一次出现的顺序排列。
 *   - `delete_file`/`delete_dir` 都计入 summary.delete(Vue2 既有正确逻辑,
 *     不是要修的 bug —— 对应 Vue2 侧曾修过的回归 "C1")。
 */
export function groupStagedChanges(groups: StagedGroup[]): GroupedStagedGroup[] {
  return groups.map((g) => {
    const batchMap = new Map<string | number, StagedItem[]>()
    const looseItems: StagedItem[] = []
    g.items.forEach((it) => {
      if (it.batch_id !== null && it.batch_id !== undefined) {
        if (!batchMap.has(it.batch_id)) batchMap.set(it.batch_id, [])
        batchMap.get(it.batch_id)!.push(it)
      } else {
        looseItems.push(it)
      }
    })
    const batches: StagedBatch[] = Array.from(batchMap.entries()).map(([batchId, items]) => {
      const summary = { mkdir: 0, rename: 0, delete: 0 }
      items.forEach((it) => {
        if (it.op === 'mkdir') summary.mkdir++
        else if (it.op === 'rename') summary.rename++
        else if (it.op === 'delete_file' || it.op === 'delete_dir') summary.delete++
      })
      return { batchId, items, summary }
    })
    return { ...g, batches, looseItems }
  })
}

const BADGE_FOR: Record<string, 'MOD' | 'DEL' | 'MKD' | 'REN'> = {
  write: 'MOD', edit: 'MOD',
  delete_file: 'DEL', delete_dir: 'DEL',
  mkdir: 'MKD', rename: 'REN',
}

/** Vue2:195-197 badgeFor —— 未知 op 兜底 'MOD'。 */
export function badgeFor(op: string): 'MOD' | 'DEL' | 'MKD' | 'REN' {
  return BADGE_FOR[op] || 'MOD'
}

/** Vue2:198-203 formatPath —— rename 且有 dst_path 时画箭头,否则原样返回 path。 */
export function formatStagedPath(it: StagedItem): string {
  if (it.op === 'rename' && it.dst_path) return `${it.path} → ${it.dst_path}`
  return it.path
}

/** Vue2:204-209 formatSize —— 无值(undefined/null,不含 0)→ '—';B/KB/MB 三档。 */
export function formatStagedSize(n?: number): string {
  if (!n && n !== 0) return '—'
  const size = n as number
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/** Vue2:223-229 relativeTime —— 入参是**秒**(unix seconds,非毫秒)。 */
export function relativeTime(unixSec: number): { key: string; params?: Record<string, unknown> } {
  const d = Date.now() / 1000 - unixSec
  if (d < 60) return { key: 'aiResJustNow' }
  if (d < 3600) return { key: 'aiResMinutesAgo', params: { n: Math.floor(d / 60) } }
  if (d < 86400) return { key: 'aiResHoursAgo', params: { n: Math.floor(d / 3600) } }
  return { key: 'aiResDaysAgo', params: { n: Math.floor(d / 86400) } }
}

const KIND_ICON: Record<string, string> = {
  image: '🖼️', video: '🎬', audio: '🎵', text: '📄', binary: '📦',
}

/** Vue2:210-218 kindIcon —— 未知/缺失 kind 兜底 📎。 */
export function attachmentKindIcon(kind?: string): string {
  return (kind && KIND_ICON[kind]) || '📎'
}

/**
 * 英文单复数后缀 helper —— Vue2 用内联三元(`file{{ n === 1 ? '' : 's' }}`)拼
 * "N file(s)"/"N turn(s)"。这只是英文语法需要的后缀,中文文案不使用该参数
 * (数字前不加单复数标记),放进 i18n params 里传给未使用它的 zh_cn 消息无害。
 */
export function pluralWord(n: number): '' | 's' {
  return n === 1 ? '' : 's'
}

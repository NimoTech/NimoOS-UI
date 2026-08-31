// 1:1 ported from Vue2 src/views/AI/Agent/tabs/ResourcesTab.vue:136-232(groupedStagedChanges
// computed + badgeFor/formatPath/formatSize/kindIcon/relativeTime methods).
//
// relativeTime returns i18n key name + params, not translation — same "return key name not translation"
// convention as docErrorKey() in attachmentMeta.ts / subKey in systemTiles.ts; the actual
// zh_cn/en_us text is rendered by t() when consumed by ResourcesTab.vue.
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
 * Vue2:164-189 groupedStagedChanges. Key invariants (verbatim port, not new):
 *   - Use `batch_id != null` to check "already batched" — batch_id === 0 is a valid value, must be
 *     added to batchMap, cannot be mistakenly dropped into looseItems because `0` is falsy (use
 *     explicit !==null && !==undefined check, not `!=`/truthy shorthand).
 *   - `Map` preserves insertion order: batches array is sorted by the order batch_id first appears.
 *   - Both `delete_file` and `delete_dir` count toward summary.delete (Vue2's existing correct logic,
 *     not a bug to fix — corresponds to a regression "C1" that was fixed on Vue2 side).
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

/** Vue2:195-197 badgeFor — unknown op defaults to 'MOD'. */
export function badgeFor(op: string): 'MOD' | 'DEL' | 'MKD' | 'REN' {
  return BADGE_FOR[op] || 'MOD'
}

/** Vue2:198-203 formatPath — draw arrow when rename with dst_path, otherwise return path as-is. */
export function formatStagedPath(it: StagedItem): string {
  if (it.op === 'rename' && it.dst_path) return `${it.path} → ${it.dst_path}`
  return it.path
}

/** Vue2:204-209 formatSize — no value (undefined/null, not including 0) → '—'; three tiers: B/KB/MB. */
export function formatStagedSize(n?: number): string {
  if (!n && n !== 0) return '—'
  const size = n as number
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/** Vue2:223-229 relativeTime — parameter is in **seconds** (unix seconds, not milliseconds). */
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

/** Vue2:210-218 kindIcon — unknown/missing kind defaults to 📎. */
export function attachmentKindIcon(kind?: string): string {
  return (kind && KIND_ICON[kind]) || '📎'
}

/**
 * English singular/plural suffix helper — Vue2 uses inline ternary (`file{{ n === 1 ? '' : 's' }}`) to
 * construct "N file(s)"/"N turn(s)". This is just a suffix needed by English grammar; Chinese text
 * does not use this parameter (no singular/plural marker before the number), so passing it in i18n
 * params to zh_cn messages that don't use it is harmless.
 */
export function pluralWord(n: number): '' | 's' {
  return n === 1 ? '' : 's'
}

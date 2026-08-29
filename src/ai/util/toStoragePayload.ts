// 1:1 Ported from Vue2 src/views/AI/Agent/Agent.vue:221-239(toStoragePayload method).
// Data source changed to Task 1 new `service.disks.list()` (see AgentPage.vue onMounted),
// single fetch — storage capacity does not need a live channel like CPU/memory/network,
// user has already approved this (brief: "storage data source...single fetch, same as Vue2, capacity does not need real-time").
export interface StorageBreakdownItem {
  name?: string
  value: number
  color?: string
}

export interface StoragePayload {
  used: number
  total: number
  breakdown: StorageBreakdownItem[]
  label: string
}

interface DiskLike {
  size?: unknown
  used?: unknown
  [k: string]: unknown
}

/**
 * Verbatim from Agent.vue:221-239: non-array / empty array / (after aggregation)
 * total is 0 → null, drives SystemTab's "storage info unavailable" empty state.
 * `breakdown[0].color` must be **string** `'var(--accent)'` (not parsed color
 * value) — StorageCard.vue writes it as-is into `:style="{ background: b.color }"`
 * inline style; this level of token indirection must be preserved.
 */
export function toStoragePayload(disks: unknown): StoragePayload | null {
  if (!Array.isArray(disks) || disks.length === 0) return null
  let used = 0
  let total = 0
  for (const d of disks as DiskLike[]) {
    // Disclosed deviation from Vue2 (code review F1): Vue2 `Agent.vue:227` is
    // `if (d.size && d.used)` — no `d &&` guard. A `null`/`undefined` element
    // in the disks array would throw there (`Cannot read properties of null
    // (reading 'size')`) and take the whole page-level fetch down with it.
    // The `d &&` guard here is an intentional, disclosed improvement (not a
    // silent port bug): a malformed disk entry is skipped instead of crashing
    // the fetch. See `toStoragePayload.test.ts`'s null/undefined-element case.
    if (d && d.size && d.used) {
      total += Number(d.size) || 0
      used += Number(d.used) || 0
    }
  }
  if (total === 0) return null
  return {
    used: used / 1e12,
    total: total / 1e12,
    breakdown: [{ name: 'Used', value: used / 1e12, color: 'var(--accent)' }],
    label: 'NimoOS Storage',
  }
}

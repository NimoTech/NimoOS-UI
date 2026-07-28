// 1:1 移植自 Vue2 src/views/AI/Agent/Agent.vue:221-239(toStoragePayload 方法)。
// 数据源改为 Task 1 新增的 `service.disks.list()`(见 AgentPage.vue onMounted),
// 单次拉取——存储容量不需要像 CPU/内存/网络那样接实时通道,这点用户已拍板
// (brief:"存储条数据源...一次性拉取,与 Vue2 同,容量不需要实时")。
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
 * 逐字港 Agent.vue:221-239:非数组/空数组/(汇总后)总量为 0 → null,驱动
 * SystemTab 的"存储信息不可用"空态。`breakdown[0].color` 必须是**字符串**
 * `'var(--accent)'`(不是解析后的颜色值)—— StorageCard.vue 把它原样写进
 * `:style="{ background: b.color }"` 内联样式,这层 token 间接必须保留。
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

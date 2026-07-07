const ORDER_KEY = 'nimoos:location-order'
const DEFAULT_KEY = 'nimoos:location-default'

// 按保存顺序重排;未记录项(新盘)保持原相对位置、排到已知项之后。对齐 Vue2 applyLocationOrder。
export function applyOrder<T extends { path: string }>(disks: T[], order: string[]): T[] {
  if (!order.length) return disks
  const rank = (p: string) => {
    const i = order.indexOf(p)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return disks
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => rank(a.item.path) - rank(b.item.path) || a.idx - b.idx)
    .map((x) => x.item)
}

export function readOrder(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function writeOrder(order: string[]): void {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)) } catch { /* 忽略 */ }
}

export function readDefault(): string {
  try { return localStorage.getItem(DEFAULT_KEY) || '' } catch { return '' }
}

export function writeDefault(path: string): void {
  try { localStorage.setItem(DEFAULT_KEY, path) } catch { /* 忽略 */ }
}

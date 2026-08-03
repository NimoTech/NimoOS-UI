// 存储 / RAID 创建时的默认名称计算(移植自 Vue2 utils/storageNaming.js,语义逐字一致)。
// RAID 阵列名与存储(分区)名共享同一命名空间,调用方需把两类已存在的名字合并后传入。

export const DEFAULT_STORAGE_NAME = 'Main-storage'

export function computeNextStorageName(
  base: string = DEFAULT_STORAGE_NAME,
  takenNames: string[] = [],
): string {
  const taken = new Set(
    (takenNames || []).filter((n) => n != null && n !== '').map((n) => String(n).toLowerCase()),
  )
  if (!taken.has(base.toLowerCase())) return base
  for (let i = 1; i < 100000; i++) {
    const cand = `${base}${i}`
    if (!taken.has(cand.toLowerCase())) return cand
  }
  return base
}

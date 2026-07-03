// 真实路径拼接(仅操作真实路径;虚拟↔真实转换在 pathUtils)。
export function joinPath(parentReal: string, name: string): string {
  const base = parentReal.replace(/\/+$/, '')
  return (base === '' ? '' : base) + '/' + name
}

export function renameTo(realPath: string, newName: string): string {
  const trimmed = realPath.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  const parent = idx <= 0 ? '' : trimmed.slice(0, idx)
  return parent + '/' + newName
}

// Real path concatenation (operates on real paths only; virtual ↔ real conversion is in pathUtils).
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

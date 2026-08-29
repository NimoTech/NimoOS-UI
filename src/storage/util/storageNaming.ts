// Default name computation for storage / RAID creation (ported from Vue2 utils/storageNaming.js, semantics identical verbatim).
// RAID array names and storage (partition) names share the same namespace, so callers must merge both existing-name lists before passing them in.

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

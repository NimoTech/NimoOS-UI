/* Pure derivations for "pick avatar from NAS". Ported from Vue2 AccountPanel.vue's
 * loadNasStorages (:273-319, only the pure-derivation part) / nasBreadcrumbs (:148-163) /
 * nasNavigateUp (:347-352) / loadNasFolder's filtering (:333-337).
 *
 * ⚠️ Do not reuse mapVolumes from storage/util/storageMap.ts: it doesn't recognize a
 * whole disk's `type === 'usb'` (its RawGroup has no type field) and lacks the
 * "/DATA always first" behavior -- both are visible 1:1 requirements of this screen.
 */
import { toVirtualPath } from '../../files/util/pathUtils'

export interface NasStorage { name: string; path: string; avail: number | null; size: number | null }

interface RawPart { mount_point?: string; label?: string; drive_name?: string; size?: unknown; avail?: unknown }
interface RawDisk { type?: string; children?: RawPart[] }
interface RawRaid { name?: string; mount_point?: string }

export function buildNasStorages(
  rawStorage: unknown,
  rawRaid: unknown,
  displayNames: Record<string, string>,
): NasStorage[] {
  const disks = Array.isArray(rawStorage) ? (rawStorage as RawDisk[]) : []
  const raids = Array.isArray(rawRaid) ? (rawRaid as RawRaid[]) : []
  const raidMountPoints = new Set(raids.map((r) => r.mount_point).filter(Boolean) as string[])

  const out: NasStorage[] = []
  // Vue2 :286-292: NimoOS-HD is always first and carries no capacity (that screen doesn't show system disk usage).
  out.push({ name: displayNames['/DATA'] || 'NimoOS-HD', path: '/DATA', avail: null, size: null })

  for (const disk of disks) {
    for (const part of disk.children || []) {
      const mp = part.mount_point || ''
      if (disk.type === 'usb' || raidMountPoints.has(mp)) continue
      if (mp === '/DATA') continue // Already added above
      out.push({
        name: displayNames[mp] || part.label || part.drive_name || '',
        path: mp,
        // size/avail from /v1/storage are **strings**; 0 and empty string are both treated as "no capacity info" (Vue2 || null)
        avail: Number(part.avail) || null,
        size: Number(part.size) || null,
      })
    }
  }
  for (const raid of raids) {
    if (!raid.mount_point) continue
    out.push({ name: raid.name || '', path: raid.mount_point, avail: null, size: null })
  }
  return out
}

/** Vue2 computed nasBreadcrumbs (:148-163). Root crumb uses the virtual name (leading `/`
 *  stripped); with no mapping it falls back to the real path (leading `/` stripped too). */
export function nasBreadcrumbs(
  nasPath: string,
  nasRootPath: string,
  displayNames: Record<string, string>,
): { name: string; path: string }[] {
  if (!nasPath || !nasRootPath) return []
  const rootVirtual = toVirtualPath(nasRootPath, displayNames)
  const rootName = rootVirtual.replace(/^\//, '') || nasRootPath
  const crumbs = [{ name: rootName, path: nasRootPath }]
  if (nasPath === nasRootPath) return crumbs
  const relative = nasPath.slice(nasRootPath.length)
  let acc = nasRootPath
  for (const seg of relative.split('/').filter(Boolean)) {
    acc += `/${seg}`
    crumbs.push({ name: seg, path: acc })
  }
  return crumbs
}

/** Target computation of Vue2 nasNavigateUp (:347-352). Returns null = already at root,
 *  no request should be sent.
 *  The clamp on the last line guards against escaping the root in the inconsistent state
 *  "current path is not under the root".
 *  ⚠️ The `|| nasRootPath` fallback is **redundant** given the clamp (when the parent
 *  computes to an empty string, `0 >= root.length` is always false and it falls back to
 *  root anyway) -- mutation testing confirmed removing it changes nothing.
 *  Kept 1:1, but no dedicated test case for it (one would be a no-op). */
export function nasNavigateUpTarget(nasPath: string, nasRootPath: string): string | null {
  if (!nasPath || nasPath === nasRootPath) return null
  const parent = nasPath.replace(/\/[^/]+$/, '') || nasRootPath
  return parent.length >= nasRootPath.length ? parent : nasRootPath
}

const IMAGE_RE = /\.(?:jpe?g|png|gif|webp|bmp)$/i

/** Image check from Vue2 :336 (regex identical). */
export function isPickableImage(name: string): boolean {
  return IMAGE_RE.test(name)
}

/** Vue2 :333-337: drop dot-prefixed hidden items, keep all directories, keep only image files. */
export function filterNasItems(content: unknown): { name: string; path: string; is_dir: boolean }[] {
  const arr = Array.isArray(content) ? (content as { name?: string; path?: string; is_dir?: boolean }[]) : []
  return arr
    .filter((item) => {
      const name = item.name || ''
      if (name.startsWith('.')) return false
      if (item.is_dir) return true
      return isPickableImage(name)
    })
    .map((item) => ({ name: item.name || '', path: item.path || '', is_dir: !!item.is_dir }))
}

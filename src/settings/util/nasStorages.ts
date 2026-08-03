/* 「从 NAS 选择头像」的纯派生。移植源 Vue2 AccountPanel.vue 的
 * loadNasStorages(:273-319,只取纯派生部分)/ nasBreadcrumbs(:148-163)/
 * nasNavigateUp(:347-352)/ loadNasFolder 的过滤(:333-337)。
 *
 * ⚠️ 不复用 storage/util/storageMap.ts 的 mapVolumes:那个不认整块磁盘的
 * `type === 'usb'`(它的 RawGroup 里没有 type 字段),也没有「/DATA 恒排第一」的行为,
 * 而这两条都是本界面可见的 1:1 要求。
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
  // Vue2 :286-292:NimoOS-HD 恒排第一,且不带容量(那一屏不显示系统盘的用量)。
  out.push({ name: displayNames['/DATA'] || 'NimoOS-HD', path: '/DATA', avail: null, size: null })

  for (const disk of disks) {
    for (const part of disk.children || []) {
      const mp = part.mount_point || ''
      if (disk.type === 'usb' || raidMountPoints.has(mp)) continue
      if (mp === '/DATA') continue // 上面已加
      out.push({
        name: displayNames[mp] || part.label || part.drive_name || '',
        path: mp,
        // /v1/storage 的 size/avail 是**字符串**;0 与空串都按「无容量信息」处理(Vue2 || null)
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

/** Vue2 computed nasBreadcrumbs(:148-163)。根 crumb 用虚拟名(去前导 `/`),
 *  无映射时回退真实路径(同样去前导 `/`)。 */
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

/** Vue2 nasNavigateUp(:347-352) 的目标计算。返回 null = 已在根,不该发请求。
 *  末行的夹紧是防「当前路径不在根之下」这种不一致状态时跑到根外面去。
 *  ⚠️ `|| nasRootPath` 这个兜底在夹紧存在的前提下是**冗余**的(父目录算成空串时
 *  `0 >= root.length` 恒 false,同样回落到根)—— 变异验证证实删掉它行为不变。
 *  照 1:1 保留,但测试里没有为它单独留用例(留了就是空转)。 */
export function nasNavigateUpTarget(nasPath: string, nasRootPath: string): string | null {
  if (!nasPath || nasPath === nasRootPath) return null
  const parent = nasPath.replace(/\/[^/]+$/, '') || nasRootPath
  return parent.length >= nasRootPath.length ? parent : nasRootPath
}

const IMAGE_RE = /\.(?:jpe?g|png|gif|webp|bmp)$/i

/** Vue2 :336 的图片判定(正则逐字一致)。 */
export function isPickableImage(name: string): boolean {
  return IMAGE_RE.test(name)
}

/** Vue2 :333-337:滤掉点开头的隐藏项,目录全留,文件只留图片。 */
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

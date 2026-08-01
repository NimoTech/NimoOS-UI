import windowsIcon from '../assets/windows.svg'
import ubuntuIcon from '../assets/ubuntu.svg'
import debianIcon from '../assets/debian.svg'
import centosIcon from '../assets/centos.svg'
import alpineIcon from '../assets/alpine.svg'
import archIcon from '../assets/arch.svg'
import freebsdIcon from '../assets/freebsd.svg'
import linuxIcon from '../assets/linux.svg'

/** 内存格式化。逐字对 Vue2 KVMFullPage.vue:1644-1651(formatRam / formatHostMem 同实现)。 */
export function formatRam(mb: number): string {
  if (!mb) return '0 MB'
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}

/** Vue2 里 formatHostMem 与 formatRam 是两个一模一样的方法。保留两个名字以对齐调用处语义。 */
export const formatHostMem = formatRam

// Vue2 getOsIcon(KVMFullPage.vue:1632-1642)的 if 链,**顺序有意义**(win 在最前)。照抄顺序。
const ICONS: [string, string][] = [
  ['win', windowsIcon],
  ['ubuntu', ubuntuIcon],
  ['debian', debianIcon],
  ['centos', centosIcon],
  ['alpine', alpineIcon],
  ['arch', archIcon],
  ['freebsd', freebsdIcon],
]

export function osIconFor(os: string): string {
  const lower = (os || '').toLowerCase()
  for (const [key, icon] of ICONS) if (lower.includes(key)) return icon
  return linuxIcon
}

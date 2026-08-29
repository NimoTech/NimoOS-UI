import windowsIcon from '../assets/windows.svg'
import ubuntuIcon from '../assets/ubuntu.svg'
import debianIcon from '../assets/debian.svg'
import centosIcon from '../assets/centos.svg'
import alpineIcon from '../assets/alpine.svg'
import archIcon from '../assets/arch.svg'
import freebsdIcon from '../assets/freebsd.svg'
import linuxIcon from '../assets/linux.svg'

/** Memory formatting. Character-by-character match with Vue2 KVMFullPage.vue:1644-1651 (formatRam / formatHostMem same implementation). */
export function formatRam(mb: number): string {
  if (!mb) return '0 MB'
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}

/** In Vue2, formatHostMem and formatRam are two identical methods. Keep both names to align with call-site semantics. */
export const formatHostMem = formatRam

// Vue2 getOsIcon (KVMFullPage.vue:1632-1642) if chain, **order matters** (win first). Replicate order.
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

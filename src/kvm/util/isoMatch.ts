import type { KvmISO } from '@nimotech/nimoos-service'

/** 本地 ISO 文件名过滤。照 Vue2 OSSelector.vue:312/:331 的
 * `item.name.toLowerCase().endsWith('.iso')` 判断,抽成独立纯函数复用。 */
export function isIsoFile(name: string): boolean {
  return name.toLowerCase().endsWith('.iso')
}

/** 文件大小格式化(字节数)。逐字对 Vue2 OSSelector.vue:292-302 formatFileSize:
 * 1024 进制、一位小数、`!bytes`(含 undefined 与 0)返回空串。 */
export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

/** 分类过滤。照 Vue2 OSSelector.vue:196-199 filteredOS computed。 */
export function filterByCategory(list: KvmISO[], cat: string): KvmISO[] {
  if (cat === 'all') return list
  return list.filter((os) => os.category === cat)
}

/** 本地 ISO 文件名反查所属模板。照 Vue2 OSSelector.vue:328-346
 * handleCustomItemClick:先按文件名是否包含某模板 id 直接命中(:335-340),
 * 未命中再走 win11/win10/泛 win 三级兜底(:343-345)。 */
export function matchTemplateByFilename(fileName: string, templates: KvmISO[]): KvmISO | null {
  const lowerName = fileName.toLowerCase()

  for (const tmpl of templates) {
    if (lowerName.includes(tmpl.id.toLowerCase())) return tmpl
  }

  if (lowerName.includes('win11')) return templates.find((t) => t.id === 'win11') ?? null
  if (lowerName.includes('win10')) return templates.find((t) => t.id === 'win10') ?? null
  if (lowerName.includes('win')) {
    return templates.find((t) => t.id === 'win11') ?? templates.find((t) => t.id === 'win10') ?? null
  }

  return null
}

export interface OsTemplateDefaults {
  osType: 'linux' | 'windows'
  firmware: 'bios' | 'uefi'
  os: string
  vcpu?: number
  memory?: number
  minDisk?: number
}

/** 选中 osTemplate 后联动出的默认值。照 Vue2 KVMFullPage.vue:720-746
 * watch('newVM.osTemplate')。generic-linux/generic-windows 是两个固定占位模板,
 * 其余按真实模板的 id/name 是否含 'win' 判断 windows,并带出推荐规格。 */
export function osTemplateDefaults(templateId: string, templates: KvmISO[]): OsTemplateDefaults {
  if (templateId === 'generic-linux') {
    return { osType: 'linux', firmware: 'bios', os: 'Linux' }
  }
  if (templateId === 'generic-windows') {
    return { osType: 'windows', firmware: 'uefi', os: 'Windows' }
  }

  const tmpl = templates.find((t) => t.id === templateId)
  if (!tmpl) {
    // 未知 id:回落到 generic-linux 的行为(Vue2 找不到 tmpl 时 watch 整段是空 no-op,
    // 但调用方需要一个确定的返回值——回落成最保守的 linux/bios,不新增语义)。
    return { osType: 'linux', firmware: 'bios', os: 'Linux' }
  }

  const isWindows = tmpl.id.toLowerCase().includes('win') || tmpl.name.toLowerCase().includes('win')
  const result: OsTemplateDefaults = {
    osType: isWindows ? 'windows' : 'linux',
    firmware: isWindows ? 'uefi' : 'bios',
    os: tmpl.name,
  }
  if (tmpl.recommendedVcpu) result.vcpu = tmpl.recommendedVcpu
  if (tmpl.recommendedMemory) result.memory = tmpl.recommendedMemory
  if (tmpl.minDisk) result.minDisk = tmpl.minDisk
  return result
}

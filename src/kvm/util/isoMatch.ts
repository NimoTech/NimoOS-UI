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
 * 未命中再走 win11/win10/泛 win 三级兜底(:343-345)。
 *
 * 偏离登记(改正确,非照抄):Vue2 那三行兜底找的是 `o.id === 'windows11'` /
 * `'windows10'`。真机 `GET /v1/kvm/isos` 返回的模板 id 是 `win10`/`win11`,
 * `windows11`/`windows10` 这两个字面量在真实响应里从未出现过——Vue2 那三行是死代码,
 * 兜底永远匹配不到任何模板。这里把字面量改成真机的 `win11`/`win10`。 */
export function matchTemplateByFilename(fileName: string, templates: KvmISO[]): KvmISO | null {
  const lowerName = fileName.toLowerCase()

  for (const tmpl of templates) {
    if (lowerName.includes(tmpl.id.toLowerCase())) return tmpl
  }

  // 三级兜底,id 字面量见函数头偏离登记(win11/win10,非 Vue2 原文的 windows11/windows10)。
  if (lowerName.includes('win11')) return templates.find((t) => t.id === 'win11') ?? null
  if (lowerName.includes('win10')) return templates.find((t) => t.id === 'win10') ?? null
  if (lowerName.includes('win')) {
    return templates.find((t) => t.id === 'win11') ?? templates.find((t) => t.id === 'win10') ?? null
  }

  return null
}

/** 本地 ISO 文件名反查所属模板 —— 家族前缀("较宽松")版。照 Vue2
 * KVMFullPage.vue:1392-1403 `onOSSelect` 里 `os.id && os.id !== 'local'` 为假时走的
 * 那段兜底逻辑(直到本次全分支评审前,New-UI 一直没搬这一层,只搬了同文件
 * OSSelector.vue:328-346 那个"严格"版,即上面的 `matchTemplateByFilename`)。
 *
 * 与 `matchTemplateByFilename` 的关系(为什么要两个函数,不是重复):Vue2 对同一份
 * `getISOList()` 数据用了两个不同松紧度的匹配器,分别喂给两条不同的调用路径——
 * `matchTemplateByFilename` 是**第一遍**(IsoBrowser 浏览本地文件、点击 .iso 那一刻,
 * 对应 handleCustomItemClick):先按 id 整个子串命中,再 win11/win10/泛 win 三级兜底,
 * 命中不了就把 id 落成 'local'。`matchTemplateByFamily` 是**第二遍**兜底(创建弹窗收到
 * `os.id==='local'` 时,对应 onOSSelect 那段 else 分支):按模板 id 的第一段(`split('-')[0]`,
 * 如 'ubuntu'/'debian'/'alpine')反查文件名是否包含这个家族前缀,`win*` 系列额外要求
 * 文件名同时包含版本号数字。两遍加起来才是 Vue2 真实的匹配能力——只搬第一遍会让
 * `alpine-standard-3.19.1-x86_64.iso` 这类"文件名不含完整模板 id,但含家族前缀"的
 * 真实命名落不到任何模板,推荐规格(vcpu/memory/disk)与准确的 osType/firmware 全部
 * 丢失,退化成"通用 Linux"。 */
export function matchTemplateByFamily(fileName: string, templates: KvmISO[]): KvmISO | null {
  const lowerName = fileName.toLowerCase()

  const match = templates.find((tmpl) => {
    const key = tmpl.id.toLowerCase().split('-')[0] // 'ubuntu' / 'debian' / 'win10' / 'win11'

    if (key.startsWith('win')) {
      const version = key.replace('win', '') // '10' / '11'
      if (version) return lowerName.includes('win') && lowerName.includes(version)
      return lowerName.includes('win')
    }

    return lowerName.includes(key)
  })

  return match ?? null
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

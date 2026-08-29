import type { KvmISO } from '@nimotech/nimoos-service'

/** Local ISO filename filter. Following Vue2 OSSelector.vue:312/:331's
 * `item.name.toLowerCase().endsWith('.iso')` check, extracted as a standalone pure function for reuse. */
export function isIsoFile(name: string): boolean {
  return name.toLowerCase().endsWith('.iso')
}

/** File size formatting (bytes). Exactly matching Vue2 OSSelector.vue:292-302 formatFileSize:
 * 1024 base, one decimal place, `!bytes` (including undefined and 0) returns empty string. */
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

/** Category filter. Following Vue2 OSSelector.vue:196-199 filteredOS computed. */
export function filterByCategory(list: KvmISO[], cat: string): KvmISO[] {
  if (cat === 'all') return list
  return list.filter((os) => os.category === cat)
}

/** Reverse lookup template by local ISO filename. Following Vue2 OSSelector.vue:328-346
 * handleCustomItemClick: first directly match if filename contains a template id (:335-340),
 * if not matched, fall back through win11/win10/generic win three-level fallback (:343-345).
 *
 * Deviation from registration (corrected, not copied verbatim): Vue2's three-line fallback
 * looks for `o.id === 'windows11'` / `'windows10'`. Real device `GET /v1/kvm/isos` returns
 * template ids `win10`/`win11`, but `windows11`/`windows10` these two literals never appear
 * in real responses—Vue2's three lines are dead code, the fallback will never match any
 * template. Here the literals are changed to the real device's `win11`/`win10`. */
export function matchTemplateByFilename(fileName: string, templates: KvmISO[]): KvmISO | null {
  const lowerName = fileName.toLowerCase()

  for (const tmpl of templates) {
    if (lowerName.includes(tmpl.id.toLowerCase())) return tmpl
  }

  // Three-level fallback, id literals see function header deviation note (win11/win10, not Vue2's
  // original windows11/windows10).
  if (lowerName.includes('win11')) return templates.find((t) => t.id === 'win11') ?? null
  if (lowerName.includes('win10')) return templates.find((t) => t.id === 'win10') ?? null
  if (lowerName.includes('win')) {
    return templates.find((t) => t.id === 'win11') ?? templates.find((t) => t.id === 'win10') ?? null
  }

  return null
}

/** Reverse lookup template by local ISO filename — family-prefix ("looser") version.
 * Following Vue2 KVMFullPage.vue:1392-1403 `onOSSelect` where `os.id && os.id !== 'local'`
 * is false, that fallback logic (until this round of full-branch review, New-UI had never
 * ported this layer, only ported the same file's OSSelector.vue:328-346 the 'strict' version,
 * namely the above `matchTemplateByFilename`).
 *
 * Relationship with `matchTemplateByFilename` (why two functions, not duplication): Vue2 uses
 * the same `getISOList()` data with two different tightness-levels of matchers, fed to two
 * different call paths— `matchTemplateByFilename` is the **first pass** (IsoBrowser browsing
 * local files, at the moment of clicking .iso, corresponding to handleCustomItemClick): first
 * match by id as a whole substring, then win11/win10/generic win three-level fallback, if not
 * matched, fall id to 'local'. `matchTemplateByFamily` is the **second pass** fallback (when
 * creating dialog receives `os.id==='local'`, corresponding to the else branch of onOSSelect):
 * by the first segment of template id (`split('-')[0]`, such as 'ubuntu'/'debian'/'alpine')
 * reverse-check if filename contains this family prefix, `win*` series additionally requires
 * filename to also contain version number digits. Together both passes are Vue2's actual
 * matching capability—porting only the first pass would let files like
 * `alpine-standard-3.19.1-x86_64.iso` (filename doesn't contain full template id, but contains
 * family prefix) fall to no template, recommended specs (vcpu/memory/disk) and accurate
 * osType/firmware all lost, degrading to 'generic Linux'. */
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

/** Default values linked when osTemplate is selected. Following Vue2 KVMFullPage.vue:720-746
 * watch('newVM.osTemplate'). generic-linux/generic-windows are two fixed placeholder templates,
 * the rest determine windows based on whether the real template's id/name contains 'win', and
 * bring out recommended specs. */
export function osTemplateDefaults(templateId: string, templates: KvmISO[]): OsTemplateDefaults {
  if (templateId === 'generic-linux') {
    return { osType: 'linux', firmware: 'bios', os: 'Linux' }
  }
  if (templateId === 'generic-windows') {
    return { osType: 'windows', firmware: 'uefi', os: 'Windows' }
  }

  const tmpl = templates.find((t) => t.id === templateId)
  if (!tmpl) {
    // Unknown id: fall back to generic-linux behavior (when Vue2 can't find tmpl, the entire
    // watch is a no-op, but the caller needs a definite return value—fall back to the most
    // conservative linux/bios, no new semantics).
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

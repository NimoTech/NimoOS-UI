/**
 * 硬盘待机选项。取值对位 Vue2 SettingsPanel.vue L989-997(standbyOptions)。
 * Vue2 每项内联 `{zh, en}` 两栏、靠 getStandbyLabel() 按当前语言挑
 * (且它只认 zh_cn/zh_tw,其他语言一律走英文)。这里改走 i18n 分片,
 * 由 vue-i18n 统一管 —— 不是重构,是因为 New-UI 本来就有 i18n 体系,
 * 内联两栏在新仓库里是重复实现。
 */
export interface StandbyOption { value: string; labelKey: string }

export const STANDBY_OPTIONS: readonly StandbyOption[] = [
  { value: 'never', labelKey: 'settingsStandbyNever' },
  { value: '10m', labelKey: 'settingsStandby10m' },
  { value: '20m', labelKey: 'settingsStandby20m' },
  { value: '30m', labelKey: 'settingsStandby30m' },
  { value: '1h', labelKey: 'settingsStandby1h' },
  { value: '2h', labelKey: 'settingsStandby2h' },
  { value: '3h', labelKey: 'settingsStandby3h' },
  { value: '4h', labelKey: 'settingsStandby4h' },
  { value: '5h', labelKey: 'settingsStandby5h' },
] as const

/**
 * 对位 Vue2 SettingsPanel.vue L1886-1890(parseStandbyMinutes)。
 * 后端 PUT /v1/sys/disk/standby 要求 `minutes` 是整数,非整数(或缺字段)
 * 会被 400(NimoOS/route/v1/system.go:606-628,PutDiskStandby),
 * 所以无法识别一律给 0 而不是 NaN。
 */
export function parseStandbyMinutes(standby: string | undefined): number {
  if (!standby || standby === 'never') return 0
  const num = Number.parseInt(standby, 10)
  if (!Number.isFinite(num)) return 0
  if (standby.endsWith('m')) return num
  if (standby.endsWith('h')) return num * 60
  return 0
}

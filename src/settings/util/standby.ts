/**
 * Disk standby options. Values map to Vue2 SettingsPanel.vue L989-997 (standbyOptions).
 * Vue2 inlines `{zh, en}` per item and picks via getStandbyLabel() based on the current
 * language (and it only recognizes zh_cn/zh_tw; every other language falls to English).
 * Here we switch to i18n keys managed uniformly by vue-i18n -- not a refactor: New-UI
 * already has an i18n system, so the inline two-column approach would be a duplicate
 * implementation in this repo.
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
 * Maps to Vue2 SettingsPanel.vue L1886-1890 (parseStandbyMinutes).
 * The backend PUT /v1/sys/disk/standby requires `minutes` to be an integer; a
 * non-integer (or missing field) gets a 400 (NimoOS/route/v1/system.go:606-628,
 * PutDiskStandby), so anything unrecognized yields 0 instead of NaN.
 */
export function parseStandbyMinutes(standby: string | undefined): number {
  if (!standby || standby === 'never') return 0
  const num = Number.parseInt(standby, 10)
  if (!Number.isFinite(num)) return 0
  if (standby.endsWith('m')) return num
  if (standby.endsWith('h')) return num * 60
  return 0
}

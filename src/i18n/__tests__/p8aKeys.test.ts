import { describe, it, expect } from 'vitest'
import zh from '../zh_cn'
import en from '../en_us'

const KEYS = [
  'photosSettingsTitle', 'photosSettingsSubtitle', 'photosSettingsHeroDesc',
  'photosSettingsNavStorage', 'photosSettingsNavAi',
  'photosSettingsStorage', 'photosSettingsVolume', 'photosSettingsFree',
  'photosSettingsUsedOf', 'photosSettingsStorageUnavailable',
  'photosSettingsSegPhotos', 'photosSettingsSegVideos', 'photosSettingsSegRaw',
  'photosSettingsSegThumbs', 'photosSettingsSegAi', 'photosSettingsSegOther',
  'photosSettingsSegFree',
  'photosSettingsRetentionLabel', 'photosSettingsRetentionDesc',
  'photosSettingsRetentionDay', 'photosSettingsRetentionFailed',
  'photosSettingsRescanLabel', 'photosSettingsRescanDesc', 'photosSettingsRescanNow',
  'photosSettingsRescanning', 'photosSettingsRescanStarted',
  'photosSettingsScanIntervalLabel', 'photosSettingsScanIntervalDesc',
  'photosSettingsScanIntervalOff',
  'photosSettingsCacheLabel', 'photosSettingsCacheDesc', 'photosSettingsClearCache',
  'photosSettingsClearing', 'photosSettingsCleared', 'photosSettingsCacheClearedToast',
  'photosSettingsCacheClearFailed',
  'photosSettingsAiTitle', 'photosSettingsAiSubtitle',
  'photosSettingsPrivacyTitle', 'photosSettingsPrivacyBody',
  'photosSettingsFeaturesTitle', 'photosSettingsFeaturesDesc',
  'photosSettingsFeatFaces', 'photosSettingsFeatFacesDesc',
  'photosSettingsFeatScenes', 'photosSettingsFeatScenesDesc',
  'photosSettingsFeatOcr', 'photosSettingsFeatOcrDesc',
  'photosSettingsFeatSmartview', 'photosSettingsFeatSmartviewDesc',
  'photosSettingsFeatSaveFailed',
  'photosSettingsIndexTitle', 'photosSettingsIndexRebuilding',
  'photosSettingsIndexLastBuilt', 'photosSettingsIndexNever',
  'photosSettingsIndexPct', 'photosSettingsIndexCoverage',
  'photosSettingsRebuildIndex', 'photosSettingsRebuiltToast',
  'photosSettingsRebuildFailed', 'photosSettingsRebuildStartFailed',
  'photosSettingsRecluster', 'photosSettingsReclusterStarted',
  'photosSettingsReclusterFailed',
  'photosSettingsFooterApp', 'photosSettingsRunningOn', 'photosSettingsLibrarySince',
  'photosDeepLinkPhotoNotFound', 'photosFavoritesLoadFailed',
  'photosAlbumLoadFailed', 'photosRetry',
] as const

describe('P8a i18n 键', () => {
  it('两个 locale 都定义了本期全部键,且值非空', () => {
    for (const k of KEYS) {
      expect(zh, `zh 缺 ${k}`).toHaveProperty(k)
      expect(en, `en 缺 ${k}`).toHaveProperty(k)
      expect(String((zh as Record<string, string>)[k]).trim().length, `zh ${k} 为空`).toBeGreaterThan(0)
      expect(String((en as Record<string, string>)[k]).trim().length, `en ${k} 为空`).toBeGreaterThan(0)
    }
  })

  it('zh 侧不残留英文占位(本期键的 zh 值不得与 en 值相同,除术语本身)', () => {
    const SAME_OK = new Set<string>() // 本期无中英同形键;若出现真同形术语,加入白名单并在此注释说明理由
    for (const k of KEYS) {
      if (SAME_OK.has(k)) continue
      const z = String((zh as Record<string, string>)[k])
      const e = String((en as Record<string, string>)[k])
      expect(z === e, `${k} 的 zh 与 en 相同,疑似漏译`).toBe(false)
    }
  })

  it('带占位符的键两侧占位符集合一致', () => {
    const ph = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',')
    for (const k of KEYS) {
      const z = String((zh as Record<string, string>)[k])
      const e = String((en as Record<string, string>)[k])
      expect(ph(z), `${k} 占位符不一致`).toBe(ph(e))
    }
  })
})

import { describe, it, expect } from 'vitest'
import zh from '../zh_cn'
import en from '../en_us'

const KEYS = [
  // Note: photosSettingsSubtitle was removed (zh_cn.ts/en_us.ts carry a removal note at that
  // spot) — it's a dead key with zero references anywhere in the repo; AreaShell.vue only
  // consumes `title`, there's no slot for a subtitle.
  'photosSettingsTitle', 'photosSettingsHeroDesc',
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

describe('P8a i18n keys', () => {
  it('both locales define every key for this milestone, with non-empty values', () => {
    for (const k of KEYS) {
      expect(zh, `zh 缺 ${k}`).toHaveProperty(k)
      expect(en, `en 缺 ${k}`).toHaveProperty(k)
      expect(String((zh as Record<string, string>)[k]).trim().length, `zh ${k} 为空`).toBeGreaterThan(0)
      expect(String((en as Record<string, string>)[k]).trim().length, `en ${k} 为空`).toBeGreaterThan(0)
    }
  })

  it("zh side has no leftover English placeholders (this milestone's zh values must not equal en, except for terms that are genuinely identical)", () => {
    const SAME_OK = new Set<string>() // 本期无中英同形键;若出现真同形术语,加入白名单并在此注释说明理由
    for (const k of KEYS) {
      if (SAME_OK.has(k)) continue
      const z = String((zh as Record<string, string>)[k])
      const e = String((en as Record<string, string>)[k])
      expect(z === e, `${k} 的 zh 与 en 相同,疑似漏译`).toBe(false)
    }
  })

  it('keys with placeholders have matching placeholder sets on both sides', () => {
    const ph = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',')
    for (const k of KEYS) {
      const z = String((zh as Record<string, string>)[k])
      const e = String((en as Record<string, string>)[k])
      expect(ph(z), `${k} 占位符不一致`).toBe(ph(e))
    }
  })
})

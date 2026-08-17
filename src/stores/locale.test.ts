import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Stateful fake backend: whatever setCustomStorage writes back, the next getCustomStorage call
// can read (systemConfig's internal serial queue re-reads once internally, so the mock must
// "remember" the last write the way a real backend would).
let blob: unknown = null
const getCustomStorage: MockedFunction<(k: string) => Promise<unknown>> = vi.fn(async () => blob)
const setCustomStorage: MockedFunction<(k: string, d: unknown) => Promise<unknown>> = vi.fn(async (_k: string, d: unknown) => { blob = d; return {} })
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { users: {
    getCustomStorage: (k: string) => getCustomStorage(k),
    setCustomStorage: (k: string, d: unknown) => setCustomStorage(k, d),
  } } }
})

import { i18n } from '../i18n'
import { useLocaleStore } from './locale'
import { useToast } from './toast'

describe('locale store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    blob = null
    i18n.global.locale.value = 'zh_cn'
  })

  it('setLocale updates i18n and localStorage', () => {
    useLocaleStore().setLocale('en_us')
    expect(i18n.global.locale.value).toBe('en_us')
    expect(localStorage.getItem('lang')).toBe('en_us')
  })

  it('loadFromServer applies a valid lang from the blob', async () => {
    getCustomStorage.mockResolvedValueOnce({ lang: 'en_us', timezone: 'UTC' })
    await useLocaleStore().loadFromServer()
    expect(i18n.global.locale.value).toBe('en_us')
  })

  it('loadFromServer supports a stringified JSON blob', async () => {
    getCustomStorage.mockResolvedValueOnce(JSON.stringify({ lang: 'en_us' }))
    await useLocaleStore().loadFromServer()
    expect(i18n.global.locale.value).toBe('en_us')
  })

  it('loadFromServer ignores an invalid lang and leaves the current language unchanged', async () => {
    getCustomStorage.mockResolvedValueOnce({ lang: 'fr_fr' })
    await useLocaleStore().loadFromServer()
    expect(i18n.global.locale.value).toBe('zh_cn')
  })

  it('persist read-modify-write: preserves other fields on the blob, only overwrites lang', async () => {
    getCustomStorage.mockResolvedValueOnce({ timezone: 'UTC', search_switch: true })
    await useLocaleStore().persist('en_us')
    expect(setCustomStorage).toHaveBeenCalledTimes(1)
    expect(setCustomStorage.mock.calls[0]?.[0]).toBe('system')
    expect(setCustomStorage.mock.calls[0]?.[1]).toEqual({ timezone: 'UTC', search_switch: true, lang: 'en_us' })
    expect(i18n.global.locale.value).toBe('en_us')
  })

  // review fix round 2 · Important: previously persist()'s catch only did console.warn --
  // the UI had already switched languages (setLocale runs first), but the server never
  // actually saved it, and the user had no way of knowing. Both LanguageRow.vue and the
  // first-boot Welcome.vue language picker go through this one persist() entry point, so
  // putting the toast in the store covers both call sites at once.
  it('shows a toast to the user when the server save fails (review fix round 2)', async () => {
    setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    await useLocaleStore().persist('en_us')
    expect(i18n.global.locale.value).toBe('en_us')   // the UI still switches (setLocale runs first)
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('switching language concurrently with the settings page writing timezone: neither write is lost (discipline #3)', async () => {
    const { patchSystemConfig, __resetSystemConfigQueue } = await import('../settings/util/systemConfig')
    __resetSystemConfigQueue()
    const store = useLocaleStore()
    await Promise.all([store.persist('en_us'), patchSystemConfig({ timezone: 'UTC' })])
    const blob = await (await import('../settings/util/systemConfig')).readSystemConfig()
    expect(blob.lang).toBe('en_us')
    expect(blob.timezone).toBe('UTC')
  })
})

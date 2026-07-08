import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const getCustomStorage: MockedFunction<(k: string) => Promise<unknown>> = vi.fn(async () => null)
const setCustomStorage: MockedFunction<(k: string, d: unknown) => Promise<unknown>> = vi.fn(async () => ({}))
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { users: {
    getCustomStorage: (k: string) => getCustomStorage(k),
    setCustomStorage: (k: string, d: unknown) => setCustomStorage(k, d),
  } } }
})

import { i18n } from '../i18n'
import { useLocaleStore } from './locale'

describe('locale store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    i18n.global.locale.value = 'zh_cn'
  })

  it('setLocale 改 i18n 与 localStorage', () => {
    useLocaleStore().setLocale('en_us')
    expect(i18n.global.locale.value).toBe('en_us')
    expect(localStorage.getItem('lang')).toBe('en_us')
  })

  it('loadFromServer 应用 blob 内合法 lang', async () => {
    getCustomStorage.mockResolvedValueOnce({ lang: 'en_us', timezone: 'UTC' })
    await useLocaleStore().loadFromServer()
    expect(i18n.global.locale.value).toBe('en_us')
  })

  it('loadFromServer 支持字符串 JSON blob', async () => {
    getCustomStorage.mockResolvedValueOnce(JSON.stringify({ lang: 'en_us' }))
    await useLocaleStore().loadFromServer()
    expect(i18n.global.locale.value).toBe('en_us')
  })

  it('loadFromServer 忽略非法 lang，不改当前语言', async () => {
    getCustomStorage.mockResolvedValueOnce({ lang: 'fr_fr' })
    await useLocaleStore().loadFromServer()
    expect(i18n.global.locale.value).toBe('zh_cn')
  })

  it('persist 读-改-写：保留 blob 其它字段，仅覆盖 lang', async () => {
    getCustomStorage.mockResolvedValueOnce({ timezone: 'UTC', search_switch: true })
    await useLocaleStore().persist('en_us')
    expect(setCustomStorage).toHaveBeenCalledTimes(1)
    expect(setCustomStorage.mock.calls[0]?.[0]).toBe('system')
    expect(setCustomStorage.mock.calls[0]?.[1]).toEqual({ timezone: 'UTC', search_switch: true, lang: 'en_us' })
    expect(i18n.global.locale.value).toBe('en_us')
  })
})

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// 有状态的假后端:setCustomStorage 写回的内容,下一次 getCustomStorage 能读到
// (systemConfig 的串行队列内部会重新读一次,mock 必须像真后端一样"记得"上一次写入)。
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

  // 评审 fix round 2 · Important:此前 persist() 的 catch 只 console.warn ——
  // 界面已经切换了语言(setLocale 先执行),服务端却从没存过,用户毫无感知。
  // LanguageRow.vue / Welcome.vue 首启语言选择器都靠 persist() 这一个入口,
  // 提示放在 store 里能同时覆盖两处调用方。
  it('server save 失败时提示用户(评审 fix round 2)', async () => {
    setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    await useLocaleStore().persist('en_us')
    expect(i18n.global.locale.value).toBe('en_us')   // 界面仍然切换(setLocale 先跑)
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('切语言与设置页写时区并发,两者都不丢(纪律 #3)', async () => {
    const { patchSystemConfig, __resetSystemConfigQueue } = await import('../settings/util/systemConfig')
    __resetSystemConfigQueue()
    const store = useLocaleStore()
    await Promise.all([store.persist('en_us'), patchSystemConfig({ timezone: 'UTC' })])
    const blob = await (await import('../settings/util/systemConfig')).readSystemConfig()
    expect(blob.lang).toBe('en_us')
    expect(blob.timezone).toBe('UTC')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import { useToast } from '../../../stores/toast'
import { useWallpaperStore } from '../../../stores/wallpaper'

const blob: Record<string, unknown> = {}
const standbyCalls: { minutes: number }[] = []
const persisted: string[] = []

// vi.fn() 而不是裸箭头函数 —— 需要能断言"没被调用过"(评审 fix 1),
// 不能只靠事后检查 blob 内容(内容可能因为幂等写入而恰好没变化,详见 fix 1 说明)。
const getCustomStorage = vi.fn(async () => ({ ...blob }))
const setCustomStorage = vi.fn(async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) })
// Stubs for the wallpaper store's service surface (imported transitively via
// WallpaperRow -> useWallpaperStore). None of this file's tests exercise
// upload or NAS-path flows, but the mock factory must still provide these
// members since the store module references service.users.uploadImage /
// service.users.setImageFromPath.
const uploadImage = vi.fn()
const setImageFromPath = vi.fn()

// vi.mock 工厂会被提升、先于上面两个 const 执行,所以工厂内部不能直接把
// getCustomStorage/setCustomStorage 当值取用(那会在初始化前解引用,ReferenceError)。
// 包一层内联箭头函数只在**调用时**才解引用外层变量,和下面 standbyCalls 的
// 用法(同样只在实际被调用时才读)是同一个既有写法。
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: (...args: Parameters<typeof getCustomStorage>) => getCustomStorage(...args),
      setCustomStorage: (...args: Parameters<typeof setCustomStorage>) => setCustomStorage(...args),
      uploadImage: (...args: Parameters<typeof uploadImage>) => uploadImage(...args),
      setImageFromPath: (...args: Parameters<typeof setImageFromPath>) => setImageFromPath(...args),
    },
    sys: { setDiskStandby: async (p: { minutes: number }) => { standbyCalls.push(p) } },
  },
}))
vi.mock('../../../stores/locale', () => ({
  LOCALES: ['zh_cn', 'en_us'],
  useLocaleStore: () => ({ persist: async (l: string) => { persisted.push(l) } }),
}))

import WallpaperRow from './WallpaperRow.vue'
import LanguageRow from './LanguageRow.vue'
import TimezoneRow from './TimezoneRow.vue'
import DiskStandbyRow from './DiskStandbyRow.vue'
import { __resetSystemConfigQueue } from '../../util/systemConfig'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountRow = (C: unknown) => mount(C as never, { global: { plugins: [i18n] } })

/** 手动可控的 promise —— 用于把服务端读取"卡"在 pending,模拟真实网络延迟下的交错路径(fix 3)。 */
function createDeferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
  standbyCalls.length = 0
  persisted.length = 0
  getCustomStorage.mockClear()
  setCustomStorage.mockClear()
  __resetSystemConfigQueue()
})

describe('WallpaperRow (SP11: debt D5 paid off)', () => {
  it('renders the label with an enabled change button', () => {
    const w = mountRow(WallpaperRow)
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.set-btn').attributes('disabled')).toBeUndefined()
  })
  it('no longer explains why it is unavailable', () => {
    expect(mountRow(WallpaperRow).find('.set-row-hint').exists()).toBe(false)
  })
  it('opens the app-level picker', async () => {
    const w = mountRow(WallpaperRow)
    await w.find('.set-btn').trigger('click')
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })
})

describe('LanguageRow(债务 D6:只有 2 项,Vue2 有 31 项)', () => {
  it('只列 zh_cn / en_us', () => {
    const opts = mountRow(LanguageRow).findAll('option')
    expect(opts.map((o) => o.attributes('value'))).toEqual(['zh_cn', 'en_us'])
  })
  it('行下方有说明', () => {
    expect(mountRow(LanguageRow).find('.set-row-hint').exists()).toBe(true)
  })
  it('选中项跟随当前 locale', () => {
    expect((mountRow(LanguageRow).find('select').element as HTMLSelectElement).value).toBe('zh_cn')
  })
  it('切换走 locale store 的 persist(不自己写 system blob,避免两条路径打架)', async () => {
    const w = mountRow(LanguageRow)
    await w.find('select').setValue('en_us')
    await flushPromises()
    expect(persisted).toEqual(['en_us'])
  })
})

describe('TimezoneRow', () => {
  it('挂载后选中服务端保存的时区', async () => {
    blob.timezone = 'Europe/Paris'
    const w = mountRow(TimezoneRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('Europe/Paris')
  })

  it('服务端没存时用默认值 America/New_York(对位 Vue2 L940)', async () => {
    const w = mountRow(TimezoneRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('America/New_York')
  })

  it('挂载**不**回写配置(移植纪律 #1:Vue2 每次打开都白写一次)', async () => {
    blob.timezone = 'UTC'
    mountRow(TimezoneRow)
    await flushPromises()
    expect(blob).toEqual({ timezone: 'UTC' })   // 没有被整块覆写出别的字段
    // 关键断言:调用次数为零,而不是"内容看起来没变"—— 若 onMounted 回归成把
    // 刚读到的值原样 patch 回去,幂等写入会让上面那句 toEqual 照样通过,只有
    // 调用次数能抓到这个回归(评审 fix 1)。
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('用户改选才 patch,且只写 timezone 一个字段', async () => {
    blob.rss_switch = true
    const w = mountRow(TimezoneRow)
    await flushPromises()
    await w.find('select').setValue('UTC')
    await flushPromises()
    expect(blob.timezone).toBe('UTC')
    expect(blob.rss_switch).toBe(true)          // 别人的字段没被洗掉
  })

  it('保存失败时提示用户(评审 fix round 2:此前只 console.warn)', async () => {
    setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    const w = mountRow(TimezoneRow)
    await flushPromises()
    await w.find('select').setValue('UTC')
    await flushPromises()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('时区表项数与 Vue2 一致(防抄漏)', () => {
    const w = mountRow(TimezoneRow)
    expect(w.findAll('option').length).toBeGreaterThanOrEqual(35)
  })

  it('挂载的服务端读取尚未返回时用户先改选,读取结果不能把用户的选择冲掉(交错路径,评审 fix 3)', async () => {
    blob.timezone = 'Europe/Paris'
    // 关键:快照要在用户改选**之前**拍下来,且 resolve 时用这份旧快照,而不是
    // resolve 时刻的 blob —— 那时 blob 已经被用户的 patch 改过了,用"当下的
    // blob"会让测试即使没有守卫也碰巧通过(踩过一次,负向验证时发现的)。
    const staleSnapshot = { ...blob }
    const deferred = createDeferred<Record<string, unknown>>()
    getCustomStorage.mockImplementationOnce(() => deferred.promise)

    const w = mountRow(TimezoneRow)
    // 此时 onMounted 里的 readSystemConfig() 还卡在 deferred,用户已经手动改选:
    await w.find('select').setValue('UTC')
    await flushPromises()
    // 读取才姗姗来迟地返回服务端的旧值(真实世界里:慢 GET 在快 PUT 之后才落地):
    deferred.resolve(staleSnapshot)
    await flushPromises()

    expect((w.find('select').element as HTMLSelectElement).value).toBe('UTC')
  })
})

describe('DiskStandbyRow', () => {
  it('挂载后选中服务端值,且**不**下发 standby 指令、**不**回写配置(移植纪律 #2 + 评审 fix 1)', async () => {
    blob.disk_standby = '30m'
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('30m')
    expect(standbyCalls).toEqual([])
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('用户改选才既 patch 配置又下发指令,分钟数经 parseStandbyMinutes 换算', async () => {
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('2h')
    await flushPromises()
    expect(blob.disk_standby).toBe('2h')
    expect(standbyCalls).toEqual([{ minutes: 120 }])
  })

  it('选 never 下发 0', async () => {
    blob.disk_standby = '1h'
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('never')
    await flushPromises()
    expect(standbyCalls).toEqual([{ minutes: 0 }])
  })

  it('配置写入本身失败时也提示用户(评审 fix round 2:此前只 console.warn,与下面「指令下发失败」是两条独立的失败路径)', async () => {
    setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('2h')
    await flushPromises()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('下发失败时提示,但不把 select 弹回去(配置已落库,指令下次开机生效)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'setDiskStandby').mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('10m')
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('10m')
    // 评审 fix 2:之前只验证了 select 没回滚,没验证真的提示了用户 —— 漏写
    // toast.show(...) 或写错 i18n key 都不会让上面那句失败。这里断言 toast
    // 真的被推入了,且文案就是 settingsSaveFailed 对应的译文(用同一个 i18n
    // 实例取,key 打错会让这句失败)。
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('9 个选项且文案有译文(没渲染出裸 key)', async () => {
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    const opts = w.findAll('option')
    expect(opts).toHaveLength(9)
    expect(opts[0].text()).toBe('从不')
    for (const o of opts) expect(o.text()).not.toMatch(/^settings/)
  })

  it('挂载的服务端读取尚未返回时用户先改选,读取结果不能把用户的选择冲掉(交错路径,评审 fix 3)', async () => {
    blob.disk_standby = '1h'
    // 同 TimezoneRow 那个用例:快照必须在用户改选前拍,resolve 时用旧快照。
    const staleSnapshot = { ...blob }
    const deferred = createDeferred<Record<string, unknown>>()
    getCustomStorage.mockImplementationOnce(() => deferred.promise)

    const w = mountRow(DiskStandbyRow)
    await w.find('select').setValue('10m')
    await flushPromises()
    deferred.resolve(staleSnapshot)
    await flushPromises()

    expect((w.find('select').element as HTMLSelectElement).value).toBe('10m')
  })
})

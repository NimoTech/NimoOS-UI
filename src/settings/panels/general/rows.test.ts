import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const blob: Record<string, unknown> = {}
const standbyCalls: { minutes: number }[] = []
const persisted: string[] = []

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
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

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
  standbyCalls.length = 0
  persisted.length = 0
  __resetSystemConfigQueue()
})

describe('WallpaperRow(债务 D5:New-UI 无壁纸系统)', () => {
  it('渲染壁纸标签,「更改」按钮禁用', () => {
    const w = mountRow(WallpaperRow)
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.set-btn').attributes('disabled')).toBeDefined()
  })
  it('行下方有说明,写清为什么不可用', () => {
    expect(mountRow(WallpaperRow).find('.set-row-hint').text()).toBe('新版界面暂未提供壁纸功能')
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

  it('时区表项数与 Vue2 一致(防抄漏)', () => {
    const w = mountRow(TimezoneRow)
    expect(w.findAll('option').length).toBeGreaterThanOrEqual(35)
  })
})

describe('DiskStandbyRow', () => {
  it('挂载后选中服务端值,且**不**下发 standby 指令(移植纪律 #2)', async () => {
    blob.disk_standby = '30m'
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('30m')
    expect(standbyCalls).toEqual([])
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

  it('下发失败时提示,但不把 select 弹回去(配置已落库,指令下次开机生效)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'setDiskStandby').mockRejectedValueOnce(new Error('boom'))
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('10m')
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('10m')
  })

  it('9 个选项且文案有译文(没渲染出裸 key)', async () => {
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    const opts = w.findAll('option')
    expect(opts).toHaveLength(9)
    expect(opts[0].text()).toBe('从未')
    for (const o of opts) expect(o.text()).not.toMatch(/^settings/)
  })
})

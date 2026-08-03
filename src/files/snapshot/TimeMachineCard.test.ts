import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import TimeMachineCard from './TimeMachineCard.vue'
import zh from '../../i18n/zh_cn'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { image: { thumbUrl: (p: string) => `/v1/image?path=${p}` } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const ITEM = { time: '14:30', dayLabelText: '今天', label: '改版前', typeKind: 'manual' as const, typeLabelKey: 'snapTypeManual' }
const mountIt = (props = {}) =>
  mount(TimeMachineCard, { props: { item: ITEM, state: 'front' as const, depth: 0, ...props }, global: { plugins: [i18n] } })

describe('TimeMachineCard', () => {
  it('显示时间、日期、类型徽章、备注', () => {
    const text = mountIt().text()
    expect(text).toContain('14:30')
    expect(text).toContain('今天')
    expect(text).toContain('手动')
    expect(text).toContain('改版前')
  })
  it('没有备注时不渲染备注行', () => {
    expect(mountIt({ item: { ...ITEM, label: '' } }).find('.tm-card-label').exists()).toBe(false)
  })
  it('按状态与层数落 class(变换全交给 CSS)', () => {
    expect(mountIt({ state: 'behind', depth: 2 }).classes()).toEqual(expect.arrayContaining(['tm-card', 'is-behind', 'depth-2']))
    expect(mountIt({ state: 'past', depth: 1 }).classes()).toContain('is-past')
  })
  it('类型着色 class 三选一', () => {
    expect(mountIt().classes()).toContain('type-manual')
    expect(mountIt({ item: { ...ITEM, typeKind: 'auto', typeLabelKey: 'snapTypeAuto' } }).classes()).toContain('type-auto')
    expect(mountIt({ item: { ...ITEM, typeKind: 'preop', typeLabelKey: 'snapTypePreop' } }).classes()).toContain('type-preop')
  })
})

describe('卡片里的文件区网格', () => {
  const preview = {
    status: 'ready' as const,
    total: 40,
    entries: [
      { path: '/s/sub', name: 'sub', is_dir: true, date: '2026-07-30T10:00:00Z' },
      { path: '/s/a.jpg', name: 'a.jpg', is_dir: false, date: '2026-07-30T10:00:00Z', size: 1024 },
      { path: '/s/n.txt', name: 'n.txt', is_dir: false, date: '2026-07-30T10:00:00Z', size: 12 },
    ],
  }
  it('每个条目一格,图片走缩略图、其它走类型图标(与文件区同一个 FileThumb)', async () => {
    const w = mountIt({ preview })
    // FileThumb 的进入视口检测在 onMounted 里落 inView,要等一拍才换成缩略图 <img>
    await nextTick()
    expect(w.findAll('.tm-file:not(.tm-file-more)')).toHaveLength(3)
    expect(w.get('.tm-file:nth-child(2) img').attributes('src')).toContain('/v1/image')
    expect(w.get('.tm-file:nth-child(3) img').attributes('src')).not.toContain('/v1/image')
  })
  it('显示文件名', () => {
    expect(mountIt({ preview }).findAll('.tm-file-name').map((n) => n.text())).toEqual(['sub', 'a.jpg', 'n.txt'])
  })
  it('副标题:文件带大写扩展名,文件夹只有时间(与文件区列表视图同一套字段)', () => {
    const subs = mountIt({ preview }).findAll('.tm-file-sub').map((n) => n.text())
    expect(subs[0]).not.toContain('·') // 文件夹不显示扩展名
    expect(subs[1]).toContain('JPG ·')
    expect(subs[2]).toContain('TXT ·')
  })
  it('总数多于已给条目时显示 +N', () => {
    expect(mountIt({ preview }).find('.tm-file-more').text()).toBe('+37')
  })
  it('显示项数', () => { expect(mountIt({ preview }).text()).toContain('40 项') })
  it('目录当时不存在 → 说人话,不显示空网格', () => {
    const w = mountIt({ preview: { status: 'missing', entries: [], total: 0 } })
    expect(w.text()).toContain('此时还没有这个文件夹')
    expect(w.find('.tm-files').exists()).toBe(false)
  })
  it('那一刻是空文件夹 → 说人话,不显示空网格', () => {
    const w = mountIt({ preview: { status: 'ready', entries: [], total: 0 } })
    expect(w.text()).toContain('此文件夹为空')
    expect(w.find('.tm-files').exists()).toBe(false)
  })
  it('拉取失败 → 退回纯文字卡,不显示报错', () => {
    const w = mountIt({ preview: { status: 'failed', entries: [], total: 0 } })
    expect(w.find('.tm-files').exists()).toBe(false)
    expect(w.text()).toContain('14:30')
    expect(w.text()).not.toContain('失败')
  })
  it('没有 preview(还没拉)→ 纯文字卡', () => {
    expect(mountIt().find('.tm-files').exists()).toBe(false)
  })
  // 卡堆窗口有 5 张,一张 36 格 = 180 个 <img>,每个都会真发一次缩略图请求。
  // 后排卡被前面那张挡得只剩顶上一条,渲染网格是纯浪费 —— 这条守住那个约束。
  it('后排卡片不铺网格(只有最前那张和正在飞出去的那张铺)', () => {
    expect(mountIt({ preview, state: 'behind', depth: 1 }).find('.tm-files').exists()).toBe(false)
    expect(mountIt({ preview, state: 'past', depth: 0 }).find('.tm-files').exists()).toBe(true)
    expect(mountIt({ preview, state: 'front' }).find('.tm-files').exists()).toBe(true)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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

describe('卡片缩略图格', () => {
  const preview = {
    status: 'ready' as const,
    total: 15,
    tiles: [
      { path: '/s/a.jpg', name: 'a.jpg', isImage: true, isDir: false },
      { path: '/s/n.txt', name: 'n.txt', isImage: false, isDir: false },
    ],
  }
  it('图片瓦片用缩略图 URL,非图片用类型图标', () => {
    const w = mountIt({ preview })
    const imgs = w.findAll('.tm-tile img')
    expect(imgs[0].attributes('src')).toContain('/v1/image')
    expect(imgs[1].attributes('src')).not.toContain('/v1/image')
  })
  it('总数多于瓦片数时显示 +N', () => {
    expect(mountIt({ preview }).find('.tm-tile-more').text()).toBe('+13')
  })
  it('显示项数', () => { expect(mountIt({ preview }).text()).toContain('15 项') })
  it('目录当时不存在 → 说人话,不显示空格子', () => {
    const w = mountIt({ preview: { status: 'missing', tiles: [], total: 0 } })
    expect(w.text()).toContain('此时还没有这个文件夹')
    expect(w.find('.tm-tiles').exists()).toBe(false)
  })
  it('拉取失败 → 退回纯文字卡,不显示报错', () => {
    const w = mountIt({ preview: { status: 'failed', tiles: [], total: 0 } })
    expect(w.find('.tm-tiles').exists()).toBe(false)
    expect(w.text()).toContain('14:30')
    expect(w.text()).not.toContain('失败')
  })
  it('没有 preview(还没拉)→ 纯文字卡', () => {
    expect(mountIt().find('.tm-tiles').exists()).toBe(false)
  })
})

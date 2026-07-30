import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineCard from './TimeMachineCard.vue'
import zh from '../../i18n/zh_cn'

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

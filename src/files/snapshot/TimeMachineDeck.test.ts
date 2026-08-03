import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineDeck from './TimeMachineDeck.vue'
import { DECK_WINDOW } from '../util/timeMachineMath'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mkItem = (i: number) => ({
  id: i, name: `snap-${i}`, label: '', typeKind: 'auto' as const, typeLabelKey: 'snapTypeAuto',
  time: `0${i}:00`, createdAt: '', flatIndex: i, dayLabelText: '今天',
})
const ITEMS = Array.from({ length: 8 }, (_, i) => mkItem(i))
const mountIt = (props = {}) =>
  mount(TimeMachineDeck, { props: { items: ITEMS, selectedIndex: 3, ...props }, global: { plugins: [i18n] } })

describe('TimeMachineDeck', () => {
  // 评审修复(Important):窗口大小从 DECK_WINDOW 常量取值(不再各写各的 5/2 字面量)——
  // 断言也从常量算,这样 TimeMachineOverlay 拉预览的窗口(见同名用例)与这里渲染的窗口
  // 永远算的是同一个数,窗口大小改了两边会一起变,不会出现"最前的卡拿不到缩略图"。
  it('只渲染可见窗口的卡片(depth 张后退 + past 张飞走),不是全部 8 张', () => {
    expect(mountIt().findAll('.tm-card')).toHaveLength(DECK_WINDOW.depth + DECK_WINDOW.past)
  })
  it('飞走的卡数量精确等于 DECK_WINDOW.past(单独钉住 past 这一侧,防止 depth/past 被调换)', () => {
    const past = mountIt().findAll('.tm-card').filter((c) => c.classes().includes('is-past'))
    expect(past).toHaveLength(DECK_WINDOW.past)
  })
  // 上面两条用共享的 8 项 ITEMS + selectedIndex:3,depth 侧会被数组边界(长度 8)顶住而不是
  // 被 DECK_WINDOW.depth 本身顶住——这条换一批够长(15 项)、选中项在中间(不贴任何一侧
  // 边界)的数据,front+behind 的张数才精确等于 DECK_WINDOW.depth,不会跟 8-3=5 这种
  // 边界巧合混在一起(单独钉住 depth 这一侧)。
  it('front+behind 卡片数量精确等于 DECK_WINDOW.depth(数据足够长,不贴数组边界)', () => {
    const longItems = Array.from({ length: 15 }, (_, i) => mkItem(i))
    const w = mount(TimeMachineDeck, { props: { items: longItems, selectedIndex: 7 }, global: { plugins: [i18n] } })
    const frontOrBehind = w.findAll('.tm-card').filter((c) => !c.classes().includes('is-past'))
    expect(frontOrBehind).toHaveLength(DECK_WINDOW.depth)
  })
  it('选中那张是 is-front', () => {
    const front = mountIt().findAll('.tm-card').filter((c) => c.classes().includes('is-front'))
    expect(front).toHaveLength(1)
    expect(front[0].text()).toContain('03:00')
  })
  it('点后面的卡只换选中,不进入', async () => {
    const w = mountIt()
    const behind = w.findAll('.tm-card').find((c) => c.classes().includes('depth-2'))!
    await behind.trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(5)
    expect(w.emitted('enter')).toBeUndefined()
  })
  it('点最前那张 = 进入(和真 Time Machine 一致)', async () => {
    const w = mountIt()
    await w.findAll('.tm-card').find((c) => c.classes().includes('is-front'))!.trigger('click')
    expect(w.emitted('enter')).toHaveLength(1)
    expect(w.emitted('select')).toBeUndefined()
  })
  it('飞走的卡不吃点击(pointer-events:none 由 CSS 保证,这里断言不 emit)', async () => {
    const w = mountIt()
    const past = w.findAll('.tm-card').find((c) => c.classes().includes('is-past'))!
    await past.trigger('click')
    expect(w.emitted('enter')).toBeUndefined()
    expect(w.emitted('select')).toBeUndefined()
  })
  it('空列表渲染 0 张卡且不报错', () => {
    expect(mountIt({ items: [] }).findAll('.tm-card')).toHaveLength(0)
  })
  it('key 用快照 name(选中变化时复用同一批 DOM,才有平滑过渡)', async () => {
    // 注:原稿断言"数组第 0 个元素在更新后还在"是空壳 —— 数组第 0 个位置恒是 is-front
    // 那张卡,即便 key 错误地绑到 depth/下标而非 name,depth-0 这个槽位本身也总存在,
    // 断言会假通过。改成跟着具体某个快照(snap-4)走:它在 selectedIndex=3 时是 behind
    // 卡,变成 selectedIndex=4 后应该晋升为 is-front —— 且必须是**同一个** DOM 节点,
    // 而不是"恰好也在 depth-0 位置"的另一个节点。若 key 换成 depth,这条会真的失败
    // (因为 depth-0 槽位会被复用给别的 item,而不是 snap-4 这个节点被搬到新位置)。
    const w = mountIt()
    const behindFour = w.findAll('.tm-card').find((c) => c.text().includes('04:00'))!
    const behindFourEl = behindFour.element
    await w.setProps({ selectedIndex: 4 })
    const front = w.findAll('.tm-card').find((c) => c.classes().includes('is-front'))!
    expect(front.text()).toContain('04:00')
    expect(front.element).toBe(behindFourEl)
  })
})

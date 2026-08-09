import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineRail from './TimeMachineRail.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const GROUPS = [
  { dayKey: '2026-07-30', labelText: '今天', items: [
    { flatIndex: 0, time: '14:30', typeKind: 'manual' as const },
    { flatIndex: 1, time: '09:00', typeKind: 'auto' as const },
  ] },
  { dayKey: '2026-07-29', labelText: '昨天', items: [
    { flatIndex: 2, time: '09:00', typeKind: 'preop' as const },
  ] },
]
const mountIt = (props = {}) =>
  mount(TimeMachineRail, { props: { groups: GROUPS, selectedIndex: 0, ...props }, global: { plugins: [i18n] } })

// Enough snapshots to overflow the rail's own scroll container, so the
// "scroll the selected tick into view" behavior actually has somewhere to scroll to.
const manyGroups = () => [
  { dayKey: '2026-07-30', labelText: '今天', items: Array.from({ length: 50 }, (_, i) => (
    { flatIndex: i, time: `${String(i).padStart(2, '0')}:00`, typeKind: 'auto' as const }
  )) },
]

// 造一个假 DOMRect,只填组件用到的 top/height 两个字段;其余字段用 0 占位满足类型。
const fakeRect = (top: number, height = 10): DOMRect =>
  ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

describe('TimeMachineRail', () => {
  it('每个快照一条主刻度,带可读的 aria-label', () => {
    const mains = mountIt().findAll('.tm-tick-main')
    expect(mains).toHaveLength(3)
    expect(mains[0].attributes('aria-label')).toContain('14:30')
  })
  it('主刻度之间插装饰子刻度,子刻度不是按钮', () => {
    const w = mountIt()
    expect(w.findAll('.tm-tick-sub').length).toBeGreaterThan(0)
    expect(w.find('.tm-tick-sub').element.tagName).not.toBe('BUTTON')
  })
  it('每天一个日期标题', () => {
    expect(mountIt().findAll('.tm-rail-day').map((d) => d.text())).toEqual(['今天', '昨天'])
  })
  it('选中那条带 is-selected', () => {
    const w = mountIt({ selectedIndex: 1 })
    const sel = w.findAll('.tm-tick-main').filter((t) => t.classes().includes('is-selected'))
    expect(sel).toHaveLength(1)
    expect(sel[0].attributes('aria-label')).toContain('09:00')
  })
  it('类型着色 class', () => {
    const mains = mountIt().findAll('.tm-tick-main')
    expect(mains[0].classes()).toContain('type-manual')
    expect(mains[2].classes()).toContain('type-preop')
  })
  it('点主刻度 emit select(只换选中,不进入)', async () => {
    const w = mountIt()
    await w.findAll('.tm-tick-main')[2].trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(2)
  })
  it('点子刻度吸附到它所属的主刻度', async () => {
    const w = mountIt()
    await w.find('.tm-tick-sub').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(0)
  })
  it('悬停主刻度时浮出时间标签,移开消失', async () => {
    const w = mountIt()
    await w.findAll('.tm-tick-main')[1].trigger('mouseenter')
    expect(w.find('.tm-tick-label').text()).toBe('09:00')
    await w.find('.tm-rail').trigger('mouseleave')
    expect(w.find('.tm-tick-label').exists()).toBe(false)
  })
  it('鼠标移动时给刻度算出缩放(离光标越近越大)', async () => {
    const w = mountIt()
    // jsdom 里 getBoundingClientRect 恒为 0,这里只断言 mousemove 后确实写了 transform,
    // 曲线本身由 timeMachineMath.test.ts 覆盖(那里是真数值断言);更强的"越近越大"
    // 断言见下面那条(通过手动 mock 各刻度的 getBoundingClientRect 制造真实距离差)。
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    expect(w.findAll('.tm-tick-main')[0].attributes('style')).toContain('scaleX')
  })
  it('移开后缩放复位', async () => {
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    await w.find('.tm-rail').trigger('mouseleave')
    expect(w.findAll('.tm-tick-main')[0].attributes('style') ?? '').not.toContain('scaleX(2')
  })
  it('空分组渲染空刻度尺,不报错', () => {
    expect(mountIt({ groups: [] }).findAll('.tm-tick-main')).toHaveLength(0)
  })

  // ↓ 补充:brief 自带的"算出缩放"用例只断言 style 里含 scaleX 的字符串,把曲线永远返回
  // scaleX(1) 这种空壳实现也能骗过去(scaleX(1) 本身就"含 scaleX")。这里手动 mock 每条
  // 主刻度自己的 getBoundingClientRect,制造出真实的、不同的光标距离,断言离光标近的那条
  // 缩放确实比远的那条大 —— 真正走一遍 computeFisheyeScales 的数值路径。
  // 注:曾经因为主刻度和它的子刻度共用 data-flat-index,这里必须连子刻度的 rect 一起
  // mock 才能通过(否则 map 会被子刻度的默认 rect 覆盖)——那个共用 key 本身是评审揪出来
  // 的真实 bug,已在组件里改成子刻度换用 data-anchor-index(不再撞 key),这里直接
  // mock 主刻度自己就够了,不用再迁就那个 bug。
  it('（非空壳强化)不同刻度到光标的真实距离不同时,缩放值也应不同且近的更大', async () => {
    const w = mountIt()
    const mains = w.findAll('.tm-tick-main')
    ;(mains[0].element as HTMLElement).getBoundingClientRect = () => fakeRect(100)
    ;(mains[2].element as HTMLElement).getBoundingClientRect = () => fakeRect(400)

    await w.find('.tm-rail').trigger('mousemove', { clientY: 105 })

    const scaleOf = (style: string | undefined) => {
      const m = (style ?? '').match(/scaleX\(([\d.]+)\)/)
      return m ? Number(m[1]) : 1
    }
    const nearScale = scaleOf(w.findAll('.tm-tick-main')[0].attributes('style'))
    const farScale = scaleOf(w.findAll('.tm-tick-main')[2].attributes('style'))
    expect(nearScale).toBeGreaterThan(farScale)
  })

  // ↓ 评审(T10 复核)钉住的回归用例:主刻度的缩放必须由主刻度自己的中心算出,不能被
  // 挂在它后面、共享同一个逻辑 flatIndex 的子刻度覆盖掉。做法:让主刻度自己的 rect 落在
  // 光标附近(该拿到接近 maxScale=2.2 的峰值),同时把它所有子刻度的 rect 支得远远的
  // (远超 radius=70,该拿到 minScale=1)。如果 updateScales() 又按 DOM 顺序"后写覆盖
  // 先写"把子刻度的值写进了同一个 map key,这里就会读到接近 1 而不是接近 2.2,断言失败。
  it('主刻度的缩放由主刻度自身中心算出,不会被同 anchor 的子刻度覆盖', async () => {
    const w = mountIt()
    const main0 = w.findAll('.tm-tick-main')[0].element as HTMLElement
    main0.getBoundingClientRect = () => fakeRect(100) // 光标 105,距离 ~5px,该接近峰值
    for (const sub of w.findAll('.tm-tick-sub')) {
      (sub.element as HTMLElement).getBoundingClientRect = () => fakeRect(2000) // 远超 radius
    }

    await w.find('.tm-rail').trigger('mousemove', { clientY: 105 })

    const style = w.findAll('.tm-tick-main')[0].attributes('style') ?? ''
    const m = style.match(/scaleX\(([\d.]+)\)/)
    const scale = m ? Number(m[1]) : 1
    expect(scale).toBeGreaterThan(2) // 峰值 maxScale=2.2;若被子刻度覆盖会压到 minScale=1
  })

  // ↓ 补充:brief 完全没测约束 #4(rAF 节流 + 卸载取消挂起帧)。默认 beforeEach 里的 rAF
  // stub 会立即同步执行回调,测不出"一帧内多次 mousemove 只安排一次重算"——这里换成
  // 手控 stub(不自动 invoke),才能观察到节流本身。
  it('（补测约束#4)一帧内连续多次 mousemove 只请求一次 rAF', async () => {
    const raf = vi.fn(() => 1)
    vi.stubGlobal('requestAnimationFrame', raf)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 10 })
    await w.find('.tm-rail').trigger('mousemove', { clientY: 20 })
    await w.find('.tm-rail').trigger('mousemove', { clientY: 30 })
    expect(raf).toHaveBeenCalledTimes(1)
  })
  it('（补测约束#4)组件卸载时取消挂起的 rAF', async () => {
    const caf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 77))
    vi.stubGlobal('cancelAnimationFrame', caf)
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 10 })
    w.unmount()
    expect(caf).toHaveBeenCalledWith(77)
  })

  // ↓ Task 10: with enough snapshots to overflow the rail's own scroll container,
  // stepping the selection past the visible range must scroll the rail too -- the deck
  // and the bottom bar already followed the selection, but the rail looked frozen.
  it('scrolls the newly selected tick into view', async () => {
    const spy = vi.fn()
    // jsdom does not implement scrollIntoView
    Element.prototype.scrollIntoView = spy
    const w = mountIt({ groups: manyGroups(), selectedIndex: 0 })
    spy.mockClear()
    await w.setProps({ selectedIndex: 40 })
    await nextTick()
    expect(spy).toHaveBeenCalled()
  })

  it('does not scroll when the selection did not change', async () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    const w = mountIt({ groups: manyGroups(), selectedIndex: 3 })
    spy.mockClear()
    await w.setProps({ groups: manyGroups() })
    await nextTick()
    expect(spy).not.toHaveBeenCalled()
  })
})

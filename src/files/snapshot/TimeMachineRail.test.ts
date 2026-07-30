import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  it('（非空壳强化)不同刻度到光标的真实距离不同时,缩放值也应不同且近的更大', async () => {
    const w = mountIt()
    // flatIndex 0 前后各插了 2 条装饰子刻度(与它共享 dataset-flat-index),必须一并
    // mock,否则 map 里 flatIndex=0 这个 key 最终会被它自己的子刻度(默认 rect 全 0)
    // 覆盖掉,和这条用例想验证的东西无关。flatIndex 2 是最后一条主刻度,后面没有子刻度,
    // 天然只有它自己一个元素,不需要额外处理。
    for (const el of w.findAll('[data-flat-index="0"]')) {
      (el.element as HTMLElement).getBoundingClientRect = () => fakeRect(100)
    }
    ;(w.findAll('.tm-tick-main')[2].element as HTMLElement).getBoundingClientRect = () => fakeRect(400)

    await w.find('.tm-rail').trigger('mousemove', { clientY: 105 })

    const scaleOf = (style: string | undefined) => {
      const m = (style ?? '').match(/scaleX\(([\d.]+)\)/)
      return m ? Number(m[1]) : 1
    }
    const nearScale = scaleOf(w.findAll('.tm-tick-main')[0].attributes('style'))
    const farScale = scaleOf(w.findAll('.tm-tick-main')[2].attributes('style'))
    expect(nearScale).toBeGreaterThan(farScale)
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
})

// P6a-T8: PlacesZoomBar.vue —— 地图左侧垂直缩放滑杆。
// 逐条对应 task-8-brief.md 的「必含测试清单」,补充覆盖结构规格 1-5 与删码清单 4 处。
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlacesZoomBar from '../PlacesZoomBar.vue'
import { MAX_SCALE } from '../../util/placesMap'

function mountBar(props: Partial<InstanceType<typeof PlacesZoomBar>['$props']> = {}) {
  return mount(PlacesZoomBar, {
    props: {
      zoomFrac: 0,
      dotColor: '#8ab4ff',
      ...props,
    },
  })
}

// 轨道矩形 mock:{top:100, height:200}(brief 给定,下面三点手算见各测试注释)。
function mockTrackRect(el: HTMLElement, top = 100, height = 200): void {
  el.getBoundingClientRect = () =>
    ({ top, height, left: 0, bottom: top + height, right: 0, width: 6, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
}

describe('结构规格 1-5: 四个可见节点齐备', () => {
  it('两个 .zb-btn(放大/缩小)+ .zb-reset + .zb-track 内的 .zb-fill 与 .zb-thumb', () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn')
    // .zb-reset 自身也带 zb-btn 类,所以三个按钮(放大/缩小/复位)都会被 .zb-btn 选到。
    expect(btns.length).toBe(3)
    expect(w.find('.zb-reset').exists()).toBe(true)
    expect(w.find('.zb-track').exists()).toBe(true)
    expect(w.find('.zb-track .zb-fill').exists()).toBe(true)
    expect(w.find('.zb-track .zb-thumb').exists()).toBe(true)
  })

  it('放大键字面 +,缩小键字面 U+2212(不是 ASCII 连字符),复位键字面 ⤢', () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn').filter(b => !b.classes().includes('zb-reset'))
    expect(btns).toHaveLength(2)
    expect(btns[0].text()).toBe('+')
    const minusBtn = btns[1]
    expect(minusBtn.text()).toBe('−')
    expect(minusBtn.text().codePointAt(0)).toBe(0x2212)
    expect(w.find('.zb-reset').text()).toBe('⤢')
  })

  it('放大/缩小键的 title 分别是 i18n 的放大/缩小,复位键 title 是重置视图', () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn').filter(b => !b.classes().includes('zb-reset'))
    expect(btns[0].attributes('title')).toBe('放大')
    expect(btns[1].attributes('title')).toBe('缩小')
    expect(w.find('.zb-reset').attributes('title')).toBe('重置视图')
  })
})

describe('结构规格 3: zoomFrac → fill 的 height / thumb 的 bottom(分别断言,不同属性)', () => {
  it('zoomFrac = 0.5 → fill.height = 50%,thumb.bottom = 50%', () => {
    const w = mountBar({ zoomFrac: 0.5 })
    const fill = w.find('.zb-fill').element as HTMLElement
    const thumb = w.find('.zb-thumb').element as HTMLElement
    expect(fill.style.height).toBe('50%')
    expect(thumb.style.bottom).toBe('50%')
    // 反向确认没有写反属性:fill 不应该有 bottom 样式声明,thumb 不应该有 height 样式声明
    // (:style 绑定只设置了各自的那一个属性)。
    expect(fill.style.bottom).toBe('')
    expect(thumb.style.height).toBe('')
  })

  it('zoomFrac = 0 → 0%;zoomFrac = 1 → 100%', () => {
    const w0 = mountBar({ zoomFrac: 0 })
    expect((w0.find('.zb-fill').element as HTMLElement).style.height).toBe('0%')
    expect((w0.find('.zb-thumb').element as HTMLElement).style.bottom).toBe('0%')
    const w1 = mountBar({ zoomFrac: 1 })
    expect((w1.find('.zb-fill').element as HTMLElement).style.height).toBe('100%')
    expect((w1.find('.zb-thumb').element as HTMLElement).style.bottom).toBe('100%')
  })
})

describe('结构规格 2/4/5: 按钮 emit', () => {
  it('+ emit zoom-by 带 1.5', async () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn').filter(b => !b.classes().includes('zb-reset'))
    await btns[0].trigger('click')
    expect(w.emitted('zoom-by')).toHaveLength(1)
    expect(w.emitted('zoom-by')![0]).toEqual([1.5])
  })

  it('− emit zoom-by 带 1/1.5(toBeCloseTo)', async () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn').filter(b => !b.classes().includes('zb-reset'))
    await btns[1].trigger('click')
    expect(w.emitted('zoom-by')).toHaveLength(1)
    const [factor] = w.emitted('zoom-by')![0] as [number]
    expect(factor).toBeCloseTo(1 / 1.5)
  })

  it('⤢ emit reset(不带参数)', async () => {
    const w = mountBar()
    await w.find('.zb-reset').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
    expect(w.emitted('reset')![0]).toEqual([])
  })
})

describe('拖拽换算(照 Vue2 :666-673,顶=最大缩放、底=最小)', () => {
  // rect = {top:100, height:200}。手算:
  //  clientY=100(顶) → t=(100-100)/200=0        → scale = 16 - 0*15 = 16 = MAX_SCALE
  //  clientY=300(底) → t=(300-100)/200=1        → scale = 16 - 1*15 = 1
  //  clientY=200(中) → t=(200-100)/200=0.5      → scale = 16 - 0.5*15 = 8.5 = (MAX_SCALE+1)/2
  it('clientY=100(顶)→ set-scale 为 MAX_SCALE', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(1)
    expect(w.emitted('set-scale')![0]).toEqual([MAX_SCALE])
  })

  it('clientY=300(底)→ set-scale 为 1', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 300, pointerId: 1 })
    expect(w.emitted('set-scale')![0]).toEqual([1])
  })

  it('clientY=200(中)→ set-scale 为 8.5', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 200, pointerId: 1 })
    const [scale] = w.emitted('set-scale')![0] as [number]
    expect(scale).toBeCloseTo(8.5)
    expect(scale).toBeCloseTo((MAX_SCALE + 1) / 2)
  })

  it('越界钳制:clientY=0 → MAX_SCALE;clientY=999 → 1', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 0, pointerId: 1 })
    expect(w.emitted('set-scale')![0]).toEqual([MAX_SCALE])
    await track.trigger('pointermove', { clientY: 999, pointerId: 1 })
    const [scale] = w.emitted('set-scale')![1] as [number]
    expect(scale).toBeCloseTo(1)
  })

  it('down 后 move 持续换算(拖拽中)', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await track.trigger('pointermove', { clientY: 200, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(2)
    const [scale] = w.emitted('set-scale')![1] as [number]
    expect(scale).toBeCloseTo(8.5)
  })

  it('pointermove 未经 pointerdown → 不 emit(删码①靶:_dragging 守卫)', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointermove', { clientY: 150, pointerId: 1 })
    expect(w.emitted('set-scale')).toBeUndefined()
  })

  it('pointerup 后再 pointermove → 不 emit', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(1)
    await track.trigger('pointerup', { clientY: 100, pointerId: 1 })
    await track.trigger('pointermove', { clientY: 250, pointerId: 1 })
    // 仍然只有 down 那一次,up 之后的 move 没有再 emit。
    expect(w.emitted('set-scale')).toHaveLength(1)
  })

  it('pointercancel 同 pointerup 一样清标志,之后 move 不再 emit', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await track.trigger('pointercancel', { clientY: 100, pointerId: 1 })
    await track.trigger('pointermove', { clientY: 250, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(1)
  })

  it('pointerdown:立即换算一次 + setPointerCapture 被调用(存在时)', async () => {
    const w = mountBar()
    const track = w.find('.zb-track').element as HTMLElement & { setPointerCapture?: (id: number) => void }
    mockTrackRect(track)
    track.setPointerCapture = vi.fn()
    await w.find('.zb-track').trigger('pointerdown', { clientY: 100, pointerId: 7 })
    expect(w.emitted('set-scale')).toHaveLength(1)
    expect(track.setPointerCapture).toHaveBeenCalledWith(7)
  })

  it('releasePointerCapture 抛异常时不冒泡(try/catch),且 _dragging 已清', async () => {
    const w = mountBar()
    const track = w.find('.zb-track').element as HTMLElement & { releasePointerCapture?: (id: number) => void }
    mockTrackRect(track)
    track.releasePointerCapture = vi.fn(() => {
      throw new Error('boom')
    })
    await w.find('.zb-track').trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await expect(w.find('.zb-track').trigger('pointerup', { clientY: 100, pointerId: 1 })).resolves.not.toThrow()
    // _dragging 已清:up 之后的 move 不应再 emit。
    await w.find('.zb-track').trigger('pointermove', { clientY: 300, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(1)
  })
})

describe('dotColor → 根元素 style 的 --accent', () => {
  it('dotColor 落到 .map-zoombar 的 --accent 上', () => {
    const w = mountBar({ dotColor: 'rgb(10, 20, 30)' })
    const root = w.find('.map-zoombar').element as HTMLElement
    expect(root.style.getPropertyValue('--accent')).toBe('rgb(10, 20, 30)')
  })
})

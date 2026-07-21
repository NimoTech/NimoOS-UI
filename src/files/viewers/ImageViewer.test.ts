import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import ImageViewer from './ImageViewer.vue'
import type { FileEntry } from '../stores/files'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { file: { fileUrl: (p: string) => `/v3/file?path=${encodeURIComponent(p)}` } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const entry = (name: string): FileEntry => ({ name, path: `/DATA/${name}`, is_dir: false })

const mountViewer = async () => {
  const list = [entry('a.png'), entry('b.png')]
  const w = mount(ImageViewer, { props: { item: list[0]!, list }, global: { plugins: [i18n] } })
  await nextTick() // 工具栏 v-if="isMoving" 在 onMounted 置 true,等一帧渲染
  return w
}

describe('ImageViewer', () => {
  // 历史 bug:.img-stage 的 pointerdown 对冒泡自工具栏按钮的事件也 setPointerCapture,
  // 指针被 stage 捕获后按钮收不到 click —— 底部工具栏整排按钮全部失效。
  it('工具栏上按下指针不得进入舞台拖拽(pointer capture 不吞按钮)', async () => {
    const w = await mountViewer()
    const btn = w.findAll('.img-toolbar .tb-item')[1]! // ＋ 放大键
    await btn.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await w.get('.img-stage').trigger('pointermove', { clientX: 60, clientY: 80 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })

  it('工具栏按钮 click 生效:放大改 scale、旋转改 rotate', async () => {
    const w = await mountViewer()
    const items = w.findAll('.img-toolbar .tb-item')
    await items[1]!.trigger('click') // 放大
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1.1)')
    await items[2]!.trigger('click') // 旋转
    expect(w.get('img.img-el').attributes('style')).toContain('rotate(90deg)')
  })

  it('在舞台空白处拖拽仍可平移图片', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
  })
})

// —— 拖拽边界:图片任何时候至少留 48px 在可视区内,拖不丢 ——
describe('ImageViewer 拖拽边界', () => {
  const mountWithLayout = async () => {
    const w = await mountViewer()
    const img = w.get('img.img-el').element as HTMLImageElement
    const stage = w.get('.img-stage').element as HTMLElement
    // jsdom 无布局,手工给出舞台与图片的显示尺寸
    Object.defineProperty(img, 'offsetWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'offsetHeight', { value: 600, configurable: true })
    Object.defineProperty(stage, 'clientWidth', { value: 1000, configurable: true })
    Object.defineProperty(stage, 'clientHeight', { value: 700, configurable: true })
    return w
  }

  it('向右下暴力拖拽被夹在边界:图片不会完全离开可视区', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 100, clientY: 100 })
    await stage.trigger('pointermove', { clientX: 5100, clientY: 5100 })
    // maxTx = (1000+800)/2 - 48 = 852;maxTy = (700+600)/2 - 48 = 602
    expect(w.get('img.img-el').attributes('style')).toContain('translate(852px, 602px)')
  })

  it('向左上暴力拖拽同样被夹住(负方向)', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 5100, clientY: 5100 })
    await stage.trigger('pointermove', { clientX: 100, clientY: 100 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(-852px, -602px)')
  })

  it('无布局信息(jsdom 默认 0 尺寸)时不夹,平移不受影响', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
  })

  // 浏览器原生图片拖放一旦启动会挂起指针事件(幽灵图+禁止光标,自绘平移全失效),
  // draggable=false 存在选区拖拽等旁路 —— 舞台层必须兜底拦截 dragstart
  it('舞台内任何元素的原生 dragstart 都被阻止(不出幽灵图)', async () => {
    const w = await mountViewer()
    const ev = new Event('dragstart', { bubbles: true, cancelable: true })
    w.get('img.img-el').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  // 真机丢 pointerup(窗口外松手)后 dragging 卡 true,图片会"粘"在指针上乱飞
  it('鼠标已无按键(buttons=0)的 pointermove 不再平移(pointerup 丢失自愈)', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { pointerType: 'mouse', buttons: 0, clientX: 60, clientY: 80 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })
})

// —— 停手落盘:缩放停止 150ms 后倍数烙进布局尺寸,强制重画消除合成器瓦线 ——
describe('ImageViewer 缩放落盘', () => {
  const mountWithSize = async () => {
    vi.useFakeTimers()
    const w = await mountViewer()
    const img = w.get('img.img-el').element as HTMLImageElement
    // jsdom 无布局,手工给出落盘前的布局尺寸(相当于 contain 后的显示大小)
    Object.defineProperty(img, 'offsetWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'offsetHeight', { value: 600, configurable: true })
    return w
  }
  const zoomInBtn = (w: Awaited<ReturnType<typeof mountViewer>>) => w.findAll('.img-toolbar .tb-item')[1]!
  const resetBtn = (w: Awaited<ReturnType<typeof mountViewer>>) => w.findAll('.img-toolbar .tb-item')[3]!

  it('停手 150ms 后落盘:scale 归 1,倍数写进 width/height', async () => {
    const w = await mountWithSize()
    try {
      await zoomInBtn(w).trigger('click') // 有效倍数 1.1
      vi.advanceTimersByTime(150)
      await nextTick()
      const style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1)')
      expect(style).toContain('width: 880px') // round(800×1.1)
      expect(style).toContain('height: 660px')
      expect(style).toContain('max-width: none')
    } finally { vi.useRealTimers() }
  })

  it('连续缩放期间不落盘(防抖),停手后才落', async () => {
    const w = await mountWithSize()
    try {
      await zoomInBtn(w).trigger('click')
      vi.advanceTimersByTime(100)
      await zoomInBtn(w).trigger('click') // 重置防抖计时
      vi.advanceTimersByTime(100)
      await nextTick()
      let style = w.get('img.img-el').attributes('style')!
      expect(style).not.toContain('width:') // 尚未落盘
      expect(style).toContain('scale(1.2')
      vi.advanceTimersByTime(50) // 距最后一次操作满 150ms
      await nextTick()
      style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1)')
      expect(style).toContain('width: 960px') // round(800×1.2)
    } finally { vi.useRealTimers() }
  })

  it('复位清除落盘尺寸,回到 CSS 自适应', async () => {
    const w = await mountWithSize()
    try {
      await zoomInBtn(w).trigger('click')
      vi.advanceTimersByTime(150)
      await nextTick()
      expect(w.get('img.img-el').attributes('style')).toContain('width: 880px')
      await resetBtn(w).trigger('click')
      await nextTick()
      const style = w.get('img.img-el').attributes('style')!
      expect(style).not.toContain('width:')
      expect(style).toContain('scale(1)')
    } finally { vi.useRealTimers() }
  })

  it('图未加载(布局尺寸为 0)时跳过落盘,不破坏显示', async () => {
    vi.useFakeTimers()
    const w = await mountViewer() // jsdom 默认 offsetWidth=0
    try {
      await w.findAll('.img-toolbar .tb-item')[1]!.trigger('click')
      vi.advanceTimersByTime(150)
      await nextTick()
      const style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1.1)') // 保持 transform 缩放,未写入 0 尺寸
      expect(style).not.toContain('width:')
    } finally { vi.useRealTimers() }
  })
})

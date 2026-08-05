import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PhotoImageViewer from '../PhotoImageViewer.vue'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      originalUrl: (id: string | number) => `/v1/photos/assets/${id}/original?token=t`,
      thumbnailUrl: (id: string | number, size = 'small') => `/v1/photos/assets/${id}/thumbnail?size=${size}&token=t`,
    },
  },
}))

const mountViewer = async (props: Partial<{ assetId: string | number; mimeType: string; ocrLines: Array<{ box: number[] }> }> = {}) => {
  const w = mount(PhotoImageViewer, {
    props: { assetId: 'a1', mimeType: 'image/jpeg', ocrLines: [], ...props },
  })
  await nextTick() // 工具栏 v-if="isMoving" 在 onMounted 置 true,等一帧渲染
  return w
}

describe('PhotoImageViewer src 计算(HEIC/TIFF/RAW 回退大图缩略图)', () => {
  it('浏览器可原生解码的 mimeType 用 originalUrl', async () => {
    const w = await mountViewer({ assetId: 'a1', mimeType: 'image/jpeg' })
    expect(w.get('img.img-el').attributes('src')).toBe('/v1/photos/assets/a1/original?token=t')
  })

  it('HEIC 等浏览器不可原生解码 mimeType 回退 thumbnailUrl(id, "large")', async () => {
    const w = await mountViewer({ assetId: 'a2', mimeType: 'image/heic' })
    expect(w.get('img.img-el').attributes('src')).toBe('/v1/photos/assets/a2/thumbnail?size=large&token=t')
  })
})

describe('PhotoImageViewer 缩放(wheel + defineExpose)', () => {
  it('wheel 向上(deltaY<0)放大,向下(deltaY>0)缩小', async () => {
    const w = await mountViewer()
    await w.get('.img-stage').trigger('wheel', { deltaY: -100 })
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1.1')
    await w.get('.img-stage').trigger('wheel', { deltaY: 100 })
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1)')
  })

  it('defineExpose 的 zoomIn/rotate/resetTransform 可被父组件驱动', async () => {
    const w = await mountViewer()
    await (w.vm as any).zoomIn()
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1.1)')
    await (w.vm as any).rotate()
    expect(w.get('img.img-el').attributes('style')).toContain('rotate(90deg)')
    await (w.vm as any).resetTransform()
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1)')
    expect(w.get('img.img-el').attributes('style')).toContain('rotate(0deg)')
  })
})

describe('PhotoImageViewer 工具栏按钮 click 生效', () => {
  it('放大改 scale、旋转改 rotate', async () => {
    const w = await mountViewer()
    const items = w.findAll('.img-toolbar .tb-item')
    await items[0]!.trigger('click') // 放大
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1.1)')
    await items[2]!.trigger('click') // 旋转
    expect(w.get('img.img-el').attributes('style')).toContain('rotate(90deg)')
  })
})

describe('PhotoImageViewer 指针拖拽守卫(pointer capture 不吞工具栏按钮 click)', () => {
  it('工具栏上按下指针不得进入舞台拖拽', async () => {
    const w = await mountViewer()
    const btn = w.findAll('.img-toolbar .tb-item')[0]! // 放大键
    await btn.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await w.get('.img-stage').trigger('pointermove', { clientX: 60, clientY: 80 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })

  it('舞台空白处拖拽可平移图片', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
  })

  it('鼠标已无按键(buttons=0)的 pointermove 不再平移(pointerup 丢失自愈)', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { pointerType: 'mouse', buttons: 0, clientX: 60, clientY: 80 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })

  it('舞台内原生 dragstart 都被阻止(不出幽灵图)', async () => {
    const w = await mountViewer()
    const ev = new Event('dragstart', { bubbles: true, cancelable: true })
    w.get('img.img-el').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })
})

describe('PhotoImageViewer 拖拽边界(clampPan)', () => {
  const mountWithLayout = async () => {
    const w = await mountViewer()
    const img = w.get('img.img-el').element as HTMLImageElement
    const stage = w.get('.img-stage').element as HTMLElement
    Object.defineProperty(img, 'offsetWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'offsetHeight', { value: 600, configurable: true })
    Object.defineProperty(stage, 'clientWidth', { value: 1000, configurable: true })
    Object.defineProperty(stage, 'clientHeight', { value: 700, configurable: true })
    return w
  }

  it('向右下暴力拖拽被夹在边界', async () => {
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
})

describe('PhotoImageViewer 停手落盘(150ms 后倍数烙进布局尺寸)', () => {
  const mountWithSize = async () => {
    vi.useFakeTimers()
    const w = await mountViewer()
    const img = w.get('img.img-el').element as HTMLImageElement
    Object.defineProperty(img, 'offsetWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'offsetHeight', { value: 600, configurable: true })
    return w
  }

  it('停手 150ms 后落盘:scale 归 1,倍数写进 width/height', async () => {
    const w = await mountWithSize()
    try {
      await (w.vm as any).zoomIn() // 有效倍数 1.1
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
      await (w.vm as any).zoomIn()
      vi.advanceTimersByTime(100)
      await (w.vm as any).zoomIn() // 重置防抖计时
      vi.advanceTimersByTime(100)
      await nextTick()
      let style = w.get('img.img-el').attributes('style')!
      expect(style).not.toContain('width:') // 尚未落盘
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
      await (w.vm as any).zoomIn()
      vi.advanceTimersByTime(150)
      await nextTick()
      expect(w.get('img.img-el').attributes('style')).toContain('width: 880px')
      await (w.vm as any).resetTransform()
      await nextTick()
      const style = w.get('img.img-el').attributes('style')!
      expect(style).not.toContain('width:')
      expect(style).toContain('scale(1)')
    } finally { vi.useRealTimers() }
  })
})

describe('PhotoImageViewer 换图复位变换', () => {
  it('assetId 变化时复位缩放/旋转/平移', async () => {
    const w = await mountViewer({ assetId: 'a1' })
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
    await w.setProps({ assetId: 'a2' })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })
})

describe('PhotoImageViewer OCR 覆盖层(随变换同容器,不叠加 offsetLeft/Top)', () => {
  const mountWithOcr = async (ocrLines: Array<{ box: number[] }>) => {
    const w = await mountViewer({ ocrLines })
    const img = w.get('img.img-el').element as HTMLImageElement
    Object.defineProperty(img, 'clientWidth', { value: 200, configurable: true })
    Object.defineProperty(img, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 50, configurable: true })
    await w.get('img.img-el').trigger('load')
    return w
  }

  it('ocrLines 非空:overlay 内出现对应 .ocr-hit,矩形与 mapOcrBoxesToRects 一致', async () => {
    const w = await mountWithOcr([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }])
    const hits = w.findAll('.ocr-overlay .ocr-hit')
    expect(hits.length).toBe(1)
    const style = hits[0]!.attributes('style')!
    expect(style).toContain('left: 0px')
    expect(style).toContain('top: 50px')
    expect(style).toContain('width: 200px')
    expect(style).toContain('height: 100px')
  })

  it('ocrLines 为空:不渲染任何 .ocr-hit', async () => {
    const w = await mountWithOcr([])
    expect(w.findAll('.ocr-overlay .ocr-hit').length).toBe(0)
  })

  it('ocrLines 缺省(未传 prop):不渲染任何 .ocr-hit', async () => {
    const w = mount(PhotoImageViewer, { props: { assetId: 'a1', mimeType: 'image/jpeg' } })
    await nextTick()
    expect(w.findAll('.ocr-overlay .ocr-hit').length).toBe(0)
  })

  it('.ocr-overlay 与 <img> 同处 .img-wrap 内,且随缩放同步变换(不是舞台的旁支兄弟)', async () => {
    const w = await mountWithOcr([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }])
    const wrap = w.get('.img-wrap').element
    expect(wrap.contains(w.get('img.img-el').element)).toBe(true)
    expect(wrap.contains(w.get('.ocr-overlay').element)).toBe(true)
    await (w.vm as any).zoomIn()
    const imgStyle = w.get('img.img-el').attributes('style')!
    const overlayStyle = w.get('.ocr-overlay').attributes('style')!
    expect(imgStyle).toContain('scale(1.1)')
    expect(overlayStyle).toContain('scale(1.1)') // 覆盖层随图片同步缩放/平移
  })
})

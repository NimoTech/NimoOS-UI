import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PhotoImageViewer from '../PhotoImageViewer.vue'
// Plan F Task 5: `.lb-ocr-hit`'s byte-exact values no longer have a local copy in this component
// (retired -- duplicate of parity's own `.photos-root .lb-ocr-hit`, see PhotoImageViewer.vue's
// scoped-style retirement note). Read parity's source instead now that it's what actually
// governs.
// Read via node:fs rather than a Vite `?raw` import -- Vite's CSS/SCSS handling intercepts
// `.scss?raw` before the raw-loader can return it (empirically empty in this project's vitest
// setup); every other guard test reading vue2-parity/*.scss uses fs for the same reason.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const PARITY_SRC = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/vue2-parity/photos.scss'),
  'utf8',
)
// I2 (final review, 2026-08-15) -- read this component's own scoped <style> the same way
// PhotoLightbox.test.ts already does for its sibling component (`?raw`, unaffected by the
// `.scss?raw` interception noted above since this is a `.vue` file, not `.scss`).
import IMAGE_VIEWER_SRC from '../PhotoImageViewer.vue?raw'

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

// Plan F Task 3: the <img> keeps its own `.img-el` hook (zoom/pan mechanics, net addition over
// Vue2 -- controller ruling 4) and gains parity's anchor `.lb-photo` alongside it
// (`.lb-media > .lb-photo(img|video)`, Vue2 PhotosLightbox.vue:38-45).
describe('PhotoImageViewer 结构:.lb-photo 锚点(Plan F Task 3)', () => {
  it('<img> 同时带 .img-el 与 .lb-photo 两个类', async () => {
    const w = await mountViewer()
    const img = w.get('img.img-el')
    expect(img.classes()).toContain('img-el')
    expect(img.classes()).toContain('lb-photo')
  })
})

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

// Plan F Task 4: byte-exact per Vue2 (photos.scss:500-510)/parity (photos.scss:616-622) --
// yellow highlighter box + entrance pulse, replacing the earlier `--accent` token approximation.
describe('PhotoImageViewer OCR 命中框动画(lb-ocr-pulse,Plan F Task 4, retargeted to parity in Task 5)', () => {
  const rule = (): string => {
    const m = /\.photos-root \.lb-ocr-hit\s*\{([^}]*)\}/.exec(PARITY_SRC)
    expect(m, '找不到 .lb-ocr-hit 规则').not.toBeNull()
    return m![1]
  }

  it('引用 lb-ocr-pulse 入场动画,时长/缓动逐字节对齐 Vue2', () => {
    expect(rule()).toMatch(/animation:\s*lb-ocr-pulse 0\.45s cubic-bezier\(0\.22,\s*0\.61,\s*0\.36,\s*1\) both/)
  })

  it('配色逐字节对齐 Vue2(黄底 30% + 白描边 85% + 黄光 55%),不再借用 --accent 系 token', () => {
    const body = rule()
    expect(body).toMatch(/background:\s*rgba\(255,\s*214,\s*10,\s*0\.30\)/)
    expect(body).toMatch(/box-shadow:\s*0 0 0 1\.5px rgba\(255,\s*255,\s*255,\s*0\.85\),\s*0 0 12px rgba\(255,\s*214,\s*10,\s*0\.55\)/)
    expect(body).not.toMatch(/var\(--accent/)
  })

  it('圆角 4px(Vue2/parity 值,此前是 3px);不再画独立 border(改用 box-shadow 双层描边)', () => {
    const body = rule()
    expect(body).toMatch(/border-radius:\s*4px/)
    expect(body).not.toMatch(/\bborder:\s*1\.5px solid/)
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

  it('ocrLines 非空:overlay 内出现对应 .lb-ocr-hit,矩形与 mapOcrBoxesToRects 一致', async () => {
    const w = await mountWithOcr([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }])
    const hits = w.findAll('.lb-ocr-overlay .lb-ocr-hit')
    expect(hits.length).toBe(1)
    const style = hits[0]!.attributes('style')!
    expect(style).toContain('left: 0px')
    expect(style).toContain('top: 50px')
    expect(style).toContain('width: 200px')
    expect(style).toContain('height: 100px')
  })

  it('ocrLines 为空:不渲染任何 .lb-ocr-hit', async () => {
    const w = await mountWithOcr([])
    expect(w.findAll('.lb-ocr-overlay .lb-ocr-hit').length).toBe(0)
  })

  it('ocrLines 缺省(未传 prop):不渲染任何 .lb-ocr-hit', async () => {
    const w = mount(PhotoImageViewer, { props: { assetId: 'a1', mimeType: 'image/jpeg' } })
    await nextTick()
    expect(w.findAll('.lb-ocr-overlay .lb-ocr-hit').length).toBe(0)
  })

  it('.lb-ocr-overlay 与 <img> 同处 .img-wrap 内,且随缩放同步变换(不是舞台的旁支兄弟)', async () => {
    const w = await mountWithOcr([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }])
    const wrap = w.get('.img-wrap').element
    expect(wrap.contains(w.get('img.img-el').element)).toBe(true)
    expect(wrap.contains(w.get('.lb-ocr-overlay').element)).toBe(true)
    await (w.vm as any).zoomIn()
    const imgStyle = w.get('img.img-el').attributes('style')!
    const overlayStyle = w.get('.lb-ocr-overlay').attributes('style')!
    expect(imgStyle).toContain('scale(1.1)')
    expect(overlayStyle).toContain('scale(1.1)') // 覆盖层随图片同步缩放/平移
  })
})

// I2 (final review, 2026-08-15) -- `.img-el { max-width:100%; max-height:100% }` used to sit at
// equal specificity with parity's own `.photos-root .lb-photo` (also targeting this exact <img>,
// since it carries both classes) and, being injected after the parity stylesheet on every host
// page, always won the tie -- silently overriding parity's `calc(100% - 80px)`/`calc(100% - 24px)`
// arrow clearance with a flush 100%. Assert the local rule no longer declares either property, so
// parity's `.lb-photo` is the only max-width/max-height source reaching this element.
describe('PhotoImageViewer .img-el 不再与 parity .lb-photo 打平手(I2)', () => {
  it('.img-el 本地规则不声明 max-width/max-height', () => {
    const m = /(?<!\.lb-)\.img-el\s*\{([^}]*)\}/.exec(IMAGE_VIEWER_SRC)
    expect(m, '找不到 .img-el 规则').not.toBeNull()
    expect(m![1]).not.toMatch(/max-width/)
    expect(m![1]).not.toMatch(/max-height/)
  })

  it('parity 的 .lb-photo 仍携带 80px/24px 的箭头留白值(锚点没挪走)', () => {
    const m = /\.photos-root \.lb-photo\s*\{([^}]*)\}/.exec(PARITY_SRC)
    expect(m, '找不到 parity 的 .photos-root .lb-photo').not.toBeNull()
    expect(m![1]).toMatch(/max-width:\s*calc\(100% - 80px\)/)
    expect(m![1]).toMatch(/max-height:\s*calc\(100% - 24px\)/)
  })
})

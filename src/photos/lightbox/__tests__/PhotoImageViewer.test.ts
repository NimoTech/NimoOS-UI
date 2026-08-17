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
  await nextTick() // Toolbar v-if="isMoving" set to true at onMounted, wait one frame to render
  return w
}

describe('PhotoImageViewer src calculation (HEIC/TIFF/RAW fallback to large thumbnail)', () => {
  it('browser-natively-decodable mimeType uses originalUrl', async () => {
    const w = await mountViewer({ assetId: 'a1', mimeType: 'image/jpeg' })
    expect(w.get('img.img-el').attributes('src')).toBe('/v1/photos/assets/a1/original?token=t')
  })

  it('HEIC and other browser-non-decodable mimeType fallback to thumbnailUrl(id, "large")', async () => {
    const w = await mountViewer({ assetId: 'a2', mimeType: 'image/heic' })
    expect(w.get('img.img-el').attributes('src')).toBe('/v1/photos/assets/a2/thumbnail?size=large&token=t')
  })
})

describe('PhotoImageViewer zoom (wheel + defineExpose)', () => {
  it('wheel up (deltaY<0) zooms in, wheel down (deltaY>0) zooms out', async () => {
    const w = await mountViewer()
    await w.get('.img-stage').trigger('wheel', { deltaY: -100 })
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1.1')
    await w.get('.img-stage').trigger('wheel', { deltaY: 100 })
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1)')
  })

  it('defineExpose zoomIn/rotate/resetTransform can be driven by parent component', async () => {
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

describe('PhotoImageViewer toolbar button click works', () => {
  it('zoom changes scale, rotate changes rotate', async () => {
    const w = await mountViewer()
    const items = w.findAll('.img-toolbar .tb-item')
    await items[0]!.trigger('click') // zoom
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1.1)')
    await items[2]!.trigger('click') // rotate
    expect(w.get('img.img-el').attributes('style')).toContain('rotate(90deg)')
  })
})

describe('PhotoImageViewer pointer drag guard (pointer capture does not swallow toolbar button click)', () => {
  it('pointer pressed on toolbar must not enter stage drag', async () => {
    const w = await mountViewer()
    const btn = w.findAll('.img-toolbar .tb-item')[0]! // zoom button
    await btn.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await w.get('.img-stage').trigger('pointermove', { clientX: 60, clientY: 80 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })

  it('drag on blank stage pans image', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
  })

  it('pointermove with no buttons (buttons=0) no longer pans (pointerup loss self-heals)', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { pointerType: 'mouse', buttons: 0, clientX: 60, clientY: 80 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })

  it('native dragstart on stage must be prevented (no ghost image)', async () => {
    const w = await mountViewer()
    const ev = new Event('dragstart', { bubbles: true, cancelable: true })
    w.get('img.img-el').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })
})

describe('PhotoImageViewer drag boundary (clampPan)', () => {
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

  it('drag forcefully to right-down, clamped at boundary', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 100, clientY: 100 })
    await stage.trigger('pointermove', { clientX: 5100, clientY: 5100 })
    // maxTx = (1000+800)/2 - 48 = 852; maxTy = (700+600)/2 - 48 = 602
    expect(w.get('img.img-el').attributes('style')).toContain('translate(852px, 602px)')
  })

  it('drag forcefully to left-up, also clamped (negative direction)', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 5100, clientY: 5100 })
    await stage.trigger('pointermove', { clientX: 100, clientY: 100 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(-852px, -602px)')
  })
})

describe('PhotoImageViewer release to settle (settle multiplier into layout size after 150ms)', () => {
  const mountWithSize = async () => {
    vi.useFakeTimers()
    const w = await mountViewer()
    const img = w.get('img.img-el').element as HTMLImageElement
    Object.defineProperty(img, 'offsetWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'offsetHeight', { value: 600, configurable: true })
    return w
  }

  it('release and settle after 150ms: scale back to 1, multiplier written to width/height', async () => {
    const w = await mountWithSize()
    try {
      await (w.vm as any).zoomIn() // effective multiplier 1.1
      vi.advanceTimersByTime(150)
      await nextTick()
      const style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1)')
      expect(style).toContain('width: 880px') // round(800×1.1)
      expect(style).toContain('height: 660px')
      expect(style).toContain('max-width: none')
    } finally { vi.useRealTimers() }
  })

  it('no settle during continuous zoom (debounce), settle only after release', async () => {
    const w = await mountWithSize()
    try {
      await (w.vm as any).zoomIn()
      vi.advanceTimersByTime(100)
      await (w.vm as any).zoomIn() // reset debounce timer
      vi.advanceTimersByTime(100)
      await nextTick()
      let style = w.get('img.img-el').attributes('style')!
      expect(style).not.toContain('width:') // not yet settled
      vi.advanceTimersByTime(50) // 150ms elapsed since last operation
      await nextTick()
      style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1)')
      expect(style).toContain('width: 960px') // round(800×1.2)
    } finally { vi.useRealTimers() }
  })

  it('reset clears settled dimensions, back to CSS auto-fit', async () => {
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

describe('PhotoImageViewer image change resets transform', () => {
  it('when assetId changes, reset zoom/rotate/pan', async () => {
    const w = await mountViewer({ assetId: 'a1' })
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
    await w.setProps({ assetId: 'a2' })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })
})

describe('PhotoImageViewer OCR overlay (transforms with container, does not stack offsetLeft/Top)', () => {
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

  it('ocrLines non-empty: overlay has corresponding .ocr-hit, rect matches mapOcrBoxesToRects', async () => {
    const w = await mountWithOcr([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }])
    const hits = w.findAll('.ocr-overlay .ocr-hit')
    expect(hits.length).toBe(1)
    const style = hits[0]!.attributes('style')!
    expect(style).toContain('left: 0px')
    expect(style).toContain('top: 50px')
    expect(style).toContain('width: 200px')
    expect(style).toContain('height: 100px')
  })

  it('ocrLines empty: no .ocr-hit rendered', async () => {
    const w = await mountWithOcr([])
    expect(w.findAll('.ocr-overlay .ocr-hit').length).toBe(0)
  })

  it('ocrLines omitted (prop not passed): no .ocr-hit rendered', async () => {
    const w = mount(PhotoImageViewer, { props: { assetId: 'a1', mimeType: 'image/jpeg' } })
    await nextTick()
    expect(w.findAll('.ocr-overlay .ocr-hit').length).toBe(0)
  })

  it('.ocr-overlay and <img> both in .img-wrap, overlay syncs transform (not a sibling of stage)', async () => {
    const w = await mountWithOcr([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }])
    const wrap = w.get('.img-wrap').element
    expect(wrap.contains(w.get('img.img-el').element)).toBe(true)
    expect(wrap.contains(w.get('.ocr-overlay').element)).toBe(true)
    await (w.vm as any).zoomIn()
    const imgStyle = w.get('img.img-el').attributes('style')!
    const overlayStyle = w.get('.ocr-overlay').attributes('style')!
    expect(imgStyle).toContain('scale(1.1)')
    expect(overlayStyle).toContain('scale(1.1)') // overlay scales/pans in sync with image
  })
})

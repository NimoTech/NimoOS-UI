import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PhotoImageViewer from '../PhotoImageViewer.vue'
// `.lb-ocr-hit`'s byte-exact values no longer have a local copy in this component
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
// Read this component's own scoped <style> the same way
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
  await nextTick() // the toolbar's v-if="isMoving" gets set true in onMounted, wait one render frame
  return w
}

// The <img> keeps its own `.img-el` hook (zoom/pan mechanics, net addition over
// Vue2, intentionally kept) and gains parity's anchor `.lb-photo` alongside it
// (`.lb-media > .lb-photo(img|video)`, Vue2 PhotosLightbox.vue:38-45).
describe('PhotoImageViewer structure: .lb-photo anchor', () => {
  it('<img> carries both the .img-el and .lb-photo classes', async () => {
    const w = await mountViewer()
    const img = w.get('img.img-el')
    expect(img.classes()).toContain('img-el')
    expect(img.classes()).toContain('lb-photo')
  })
})

describe('PhotoImageViewer src computation (HEIC/TIFF/RAW fall back to large thumbnail)', () => {
  it('uses originalUrl for mimeTypes the browser can natively decode', async () => {
    const w = await mountViewer({ assetId: 'a1', mimeType: 'image/jpeg' })
    expect(w.get('img.img-el').attributes('src')).toBe('/v1/photos/assets/a1/original?token=t')
  })

  it('falls back to thumbnailUrl(id, "large") for mimeTypes the browser can\'t natively decode, like HEIC', async () => {
    const w = await mountViewer({ assetId: 'a2', mimeType: 'image/heic' })
    expect(w.get('img.img-el').attributes('src')).toBe('/v1/photos/assets/a2/thumbnail?size=large&token=t')
  })
})

// Byte-exact per Vue2 (photos.scss:500-510)/parity (photos.scss:616-622) --
// yellow highlighter box + entrance pulse, replacing the earlier `--accent` token approximation.
describe('PhotoImageViewer OCR hit-box animation (lb-ocr-pulse)', () => {
  const rule = (): string => {
    const m = /\.photos-root \.lb-ocr-hit\s*\{([^}]*)\}/.exec(PARITY_SRC)
    expect(m, 'could not find the .lb-ocr-hit rule').not.toBeNull()
    return m![1]
  }

  it('references the lb-ocr-pulse entrance animation, duration/easing byte-aligned with Vue2', () => {
    expect(rule()).toMatch(/animation:\s*lb-ocr-pulse 0\.45s cubic-bezier\(0\.22,\s*0\.61,\s*0\.36,\s*1\) both/)
  })

  it('color byte-aligned with Vue2 (30% yellow fill + 85% white outline + 55% yellow glow), no longer borrowing the --accent token family', () => {
    const body = rule()
    expect(body).toMatch(/background:\s*rgba\(255,\s*214,\s*10,\s*0\.30\)/)
    expect(body).toMatch(/box-shadow:\s*0 0 0 1\.5px rgba\(255,\s*255,\s*255,\s*0\.85\),\s*0 0 12px rgba\(255,\s*214,\s*10,\s*0\.55\)/)
    expect(body).not.toMatch(/var\(--accent/)
  })

  it('4px border-radius (Vue2/parity value, previously 3px); no longer draws a separate border (uses a double box-shadow outline instead)', () => {
    const body = rule()
    expect(body).toMatch(/border-radius:\s*4px/)
    expect(body).not.toMatch(/\bborder:\s*1\.5px solid/)
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

  it('the exposed zoomIn/rotate/resetTransform can be driven by the parent component', async () => {
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

// The bottom `.img-toolbar` (Zoom in/Zoom out/
// Rotate/Reset buttons) is removed in both themes -- flagged as a dark box that
// stayed illegible in light mode and had no light-mode variant of its own. Zoom remains reachable
// via wheel (already covered by the "PhotoImageViewer zoom" describe above) and the new
// double-click toggle below. The two describe blocks that used to exercise `.img-toolbar .tb-item`
// buttons (a click-to-zoom/rotate test and a pointer-capture guard proving toolbar clicks don't
// get eaten by stage drag) are deleted outright along with the buttons themselves -- nothing to
// retarget, the element no longer exists.

describe('PhotoImageViewer double-click zoom toggle (a cheap companion gesture alongside wheel-zoom)', () => {
  it('double-click when not zoomed → zooms to 2x', async () => {
    const w = await mountViewer()
    await w.get('.img-stage').trigger('dblclick')
    expect(w.get('img.img-el').attributes('style')).toContain('scale(2)')
  })

  it('double-click when already zoomed (committedZoom×scale > 1) → resets (scale(1), rotation/translation back to zero)', async () => {
    const w = await mountViewer()
    await (w.vm as any).zoomIn() // effective factor 1.1 > the 1.01 threshold
    await w.get('.img-stage').trigger('dblclick')
    const style = w.get('img.img-el').attributes('style')!
    expect(style).toContain('scale(1)')
    expect(style).toContain('rotate(0deg)')
  })
})

describe('PhotoImageViewer stage drag (now that the toolbar is removed, pointerdown no longer needs an .img-toolbar pass-through guard)', () => {
  it('dragging on empty stage space pans the image', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
  })

  it('a pointermove with no mouse button held (buttons=0) no longer pans (self-heals from a missed pointerup)', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { pointerType: 'mouse', buttons: 0, clientX: 60, clientY: 80 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })

  it('native dragstart inside the stage is always prevented (no ghost image)', async () => {
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

  it('dragging aggressively toward bottom-right gets clamped at the boundary', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 100, clientY: 100 })
    await stage.trigger('pointermove', { clientX: 5100, clientY: 5100 })
    // maxTx = (1000+800)/2 - 48 = 852; maxTy = (700+600)/2 - 48 = 602
    expect(w.get('img.img-el').attributes('style')).toContain('translate(852px, 602px)')
  })

  it('dragging aggressively toward top-left also gets clamped (negative direction)', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 5100, clientY: 5100 })
    await stage.trigger('pointermove', { clientX: 100, clientY: 100 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(-852px, -602px)')
  })
})

describe('PhotoImageViewer commit on settle (150ms after settling, the factor gets baked into the layout size)', () => {
  const mountWithSize = async () => {
    vi.useFakeTimers()
    const w = await mountViewer()
    const img = w.get('img.img-el').element as HTMLImageElement
    Object.defineProperty(img, 'offsetWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'offsetHeight', { value: 600, configurable: true })
    return w
  }

  it('commits 150ms after settling: scale resets to 1, the factor gets written into width/height', async () => {
    const w = await mountWithSize()
    try {
      await (w.vm as any).zoomIn() // effective factor 1.1
      vi.advanceTimersByTime(150)
      await nextTick()
      const style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1)')
      expect(style).toContain('width: 880px') // round(800×1.1)
      expect(style).toContain('height: 660px')
      expect(style).toContain('max-width: none')
    } finally { vi.useRealTimers() }
  })

  it('does not commit during continuous zooming (debounced), only commits after settling', async () => {
    const w = await mountWithSize()
    try {
      await (w.vm as any).zoomIn()
      vi.advanceTimersByTime(100)
      await (w.vm as any).zoomIn() // resets the debounce timer
      vi.advanceTimersByTime(100)
      await nextTick()
      let style = w.get('img.img-el').attributes('style')!
      expect(style).not.toContain('width:') // hasn't committed yet
      vi.advanceTimersByTime(50) // 150ms have now elapsed since the last operation
      await nextTick()
      style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1)')
      expect(style).toContain('width: 960px') // round(800×1.2)
    } finally { vi.useRealTimers() }
  })

  it('reset clears the committed size, returning to CSS auto-sizing', async () => {
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

describe('PhotoImageViewer resets transform on image change', () => {
  it('resets zoom/rotation/pan when assetId changes', async () => {
    const w = await mountViewer({ assetId: 'a1' })
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
    await w.setProps({ assetId: 'a2' })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })
})

describe('PhotoImageViewer OCR overlay (shares the same container transform, no extra offsetLeft/Top)', () => {
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

  it('ocrLines non-empty: the overlay renders the corresponding .lb-ocr-hit, rects match mapOcrBoxesToRects', async () => {
    const w = await mountWithOcr([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }])
    const hits = w.findAll('.lb-ocr-overlay .lb-ocr-hit')
    expect(hits.length).toBe(1)
    const style = hits[0]!.attributes('style')!
    expect(style).toContain('left: 0px')
    expect(style).toContain('top: 50px')
    expect(style).toContain('width: 200px')
    expect(style).toContain('height: 100px')
  })

  it('ocrLines empty: renders no .lb-ocr-hit at all', async () => {
    const w = await mountWithOcr([])
    expect(w.findAll('.lb-ocr-overlay .lb-ocr-hit').length).toBe(0)
  })

  it('ocrLines omitted (prop not passed): renders no .lb-ocr-hit at all', async () => {
    const w = mount(PhotoImageViewer, { props: { assetId: 'a1', mimeType: 'image/jpeg' } })
    await nextTick()
    expect(w.findAll('.lb-ocr-overlay .lb-ocr-hit').length).toBe(0)
  })

  it('.lb-ocr-overlay lives inside .img-wrap together with <img>, and transforms in sync when zooming (not a sibling off the stage)', async () => {
    const w = await mountWithOcr([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }])
    const wrap = w.get('.img-wrap').element
    expect(wrap.contains(w.get('img.img-el').element)).toBe(true)
    expect(wrap.contains(w.get('.lb-ocr-overlay').element)).toBe(true)
    await (w.vm as any).zoomIn()
    const imgStyle = w.get('img.img-el').attributes('style')!
    const overlayStyle = w.get('.lb-ocr-overlay').attributes('style')!
    expect(imgStyle).toContain('scale(1.1)')
    expect(overlayStyle).toContain('scale(1.1)') // the overlay zooms/pans in sync with the image
  })
})

// `.img-el { max-width:100%; max-height:100% }` used to sit at
// equal specificity with parity's own `.photos-root .lb-photo` (also targeting this exact <img>,
// since it carries both classes) and, being injected after the parity stylesheet on every host
// page, always won the tie -- silently overriding parity's `calc(100% - 80px)`/`calc(100% - 24px)`
// arrow clearance with a flush 100%. Assert the local rule no longer declares either property, so
// parity's `.lb-photo` is the only max-width/max-height source reaching this element.
describe('PhotoImageViewer .img-el no longer ties with parity .lb-photo', () => {
  it('the local .img-el rule declares neither max-width nor max-height', () => {
    const m = /(?<!\.lb-)\.img-el\s*\{([^}]*)\}/.exec(IMAGE_VIEWER_SRC)
    expect(m, 'could not find the .img-el rule').not.toBeNull()
    expect(m![1]).not.toMatch(/max-width/)
    expect(m![1]).not.toMatch(/max-height/)
  })

  it('parity\'s .lb-photo still carries the 80px/24px arrow-clearance values (the anchor hasn\'t moved)', () => {
    const m = /\.photos-root \.lb-photo\s*\{([^}]*)\}/.exec(PARITY_SRC)
    expect(m, "could not find parity's .photos-root .lb-photo").not.toBeNull()
    expect(m![1]).toMatch(/max-width:\s*calc\(100% - 80px\)/)
    expect(m![1]).toMatch(/max-height:\s*calc\(100% - 24px\)/)
  })
})

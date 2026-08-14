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
  await nextTick() // toolbar v-if="isMoving" is set true in onMounted; wait one frame to render
  return w
}

describe('ImageViewer', () => {
  // Historical bug: .img-stage's pointerdown also called setPointerCapture on events bubbling up
  // from toolbar buttons; once the stage captured the pointer, buttons never received click — the
  // entire bottom toolbar row went dead.
  it('pressing pointer on toolbar should not enter stage dragging (pointer capture does not consume button)', async () => {
    const w = await mountViewer()
    const btn = w.findAll('.img-toolbar .tb-item')[1]! // the + zoom-in button
    await btn.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await w.get('.img-stage').trigger('pointermove', { clientX: 60, clientY: 80 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })

  it('toolbar button click works: zoom in changes scale, rotate changes rotate', async () => {
    const w = await mountViewer()
    const items = w.findAll('.img-toolbar .tb-item')
    await items[1]!.trigger('click') // zoom in
    expect(w.get('img.img-el').attributes('style')).toContain('scale(1.1)')
    await items[2]!.trigger('click') // rotate
    expect(w.get('img.img-el').attributes('style')).toContain('rotate(90deg)')
  })

  it('dragging on empty stage still pans image', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
  })
})

// —— Drag bounds: the image always keeps at least 48px inside the viewport, can't be dragged away ——
describe('ImageViewer drag bounds', () => {
  const mountWithLayout = async () => {
    const w = await mountViewer()
    const img = w.get('img.img-el').element as HTMLImageElement
    const stage = w.get('.img-stage').element as HTMLElement
    // jsdom has no layout; supply the stage and image display sizes by hand
    Object.defineProperty(img, 'offsetWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'offsetHeight', { value: 600, configurable: true })
    Object.defineProperty(stage, 'clientWidth', { value: 1000, configurable: true })
    Object.defineProperty(stage, 'clientHeight', { value: 700, configurable: true })
    return w
  }

  it('dragging violently to bottom-right is clamped at bounds: image never leaves viewport completely', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 100, clientY: 100 })
    await stage.trigger('pointermove', { clientX: 5100, clientY: 5100 })
    // maxTx = (1000+800)/2 - 48 = 852; maxTy = (700+600)/2 - 48 = 602
    expect(w.get('img.img-el').attributes('style')).toContain('translate(852px, 602px)')
  })

  it('dragging violently to top-left is also clamped (negative direction)', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 5100, clientY: 5100 })
    await stage.trigger('pointermove', { clientX: 100, clientY: 100 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(-852px, -602px)')
  })

  it('when no layout info (jsdom defaults to 0 size), clamping is skipped, panning is unaffected', async () => {
    const w = await mountViewer()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { clientX: 30, clientY: 40 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(20px, 30px)')
  })

  // Once the browser's native image drag starts it suspends pointer events (ghost image + no-drop
  // cursor; our own panning all breaks); draggable=false has bypasses like selection dragging —
  // the stage layer must intercept dragstart as the backstop
  it('native dragstart of any element on stage is prevented (no ghost image)', async () => {
    const w = await mountViewer()
    const ev = new Event('dragstart', { bubbles: true, cancelable: true })
    w.get('img.img-el').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  // On real devices a lost pointerup (released outside the window) leaves dragging stuck true, and the image "sticks" to the pointer and flies around
  it('pointermove with no mouse buttons (buttons=0) stops panning (lost pointerup self-heals)', async () => {
    const w = await mountWithLayout()
    const stage = w.get('.img-stage')
    await stage.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await stage.trigger('pointermove', { pointerType: 'mouse', buttons: 0, clientX: 60, clientY: 80 })
    expect(w.get('img.img-el').attributes('style')).toContain('translate(0px, 0px)')
  })
})

// —— Settle-on-idle: 150ms after zooming stops, the factor is baked into layout size, forcing a repaint that removes compositor tile seams ——
describe('ImageViewer zoom settle-on-idle', () => {
  const mountWithSize = async () => {
    vi.useFakeTimers()
    const w = await mountViewer()
    const img = w.get('img.img-el').element as HTMLImageElement
    // jsdom has no layout; supply the pre-settle layout size by hand (equivalent to the display size after contain)
    Object.defineProperty(img, 'offsetWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'offsetHeight', { value: 600, configurable: true })
    return w
  }
  const zoomInBtn = (w: Awaited<ReturnType<typeof mountViewer>>) => w.findAll('.img-toolbar .tb-item')[1]!
  const resetBtn = (w: Awaited<ReturnType<typeof mountViewer>>) => w.findAll('.img-toolbar .tb-item')[3]!

  it('after 150ms idle: scale returns to 1, multiplier is written to width/height', async () => {
    const w = await mountWithSize()
    try {
      await zoomInBtn(w).trigger('click') // effective factor 1.1
      vi.advanceTimersByTime(150)
      await nextTick()
      const style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1)')
      expect(style).toContain('width: 880px') // round(800×1.1)
      expect(style).toContain('height: 660px')
      expect(style).toContain('max-width: none')
    } finally { vi.useRealTimers() }
  })

  it('no settling during continuous zoom (debounced), settles only after stop', async () => {
    const w = await mountWithSize()
    try {
      await zoomInBtn(w).trigger('click')
      vi.advanceTimersByTime(100)
      await zoomInBtn(w).trigger('click') // resets the debounce timer
      vi.advanceTimersByTime(100)
      await nextTick()
      let style = w.get('img.img-el').attributes('style')!
      expect(style).not.toContain('width:') // not settled yet
      expect(style).toContain('scale(1.2')
      vi.advanceTimersByTime(50) // reaches 150ms since the last action
      await nextTick()
      style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1)')
      expect(style).toContain('width: 960px') // round(800×1.2)
    } finally { vi.useRealTimers() }
  })

  it('reset clears settled size, returns to CSS auto-sizing', async () => {
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

  it('when image not loaded (layout size 0), skip settling, do not break display', async () => {
    vi.useFakeTimers()
    const w = await mountViewer() // jsdom defaults to offsetWidth=0
    try {
      await w.findAll('.img-toolbar .tb-item')[1]!.trigger('click')
      vi.advanceTimersByTime(150)
      await nextTick()
      const style = w.get('img.img-el').attributes('style')!
      expect(style).toContain('scale(1.1)') // keeps the transform scale; never writes a 0 size
      expect(style).not.toContain('width:')
    } finally { vi.useRealTimers() }
  })
})

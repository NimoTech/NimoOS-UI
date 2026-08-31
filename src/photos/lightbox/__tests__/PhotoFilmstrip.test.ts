import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import PhotoFilmstrip from '../PhotoFilmstrip.vue'
// `.lb-strip`'s `grid-area` no longer has a local copy (retired -- byte-duplicate
// of parity's own `.photos-root .lb-strip`, see PhotoFilmstrip.vue's scoped-style retirement
// note). Read parity's source instead now that it's what actually governs.
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
import type { Photo } from '../../util/assetToPhoto'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      thumbnailUrl: (id: string | number, size = 'small') => `/v1/photos/assets/${id}/thumbnail?size=${size}&token=t`,
    },
  },
}))

function makePhoto(id: string, isVideo = false, duration: string | null = null): Photo {
  return { id, isVideo, duration } as unknown as Photo
}

function makeList(n: number): Photo[] {
  return Array.from({ length: n }, (_, i) => makePhoto(`p${i}`))
}

function mountFilmstrip(list: Photo[], index: number) {
  return mount(PhotoFilmstrip, { props: { list, index } })
}

// jsdom has no real layout engine -- manually lay out each thumbnail's offsetLeft/clientWidth and
// the strip's own clientWidth/scrollLeft/scrollTo, so centerActiveThumb / findCenterThumbIndex's
// geometry calculations become testable (same Object.defineProperty technique as PhotoImageViewer.test.ts).
function stubGeometry(w: VueWrapper, thumbWidth = 100, stripWidth = 300) {
  const strip = w.get('.lb-strip').element as HTMLElement
  Object.defineProperty(strip, 'clientWidth', { value: stripWidth, configurable: true })
  let scrollLeftVal = 0
  Object.defineProperty(strip, 'scrollLeft', {
    get: () => scrollLeftVal,
    set: (v: number) => { scrollLeftVal = v },
    configurable: true,
  })
  strip.scrollTo = vi.fn((opts: unknown) => {
    const o = opts as { left?: number } | undefined
    if (o && typeof o.left === 'number') scrollLeftVal = o.left
  }) as unknown as typeof strip.scrollTo
  w.findAll('.lb-thumb').forEach((t, i) => {
    const el = t.element as HTMLElement
    Object.defineProperty(el, 'offsetLeft', { value: i * thumbWidth, configurable: true })
    Object.defineProperty(el, 'clientWidth', { value: thumbWidth, configurable: true })
  })
  return { strip, setScrollLeft: (v: number) => { scrollLeftVal = v } }
}

function fireWheel(strip: HTMLElement, deltaY: number, deltaX = 0): WheelEvent {
  const e = new Event('wheel', { cancelable: true, bubbles: true }) as WheelEvent
  Object.defineProperty(e, 'deltaY', { value: deltaY })
  Object.defineProperty(e, 'deltaX', { value: deltaX })
  strip.dispatchEvent(e)
  return e
}

// Root is now a direct grid child of PhotoLightbox's `.lightbox` grid
// (grid-area: strip) rather than a nested flex-row child of the removed `.lb-body` wrapper.
describe('PhotoFilmstrip structure: grid-area contract', () => {
  it('the .lb-strip rule includes grid-area: strip', () => {
    const m = /\.photos-root \.lb-strip\s*\{([^}]*)\}/.exec(PARITY_SRC)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/grid-area:\s*strip/)
  })
})

describe('PhotoFilmstrip rendering', () => {
  it('renders N thumbnails, the current index item has the data-active attribute (originally the .active boolean class, changed to [data-active])', () => {
    const w = mountFilmstrip(makeList(5), 2)
    const thumbs = w.findAll('.lb-thumb')
    expect(thumbs.length).toBe(5)
    thumbs.forEach((t, i) => { expect(t.attributes('data-active')).toBe(i === 2 ? 'true' : 'false') })
  })

  it('thumbnail src comes from service.photos.thumbnailUrl(id, "small"), loading=lazy', () => {
    const w = mountFilmstrip(makeList(2), 0)
    const imgs = w.findAll('.lb-thumb img')
    expect(imgs[0]!.attributes('src')).toBe('/v1/photos/assets/p0/thumbnail?size=small&token=t')
    expect(imgs[0]!.attributes('loading')).toBe('lazy')
  })

  it('video items show a badge (duration), image items do not', () => {
    const list = [makePhoto('v0', true, '1:23'), makePhoto('p1', false)]
    const w = mountFilmstrip(list, 0)
    const thumbs = w.findAll('.lb-thumb')
    expect(thumbs[0]!.find('.thumb-vid').exists()).toBe(true)
    expect(thumbs[0]!.text()).toContain('1:23')
    expect(thumbs[1]!.find('.thumb-vid').exists()).toBe(false)
  })
})

describe('PhotoFilmstrip click to page (absolute index)', () => {
  it('clicking the k-th thumbnail emits select(k) -- an absolute index, not a relative delta', async () => {
    const w = mountFilmstrip(makeList(4), 0)
    await w.findAll('.lb-thumb')[3]!.trigger('click')
    expect(w.emitted('select')).toEqual([[3]])
  })
})

describe('PhotoFilmstrip wheel → horizontal scroll + emits select for the centered item 140ms after settling', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('wheel accumulates scrollLeft, emits select (centered item index) 140ms after settling', async () => {
    const w = mountFilmstrip(makeList(6), 0)
    await nextTick() // wait for onMounted to attach the wheel listener
    const { strip, setScrollLeft } = stubGeometry(w, 100, 300)
    setScrollLeft(100)
    fireWheel(strip, 10) // scrollLeft: 100 -> 110; center 260, nearest is index2 (center 250)
    vi.advanceTimersByTime(140)
    expect(w.emitted('select')).toEqual([[2]])
  })

  it('wheel triggers preventDefault ({passive:false} takes effect)', async () => {
    const w = mountFilmstrip(makeList(3), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const e = fireWheel(strip, 10)
    expect(e.defaultPrevented).toBe(true)
  })

  it('scrolls by deltaX when deltaY is 0 but deltaX is non-zero', async () => {
    const w = mountFilmstrip(makeList(6), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const before = strip.scrollLeft
    fireWheel(strip, 0, 50)
    expect(strip.scrollLeft).toBe(before + 50)
  })

  it('does nothing when both deltaY and deltaX are 0 (no preventDefault, no horizontal scroll scheduled)', async () => {
    const w = mountFilmstrip(makeList(3), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const e = fireWheel(strip, 0, 0)
    expect(e.defaultPrevented).toBe(false)
  })

  it('does not re-emit select when the centered item index equals the current index', async () => {
    const w = mountFilmstrip(makeList(6), 1)
    await nextTick()
    const { strip, setScrollLeft } = stubGeometry(w, 100, 300)
    // index=1 thumbnail center=150; when scrollLeft=0 the strip's center=0+150=150 → the centered item is index1
    setScrollLeft(0)
    fireWheel(strip, 0.0001)
    vi.advanceTimersByTime(140)
    expect(w.emitted('select')).toBeUndefined()
  })

  it('another wheel event within 140ms resets the timer, emitting only once after the final settle', async () => {
    const w = mountFilmstrip(makeList(6), 0)
    await nextTick()
    const { strip, setScrollLeft } = stubGeometry(w, 100, 300)
    setScrollLeft(0)
    fireWheel(strip, 200) // scrollLeft -> 200, center 350 -> nearest index3 (center 350)
    vi.advanceTimersByTime(100)
    fireWheel(strip, 100) // scrollLeft -> 300, center 450 -> nearest index4 (center 450); timer reset
    vi.advanceTimersByTime(100)
    expect(w.emitted('select')).toBeUndefined() // the first timer was already interrupted, 140ms hasn't elapsed yet
    vi.advanceTimersByTime(40)
    expect(w.emitted('select')).toEqual([[4]])
  })
})

// Vue2 param alignment: Vue2 mounted() calls `centerActiveThumb()` with no
// argument -- the default `smooth = true` -- so every lightbox open smooth-scrolls the strip to
// the active thumbnail. This component previously passed `false` (instant) on mount with no
// documented reason; corrected to match. `HTMLElement.prototype.scrollTo` is stubbed globally
// (not per-element via stubGeometry) so the call made during onMounted -- before the test can
// reach into the mounted wrapper to stub the specific strip element -- is captured too.
describe('PhotoFilmstrip centers on mount (Vue2 mounted() param alignment)', () => {
  let scrollToSpy: ReturnType<typeof vi.fn<(...a: unknown[]) => void>>
  let restore: () => void

  beforeEach(() => {
    scrollToSpy = vi.fn<(...a: unknown[]) => void>()
    const proto = HTMLElement.prototype as unknown as { scrollTo: (...a: unknown[]) => void }
    const original = proto.scrollTo
    proto.scrollTo = ((...a: unknown[]) => scrollToSpy(...a)) as typeof proto.scrollTo
    restore = () => { proto.scrollTo = original }
  })
  afterEach(() => restore())

  it('calls scrollTo to center the current item on mount, with behavior smooth (not the previous instant)', () => {
    mountFilmstrip(makeList(5), 2)
    expect(scrollToSpy).toHaveBeenCalledTimes(1)
    const arg = scrollToSpy.mock.calls[0]![0] as { behavior: string }
    expect(arg.behavior).toBe('smooth')
  })
})

describe('PhotoFilmstrip centers the thumbnail when index changes (centerActiveThumb ported)', () => {
  it('calls strip.scrollTo to center the thumbnail after props.index changes', async () => {
    const w = mountFilmstrip(makeList(5), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const scrollToSpy = strip.scrollTo as unknown as ReturnType<typeof vi.fn>
    scrollToSpy.mockClear()
    await w.setProps({ index: 3 })
    await nextTick()
    expect(scrollToSpy).toHaveBeenCalled()
    const arg = scrollToSpy.mock.calls[0]![0] as { left: number }
    // target = el.offsetLeft(300) - (stripWidth(300)-thumbWidth(100))/2 = 300-100 = 200
    expect(arg.left).toBe(200)
  })
})

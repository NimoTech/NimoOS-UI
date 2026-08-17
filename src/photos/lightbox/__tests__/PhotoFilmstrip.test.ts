import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import PhotoFilmstrip from '../PhotoFilmstrip.vue'
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

// jsdom has no real layout engine — manually set each thumbnail's offsetLeft/clientWidth and strip's own
// clientWidth/scrollLeft/scrollTo, making geometric calculations in centerActiveThumb / findCenterThumbIndex testable
// (same Object.defineProperty technique as PhotoImageViewer.test.ts).
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

describe('PhotoFilmstrip rendering', () => {
  it('render N thumbnails, current index item has active class', () => {
    const w = mountFilmstrip(makeList(5), 2)
    const thumbs = w.findAll('.lb-thumb')
    expect(thumbs.length).toBe(5)
    thumbs.forEach((t, i) => { expect(t.classes('active')).toBe(i === 2) })
  })

  it('thumbnail src from service.photos.thumbnailUrl(id, "small"), loading=lazy', () => {
    const w = mountFilmstrip(makeList(2), 0)
    const imgs = w.findAll('.lb-thumb img')
    expect(imgs[0]!.attributes('src')).toBe('/v1/photos/assets/p0/thumbnail?size=small&token=t')
    expect(imgs[0]!.attributes('loading')).toBe('lazy')
  })

  it('video item shows badge (duration), image item does not', () => {
    const list = [makePhoto('v0', true, '1:23'), makePhoto('p1', false)]
    const w = mountFilmstrip(list, 0)
    const thumbs = w.findAll('.lb-thumb')
    expect(thumbs[0]!.find('.thumb-vid').exists()).toBe(true)
    expect(thumbs[0]!.text()).toContain('1:23')
    expect(thumbs[1]!.find('.thumb-vid').exists()).toBe(false)
  })
})

describe('PhotoFilmstrip click pagination (absolute index)', () => {
  it('click k-th thumbnail emit select(k) — absolute index, not relative delta', async () => {
    const w = mountFilmstrip(makeList(4), 0)
    await w.findAll('.lb-thumb')[3]!.trigger('click')
    expect(w.emitted('select')).toEqual([[3]])
  })
})

describe('PhotoFilmstrip wheel → horizontal scroll + center item emit select after 140ms release', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('wheel accumulates scrollLeft, settle 140ms later emit select (center item index)', async () => {
    const w = mountFilmstrip(makeList(6), 0)
    await nextTick() // wait for onMounted to attach wheel listener
    const { strip, setScrollLeft } = stubGeometry(w, 100, 300)
    setScrollLeft(100)
    fireWheel(strip, 10) // scrollLeft: 100 -> 110; center 260, closest is index2(center 250)
    vi.advanceTimersByTime(140)
    expect(w.emitted('select')).toEqual([[2]])
  })

  it('wheel triggers preventDefault({passive:false} effective)', async () => {
    const w = mountFilmstrip(makeList(3), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const e = fireWheel(strip, 10)
    expect(e.defaultPrevented).toBe(true)
  })

  it('deltaY is 0 but deltaX non-zero: scroll by deltaX', async () => {
    const w = mountFilmstrip(makeList(6), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const before = strip.scrollLeft
    fireWheel(strip, 0, 50)
    expect(strip.scrollLeft).toBe(before + 50)
  })

  it('deltaY and deltaX both zero: no handling (no preventDefault, allow horizontal scroll)', async () => {
    const w = mountFilmstrip(makeList(3), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const e = fireWheel(strip, 0, 0)
    expect(e.defaultPrevented).toBe(false)
  })

  it('center item index same as current index: does not emit select again', async () => {
    const w = mountFilmstrip(makeList(6), 1)
    await nextTick()
    const { strip, setScrollLeft } = stubGeometry(w, 100, 300)
    // index=1 thumbnail center=150; scrollLeft=0 strip center=0+150=150 → center item is index1
    setScrollLeft(0)
    fireWheel(strip, 0.0001)
    vi.advanceTimersByTime(140)
    expect(w.emitted('select')).toBeUndefined()
  })

  it('wheel event within 140ms: timer resets, emit once only after final release', async () => {
    const w = mountFilmstrip(makeList(6), 0)
    await nextTick()
    const { strip, setScrollLeft } = stubGeometry(w, 100, 300)
    setScrollLeft(0)
    fireWheel(strip, 200) // scrollLeft -> 200, center 350 -> closest index3(center 350)
    vi.advanceTimersByTime(100)
    fireWheel(strip, 100) // scrollLeft -> 300, center 450 -> closest index4(center 450); timer resets
    vi.advanceTimersByTime(100)
    expect(w.emitted('select')).toBeUndefined() // first timer interrupted, not yet 140ms
    vi.advanceTimersByTime(40)
    expect(w.emitted('select')).toEqual([[4]])
  })
})

describe('PhotoFilmstrip center thumbnail on index change (centerActiveThumb ported)', () => {
  it('after props.index changes, call strip.scrollTo to center that thumbnail', async () => {
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

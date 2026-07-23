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

// jsdom 没有真实布局引擎——手动铺设每张缩略图的 offsetLeft/clientWidth 和条带
// 自身的 clientWidth/scrollLeft/scrollTo,让 centerActiveThumb / findCenterThumbIndex
// 的几何计算可测(同 PhotoImageViewer.test.ts 的 Object.defineProperty 手法)。
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

describe('PhotoFilmstrip 渲染', () => {
  it('渲染 N 个缩略图,当前 index 项有 active class', () => {
    const w = mountFilmstrip(makeList(5), 2)
    const thumbs = w.findAll('.lb-thumb')
    expect(thumbs.length).toBe(5)
    thumbs.forEach((t, i) => { expect(t.classes('active')).toBe(i === 2) })
  })

  it('缩略图 src 来自 service.photos.thumbnailUrl(id, "small"), loading=lazy', () => {
    const w = mountFilmstrip(makeList(2), 0)
    const imgs = w.findAll('.lb-thumb img')
    expect(imgs[0]!.attributes('src')).toBe('/v1/photos/assets/p0/thumbnail?size=small&token=t')
    expect(imgs[0]!.attributes('loading')).toBe('lazy')
  })

  it('视频项显示角标(时长),图片项不显示', () => {
    const list = [makePhoto('v0', true, '1:23'), makePhoto('p1', false)]
    const w = mountFilmstrip(list, 0)
    const thumbs = w.findAll('.lb-thumb')
    expect(thumbs[0]!.find('.thumb-vid').exists()).toBe(true)
    expect(thumbs[0]!.text()).toContain('1:23')
    expect(thumbs[1]!.find('.thumb-vid').exists()).toBe(false)
  })
})

describe('PhotoFilmstrip 点击翻页(绝对 index)', () => {
  it('点第 k 个缩略图 emit select(k)——绝对下标,非相对 delta', async () => {
    const w = mountFilmstrip(makeList(4), 0)
    await w.findAll('.lb-thumb')[3]!.trigger('click')
    expect(w.emitted('select')).toEqual([[3]])
  })
})

describe('PhotoFilmstrip 滚轮 → 横向滚动 + 停手 140ms 后居中项 emit select', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('滚轮累加 scrollLeft,settle 140ms 后 emit select(居中项索引)', async () => {
    const w = mountFilmstrip(makeList(6), 0)
    await nextTick() // 等 onMounted 挂上 wheel 监听
    const { strip, setScrollLeft } = stubGeometry(w, 100, 300)
    setScrollLeft(100)
    fireWheel(strip, 10) // scrollLeft: 100 -> 110;中心 260,最近的是 index2(中心250)
    vi.advanceTimersByTime(140)
    expect(w.emitted('select')).toEqual([[2]])
  })

  it('wheel 触发 preventDefault({passive:false} 生效)', async () => {
    const w = mountFilmstrip(makeList(3), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const e = fireWheel(strip, 10)
    expect(e.defaultPrevented).toBe(true)
  })

  it('deltaY 为 0 但 deltaX 非 0 时按 deltaX 滚动', async () => {
    const w = mountFilmstrip(makeList(6), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const before = strip.scrollLeft
    fireWheel(strip, 0, 50)
    expect(strip.scrollLeft).toBe(before + 50)
  })

  it('deltaY 与 deltaX 都为 0 时不处理(不 preventDefault,不排横向滚动)', async () => {
    const w = mountFilmstrip(makeList(3), 0)
    await nextTick()
    const { strip } = stubGeometry(w, 100, 300)
    const e = fireWheel(strip, 0, 0)
    expect(e.defaultPrevented).toBe(false)
  })

  it('居中项索引与当前 index 相同时不重复 emit select', async () => {
    const w = mountFilmstrip(makeList(6), 1)
    await nextTick()
    const { strip, setScrollLeft } = stubGeometry(w, 100, 300)
    // index=1 缩略图中心=150;scrollLeft=0 时条带中心=0+150=150 → 居中项就是 index1
    setScrollLeft(0)
    fireWheel(strip, 0.0001)
    vi.advanceTimersByTime(140)
    expect(w.emitted('select')).toBeUndefined()
  })

  it('140ms 内又发生滚轮:计时器重置,只在最后一次停手后 emit 一次', async () => {
    const w = mountFilmstrip(makeList(6), 0)
    await nextTick()
    const { strip, setScrollLeft } = stubGeometry(w, 100, 300)
    setScrollLeft(0)
    fireWheel(strip, 200) // scrollLeft -> 200,中心 350 -> 最近 index3(中心350)
    vi.advanceTimersByTime(100)
    fireWheel(strip, 100) // scrollLeft -> 300,中心 450 -> 最近 index4(中心450);计时器重置
    vi.advanceTimersByTime(100)
    expect(w.emitted('select')).toBeUndefined() // 第一次计时器已被打断,尚未到 140ms
    vi.advanceTimersByTime(40)
    expect(w.emitted('select')).toEqual([[4]])
  })
})

describe('PhotoFilmstrip index 变化时把该缩略图居中(centerActiveThumb 移植)', () => {
  it('props.index 变化后调用 strip.scrollTo 把该缩略图居中', async () => {
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

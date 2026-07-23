// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosGrid.vue (348 lines).
// P1 scope cuts + URL-builder delta per task-7-brief.md:
//  - thumbnailSrc/hoverVideoSrc/spriteUrl go through the shared `service.photos.*`
//    package (mocked below), never hand-built `/v1/...` strings.
//  - spriteMeta resolves { frames, durationMs, frameW, frameH } directly (no
//    {ok,stale,url} envelope) — the component itself must guard staleness via
//    hoverToken, matching Vue2's loadSpriteMeta semantics.
//  - selectbar renders ONLY delete + cancel (favorite/album/ask-nimo cut to P3/P4/SP8).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    previewUrl: vi.fn((id: string | number) => `mock://preview/${id}`),
    spriteUrl: vi.fn((id: string | number) => `mock://sprite/${id}`),
    spriteMeta: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosGrid from '../PhotosGrid.vue'
import VideoHoverPreview from '../VideoHoverPreview.vue'
import { assetToPhoto, type Month, type Photo } from '../../util/assetToPhoto'

function photo(id: string, opts: Partial<{ isVideo: boolean; hasOcr: boolean; durationMs: number }> = {}): Photo {
  return assetToPhoto({
    id,
    mimeType: opts.isVideo ? 'video/mp4' : 'image/jpeg',
    hasOcr: opts.hasOcr,
    durationMs: opts.durationMs,
  })
}

function month(key: string, title: string, photos: Photo[]): Month {
  return { key, title, loc: '', photos }
}

beforeEach(() => {
  vi.clearAllMocks()
  svc.photos.thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
  svc.photos.previewUrl.mockImplementation((id: string | number) => `mock://preview/${id}`)
  svc.photos.spriteUrl.mockImplementation((id: string | number) => `mock://sprite/${id}`)
})

describe('PhotosGrid', () => {
  it('renders one .month-group per month (with title) that has at least one filtered item', () => {
    const months = [
      month('2026-07', 'July 2026', [photo('a'), photo('b')]),
      month('2026-06', 'June 2026', [photo('c')]),
    ]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
    expect(w.findAll('.month-group')).toHaveLength(2)
    expect(w.text()).toContain('July 2026')
    expect(w.text()).toContain('June 2026')
  })

  it('empty months are not rendered as a group at all', () => {
    const months = [month('2026-07', 'July 2026', [])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
    expect(w.find('.month-group').exists()).toBe(false)
  })

  it('tab=video filters down to only isVideo photos across all months', () => {
    const months = [
      month('2026-07', 'July 2026', [photo('a'), photo('b', { isVideo: true })]),
      month('2026-06', 'June 2026', [photo('c')]),
    ]
    const w = mount(PhotosGrid, { props: { months, tab: 'video', density: 'comfortable', selected: [] } })
    const tiles = w.findAll('.tile')
    expect(tiles).toHaveLength(1)
    expect(w.findAll('.month-group')).toHaveLength(1) // June group has 0 filtered videos -> not rendered
  })

  it('shows the empty-state copy when there are no items to show at all', () => {
    const w = mount(PhotosGrid, { props: { months: [], tab: 'all', density: 'comfortable', selected: [] } })
    expect(w.text()).toContain('暂无照片')
  })

  it('thumbnail <img> src is built via service.photos.thumbnailUrl(id, "small")', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('a', 'small')
    expect(w.get('img').attributes('src')).toBe('mock://thumb/a/small')
  })

  it('clicking the tile checkbox emits toggle-select with the photo id, not open', async () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
    await w.get('.tile-checkbox').trigger('click')
    expect(w.emitted('toggle-select')?.[0]).toEqual(['a'])
    expect(w.emitted('open')).toBeUndefined()
  })

  it('when selecting (selected non-empty), clicking the tile itself also toggles instead of opening', async () => {
    const months = [month('2026-07', 'July 2026', [photo('a'), photo('b')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: ['b'] } })
    await w.findAll('.tile')[0].trigger('click')
    expect(w.emitted('toggle-select')?.[0]).toEqual(['a'])
    expect(w.emitted('open')).toBeUndefined()
  })

  it('when not selecting, clicking a tile emits open(photo, undefined, startMs=0) for a non-video photo', async () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
    await w.get('.tile').trigger('click')
    const evt = w.emitted('open')?.[0]
    expect(evt?.[0]).toMatchObject({ id: 'a' })
    expect(evt?.[1]).toBeUndefined()
    expect(evt?.[2]).toBe(0)
  })

  it('selectbar is absent when nothing is selected', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
    expect(w.find('.selectbar').exists()).toBe(false)
  })

  it('selectbar renders exactly two buttons (delete, cancel); delete emits a COPY of the selected ids', async () => {
    const months = [month('2026-07', 'July 2026', [photo('a'), photo('b')])]
    const selected = ['a', 'b']
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected } })
    const bar = w.get('.selectbar')
    const buttons = bar.findAll('button')
    expect(buttons).toHaveLength(2)

    await buttons[0].trigger('click')
    const emittedIds = w.emitted('batch-delete')?.[0]?.[0] as unknown[]
    expect(emittedIds).toEqual(['a', 'b'])
    expect(emittedIds).not.toBe(selected) // must be a copy, not the same array reference

    await buttons[1].trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
  })

  it('hovering a video tile for less than 300ms and leaving never calls spriteMeta (debounce)', async () => {
    vi.useFakeTimers()
    try {
      const months = [month('2026-07', 'July 2026', [photo('v', { isVideo: true, durationMs: 5000 })])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      const tile = w.get('.tile')
      await tile.trigger('mouseenter')
      vi.advanceTimersByTime(200)
      await tile.trigger('mouseleave')
      vi.advanceTimersByTime(1000)
      expect(svc.photos.spriteMeta).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('hovering past 300ms calls spriteMeta exactly once and shows the hover preview', async () => {
    vi.useFakeTimers()
    try {
      svc.photos.spriteMeta.mockResolvedValueOnce({ frames: 12, durationMs: 5000, frameW: 240, frameH: 135 })
      const months = [month('2026-07', 'July 2026', [photo('v', { isVideo: true, durationMs: 5000 })])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      const tile = w.get('.tile')
      await tile.trigger('mouseenter')
      vi.advanceTimersByTime(300)
      await flushPromises()
      expect(svc.photos.spriteMeta).toHaveBeenCalledTimes(1)
      expect(svc.photos.spriteMeta).toHaveBeenCalledWith('v')
      const preview = w.findComponent(VideoHoverPreview)
      expect(preview.exists()).toBe(true)
      expect(preview.props('spriteUrl')).toBe('mock://sprite/v')
      expect(preview.props('frameCount')).toBe(12) // mapped from spriteMeta's `frames` field
    } finally {
      vi.useRealTimers()
    }
  })

  it('a spriteMeta reply that resolves AFTER the user has left (stale token) is discarded, not written to state', async () => {
    vi.useFakeTimers()
    try {
      const resolvers: Array<(v: { frames: number; durationMs: number; frameW: number; frameH: number }) => void> = []
      svc.photos.spriteMeta.mockImplementation(
        () => new Promise(res => { resolvers.push(res) }),
      )
      const months = [month('2026-07', 'July 2026', [photo('v', { isVideo: true, durationMs: 5000 })])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      const tile = w.get('.tile')

      // First hover session: debounce elapses, request goes out, but never resolves yet.
      await tile.trigger('mouseenter')
      vi.advanceTimersByTime(300)
      await flushPromises()
      expect(svc.photos.spriteMeta).toHaveBeenCalledTimes(1)

      // User leaves before the network replies -> hoverToken bumped, preview closed.
      await tile.trigger('mouseleave')
      await nextTick()
      expect(w.findComponent(VideoHoverPreview).exists()).toBe(false)

      // Stale reply arrives late, carrying deliberately-wrong data.
      resolvers[0]({ frames: 24, durationMs: 9999, frameW: 999, frameH: 999 })
      await flushPromises()
      // Discarding a stale reply must not resurrect the preview or throw.
      expect(w.findComponent(VideoHoverPreview).exists()).toBe(false)

      // Second (fresh) hover session must start from clean defaults, not the
      // discarded 24/9999/999 — proves the stale write never landed in state.
      await tile.trigger('mouseenter')
      vi.advanceTimersByTime(300)
      await flushPromises()
      expect(svc.photos.spriteMeta).toHaveBeenCalledTimes(2)
      const preview = w.findComponent(VideoHoverPreview)
      expect(preview.exists()).toBe(true)
      expect(preview.props('frameCount')).not.toBe(24)
      expect(preview.props('durationMs')).not.toBe(9999)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a spriteMeta error closes the preview and does not throw', async () => {
    vi.useFakeTimers()
    try {
      svc.photos.spriteMeta.mockRejectedValueOnce(new Error('network down'))
      const months = [month('2026-07', 'July 2026', [photo('v', { isVideo: true, durationMs: 5000 })])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      const tile = w.get('.tile')
      await tile.trigger('mouseenter')
      vi.advanceTimersByTime(300)
      await flushPromises()
      expect(w.findComponent(VideoHoverPreview).exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

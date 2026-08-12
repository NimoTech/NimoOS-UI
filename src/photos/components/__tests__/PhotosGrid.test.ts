// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosGrid.vue (348 lines).
// P1 scope cuts + URL-builder delta per task-7-brief.md:
//  - thumbnailSrc/hoverVideoSrc/spriteUrl go through the shared `service.photos.*`
//    package (mocked below), never hand-built `/v1/...` strings.
//  - spriteMeta resolves { frames, durationMs, frameW, frameH } directly (no
//    {ok,stale,url} envelope) — the component itself must guard staleness via
//    hoverToken, matching Vue2's loadSpriteMeta semantics.
//  - the selection action bar lives out of this component entirely — it lives in
//    the parent as PhotosSelectionToolbar.vue, so this component no longer emits
//    batch-delete/cancel.
//  - Task 6 (网格重刻): the per-tile checkbox was briefly (SP7 acceptance feedback)
//    the Files-region native-checkbox pattern (`.tile-check`/`.tile-check-box`
//    <input>) — Task 6 supersedes that with Vue2's own `.tile-checkbox` div
//    (click-to-toggle, no native <input>). Likewise the favorite star splits
//    into Vue2's two elements: a decorative `.tile-fav` (shown only when
//    favorited AND not selecting) and the actual click target, `.tile-act`
//    inside `.tile-actions`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    previewUrl: vi.fn((id: string | number) => `mock://preview/${id}`),
    spriteUrl: vi.fn((id: string | number) => `mock://sprite/${id}`),
    spriteMeta: vi.fn(),
    listFavoriteIds: vi.fn<() => Promise<Array<string | number>>>(() => Promise.resolve([])),
    favorite: vi.fn(() => Promise.resolve()),
    unfavorite: vi.fn(() => Promise.resolve()),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosGrid from '../PhotosGrid.vue'
import VideoHoverPreview from '../VideoHoverPreview.vue'
import { assetToPhoto, type Month, type Photo } from '../../util/assetToPhoto'
import { usePhotosFavorites } from '../../stores/favorites'

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
  svc.photos.listFavoriteIds.mockImplementation(() => Promise.resolve([]))
  svc.photos.favorite.mockImplementation(() => Promise.resolve())
  svc.photos.unfavorite.mockImplementation(() => Promise.resolve())
  // PhotosGrid consumes usePhotosFavorites() unconditionally at setup — every
  // mount needs an active pinia, even tests that don't touch favorites at all.
  setActivePinia(createPinia())
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

  it("a month group with key 'unknown' renders the i18n photosUnknownDate label instead of m.title (Fix 5a)", () => {
    // groupToMonth hardcodes title='Unknown Date' (English) for month===0 groups
    // — PhotosGrid must override that with the localized key at render time.
    const months = [month('unknown', 'Unknown Date', [photo('a')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
    expect(w.get('.month-title').text()).toBe('未知日期')
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

  it('the tile checkbox is Vue2\'s clickable .tile-checkbox div, not a native <input>', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
    const box = w.get('.tile-checkbox')
    expect(box.element.tagName).not.toBe('INPUT')
    expect(w.find('input[type="checkbox"]').exists()).toBe(false)
    expect(w.find('.tile-check').exists()).toBe(false)
    expect(w.find('.tile-check-box').exists()).toBe(false)
  })

  // P6b-T9: `selectable` prop (偏离登记 14) —— 地点照片页(D10)不接多选,复用本组件时不该
  // 有复选框。默认值必须保持 true,否则 Photos.vue/PhotosFavorites.vue 这两个既有消费方
  // (都不传 selectable)会静默丢失复选框——这条是纯粹的默认值回归断言。
  it('not passing `selectable` at all still renders .tile-checkbox (default-value regression for existing consumers)', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
    expect(w.find('.tile-checkbox').exists()).toBe(true)
  })

  it('selectable=false hides .tile-checkbox and leaves no way to fire toggle-select via it', async () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [], selectable: false } })
    expect(w.find('.tile-checkbox').exists()).toBe(false)
    // Clicking the bare tile still opens (selected is empty), confirming the checkbox's
    // absence doesn't leave the tile in some half-selecting state.
    await w.get('.tile').trigger('click')
    expect(w.emitted('open')).toBeTruthy()
    expect(w.emitted('toggle-select')).toBeUndefined()
  })

  it('clicking the tile checkbox emits toggle-select with the photo id, not open, and does not bubble to the tile click handler', async () => {
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

  it('PhotosGrid no longer renders any selection action bar itself (moved to the parent as PhotosSelectionToolbar)', () => {
    const months = [month('2026-07', 'July 2026', [photo('a'), photo('b')])]
    const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: ['a', 'b'] } })
    expect(w.find('.selectbar').exists()).toBe(false)
    expect(w.find('.selection-toolbar').exists()).toBe(false)
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

  it('keeps the hover preview mounted after a timeline refresh rebuilds the photo object (match by id, not reference)', async () => {
    // Regression (SP7-P1 acceptance): the timeline's quiet refresh (index poll)
    // replaces `timelineGroups`, so assetToPhoto rebuilds each Photo as a NEW
    // object with the SAME id. The old `hoveredVideo === p` reference check then
    // went false and the preview silently unmounted (Vue2 kept refs stable; Vue3
    // does not). The v-if must match on the stable id instead.
    vi.useFakeTimers()
    try {
      svc.photos.spriteMeta.mockResolvedValue({ frames: 12, durationMs: 5000, frameW: 240, frameH: 135 })
      const months1 = [month('2026-07', 'July 2026', [photo('v', { isVideo: true, durationMs: 5000 })])]
      const w = mount(PhotosGrid, { props: { months: months1, tab: 'all', density: 'comfortable', selected: [] } })
      await w.get('.tile').trigger('mouseenter')
      vi.advanceTimersByTime(300)
      await flushPromises()
      expect(w.findComponent(VideoHoverPreview).exists()).toBe(true)

      // Simulate the quiet refresh: same id 'v', brand-new object reference.
      const months2 = [month('2026-07', 'July 2026', [photo('v', { isVideo: true, durationMs: 5000 })])]
      expect(months2[0].photos[0]).not.toBe(months1[0].photos[0]) // sanity: reference changed
      await w.setProps({ months: months2 })
      await nextTick()
      // Reference equality would have unmounted it here; id equality keeps it.
      expect(w.findComponent(VideoHoverPreview).exists()).toBe(true)
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

  it('clicking a video tile after the hover preview is visible reads startMs via hoverPreviewRef without throwing (ref_for array normalization)', async () => {
    // Regression test for Fix 1: ref="hoverPreviewRef" sits inside v-for
    // (ref_for) so at runtime Vue populates it as an ARRAY of instances, not
    // a single instance. onTileClick must normalize `[].concat(ref||[])[0]`
    // like Vue2 did — calling `.currentPreviewTimeMs()` directly on the raw
    // (array) ref throws a TypeError.
    vi.useFakeTimers()
    try {
      svc.photos.spriteMeta.mockResolvedValueOnce({ frames: 10, durationMs: 5000, frameW: 240, frameH: 135 })
      const months = [month('2026-07', 'July 2026', [photo('v', { isVideo: true, durationMs: 5000 })])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      const tile = w.get('.tile')
      await tile.trigger('mouseenter')
      vi.advanceTimersByTime(300)
      await flushPromises()
      expect(w.findComponent(VideoHoverPreview).exists()).toBe(true)

      await expect(tile.trigger('click')).resolves.not.toThrow()

      const evt = w.emitted('open')?.[0]
      expect(evt).toBeTruthy()
      expect(typeof evt?.[2]).toBe('number')
      expect(Number.isNaN(evt?.[2] as number)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('captures startMs after a timeline refresh rebuilds the hovered video object (match by id, not reference)', async () => {
    // Regression (SP7-P2 real-machine acceptance): onTileClick guarded the
    // start-position capture with `hoveredVideo === p` (object reference). The
    // quiet index-poll refresh rebuilds the Photo as a NEW object with the SAME
    // id on the same keyed DOM node (no mouseleave fires), so the reference
    // check went false and startMs collapsed to 0 — the lightbox opened the
    // video from the start instead of the hovered position. Must match on id.
    vi.useFakeTimers()
    try {
      svc.photos.spriteMeta.mockResolvedValue({ frames: 10, durationMs: 5000, frameW: 240, frameH: 135 })
      const months1 = [month('2026-07', 'July 2026', [photo('v', { isVideo: true, durationMs: 5000 })])]
      const w = mount(PhotosGrid, { props: { months: months1, tab: 'all', density: 'comfortable', selected: [] } })
      const tile = w.get('.tile')
      await tile.trigger('mouseenter')
      vi.advanceTimersByTime(300)
      await flushPromises()
      expect(w.findComponent(VideoHoverPreview).exists()).toBe(true)
      // let the sprite auto-advance move the playhead off frame 0 so startMs > 0
      vi.advanceTimersByTime(450)
      await nextTick()

      // Quiet refresh: same id 'v', brand-new object reference on the same node.
      const months2 = [month('2026-07', 'July 2026', [photo('v', { isVideo: true, durationMs: 5000 })])]
      expect(months2[0].photos[0]).not.toBe(months1[0].photos[0]) // sanity: reference changed
      await w.setProps({ months: months2 })
      await nextTick()

      await tile.trigger('click')
      const events = w.emitted('open') as unknown[][]
      const startMs = events[events.length - 1][2] as number
      // reference-equality guard yields 0 here; id-equality preserves the hovered position
      expect(startMs).toBeGreaterThan(0)
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

  // Task 6 (网格重刻): Vue2 PhotosGrid.vue:65-76 splits favoriting into TWO elements —
  // a decorative bottom-left `.tile-fav` (v-if="p.fav && !selecting", no click handler)
  // and the actual click target, a top-right `.tile-act` button inside `.tile-actions`
  // (always present, hover-visible via CSS, `data-on` reflects fav state). This
  // supersedes the pre-Task-6 shape where `.tile-fav` itself was the single, always-
  // rendered, clickable toggle.
  describe('per-tile favorite star (SP7-P3 Task 5, re-skinned to Vue2\'s split shape in Task 6)', () => {
    it('a favorited photo renders the decorative .tile-fav badge (value comparison via fav.isFav(id), not object identity)', async () => {
      svc.photos.listFavoriteIds.mockResolvedValueOnce(['a'])
      const fav = usePhotosFavorites()
      await fav.reconcileFavIds()
      const months = [month('2026-07', 'July 2026', [photo('a')])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      expect(w.find('.tile-fav').exists()).toBe(true)
    })

    it('an unfavorited photo renders no .tile-fav badge at all', () => {
      const months = [month('2026-07', 'July 2026', [photo('b')])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      expect(w.find('.tile-fav').exists()).toBe(false)
    })

    // Vue2 PhotosGrid.vue:65 `v-if="p.fav && !selecting"` — the decorative badge yields
    // the corner to the checkbox once selection starts, even for an already-favorited photo.
    it('hides the decorative .tile-fav badge while selecting, even for a favorited photo', async () => {
      svc.photos.listFavoriteIds.mockResolvedValueOnce(['a'])
      const fav = usePhotosFavorites()
      await fav.reconcileFavIds()
      const months = [month('2026-07', 'July 2026', [photo('a'), photo('b')])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: ['b'] } })
      expect(w.find('.tile-fav').exists()).toBe(false)
    })

    it('the interactive .tile-act toggle is always present, favorited or not', () => {
      const months = [month('2026-07', 'July 2026', [photo('a')])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      expect(w.find('.tile-act').exists()).toBe(true)
    })

    it('.tile-act reflects fav state via data-on', async () => {
      svc.photos.listFavoriteIds.mockResolvedValueOnce(['a'])
      const fav = usePhotosFavorites()
      await fav.reconcileFavIds()
      const months = [month('2026-07', 'July 2026', [photo('a'), photo('b')])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      const acts = w.findAll('.tile-act')
      expect(acts[0].attributes('data-on')).toBe('true')
      expect(acts[1].attributes('data-on')).toBe('false')
    })

    it('clicking .tile-act calls fav.toggle(id) and does not bubble to open/toggle-select (@click.stop)', async () => {
      const fav = usePhotosFavorites()
      const spy = vi.spyOn(fav, 'toggle').mockResolvedValue()
      const months = [month('2026-07', 'July 2026', [photo('a')])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      await w.get('.tile-act').trigger('click')
      expect(spy).toHaveBeenCalledWith('a')
      expect(w.emitted('open')).toBeUndefined()
      expect(w.emitted('toggle-select')).toBeUndefined()
    })

    it('clicking .tile-act while selecting still toggles favorite, not selection', async () => {
      const fav = usePhotosFavorites()
      const spy = vi.spyOn(fav, 'toggle').mockResolvedValue()
      const months = [month('2026-07', 'July 2026', [photo('a'), photo('b')])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: ['b'] } })
      await w.findAll('.tile-act')[0].trigger('click')
      expect(spy).toHaveBeenCalledWith('a')
      expect(w.emitted('toggle-select')).toBeUndefined()
    })

    it('.tile-act aria-label switches between photosFavorite and photosUnfavorite based on fav state', async () => {
      svc.photos.listFavoriteIds.mockResolvedValueOnce(['a'])
      const fav = usePhotosFavorites()
      await fav.reconcileFavIds()
      const months = [month('2026-07', 'July 2026', [photo('a'), photo('b')])]
      const w = mount(PhotosGrid, { props: { months, tab: 'all', density: 'comfortable', selected: [] } })
      const acts = w.findAll('.tile-act')
      expect(acts[0].attributes('aria-label')).toBe('取消收藏')
      expect(acts[1].attributes('aria-label')).toBe('收藏')
    })
  })
})

function bucketMonth(key: string, title: string, count: number, videoCount = 0): Month {
  return { key, title, loc: '', photos: [], loaded: false, count, videoCount }
}

describe('PhotosGrid bucket-mode skeletons', () => {
  it('renders a sized skeleton for an unloaded month instead of the empty state', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'photo' } })
    await nextTick()
    expect(w.find('[data-test="empty-state"]').exists()).toBe(false)
    const sk = w.find('[data-test="month-skeleton"]')
    expect(sk.exists()).toBe(true)
    expect(Number.parseFloat(sk.attributes('style')?.match(/height:\s*([\d.]+)px/)?.[1] ?? '0')).toBeGreaterThan(0)
  })

  it('keeps the month head visible on a skeleton, with the estimated count', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'photo' } })
    await nextTick()
    expect(w.find('.month-title').text()).toBe('August 2026')
    // photo tab estimate = count - videoCount = 9
    expect(w.find('.month-count').text()).toContain('9')
  })

  it('renders the month container so jump anchors exist before anything loads', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12)], tab: 'photo' } })
    await nextTick()
    expect(w.find('#m-2026-08').exists()).toBe(true)
  })

  it('keeps the scrubber visible while every month is still a skeleton', async () => {
    const w = mount(PhotosGrid, {
      props: { months: [bucketMonth('2026-08', 'August 2026', 12), bucketMonth('2026-07', 'July 2026', 4)], tab: 'photo' },
    })
    await nextTick()
    expect(w.find('.scrubber').exists()).toBe(true)
    expect(w.findAll('.scrubber-tick').length).toBeGreaterThan(0)
  })

  // Whole-branch review, Important 6: this used to assert the opposite — no
  // container and the "No photos" empty state — which is the defect, not a
  // limitation: with no container there is nothing for the observer to watch, so
  // `need-bucket` was never emitted and the tab claimed the library had no
  // documents forever (reachable on first paint via ?tab=ocr). The directory
  // still cannot count OCR items, so the head prints no count and the body is a
  // one-row stand-in (spec §5.4, reworded to match).
  it('keeps an unloaded month on the ocr tab loadable, with no invented count', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'ocr' } })
    await nextTick()
    expect(w.find('[data-test="empty-state"]').exists()).toBe(false)
    expect(w.find('#m-2026-08').exists()).toBe(true)
    expect(w.find('.month-title').text()).toBe('August 2026')
    // No OCR counter exists, so no count is printed at all — "0 items" would be a
    // guess dressed up as a fact.
    expect(w.find('.month-count').exists()).toBe(false)
    const sk = w.find('[data-test="month-skeleton"]')
    expect(sk.exists()).toBe(true)
    expect(Number.parseFloat(sk.attributes('style')?.match(/height:\s*([\d.]+)px/)?.[1] ?? '0')).toBeGreaterThan(0)
  })

  it('drops the month again once it is loaded and really has nothing for the ocr tab', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'ocr' } })
    await nextTick()
    // The bucket arrives and holds no documents: the container was only ever a
    // loading vehicle, so the tab is now honestly empty.
    await w.setProps({
      months: [{
        key: '2026-08', title: 'August 2026', loc: '',
        photos: [photo('a1')], loaded: true, count: 1, videoCount: 0,
      }],
    })
    await nextTick()
    expect(w.find('#m-2026-08').exists()).toBe(false)
    expect(w.find('[data-test="empty-state"]').exists()).toBe(true)
  })

  it('still shows the empty state when there are no months at all', async () => {
    const w = mount(PhotosGrid, { props: { months: [], tab: 'photo' } })
    await nextTick()
    expect(w.find('[data-test="empty-state"]').exists()).toBe(true)
  })

  it('renders real tiles once a month is loaded', async () => {
    const m: Month = { key: '2026-08', title: 'August 2026', loc: '', photos: [photo('a1')], loaded: true, count: 1, videoCount: 0 }
    const w = mount(PhotosGrid, { props: { months: [m], tab: 'photo' } })
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
  })

  it('leaves legacy month groups (no loaded field) rendering exactly as before', async () => {
    const w = mount(PhotosGrid, { props: { months: [month('2026-08', 'August 2026', [photo('a1')])], tab: 'photo' } })
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
  })

  // SP15-P3-T8: the tick's disabled state must come from the SAME array the
  // template renders month containers from (filteredMonths), not the raw
  // props.months — otherwise a month hidden by the current tab still gets a
  // clickable tick that jumps nowhere.
  //
  // Two months are needed: the hidden one contributes no container, so with only
  // that one the scrubber's own v-if would remove the whole block and there would
  // be no ticks to assert on. matchesTab requires `hasOcr: true` for the literal
  // 'ocr' tab, so the "has content on this tab" month must carry it — a plain
  // photo would NOT match under 'ocr', leaving both months contentless and the
  // scrubber unmounted.
  //
  // The hidden month has to be a LOADED one whose assets simply do not match the
  // tab. An *unloaded* month is no longer hidden on the ocr tab (whole-branch
  // review, Important 6: its container is what drives the load), so it would no
  // longer be a hidden month at all and this test would be asserting nothing.
  it('disables the tick of a month the current tab hides', async () => {
    const ocrMonth: Month = {
      key: '2026-09', title: 'September 2026', loc: '',
      photos: [photo('d1', { hasOcr: true })], loaded: true, count: 1, videoCount: 0,
    }
    const hiddenMonth: Month = {
      key: '2026-08', title: 'August 2026', loc: '',
      photos: [photo('a1')], loaded: true, count: 1, videoCount: 0,
    }
    const w = mount(PhotosGrid, {
      props: { months: [ocrMonth, hiddenMonth], tab: 'ocr' },
    })
    await nextTick()
    const tick = w.findAll('.scrubber-tick').find((t) => t.attributes('data-major') !== 'true' && t.text() === 'Aug')
    expect(tick?.attributes('data-disabled')).toBe('true')
  })
})

class FakeIO {
  static instances: FakeIO[] = []
  cb: IntersectionObserverCallback
  targets: Element[] = []
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; FakeIO.instances.push(this) }
  observe(el: Element) { this.targets.push(el) }
  unobserve(el: Element) { this.targets = this.targets.filter((t) => t !== el) }
  disconnect() { this.targets = [] }
  takeRecords(): IntersectionObserverEntry[] { return [] }
  fire(el: Element, isIntersecting: boolean) {
    this.cb(
      [{ target: el, isIntersecting } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
  // A browser only ever notifies about elements that are actually being observed.
  // Tests about *registration* must go through this rather than fire(), or they
  // would prove nothing: fire() delivers a notification for an element the real
  // observer would never have reported on.
  fireIfObserved(el: Element, isIntersecting: boolean) {
    if (!this.targets.includes(el)) return
    this.fire(el, isIntersecting)
  }
}

describe('PhotosGrid windowing', () => {
  beforeEach(() => {
    FakeIO.instances = []
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO
  })
  afterEach(() => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
    vi.restoreAllMocks()
  })

  const loadedMonth = (key: string, ids: string[]): Month => ({
    key, title: key, loc: '', photos: ids.map((id) => photo(id)), loaded: true, count: ids.length, videoCount: 0,
  })

  // jsdom has no layout engine — offsetHeight is 0 for every element. These tests
  // are about WHICH element gets measured, so a constant stub would prove nothing
  // (it answers the same for the group and for its body). This models the real box
  // tree instead: a `.month-group` is its head plus whichever body is currently
  // mounted, and that body is either the tiles or the placeholder that replaced
  // them. It is the only way to see the double-count and the ratchet from jsdom.
  const HEAD_H = 32
  const GRID_H = 321
  function installLayoutModel() {
    return vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('grid')) return GRID_H
      if (this.classList.contains('month-placeholder')) return Number.parseFloat(this.style.height) || 0
      if (this.classList.contains('month-skeleton')) return Number.parseFloat(this.style.height) || 0
      if (this.classList.contains('month-group')) {
        const body = this.querySelector('.grid, .month-placeholder, .month-skeleton') as HTMLElement | null
        return HEAD_H + (body ? body.offsetHeight : 0)
      }
      return 0
    })
  }
  function placeholderPx(w: ReturnType<typeof mount>): number {
    const ph = w.find('[data-test="month-placeholder"]')
    expect(ph.exists()).toBe(true)
    return Number.parseFloat(ph.attributes('style')?.match(/height:\s*([\d.]+)px/)?.[1] ?? '0')
  }

  it('observes every month container', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1']), loadedMonth('2026-07', ['a2'])], tab: 'photo' } })
    await nextTick()
    expect(FakeIO.instances[0].targets).toHaveLength(2)
  })

  it('asks for a bucket when an unloaded month enters the window', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12)], tab: 'photo' } })
    await nextTick()
    const io = FakeIO.instances[0]
    io.fire(w.find('#m-2026-08').element, true)
    await nextTick()
    expect(w.emitted('need-bucket')?.[0]).toEqual(['2026-08'])
  })

  it('never asks for a bucket for a group that has no bucket at all', async () => {
    // Favorites and place-assets feed synthetic groups: loaded is undefined.
    const w = mount(PhotosGrid, { props: { months: [month('2026-08', 'August 2026', [photo('a1')])], tab: 'photo' } })
    await nextTick()
    FakeIO.instances[0].fire(w.find('#m-2026-08').element, true)
    await nextTick()
    expect(w.emitted('need-bucket')).toBeUndefined()
  })

  // Whole-branch review, Important 3: the height must be the BODY's, not the
  // `.month-group`'s. The group includes `.month-head`, while the height is
  // applied to `.month-placeholder` — a sibling of the head — so measuring the
  // group made every collapsed section a head taller than it was hydrated. This
  // used to assert `toContain('321px')` against a stub that answered 321 for the
  // group itself, which could not tell the two apart.
  it('sizes the placeholder from the section body, not the group (the head is not part of it)', async () => {
    installLayoutModel()
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1', 'a2'])], tab: 'photo' } })
    await nextTick()
    const el = w.find('#m-2026-08').element as HTMLElement
    const io = FakeIO.instances[0]
    io.fire(el, true)
    await nextTick()
    io.fire(el, false)
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(0)
    // Exactly the body height. The group measures HEAD_H + GRID_H = 353, which is
    // what the bug stored.
    expect(placeholderPx(w)).toBe(GRID_H)
  })

  // Same finding, second half: the leave branch had no "was it hydrated?" guard,
  // and syncObserver disconnect()s + re-observe()s, which makes the browser
  // re-deliver `isIntersecting: false` for sections that are ALREADY collapsed.
  // Each such notification re-measured the group — head + placeholder — and stored
  // it, so every re-sync added another head. Fixing Critical 1 adds re-syncs, so
  // without this the scrollbar would creep on every tab change.
  it('does not grow the stored height when an already-collapsed section is notified again', async () => {
    installLayoutModel()
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1', 'a2'])], tab: 'photo' } })
    await nextTick()
    const el = w.find('#m-2026-08').element as HTMLElement
    const io = FakeIO.instances[0]
    io.fire(el, true); await nextTick()
    io.fire(el, false); await nextTick()
    const first = placeholderPx(w)
    expect(first).toBe(GRID_H)
    // The section is already collapsed; a re-sync re-notifies it.
    io.fire(el, false); await nextTick()
    expect(placeholderPx(w)).toBe(first)
    // And again — the bug grew by a head every single time (321 -> 353 -> 385).
    io.fire(el, false); await nextTick()
    expect(placeholderPx(w)).toBe(first)
  })

  it('renders tiles again when the month comes back into the window', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1'])], tab: 'photo' } })
    await nextTick()
    const el = w.find('#m-2026-08').element as HTMLElement
    const io = FakeIO.instances[0]
    io.fire(el, true); await nextTick()
    io.fire(el, false); await nextTick()
    io.fire(el, true); await nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  it('renders everything when IntersectionObserver is missing', async () => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1']), loadedMonth('2026-07', ['a2'])], tab: 'photo' } })
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.find('[data-test="month-placeholder"]').exists()).toBe(false)
  })

  it('disconnects the observer on unmount', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1'])], tab: 'photo' } })
    await nextTick()
    const io = FakeIO.instances[0]
    w.unmount()
    expect(io.targets).toHaveLength(0)
  })

  it('observes a month that appears after a directory refresh', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1'])], tab: 'photo' } })
    await nextTick()
    await w.setProps({ months: [loadedMonth('2026-08', ['a1']), bucketMonth('2026-07', 'July 2026', 4)] })
    await nextTick()
    expect(FakeIO.instances[0].targets).toHaveLength(2)
  })

  // Whole-branch review, minor 9: windowing must not be armed before the first
  // notification. It used to be switched on in onMounted while activeKeys was
  // still empty, so consumers that already hold every photo (favorites,
  // place-assets) painted a grey shimmer over photos they could have shown
  // immediately, until the observer's first callback landed a frame later.
  it('paints the photos it already holds before the first notification arrives', async () => {
    const w = mount(PhotosGrid, { props: { months: [month('2026-08', 'August 2026', [photo('a1')])], tab: 'photo' } })
    await nextTick()
    expect(FakeIO.instances[0].targets).toHaveLength(1) // the observer IS installed
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
  })

  // Whole-branch review, Critical 1: which containers exist is tab-dependent
  // (hasContent -> skeletonItemCount reads the tab), but the month list is not.
  // The observer was re-synced from a watch over every month key, so a tab round
  // trip — every videoCount:0 month unmounts on 'video', brand-new elements mount
  // on the way back — left the new elements unobserved forever. `need-bucket` is
  // only ever emitted for a month inside the window, so those months stayed
  // skeletons until a page reload.
  it('re-registers the containers a tab round trip recreated', async () => {
    const w = mount(PhotosGrid, {
      props: { months: [bucketMonth('2026-08', 'August 2026', 12, 0)], tab: 'photo' },
    })
    await nextTick()
    const io = FakeIO.instances[0]
    io.fireIfObserved(w.find('#m-2026-08').element, true)
    await nextTick()
    expect(w.emitted('need-bucket')).toHaveLength(1)

    // videoCount is 0, so the 'video' tab hides the month entirely and unmounts
    // its container.
    await w.setProps({ tab: 'video' })
    await nextTick(); await nextTick()
    expect(w.find('#m-2026-08').exists()).toBe(false)

    // Back to photos: Vue mounts a fresh element for it.
    await w.setProps({ tab: 'photo' })
    await nextTick(); await nextTick()
    const back = w.find('#m-2026-08')
    expect(back.exists()).toBe(true)
    io.fireIfObserved(back.element, true)
    await nextTick()
    // Before the fix the fresh element was never observed, so no browser would
    // ever have notified about it and this month could not load again.
    expect(io.targets).toContain(back.element)
    expect((w.emitted('need-bucket') ?? []).length).toBeGreaterThan(1)
  })

  // Whole-branch review, Important 2 / path A (the upload flow): a write patches
  // the directory while the month is on screen, its cache is invalidated, and the
  // tiles the user is looking at are replaced by a shimmer. No intersection
  // boundary is crossed, so an enter-only emit never re-requested — the shimmer
  // stayed until the user scrolled two viewports away and back.
  it('re-requests a month whose cache was invalidated while it was on screen', async () => {
    const w = mount(PhotosGrid, {
      props: { months: [loadedMonth('2026-08', ['a1', 'a2'])], tab: 'photo' },
    })
    await nextTick()
    const io = FakeIO.instances[0]
    io.fire(w.find('#m-2026-08').element, true)
    await nextTick()
    expect(w.emitted('need-bucket')).toBeUndefined() // it was loaded: nothing to ask for

    // The 5s index poll saw `indexed` grow, refreshBuckets found August's count
    // changed and dropped its cache: same month, same position, now unloaded.
    await w.setProps({ months: [bucketMonth('2026-08', 'August 2026', 13, 0)] })
    await nextTick()
    expect(w.emitted('need-bucket')?.[0]).toEqual(['2026-08'])
  })

  // Same finding, path B: the fetch failed while the month was on screen, so
  // there is no "scroll back to it" to retry on (the store's own comment claimed
  // there was). Any later windowing notification — a neighbour entering, a
  // re-sync, a repeated "still intersecting" — must re-evaluate the pending set.
  it('re-requests a month whose fetch failed and never left the window', async () => {
    const w = mount(PhotosGrid, {
      props: { months: [bucketMonth('2026-08', 'August 2026', 12, 0), bucketMonth('2026-07', 'July 2026', 4, 0)], tab: 'photo' },
    })
    await nextTick()
    const io = FakeIO.instances[0]
    io.fire(w.find('#m-2026-08').element, true)
    await nextTick()
    expect((w.emitted('need-bucket') ?? []).flat()).toEqual(['2026-08'])

    // The request failed: the store holds nothing for August and the month is
    // still exactly where it was. July then scrolls into the window.
    io.fire(w.find('#m-2026-07').element, true)
    await nextTick()
    const asked = (w.emitted('need-bucket') ?? []).flat()
    expect(asked.filter((k) => k === '2026-08').length).toBeGreaterThan(1)
    expect(asked).toContain('2026-07')
  })

  it('never re-requests a month that is out of the window', async () => {
    const w = mount(PhotosGrid, {
      props: { months: [bucketMonth('2026-08', 'August 2026', 12, 0), bucketMonth('2026-07', 'July 2026', 4, 0)], tab: 'photo' },
    })
    await nextTick()
    const io = FakeIO.instances[0]
    io.fire(w.find('#m-2026-07').element, true)
    await nextTick()
    // A directory refresh must not turn into a request for every month in the
    // library — only the ones actually near the viewport.
    await w.setProps({ months: [bucketMonth('2026-08', 'August 2026', 13, 0), bucketMonth('2026-07', 'July 2026', 4, 0)] })
    await nextTick()
    expect((w.emitted('need-bucket') ?? []).flat()).not.toContain('2026-08')
  })
})

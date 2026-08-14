import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PhotoLightbox from '../PhotoLightbox.vue'
// Style assertions read component source (scoped <style> declarations are unavailable in jsdom,
// and jsdom does not compute cascade) — same pattern as the "anchor rule body first, then assert
// properties" approach landed in P6b-T7.
import LIGHTBOX_SRC from '../PhotoLightbox.vue?raw'
import { useLightbox } from '../useLightbox'
import { usePhotosFavorites } from '../../stores/favorites'
import type { Photo } from '../../util/assetToPhoto'

// service mock — bare shapes (URL generator tokenized + hydration/favorites trinity called at singleton open state)
const favorite = vi.fn(() => Promise.resolve())
const unfavorite = vi.fn(() => Promise.resolve())
const listFavoriteIds = vi.fn<() => Promise<Array<string | number>>>(() => Promise.resolve([]))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      originalUrl: (id: string | number) => `/v1/photos/assets/${id}/original?token=t`,
      thumbnailUrl: (id: string | number, size = 'small') => `/v1/photos/assets/${id}/thumbnail?size=${size}&token=t`,
      liveUrl: (id: string | number) => `/v1/photos/assets/${id}/live?token=t`,
      recordView: () => Promise.resolve(),
      // reject → hydrateDetail preserves list-item placeholder, detail is always equal to test Photo (stable title)
      getAsset: () => Promise.reject(new Error('no hydrate in test')),
      getAssetOcr: () => Promise.resolve({ lines: [] }),
      listFavoriteIds: () => listFavoriteIds(),
      favorite: (id: string | number) => favorite(),
      unfavorite: (id: string | number) => unfavorite(),
    },
  },
}))

// jsdom has no media stack — stub video.play/pause
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

function makePhoto(over: Partial<Photo> = {}): Photo {
  return {
    id: 'p1', title: 'Sunset', file: 'sunset.jpg', date: 'July 1, 2026', time: '12:00',
    takenAt: null, indexedAt: null, mimeType: 'image/jpeg', fileSize: 0,
    isVideo: false, hasOcr: false, isNew: false, isLivePhoto: false, livePhotoVideoId: null,
    duration: null, durationMs: 0, fav: false, status: undefined, filePath: '', width: null, height: null,
    dim: null, size: '', latitude: null, longitude: null, coords: null, place: null, camera: null,
    iso: null, shutter: null, aperture: null, focal: null, orientation: null, videoCodec: null,
    audioCodec: null, frameRate: null, bitRate: null, rotation: 0, matchScore: null, matchedBy: null,
    belowCut: false, tags: [], scene: null, faces: [], ...over,
  } as Photo
}

const IMG_A = makePhoto({ id: 'a', title: 'Alpha' })
const IMG_B = makePhoto({ id: 'b', title: 'Bravo' })
const IMG_C = makePhoto({ id: 'c', title: 'Charlie' })
const THREE = [IMG_A, IMG_B, IMG_C]

let wrapper: VueWrapper | null = null
function mountLb(): VueWrapper {
  wrapper = mount(PhotoLightbox, {
    global: {
      stubs: {
        PhotoImageViewer: { name: 'PhotoImageViewer', template: '<div class="stub-viewer" />' },
        // Task 9 onwards, PhotoLightbox actually hung out T7/T8 — this file only tests the lightbox
        // shell (open/close/pagination/favorites/delete/chrome auto-hide, etc.); behavior of the detail
        // panel and filmstrip are covered in PhotoInfoPanel.test.ts / PhotoFilmstrip.test.ts respectively.
        // Stub preserves visible gate-control + class="lb-info", keeping existing "info toggle" assertions unchanged.
        PhotoInfoPanel: {
          name: 'PhotoInfoPanel',
          props: ['photo', 'visible'],
          template: '<aside v-if="visible" class="lb-info" />',
        },
        PhotoFilmstrip: {
          name: 'PhotoFilmstrip',
          props: ['list', 'index'],
          template: '<div class="stub-filmstrip" />',
        },
      },
    },
  })
  return wrapper
}

// Create pinia only once (not rebuild in each beforeEach): useLightbox's isFav computed is a
// module-level singleton. Its `current.value && fav.isFav(...)` short-circuit structure means
// when the current reference value is reused across two evaluation windows (IMG_A/B/C in this file
// are module-level constants shared across tests), Vue judges “no change” and skips re-evaluation,
// causing isFav to hang indefinitely on the previous store instance's favIds (which is now defunct
// from createPinia()) and never receive notification of state flips in the new store. We keep the
// same pinia/store, and instead reset state in each test with store's own __resetForTest() —
// semantically equivalent to the pre-refactoring approach of “same module-level favIds ref, reset
// .value before each test”.
setActivePinia(createPinia())
const lb = useLightbox()

beforeEach(() => {
  favorite.mockClear()
  unfavorite.mockClear()
  listFavoriteIds.mockReset()
  listFavoriteIds.mockResolvedValue([])
  usePhotosFavorites().__resetForTest()
  lb.__resetForTest()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('PhotoLightbox open/close + title/count', () => {
  it('open=false does not render overlay', () => {
    const w = mountLb()
    expect(w.find('.lightbox').exists()).toBe(false)
  })

  it('after openAt, renders overlay + title + count 1 / 3', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lightbox').exists()).toBe(true)
    expect(w.text()).toContain('Alpha')
    expect(w.text()).toContain('1 / 3')
  })
})

describe('PhotoLightbox stage dispatch', () => {
  it('video item renders native <video> with src=originalUrl, does not render image viewer', async () => {
    const w = mountLb()
    lb.openAt(makePhoto({ id: 'v1', title: 'Clip', isVideo: true, mimeType: 'video/mp4' }), [])
    await nextTick()
    const video = w.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('/v1/photos/assets/v1/original?token=t')
    expect(w.findComponent({ name: 'PhotoImageViewer' }).exists()).toBe(false)
  })

  it('image item renders PhotoImageViewer (stub), does not render <video>', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.findComponent({ name: 'PhotoImageViewer' }).exists()).toBe(true)
    expect(w.find('video').exists()).toBe(false)
  })
})

describe('PhotoLightbox close', () => {
  it('click close button closes lightbox (open→false)', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-close').trigger('click')
    expect(lb.open.value).toBe(false)
  })

  it('ESC closes lightbox', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(lb.open.value).toBe(false)
  })

  it('when delete confirmation is open, ESC only closes modal, not lightbox', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(false)
    expect(lb.open.value).toBe(true)
  })
})

describe('PhotoLightbox pagination', () => {
  it('first page: prev disabled, click next advances to 2 / 3', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect((w.find('.lb-nav-prev').element as HTMLButtonElement).disabled).toBe(true)
    await w.find('.lb-nav-next').trigger('click')
    await nextTick()
    expect(w.text()).toContain('2 / 3')
  })

  it('last page: next disabled', async () => {
    const w = mountLb()
    lb.openAt(IMG_C, THREE)
    await nextTick()
    expect((w.find('.lb-nav-next').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('ArrowRight advances, ArrowLeft goes back', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await nextTick()
    expect(w.text()).toContain('2 / 3')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await nextTick()
    expect(w.text()).toContain('1 / 3')
  })
})

describe('PhotoLightbox favorites', () => {
  it('click favorite button calls favorite and emits toggle-fav, star becomes solid', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-fav').trigger('click')
    await nextTick()
    expect(favorite).toHaveBeenCalledTimes(1)
    expect(w.emitted('toggle-fav')?.[0]).toEqual(['a', true])
    expect(w.find('.lb-fav').classes()).toContain('is-fav')
  })

  it('favorited item (listFavoriteIds returns its id) has solid star', async () => {
    listFavoriteIds.mockResolvedValue(['a'])
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await flushPromises()
    await nextTick()
    expect(w.find('.lb-fav').classes()).toContain('is-fav')
  })

  it('f key toggles favorite', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
    await nextTick()
    expect(favorite).toHaveBeenCalledTimes(1)
  })
})

describe('PhotoLightbox download', () => {
  it('download link has href=originalUrl with download attribute', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    const a = w.find('a.lb-download')
    expect(a.attributes('href')).toBe('/v1/photos/assets/a/original?token=t')
    expect(a.attributes('download')).toBeDefined()
  })
})

describe('PhotoLightbox info toggle', () => {
  it('click info button toggles showInfo (mounts Task 7 panel placeholder)', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(false)
    await w.find('.lb-info-toggle').trigger('click')
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(true)
    await w.find('.lb-info-toggle').trigger('click')
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(false)
  })
})

describe('PhotoLightbox delete confirmation', () => {
  it('click trash button opens modal, confirm emits delete with current.id and closes lightbox', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-delete').trigger('click')
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(true)
    await w.find('.lb-confirm-ok').trigger('click')
    await nextTick()
    expect(w.emitted('delete')?.[0]).toEqual(['a'])
    expect(lb.open.value).toBe(false)
  })

  it('cancel only closes modal', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-delete').trigger('click')
    await nextTick()
    await w.find('.lb-confirm-cancel').trigger('click')
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(false)
    expect(lb.open.value).toBe(true)
    expect(w.emitted('delete')).toBeUndefined()
  })
})

describe('PhotoLightbox chrome auto-hide', () => {
  // User acceptance requirement on 2026-07-31 changed the auto-hide scope: the top bar is
  // opaque in-flow chrome and **always visible, never auto-hides** (if it hides, the stage becomes
  // taller and the image jumps). Only pagination arrows overlaid on the photo still auto-hide after 5s.
  it('after 5s without mouse movement, only arrows hide; top bar stays, mousemove restores arrows', async () => {
    vi.useFakeTimers()
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lb-top').exists()).toBe(true)
    expect(w.find('.lb-nav-next').exists()).toBe(true)
    vi.advanceTimersByTime(5000)
    await nextTick()
    // Top bar is no longer subject to isMoving control — this assertion relies on deleting the v-if
    // guard from the template
    expect(w.find('.lb-top').exists()).toBe(true)
    expect(w.find('.lb-nav-next').exists()).toBe(false)
    await w.find('.lightbox').trigger('mousemove')
    expect(w.find('.lb-nav-next').exists()).toBe(true)
  })
})

describe('PhotoLightbox top bar is opaque in-flow chrome (user acceptance requirement 2026-07-31)', () => {
  // Style assertion: anchor the .lb-top rule body first, then assert properties (file-level toContain
  // is always true).
  const topRule = (): string => {
    const m = /\.lb-top\s*\{([^}]*)\}/.exec(LIGHTBOX_SRC)
    expect(m).not.toBeNull()
    return m![1]
  }

  it('solid --popup-bg background, not gradient, not absolute positioned', () => {
    const body = topRule()
    expect(body).toMatch(/background:\s*var\(--popup-bg\)/)
    expect(body).not.toMatch(/position:\s*absolute/)
    expect(body).not.toMatch(/linear-gradient/)
  })

  it('is flex in-flow item with separator line to stage (image thus sandwiched between two bars)', () => {
    const body = topRule()
    expect(body).toMatch(/flex:\s*0\s+0\s+auto/)
    expect(body).toMatch(/border-bottom:\s*1px solid var\(--card-border\)/)
  })

  it('detail panel top margin no longer yields space to top bar (64px → 16px, else sinks below stage)', () => {
    const m = /:deep\(\.info-panel\)\s*\{([^}]*)\}/.exec(LIGHTBOX_SRC)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/margin:\s*16px 16px 16px 0/)
  })
})

describe('PhotoLightbox video start position resume', () => {
  // Critical regression: component is persistently mounted; openAt sets open to true before loadedmetadata.
  // The anchor must be captured when open becomes true (not at onMounted, when lightbox is usually closed
  // and current is empty).
  function trackCurrentTime(el: HTMLVideoElement, durationS: number): () => number {
    Object.defineProperty(el, 'duration', { value: durationS, configurable: true })
    let ct = 0
    Object.defineProperty(el, 'currentTime', {
      get: () => ct,
      set: (v: number) => { ct = v },
      configurable: true,
    })
    return () => ct
  }

  it('open video at hover position, after loadedmetadata actually seeks to 16s (startMs 16000)', async () => {
    const VID_A = makePhoto({ id: 'vA', title: 'ClipA', isVideo: true, mimeType: 'video/mp4' })
    const w = mountLb()
    lb.openAt(VID_A, [VID_A], 16000)
    await nextTick()
    const video = w.find('video')
    expect(video.exists()).toBe(true)
    const readCt = trackCurrentTime(video.element as HTMLVideoElement, 60)
    await video.trigger('loadedmetadata')
    expect(readCt()).toBe(16) // 16000ms / 1000 = 16s
  })

  it('pagination to another video does not seek again (startApplied one-time guard)', async () => {
    const VID_A = makePhoto({ id: 'vA', title: 'ClipA', isVideo: true, mimeType: 'video/mp4' })
    const VID_B = makePhoto({ id: 'vB', title: 'ClipB', isVideo: true, mimeType: 'video/mp4' })
    const w = mountLb()
    lb.openAt(VID_A, [VID_A, VID_B], 16000)
    await nextTick()
    const readA = trackCurrentTime(w.find('video').element as HTMLVideoElement, 60)
    await w.find('video').trigger('loadedmetadata')
    expect(readA()).toBe(16)
    // Pagination to second video: element rebuilds by id, new video should not be seeked to 16s
    lb.next()
    await nextTick()
    const readB = trackCurrentTime(w.find('video').element as HTMLVideoElement, 60)
    await w.find('video').trigger('loadedmetadata')
    expect(readB()).toBe(0)
  })
})

describe('PhotoLightbox persistent mount: lightbox closed at onMounted', () => {
  // Regression (review finding #1): parent mounts only once, internal v-if="lb.open.value" self-gates,
  // lightbox is usually closed at onMounted — if isMoving 5s auto-hide timer is armed only once at
  // onMounted, the component stays mounted year-round, and this timer expires long before actual openAt.
  // When truly opened, top bar + pagination arrows are all invisible (isMoving=false) and look unrendered.
  it('lightbox closed at mount, 5s timer expired before any openAt — after openAt toolbar + arrows must be visible', async () => {
    vi.useFakeTimers()
    const w = mountLb() // At mount, lb.open.value === false (beforeEach already called __resetForTest)
    expect(w.find('.lightbox').exists()).toBe(false)
    // Before any open, let the timer armed at onMounted expire
    vi.advanceTimersByTime(5000)
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lightbox').exists()).toBe(true)
    expect(w.find('.lb-top').exists()).toBe(true) // Top bar toolbar (favorites/download/info/delete, etc.)
    expect(w.find('.lb-nav-next').exists()).toBe(true) // Pagination arrows
  })

  it('when open, showInfo resets to false, even if previously toggled to true', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-info-toggle').trigger('click')
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(true) // Previous open toggled info panel open
    lb.close()
    await nextTick()
    lb.openAt(IMG_B, THREE)
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(false) // Reopen should default to closed
  })
})

describe('PhotoLightbox add to album (Task 9)', () => {
  it('top bar renders "add to album" button between favorite and download buttons', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    const btns = Array.from(w.find('.lb-top').element.querySelectorAll('button, a'))
    const favIdx = btns.findIndex((b) => b.classList.contains('lb-fav'))
    const addIdx = btns.findIndex((b) => b.classList.contains('lb-add-album'))
    const dlIdx = btns.findIndex((b) => b.classList.contains('lb-download'))
    expect(favIdx).toBeGreaterThanOrEqual(0)
    expect(addIdx).toBeGreaterThan(favIdx)
    expect(addIdx).toBeLessThan(dlIdx)
  })

  it('click "add to album" emits add-to-album (current.id), lightbox stays open', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-add-album').trigger('click')
    await nextTick()
    expect(w.emitted('add-to-album')?.[0]).toEqual(['a'])
    expect(lb.open.value).toBe(true)
    expect(w.find('.lightbox').exists()).toBe(true)
  })
})

describe('PhotoLightbox live photos', () => {
  it('live photo renders live badge; hold down to play <video src=liveUrl>, release to hide', async () => {
    const w = mountLb()
    lb.openAt(makePhoto({ id: 'lp', title: 'Live', isLivePhoto: true, livePhotoVideoId: 'lpv' }), [])
    await nextTick()
    const badge = w.find('.lb-live-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('实况')
    expect(w.find('video.lb-live-video').exists()).toBe(false)
    await badge.trigger('pointerdown')
    await nextTick()
    const lv = w.find('video.lb-live-video')
    expect(lv.exists()).toBe(true)
    expect(lv.attributes('src')).toBe('/v1/photos/assets/lp/live?token=t')
    await badge.trigger('pointerup')
    await nextTick()
    expect(w.find('video.lb-live-video').exists()).toBe(false)
  })
})

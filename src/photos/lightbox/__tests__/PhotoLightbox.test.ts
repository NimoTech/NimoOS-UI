import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick, Transition } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PhotoLightbox from '../PhotoLightbox.vue'
// Style assertions read the component's source text (scoped <style> declarations aren't
// accessible in jsdom, and jsdom doesn't compute the cascade) -- following the same
// "anchor the rule body first, then assert properties" convention used elsewhere.
import LIGHTBOX_SRC from '../PhotoLightbox.vue?raw'
// The grid/chrome/crossfade rules these style assertions used to read straight
// off this component's own scoped <style> were retired once the lightbox actually nests inside
// `.photos-root` -- parity's own `.photos-root .lightbox`/`.lb-*` family now solely governs those
// properties (see PhotoLightbox.vue's scoped-style retirement note). The assertions below that
// cover retired rules are retargeted to read parity's source instead of the component's.
// Read via node:fs rather than a Vite `?raw` import -- unlike this component's own `.vue?raw`
// import above, Vite's CSS/SCSS handling intercepts `.scss?raw` before the raw-loader can return
// it (empirically returns an empty string in this project's vitest setup), same reason every
// other guard test that reads vue2-parity/*.scss (keyframes-guard.test.ts,
// class-collision-guard.test.ts, photosOverlayZIndex.test.ts) already reads it via fs instead.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const PARITY_SRC = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/vue2-parity/photos.scss'),
  'utf8',
)
import { useLightbox } from '../useLightbox'
import { usePhotosFavorites } from '../../stores/favorites'
import type { Photo } from '../../util/assetToPhoto'

// service mock -- bare shapes (tokenized URL generators + the hydrate/favorite trio called while the singleton is open)
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
      // reject → hydrateDetail keeps the list-item placeholder, detail always equals the test Photo (title stays stable)
      getAsset: () => Promise.reject(new Error('no hydrate in test')),
      getAssetOcr: () => Promise.resolve({ lines: [] }),
      listFavoriteIds: () => listFavoriteIds(),
      favorite: (id: string | number) => favorite(),
      unfavorite: (id: string | number) => unfavorite(),
    },
  },
}))

// jsdom has no media stack: video.play/pause are stubbed
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
        // PhotoLightbox now really mounts PhotoInfoPanel/PhotoFilmstrip -- this file only tests the
        // lightbox shell (open/close, paging, favorite, delete, chrome auto-hide, etc.), the info
        // panel's/filmstrip's own behavior is covered in PhotoInfoPanel.test.ts / PhotoFilmstrip.test.ts.
        // The stub keeps the visible gate + class="lb-info", so the existing "info toggle" assertions stay unchanged.
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

// Build pinia only once (rather than recreating it in every beforeEach): useLightbox's isFav
// computed is a module-level singleton, and its `current.value && fav.isFav(...)` short-circuit
// structure means that when the current reference happens to reuse the same object across two
// evaluations (this file's IMG_A/B/C are module-level constants shared across test cases), Vue
// judges "no change" and skips recomputation -- isFav would then stay pinned to the previous
// (already discarded by createPinia()) store instance's favIds and never receive the new store's
// flip notifications. Keeping the same pinia/store and instead having each test case clear state
// via the store's own __resetForTest() is semantically equivalent to the pre-refactor approach of
// "one module-level favIds ref, reset .value in every test case".
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

describe('PhotoLightbox open/close + title/counter', () => {
  it('does not render the overlay when open=false', () => {
    const w = mountLb()
    expect(w.find('.lightbox').exists()).toBe(false)
  })

  it('renders the overlay + title + counter 1 / 3 after openAt', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lightbox').exists()).toBe(true)
    expect(w.text()).toContain('Alpha')
    expect(w.text()).toContain('1 / 3')
  })
})

// Container re-shaped from a flex column to a CSS Grid mirroring Vue2/parity
// exactly (grid-template-rows 56px 1fr 88px; data-info="true" → columns 1fr 360px + named
// areas "top top"/"main info"/"strip info"; "false" → single column). Style assertions read
// the component's own source text (jsdom doesn't compute cascade), same idiom as the
// "top bar is opaque in-flow chrome" block below.
describe('PhotoLightbox structure: container grid + data-info contract', () => {
  // `.lightbox`/`[data-info]` no longer have local copies (retired -- see
  // PhotoLightbox.vue's scoped-style header note); these read parity's `.photos-root`-scoped
  // rules, which is what actually governs this component's layout now that it nests inside
  // `.photos-root`.
  const rule = (selector: string): string => {
    const m = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(PARITY_SRC)
    expect(m, `could not find rule ${selector}`).not.toBeNull()
    return m![1]
  }

  it('.lightbox is display:grid, row heights 56px 1fr 88px, z-index 200', () => {
    const body = rule('\\.photos-root \\.lightbox')
    expect(body).toMatch(/display:\s*grid/)
    expect(body).toMatch(/grid-template-rows:\s*56px 1fr 88px/)
    expect(body).toMatch(/z-index:\s*200/)
    expect(body).toMatch(/position:\s*fixed/)
  })

  it('data-info="true": two columns (1fr 360px) + three named areas (top top / main info / strip info)', () => {
    const body = rule('\\.photos-root \\.lightbox\\[data-info="true"\\]')
    expect(body).toMatch(/grid-template-columns:\s*1fr 360px/)
    expect(body).toMatch(/grid-template-areas:\s*"top top" "main info" "strip info"/)
  })

  it('data-info="false": single column + three areas each spanning a full row (top / main / strip)', () => {
    const body = rule('\\.photos-root \\.lightbox\\[data-info="false"\\]')
    expect(body).toMatch(/grid-template-columns:\s*1fr;/)
    expect(body).toMatch(/grid-template-areas:\s*"top" "main" "strip"/)
  })

  it('.lb-main/.lb-nav[data-side]/.lb-strip/.lb-info are all direct children of .lightbox (no longer nested inside .lb-body)', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-info-toggle').trigger('click')
    await nextTick()
    const lightbox = w.get('.lightbox').element
    const main = w.get('.lb-main').element
    const info = w.get('.lb-info').element // PhotoInfoPanel's stub (see mountLb's stubs)
    const strip = w.get('.stub-filmstrip').element // PhotoFilmstrip's stub
    expect(main.parentElement).toBe(lightbox)
    expect(info.parentElement).toBe(lightbox)
    expect(strip.parentElement).toBe(lightbox)
    // the old .lb-body wrapper element no longer exists
    expect(w.find('.lb-body').exists()).toBe(false)
  })

  it('nav arrows use the data-side attribute rather than .lb-nav-prev/.lb-nav-next modifier classes', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    const prev = w.get('.lb-nav[data-side="prev"]')
    const next = w.get('.lb-nav[data-side="next"]')
    expect(prev.classes()).not.toContain('lb-nav-prev')
    expect(next.classes()).not.toContain('lb-nav-next')
  })
})

// Swap transition, byte-exact per Vue2 (PhotosLightbox.vue:25
// `<transition :name="'lb-swap-' + navDir">`, watch 'photo.id' comparing idx against _lastIdx).
// `findComponent(Transition)`'s overload resolution collapses to the untyped `WrapperLike`
// (no usable `.props()` typing) for this built-in component -- casting the result to this
// minimal local shape restores a typed accessor without weakening the runtime assertion.
function swapTransitionName(w: VueWrapper): string {
  const t = w.findComponent(Transition as never) as unknown as {
    exists: () => boolean
    props: (key: string) => unknown
  }
  expect(t.exists()).toBe(true)
  return t.props('name') as string
}

describe('PhotoLightbox swap transition + navDir', () => {
  it('.lb-media is wrapped in a <transition>, name changes with navDir', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(swapTransitionName(w)).toBe('lb-swap-next') // default value, same as Vue2 data()'s navDir: 'next'
  })

  it('index increases (next()/goTo to a larger index) → navDir="next"', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE) // idx 0
    await nextTick()
    lb.next() // idx 0 -> 1, increases
    await nextTick()
    expect(swapTransitionName(w)).toBe('lb-swap-next')
  })

  it('index decreases (prev()) → navDir="prev"', async () => {
    const w = mountLb()
    lb.openAt(IMG_C, THREE) // idx 2
    await nextTick()
    lb.prev() // idx 2 -> 1, decreases
    await nextTick()
    expect(swapTransitionName(w)).toBe('lb-swap-prev')
  })

  it('goTo with an absolute index also judges direction by increase/decrease (not limited to adjacent paging)', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE) // idx 0
    await nextTick()
    lb.goTo(2) // 0 -> 2, increases
    await nextTick()
    expect(swapTransitionName(w)).toBe('lb-swap-next')
    lb.goTo(0) // 2 -> 0, decreases
    await nextTick()
    expect(swapTransitionName(w)).toBe('lb-swap-prev')
  })

  it('reopening (the component stays persistently mounted, reusing the same lastIdx) does not misjudge the jump in starting index as a page-flip', async () => {
    const w = mountLb()
    lb.openAt(IMG_C, THREE) // idx 2
    await nextTick()
    lb.close()
    await nextTick()
    lb.openAt(IMG_A, THREE) // reopens at idx 0 (far below the 2 it was at when last closed)
    await nextTick()
    // Without resetting lastIdx on open, this would be misjudged as a "prev" from idx 2 down to 0;
    // the correct behavior is to reset the baseline, so a fresh open still defaults to Vue2 data()'s initial value 'next'.
    expect(swapTransitionName(w)).toBe('lb-swap-next')
  })

  it('.lightbox references the global lb-in entrance animation (no @keyframes redefined here, guarded by keyframes-guard)', () => {
    // The local `.lightbox` rule (and its `animation` declaration) is retired --
    // parity's own `.photos-root .lightbox` carries it now that the component nests inside
    // `.photos-root`. Read parity's source instead.
    const m = /\.photos-root \.lightbox\s*\{([^}]*)\}/.exec(PARITY_SRC)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/animation:\s*lb-in 0\.22s ease-out/)
    // Only match a real @keyframes declaration (immediately followed by `{`), so this isn't
    // tripped up by this file's own comment mentioning the name "@keyframes lb-in" (explaining
    // why it isn't redefined here).
    expect(LIGHTBOX_SRC).not.toMatch(/@keyframes\s+lb-in\s*\{/)
  })

  it('.lb-media is position:absolute + inset:0 (the entering/leaving instances must overlap during the swap transition, not stack vertically)', () => {
    // The local `.lb-media` rule is retired -- byte-identical to parity's own
    // `.photos-root .lb-media`, which now solely governs (see PhotoLightbox.vue's retirement
    // note).
    const m = /\.photos-root \.lb-media\s*\{([^}]*)\}/.exec(PARITY_SRC)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/position:\s*absolute/)
    expect(m![1]).toMatch(/inset:\s*0/)
    expect(m![1]).not.toMatch(/width:\s*100%/)
  })

  it('supplies a local Vue3 -enter-from selector (parity only carries Vue2\'s dead -enter name), values byte-aligned with Vue2', () => {
    const next = /\.lb-swap-next-enter-from\s*\{([^}]*)\}/.exec(LIGHTBOX_SRC)
    const prev = /\.lb-swap-prev-enter-from\s*\{([^}]*)\}/.exec(LIGHTBOX_SRC)
    expect(next, 'could not find .lb-swap-next-enter-from').not.toBeNull()
    expect(prev, 'could not find .lb-swap-prev-enter-from').not.toBeNull()
    expect(next![1]).toMatch(/opacity:\s*0/)
    expect(next![1]).toMatch(/transform:\s*translateX\(36px\) scale\(0\.97\)/)
    expect(prev![1]).toMatch(/opacity:\s*0/)
    expect(prev![1]).toMatch(/transform:\s*translateX\(-36px\) scale\(0\.97\)/)
  })

  // `.lb-nav.shake`/`[data-disabled]` is Vue2 dead code (never wired up); not wired up here either.
  it('.lb-nav.shake / [data-disabled] is not wired up in this component (dead code stays dead)', () => {
    expect(LIGHTBOX_SRC).not.toMatch(/data-disabled/)
    expect(LIGHTBOX_SRC).not.toMatch(/\bshake\b/)
  })
})

describe('PhotoLightbox stage dispatch', () => {
  it('a video item renders a native <video> with src=originalUrl, not the static image viewer', async () => {
    const w = mountLb()
    lb.openAt(makePhoto({ id: 'v1', title: 'Clip', isVideo: true, mimeType: 'video/mp4' }), [])
    await nextTick()
    const video = w.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('/v1/photos/assets/v1/original?token=t')
    expect(w.findComponent({ name: 'PhotoImageViewer' }).exists()).toBe(false)
    // The media element carries parity's anchor `.lb-photo`
    // (`.lb-media > .lb-photo(img|video)`) alongside this component's own `.lb-video`.
    expect(video.classes()).toContain('lb-photo')
    expect(video.classes()).toContain('lb-video')
  })

  it('an image item renders PhotoImageViewer (stub), not a <video>', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.findComponent({ name: 'PhotoImageViewer' }).exists()).toBe(true)
    expect(w.find('video').exists()).toBe(false)
  })
})

describe('PhotoLightbox close', () => {
  it('clicking the close button closes the lightbox (open→false)', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-close').trigger('click')
    expect(lb.open.value).toBe(false)
  })

  it('ESC closes the lightbox', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(lb.open.value).toBe(false)
  })

  it('while the delete confirmation is open, ESC only closes the modal, not the lightbox', async () => {
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

describe('PhotoLightbox paging', () => {
  it('prev is disabled on the first item, clicking next advances to 2 / 3', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect((w.find('.lb-nav[data-side="prev"]').element as HTMLButtonElement).disabled).toBe(true)
    await w.find('.lb-nav[data-side="next"]').trigger('click')
    await nextTick()
    expect(w.text()).toContain('2 / 3')
  })

  it('next is disabled on the last item', async () => {
    const w = mountLb()
    lb.openAt(IMG_C, THREE)
    await nextTick()
    expect((w.find('.lb-nav[data-side="next"]').element as HTMLButtonElement).disabled).toBe(true)
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

describe('PhotoLightbox favorite', () => {
  it('clicking the favorite button calls favorite and emits toggle-fav, the star fills in', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-fav').trigger('click')
    await nextTick()
    expect(favorite).toHaveBeenCalledTimes(1)
    expect(w.emitted('toggle-fav')?.[0]).toEqual(['a', true])
    expect(w.find('.lb-fav').classes()).toContain('is-fav')
  })

  it('an already-favorited item (its id is in listFavoriteIds\' result) shows a filled star', async () => {
    listFavoriteIds.mockResolvedValue(['a'])
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await flushPromises()
    await nextTick()
    expect(w.find('.lb-fav').classes()).toContain('is-fav')
  })

  it('the f key toggles favorite', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
    await nextTick()
    expect(favorite).toHaveBeenCalledTimes(1)
  })
})

describe('PhotoLightbox download', () => {
  it('the download link has href=originalUrl and a download attribute', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    const a = w.find('a.lb-download')
    expect(a.attributes('href')).toBe('/v1/photos/assets/a/original?token=t')
    expect(a.attributes('download')).toBeDefined()
  })
})

describe('PhotoLightbox info toggle', () => {
  it('clicking the info button toggles showInfo (mounts the info panel)', async () => {
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
  it('clicking trash opens the modal, confirming emits delete with current.id and closes the lightbox', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-delete').trigger('click')
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(true)
    await w.find('.trash-btn-cta-danger').trigger('click')
    await nextTick()
    expect(w.emitted('delete')?.[0]).toEqual(['a'])
    expect(lb.open.value).toBe(false)
  })

  it('cancel only closes the modal', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-delete').trigger('click')
    await nextTick()
    await w.find('.trash-btn-ghost').trigger('click')
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(false)
    expect(lb.open.value).toBe(true)
    expect(w.emitted('delete')).toBeUndefined()
  })

  // No animation should be dropped -- Vue2 wraps the confirm scrim in
  // `<transition name="lb-confirm">` (PhotosLightbox.vue:151-165); this component had regressed
  // to a bare `v-if` with no transition wrapper at all. Assert the wrapper is back.
  it('the confirm dialog is wrapped in <transition name="lb-confirm"> (faithful to Vue2 :151-165)', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-delete').trigger('click')
    await nextTick()
    const transitions = w.findAllComponents(Transition as never) as unknown as Array<{
      props: (key: string) => unknown
    }>
    const confirmTransition = transitions.find((t) => t.props('name') === 'lb-confirm')
    expect(confirmTransition, 'could not find a <transition> with name="lb-confirm"').not.toBeUndefined()
  })

  it('supplies a local Vue3 -enter-from selector (parity\'s .lb-confirm-enter is a verbatim transcription of Vue2\'s dead name, following the same precedent as .lb-swap-*-enter-from)', () => {
    const m = /\.lb-confirm-enter-from\s*\{([^}]*)\}/.exec(LIGHTBOX_SRC)
    expect(m, 'could not find .lb-confirm-enter-from').not.toBeNull()
    expect(m![1]).toMatch(/opacity:\s*0/)
    expect(m![1]).toMatch(/transform:\s*scale\(0\.95\)/)
  })
})

describe('PhotoLightbox chrome auto-hide', () => {
  // Requirements changed the scope of auto-hide: the top bar is opaque in-flow chrome that
  // **always shows and never auto-hides** (collapsing the stage would make it taller and the
  // photo would jump); only the nav arrows layered on top of the photo still auto-hide after 5s.
  it('after 5s of no mouse movement only the arrows hide, the top bar stays; mousemove brings the arrows back', async () => {
    vi.useFakeTimers()
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lb-top').exists()).toBe(true)
    expect(w.find('.lb-nav[data-side="next"]').exists()).toBe(true)
    vi.advanceTimersByTime(5000)
    await nextTick()
    // The top bar is no longer governed by isMoving -- this alone relies on the template's v-if guard having been removed
    expect(w.find('.lb-top').exists()).toBe(true)
    expect(w.find('.lb-nav[data-side="next"]').exists()).toBe(false)
    await w.find('.lightbox').trigger('mousemove')
    expect(w.find('.lb-nav[data-side="next"]').exists()).toBe(true)
  })
})

describe('PhotoLightbox top bar is opaque in-flow chrome', () => {
  // `.lb-top` no longer has a local copy (retired -- byte-duplicate of parity's
  // `.photos-root .lb-top`, see PhotoLightbox.vue's scoped-style retirement note). These now read
  // parity's rule, which is what actually governs the top bar's chrome now that the lightbox
  // nests inside `.photos-root`.
  const topRule = (): string => {
    const m = /\.photos-root \.lb-top\s*\{([^}]*)\}/.exec(PARITY_SRC)
    expect(m).not.toBeNull()
    return m![1]
  }

  it('solid --lb-chrome fill, not a gradient, not absolutely positioned', () => {
    const body = topRule()
    expect(body).toMatch(/background:\s*var\(--lb-chrome\)/)
    expect(body).not.toMatch(/position:\s*absolute/)
    expect(body).not.toMatch(/linear-gradient/)
  })

  // The container switched from a flex column to a CSS Grid (parity's own
  // row/column/area shape) -- `.lb-top` now claims its row via `grid-area: top` instead of
  // `flex: 0 0 auto`. The underlying user-facing requirement (an opaque row of its own, with a
  // separating line from the stage below) is unchanged; only the layout mechanism is.
  it('occupies its own grid row (grid-area: top) with a separator line from the stage (the photo is thus sandwiched between the top and bottom bars)', () => {
    const body = topRule()
    expect(body).toMatch(/grid-area:\s*top/)
    expect(body).toMatch(/border-bottom:\s*1px solid var\(--line\)/)
  })

  it('the info panel no longer makes room for the top bar via a local margin -- it is now a flush panel hugging its grid area (matching parity)', () => {
    // The `:deep(.lb-info) { margin: 16px 16px 16px 0; }` override is retired --
    // parity's own `.photos-root .lb-info` is a flush panel with no margin at all (Vue2's real
    // lightbox never floats this panel either), and PhotoInfoPanel.vue's own "card look" is
    // retired to match (see that file's own note about it). Assert the override rule is gone
    // (not merely absent from prose -- the component's own retirement comment mentions the old
    // selector by name), not that some byte-exact margin value survives.
    expect(LIGHTBOX_SRC).not.toMatch(/:deep\(\.lb-info\)\s*\{/)
  })
})

describe('PhotoLightbox resumes video from the hover-preview position', () => {
  // A key regression: the component stays persistently mounted, and openAt flips open from
  // false to true before loadedmetadata fires, so the anchor must be captured at the moment open
  // flips true (not at onMounted, when the lightbox isn't open yet and current is empty).
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

  it('opening a video from a hover position really seeks to 16s after loadedmetadata (startMs 16000)', async () => {
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

  it('paging to another video no longer seeks (the startApplied one-shot guard)', async () => {
    const VID_A = makePhoto({ id: 'vA', title: 'ClipA', isVideo: true, mimeType: 'video/mp4' })
    const VID_B = makePhoto({ id: 'vB', title: 'ClipB', isVideo: true, mimeType: 'video/mp4' })
    const w = mountLb()
    lb.openAt(VID_A, [VID_A, VID_B], 16000)
    await nextTick()
    const readA = trackCurrentTime(w.find('video').element as HTMLVideoElement, 60)
    await w.find('video').trigger('loadedmetadata')
    expect(readA()).toBe(16)
    // Paging to the second video: the element gets rebuilt by id, the new video should not be seeked to 16s
    lb.next()
    await nextTick()
    const readB = trackCurrentTime(w.find('video').element as HTMLVideoElement, 60)
    await w.find('video').trigger('loadedmetadata')
    expect(readB()).toBe(0)
  })
})

describe('PhotoLightbox persistent mount: the lightbox is not yet open at onMounted', () => {
  // Regression: the parent only mounts once, self-gating internally via v-if="lb.open.value";
  // at onMounted time the lightbox is usually still closed -- if isMoving's 5s auto-hide timer
  // only arms once in onMounted, the component stays mounted for a long time, that timer long
  // since expires, and once a real openAt happens the top bar + nav arrows would all be invisible
  // due to isMoving=false, looking as if nothing rendered.
  it('the lightbox is closed at mount, and the 5s timer that predates any openAt has already expired -- the toolbar + nav arrows must be visible after openAt', async () => {
    vi.useFakeTimers()
    const w = mountLb() // lb.open.value === false at mount (beforeEach already called __resetForTest)
    expect(w.find('.lightbox').exists()).toBe(false)
    // Expire the timer armed in onMounted, before any open happens
    vi.advanceTimersByTime(5000)
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lightbox').exists()).toBe(true)
    expect(w.find('.lb-top').exists()).toBe(true) // top toolbar (favorite/download/info/delete etc.)
    expect(w.find('.lb-nav[data-side="next"]').exists()).toBe(true) // nav arrows
  })

  it('showInfo resets to false on open, even if the previous open had switched it to true', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-info-toggle').trigger('click')
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(true) // the previous open switched the info panel on
    lb.close()
    await nextTick()
    lb.openAt(IMG_B, THREE)
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(false) // reopening should default to collapsed
  })
})

describe('PhotoLightbox add to album', () => {
  it('the top bar renders an "add to album" button between the favorite and download buttons', async () => {
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

  it('clicking "add to album" emits add-to-album(current.id), the lightbox stays open', async () => {
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

describe('PhotoLightbox Live Photo', () => {
  it('a live item renders the live badge; press-and-hold plays <video src=liveUrl>, release hides it', async () => {
    const w = mountLb()
    lb.openAt(makePhoto({ id: 'lp', title: 'Live', isLivePhoto: true, livePhotoVideoId: 'lpv' }), [])
    await nextTick()
    const badge = w.find('.lb-live-btn') // Renamed to avoid parity's own unrelated `.lb-live-badge` rule
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

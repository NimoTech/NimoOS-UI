import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import PhotoInfoPanel from '../PhotoInfoPanel.vue'
// Style assertions read the component's source text (scoped <style> declarations aren't
// accessible in jsdom) -- following the same "anchor the rule body first, then assert
// properties" convention used elsewhere.
import PANEL_SRC from '../PhotoInfoPanel.vue?raw'
// `.lb-info`'s `grid-area`/`.map-mini`'s `height` no longer have local copies
// (retired -- both were byte-duplicates of parity's own `.photos-root .lb-info`/`.map-mini`, see
// PhotoInfoPanel.vue's scoped-style retirement note). Read parity's source instead now that it's
// what actually governs.
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
import { osmEmbedSrc } from '../util/osmMap'
import { usePhotosPeople } from '../../stores/people'
import { useAgentStore } from '../../../ai/stores/agentStore'
import { useAskNimo } from '../../composables/useAskNimo'
import type { Photo } from '../../util/assetToPhoto'

// Reuses the existing clipboard util (src/files/util/clipboard.ts's HTTP non-secure-context
// fallback approach) -- stubbed here to verify the call, without re-testing copyText's internal
// fallback logic (already covered by src/files/util/clipboard.test.ts).
const copyText = vi.fn((_text: string) => Promise.resolve())
vi.mock('../../../files/util/clipboard', () => ({ copyText: (t: string) => copyText(t) }))

// Since the lightbox face chip introduced usePhotosPeople(), this component depends on
// Pinia -- its three host pages (timeline/favorites/album detail) each already call
// setActivePinia, so this file's own unit tests need the same setup (a lesson learned
// elsewhere: forgetting to mount Pinia turns the test red, and it's not a bug in this
// component's own logic).
const svc = vi.hoisted(() => ({
  photos: {
    listPersons: vi.fn(
      (): Promise<{ persons: Array<Record<string, unknown>>; facesIndexedUpTo: string | null }> =>
        Promise.resolve({ persons: [], facesIndexedUpTo: null }),
    ),
    personFaceThumbnailUrl: vi.fn(
      (id: string | number, ver?: string | number | null) => `mock://face/${id}?ver=${ver ?? ''}`,
    ),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makePhoto(over: Partial<Photo> = {}): Photo {
  return {
    id: 'p1', title: 'Sunset', file: 'sunset.jpg', date: 'July 1, 2026', time: '12:00',
    takenAt: null, indexedAt: null, mimeType: 'image/jpeg', fileSize: 0,
    isVideo: false, hasOcr: false, isNew: false, isLivePhoto: false, livePhotoVideoId: null,
    duration: null, durationMs: 0, fav: false, status: undefined, filePath: '/DATA/Gallery/sunset.jpg',
    width: null, height: null, dim: null, size: '', latitude: null, longitude: null, coords: null,
    place: null, camera: null, iso: null, shutter: null, aperture: null, focal: null, orientation: null,
    videoCodec: null, audioCodec: null, frameRate: null, bitRate: null, rotation: 0, matchScore: null,
    matchedBy: null, belowCut: false, tags: [], scene: null, faces: [], ...over,
  } as Photo
}

function mountPanel(photo: Photo | null, visible = true) {
  return mount(PhotoInfoPanel, {
    props: { photo, visible },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.listPersons.mockClear().mockResolvedValue({ persons: [], facesIndexedUpTo: null })
  svc.photos.personFaceThumbnailUrl.mockClear()
  // This file's own beforeEach -- onGiveNimo now calls
  // useAskNimo().openWith(), which calls ensureNimoAgentInit() internally.
  const agent = useAgentStore('photos')
  agent.loadAvailableModels = vi.fn(async () => {})
  agent.createSession = vi.fn(async () => { agent.activeSessionId = 's0' })
  agent.deleteSession = vi.fn(async () => {})
  agent.setSessionTitle = vi.fn(async () => {})
  useAskNimo().__resetForTests()
})

afterEach(() => {
  copyText.mockClear()
})

describe('PhotoInfoPanel', () => {
  it('renders the camera section with populated fields, omitting empty ones', () => {
    const photo = makePhoto({ camera: 'Canon EOS R5', iso: 200, dim: '4000 × 3000', size: '3.2 MB', aperture: null })
    const w = mountPanel(photo)
    const text = w.text()
    expect(text).toContain('Canon EOS R5')
    expect(text).toContain('200')
    expect(text).toContain('4000 × 3000')
    expect(text).toContain('3.2 MB')
    // aperture is null → its row must not render at all
    expect(w.find('[data-field="aperture"]').exists()).toBe(false)
    expect(text).not.toContain('f/')
  })

  it('formats aperture and focal length like the Vue2 source', () => {
    const photo = makePhoto({ aperture: 1.8, focal: 35 })
    const w = mountPanel(photo)
    expect(w.text()).toContain('f/1.8')
    expect(w.text()).toContain('35 mm')
  })

  it('renders the video section (not the camera section) for a video photo', () => {
    const photo = makePhoto({ isVideo: true, duration: '1:23', dim: '1920 × 1080', videoCodec: 'h264' })
    const w = mountPanel(photo)
    expect(w.find('[data-field="duration"]').exists()).toBe(true)
    expect(w.find('[data-field="video-codec"]').exists()).toBe(true)
    expect(w.find('[data-field="camera"]').exists()).toBe(false)
  })

  it('renders an OSM iframe with osmEmbedSrc when lat/lon are present', () => {
    const photo = makePhoto({ latitude: 31.23, longitude: 121.47, place: 'Shanghai', coords: '31.230000, 121.470000' })
    const w = mountPanel(photo)
    const iframe = w.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toBe(osmEmbedSrc(31.23, 121.47))
    expect(iframe.attributes('loading')).toBe('lazy')
    expect(w.find('.map-pin').exists()).toBe(true)
  })

  // Root class renamed from the invented `.info-panel` to parity's real anchor
  // `.lb-info` (grid-area: info), and `.map-mini`'s height corrected to parity's 132px.
  // Both style assertions below are retargeted to parity's source -- `grid-area`/
  // `height` no longer have local copies (retired as byte-duplicates, see PhotoInfoPanel.vue's
  // scoped-style retirement note); parity's `.photos-root .lb-info`/`.photos-root .map-mini`
  // solely govern now that this component nests inside `.photos-root`.
  describe('structure: .lb-info anchor + grid-area', () => {
    it('the root element renders as .lb-info (not the old .info-panel)', () => {
      const w = mountPanel(makePhoto())
      expect(w.find('.lb-info').exists()).toBe(true)
      expect(w.find('.info-panel').exists()).toBe(false)
    })

    it('the .lb-info rule includes grid-area: info (as a direct child of the PhotoLightbox grid)', () => {
      const m = /\.photos-root \.lb-info\s*\{([^}]*)\}/.exec(PARITY_SRC)
      expect(m).not.toBeNull()
      expect(m![1]).toMatch(/grid-area:\s*info/)
    })

    it('.map-mini height matches Vue2/parity\'s 132px (previously 140px)', () => {
      const m = /\.photos-root \.map-mini\s*\{([^}]*)\}/.exec(PARITY_SRC)
      expect(m).not.toBeNull()
      expect(m![1]).toMatch(/height:\s*132px/)
    })
  })

  // `.lb-info { display:flex; flex-direction:column; gap:16px }` +
  // `.info-section { ...; gap:6px }` were an unregistered pixel deviation -- Vue2 stacks sections
  // flush (padding 12px 20px + border-bottom, no gap at all, parity :690-691), not with a 16px/6px
  // flex gap layered on top. Assert both rules stop declaring flex/flex-direction/gap so parity's
  // flush stacking governs.
  describe('.lb-info / .info-section no longer stack an extra flex gap (aligning with Vue2\'s flush stacking)', () => {
    // Only look for rules inside the actual <style scoped> block -- this file's own template
    // comment at the top already quotes an explanatory snippet like
    // "`.lb-info { grid-area: info; ... }`" (describing what parity's rule looks like); running an
    // unanchored regex over the whole PANEL_SRC would match that example text in the comment
    // before the real CSS rule, silently producing a false positive (confirmed by an earlier
    // investigation).
    const STYLE_BLOCK = /<style[^>]*>([\s\S]*)<\/style>/.exec(PANEL_SRC)![1]

    it('the local .lb-info rule declares no display/flex-direction/gap', () => {
      const m = /\.lb-info\s*\{([^}]*)\}/.exec(STYLE_BLOCK)
      expect(m, 'could not find the .lb-info rule').not.toBeNull()
      expect(m![1]).not.toMatch(/display:\s*flex/)
      expect(m![1]).not.toMatch(/flex-direction/)
      expect(m![1]).not.toMatch(/gap/)
    })

    it('the local .info-section rule declares no display/flex-direction/gap', () => {
      const m = /(?<!\.)\.info-section\s*\{([^}]*)\}/.exec(STYLE_BLOCK)
      expect(m, 'could not find the .info-section rule').not.toBeNull()
      expect(m![1]).not.toMatch(/display:\s*flex/)
      expect(m![1]).not.toMatch(/flex-direction/)
      expect(m![1]).not.toMatch(/gap/)
    })

    it('parity\'s .photos-root .info-section is still a flush stack via padding + border-bottom', () => {
      const m = /\.photos-root \.info-section\s*\{([^}]*)\}/.exec(PARITY_SRC)
      expect(m, "could not find parity's .photos-root .info-section").not.toBeNull()
      expect(m![1]).toMatch(/padding:\s*12px 20px/)
      expect(m![1]).toMatch(/border-bottom/)
    })
  })

  // Removes OSM's own embedded-page footer text (Report a problem /
  // Make a Donation / Website and API terms). The iframe is cross-origin, so internal elements
  // can't be hidden via CSS -- only the outer crop works; the crop must be symmetric top/bottom,
  // otherwise OSM's own marker ends up misaligned below .map-pin.
  describe('OSM footer crop', () => {
    const rule = (sel: string): string => {
      const m = new RegExp(`${sel}\\s*\\{([^}]*)\\}`).exec(PANEL_SRC)
      expect(m).not.toBeNull()
      return m![1]
    }

    it('the iframe is symmetrically taller and shifted up (crops the footer + keeps the map center aligned with the box center)', () => {
      const body = rule('\\.map-mini iframe')
      expect(body).toMatch(/top:\s*-48px/)
      expect(body).toMatch(/height:\s*calc\(100% \+ 96px\)/) // 2 × 48, symmetric
      expect(body).toMatch(/position:\s*absolute/)
    })

    it('adds a self-drawn attribution notice (ODbL requires attribution, so the credit can\'t be cropped away with the footer)', () => {
      const photo = makePhoto({ latitude: 31.23, longitude: 121.47, place: 'Shanghai' })
      const w = mountPanel(photo)
      const credit = w.find('.map-credit')
      expect(credit.exists()).toBe(true)
      expect(credit.text()).toContain('OpenStreetMap')
    })

    it('the attribution notice has a theme-exception fixed light color (it sits on top of arbitrary tiles, whose color is unpredictable)', () => {
      const body = rule('\\.map-credit')
      // The color-guard exemption window is a line-by-line state machine -- the comment must sit right above the exempted declaration
      expect(PANEL_SRC).toMatch(/theme-exception[^\n]*\n\s*color:\s*rgba\(255, 255, 255, 0\.72\)/)
      expect(body).toMatch(/pointer-events:\s*none/)
    })
  })

  it('omits the location section entirely when lat/lon are absent', () => {
    const photo = makePhoto({ latitude: null, longitude: null })
    const w = mountPanel(photo)
    expect(w.find('iframe').exists()).toBe(false)
  })

  it('hides the people/nimo-sees sections when faces/tags are empty (the timeline data path so far)', () => {
    const photo = makePhoto({ faces: [], tags: [], scene: null })
    const w = mountPanel(photo)
    expect(w.find('[data-section="people"]').exists()).toBe(false)
    expect(w.find('[data-section="nimo-sees"]').exists()).toBe(false)
  })

  it('renders face and tag chips; no unique person match → text/placeholder only (no img)', async () => {
    const photo = makePhoto({ faces: ['Alice', 'Bob'], tags: ['beach', 'sunset'], scene: 'Outdoor' })
    const w = mountPanel(photo)
    await w.vm.$nextTick()
    expect(w.find('[data-section="people"]').exists()).toBe(true)
    expect(w.findAll('.face-chip')).toHaveLength(2)
    expect(w.find('.face-chip img').exists()).toBe(false) // people list empty → no unique match, placeholder only
    expect(w.find('[data-section="nimo-sees"]').exists()).toBe(true)
    // Renamed from `.tag-chip` to parity's real anchor `.tag[data-kind="ai"]`.
    expect(w.findAll('.tag[data-kind="ai"]')).toHaveLength(2)
  })

  // Face-chip real avatars. Prerequisite fact correction: the backend has no asset-scoped
  // face-thumbnail endpoint, Photo.faces is just an array of name strings -- what's implemented
  // here is an enhancement that looks up the person list by name to get a personId, and only
  // shows a real avatar on a unique match, beyond what Vue2 originally does with its initial placeholder.
  describe('face-chip real avatars (an enhancement beyond Vue2 1:1, logged as a deviation)', () => {
    it('faces non-empty and there is a unique same-name match in the person list → renders <img>, src goes through personFaceThumbnailUrl with ver', async () => {
      svc.photos.listPersons.mockResolvedValue({
        persons: [{ id: 'pid-1', name: 'Alice', coverFaceId: 'face-9' }],
        facesIndexedUpTo: null,
      })
      const photo = makePhoto({ faces: ['Alice'] })
      const w = mountPanel(photo)
      await Promise.resolve() // fetchPeople's await
      await Promise.resolve()
      await w.vm.$nextTick()

      const img = w.find('.face-chip img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('mock://face/pid-1?ver=face-9')
      expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('pid-1', 'face-9')
    })

    it('duplicate names (two people share a name) → still falls back to the initial placeholder, uppercased (personInitial, incidentally fixing the un-uppercased f[0] bug)', async () => {
      svc.photos.listPersons.mockResolvedValue({
        persons: [
          { id: 'pid-1', name: 'alice', coverFaceId: 'face-1' },
          { id: 'pid-2', name: 'alice', coverFaceId: 'face-2' },
        ],
        facesIndexedUpTo: null,
      })
      const photo = makePhoto({ faces: ['alice'] })
      const w = mountPanel(photo)
      await Promise.resolve()
      await Promise.resolve()
      await w.vm.$nextTick()

      expect(w.find('.face-chip img').exists()).toBe(false)
      expect(w.find('.face-avatar').text()).toBe('A') // personInitial('alice') = 'A', not the un-uppercased 'a'
    })

    it('faces empty → does not trigger fetchPeople (negative assertion, avoiding a wasted fetch every time an image opens)', async () => {
      const photo = makePhoto({ faces: [] })
      mountPanel(photo)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(svc.photos.listPersons).not.toHaveBeenCalled()
    })

    it('faces non-empty and people.peopleLoaded is already true (loaded upstream already) → does not re-fetchPeople', async () => {
      const people = usePhotosPeople()
      await people.fetchPeople() // pre-set to already loaded
      svc.photos.listPersons.mockClear()

      const photo = makePhoto({ faces: ['Alice'] })
      mountPanel(photo)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(svc.photos.listPersons).not.toHaveBeenCalled()
    })
  })

  // The "Hand off to Nimo" button is restored per
  // Vue2 PhotosLightbox.vue:84-87 -- this case used to assert its ABSENCE (an earlier
  // delta note #1); flipped to assert presence + a safe no-op click (real wiring is a later
  // phase's job, same precedent as PersonHero.vue's onAskNimo).
  describe('"Hand off to Nimo" button (restored per Vue2 PhotosLightbox.vue:84-87)', () => {
    it('renders .give-nimo, data-test=lb-give-nimo, text from photosHandOffToNimo', () => {
      const w = mountPanel(makePhoto())
      const btn = w.find('[data-test="lb-give-nimo"]')
      expect(btn.exists()).toBe(true)
      expect(btn.classes()).toContain('give-nimo')
      expect(btn.text()).toBe(zh.photosHandOffToNimo)
    })

    // Wires the previously no-op onGiveNimo to useAskNimo().openWith() with
    // Vue2's exact canned prompt (PhotosLightbox.vue:84 -- `$t('Edit this photo: {title}',
    // { title: photo.title })`, always photo.title as-is, no filePath-basename derivation).
    // filePath is deliberately set to a DIFFERENT basename than title here, to prove the prefill
    // tracks title only and is not silently re-derived from the file path.
    it('clicking opens Ask Nimo, the prefill text comes from photo.title (no filePath basename derivation)', async () => {
      const photo = makePhoto({ title: 'sunset', filePath: '/a/b/unrelated-name.jpg' })
      const w = mountPanel(photo)
      await w.find('[data-test="lb-give-nimo"]').trigger('click')
      expect(useAskNimo().popupOpen.value).toBe(true)
      expect(useAskNimo().prefill.value).toBe('编辑这张照片：sunset')
    })

    it('falls back to photo.id when photo.title is missing (null/undefined)', async () => {
      const photo = makePhoto({ title: undefined as unknown as string, id: 'p42' })
      const w = mountPanel(photo)
      await w.find('[data-test="lb-give-nimo"]').trigger('click')
      expect(useAskNimo().prefill.value).toBe('编辑这张照片：p42')
    })

    it('the button also doesn\'t render when visible=false (hidden along with the whole panel)', () => {
      const w = mountPanel(makePhoto(), false)
      expect(w.find('[data-test="lb-give-nimo"]').exists()).toBe(false)
    })
  })

  it('renders nothing when visible=false', () => {
    const w = mountPanel(makePhoto(), false)
    expect(w.find('.lb-info').exists()).toBe(false)
  })

  it('renders nothing when photo is null', () => {
    const w = mountPanel(null, true)
    expect(w.find('.lb-info').exists()).toBe(false)
  })

  it('copies the file path via the clipboard util and flips to the copied label for ~2s', async () => {
    vi.useFakeTimers()
    const photo = makePhoto({ filePath: '/DATA/Gallery/sunset.jpg' })
    const w = mountPanel(photo)
    const btn = w.find('.copy-btn')
    expect(w.text()).toContain('/DATA/Gallery/sunset.jpg')
    await btn.trigger('click')
    expect(copyText).toHaveBeenCalledWith('/DATA/Gallery/sunset.jpg')
    await Promise.resolve()
    expect(w.text()).toContain(zh.photosCopied)
    vi.advanceTimersByTime(2100)
    await Promise.resolve()
    expect(w.text()).not.toContain(zh.photosCopied)
    vi.useRealTimers()
  })

  // Slide-in open/close transition, a
  // net addition over Vue2 (which has none -- bare `v-if`, see this component's style-block
  // comment about it). jsdom doesn't run CSS transitions, so this is a raw-source assertion (same idiom as
  // PhotoLightbox.test.ts's own `.lb-swap-*`/`.lb-confirm` transition-name/timing checks).
  describe('the info panel\'s slide-in open/close transition (a net addition)', () => {
    it('<aside class="lb-info"> is wrapped in <transition name="lb-info-slide">', () => {
      expect(PANEL_SRC).toMatch(/<transition name="lb-info-slide">\s*<aside v-if="visible && photo" class="lb-info">/)
    })

    it('transition duration/easing uses the house cubic-bezier(0.22, 0.61, 0.36, 1), only changing transform/opacity', () => {
      const activeRule = /\.lb-info-slide-enter-active,\s*\.lb-info-slide-leave-active\s*\{([^}]*)\}/.exec(PANEL_SRC)
      expect(activeRule, 'could not find the .lb-info-slide-enter-active/-leave-active rule').not.toBeNull()
      expect(activeRule![1]).toMatch(/transition:\s*transform 0\.28s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\), opacity 0\.22s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\)/)
    })

    it('pre-enter/post-leave state: offset to the right + transparent, no layout properties at all (won\'t reflow .lb-main)', () => {
      const endStateRule = /\.lb-info-slide-enter-from,\s*\.lb-info-slide-leave-to\s*\{([^}]*)\}/.exec(PANEL_SRC)
      expect(endStateRule, 'could not find the .lb-info-slide-enter-from/-leave-to rule').not.toBeNull()
      const body = endStateRule![1]
      expect(body).toMatch(/transform:\s*translateX\(24px\)/)
      expect(body).toMatch(/opacity:\s*0/)
      expect(body).not.toMatch(/width|height|margin|padding|grid/)
    })
  })
})

// SP7-P8a-T5: PhotosSettings.vue -- the settings page container, wiring in T3 (storage card) /
// T4 (AI card) + a real route `/photos/settings` + sidebar entry. See task-5-brief.md's header
// and the component's own file-header comment for the source-mapping coordinates.
//
// Both cards already have their own dedicated unit tests (PhotosStorageCard.test.ts /
// PhotosAiCard.test.ts) covering their internal logic; here global.stubs replaces them with two
// minimal stubs (each carrying a #storage/#ai anchor + a trigger that can emit('toast', ...)),
// verifying only the container's own wiring, not re-testing the cards' internal behaviour --
// following the established stub pattern from PhotosSearch.test.ts:1056-1060.
//
// Test-infrastructure deviations logged here (where the brief disagrees with this repo's actual
// behaviour, this repo's measured behaviour wins -- see task-5-report.md for the full record):
// 1. The brief's Step 1 guard case asserts "no second sidebar mounted" by checking
//    `wrapper.findComponent(PhotosSidebar).exists()` should be false -- but AreaShell.vue itself
//    has no concept of a sidebar (confirmed by reading its source: only header/slot). The
//    sidebar is mounted once by each /photos/* view inside the shell (an established precedent
//    at PhotosAlbums.vue:187, which this component mirrors). Asserting `false` literally would
//    require this page to mount no sidebar at all -- a real UX regression (the user would see no
//    navigation on the settings page) and a direct violation of this task's dispatch, which
//    explicitly requires "copying PhotosAlbums.vue's structure". Changed to asserting "exactly
//    one" (`findAllComponents(...).length === 1`), which is what the "no duplicate mount"
//    invariant actually needs to guard.
// 2. The brief's Step 1 "fetch all five pieces of data on mount" contradicts the Interface Debt
//    section ("your container must call these four and only these four -- fetchStorage belongs
//    to StorageCard itself"). This file follows the latter (more specific and authoritative),
//    asserting the four explicit actions plus a reverse lock that "fetchStorage is never called
//    by the container" (guarding against someone adding it back and causing a double fetch).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

// P8a-T6 review fix (Important 1): getConfig added into the mock -- it used to be the empty
// object `photos: {}`, which meant any real (un-spied) fetchAiFeatures call would synchronously
// throw a TypeError (not a function) when calling `service.photos.getConfig()`, swallowed by
// fetchAiFeatures's own try/catch. It happened to "look" correct but never actually verified the
// "only one real network request is sent" invariant -- the new network-level dedup test case
// (see the describe block below) needs a real vi.fn() to count calls.
vi.mock('@nimotech/nimoos-service', () => ({ service: { photos: { getConfig: vi.fn() } } }))

import PhotosSettings from '../PhotosSettings.vue'
import photosSettingsRaw from '../PhotosSettings.vue?raw'
import PhotosSidebar from '../../photos/components/PhotosSidebar.vue'
import { service } from '@nimotech/nimoos-service'
import { usePhotosSettingsStore } from '../../photos/stores/settings'
import { extractStyleBlock } from '../../photos/components/__tests__/cssCascade'

const StorageStub = {
  template:
    '<section id="storage" data-test="storage-card-stub" @click="$emit(\'toast\', { icon: \'trash\', text: \'toast-from-storage\' })"></section>',
}
const AiStub = {
  template:
    '<section id="ai" data-test="ai-card-stub" @click="$emit(\'toast\', { icon: \'sparkles\', text: \'toast-from-ai\' })"></section>',
}

function makeRouter(path: string) {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
    ],
  })
  router.push(path)
  return router
}

async function mountView(path = '/photos/settings') {
  const router = makeRouter(path)
  await router.isReady()
  const w = mount(PhotosSettings, {
    global: {
      plugins: [router],
      stubs: { PhotosStorageCard: StorageStub, PhotosAiCard: AiStub },
    },
  })
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

// Same as mountView, but hands the router back too -- the two review-fix (Important 1) test
// cases need to router.push the same route with only the query changed *after* mounting, to
// verify the "user is already sitting on this page" path (watch, not the mounted-time path).
// mountView's own return shape is left untouched to avoid touching every existing test case's
// destructuring above.
async function mountViewWithRouter(path = '/photos/settings') {
  const router = makeRouter(path)
  await router.isReady()
  const w = mount(PhotosSettings, {
    global: {
      plugins: [router],
      stubs: { PhotosStorageCard: StorageStub, PhotosAiCard: AiStub },
    },
  })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

// jsdom does not implement scrollIntoView (brief ruling #2) -- manually record which element
// each call targets, rather than depending on vitest mock's this-context API version quirks.
let scrollCalls: Element[]
// Also record the argument string of every querySelector call -- the "?section= illegal value
// does not scroll" invariant would be false if judged only by whether scrollIntoView was called:
// the only two ids that exist on the page are storage/ai, so any "illegal" value (e.g. the
// string '1' from Vue2's settings=1 scenario) naturally finds no element and scrollIntoView
// naturally never gets called -- regardless of whether the whitelist guard is present or not,
// this invariant cannot detect a mutation that way. What actually needs to be locked down is
// "was scrollTo ever called", proven directly by querySelector's call arguments, independent of
// whether it hits a real element. Also, '#1' is not a legal CSS id selector (starts with a
// digit); jsdom's real querySelector throws a SyntaxError for it -- this forwards to the real
// implementation but swallows that error so it doesn't become an unhandled rejection polluting
// other test cases.
let queryCalls: string[]
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.mocked(service.photos.getConfig).mockReset().mockResolvedValue({})
  scrollCalls = []
  queryCalls = []
  const realQuerySelector = Element.prototype.querySelector
  Element.prototype.querySelector = function (this: Element, selectors: string) {
    queryCalls.push(selectors)
    try {
      return realQuerySelector.call(this, selectors)
    } catch {
      return null
    }
  }
  Element.prototype.scrollIntoView = function (this: Element) { scrollCalls.push(this) }
})
afterEach(() => {
  // Defensive teardown: if a test case throws mid-way, don't let fake-timer state leak into
  // the next test case.
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('PhotosSettings container', () => {
  it('calls fetchAbout/fetchRetention/fetchScanInterval/fetchAiFeatures on mount, without re-calling fetchStorage', async () => {
    const store = usePhotosSettingsStore()
    const fetchAbout = vi.spyOn(store, 'fetchAbout').mockResolvedValue(undefined)
    const fetchRetention = vi.spyOn(store, 'fetchRetention').mockResolvedValue(undefined)
    const fetchScanInterval = vi.spyOn(store, 'fetchScanInterval').mockResolvedValue(undefined)
    const fetchAiFeatures = vi.spyOn(store, 'fetchAiFeatures').mockResolvedValue(store.aiFeatures)
    const fetchStorage = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)

    await mountView()

    expect(fetchAbout).toHaveBeenCalledTimes(1)
    expect(fetchRetention).toHaveBeenCalledTimes(1)
    expect(fetchScanInterval).toHaveBeenCalledTimes(1)
    // P8a-T6: this page's own header comment (:14-17) states "the whole page has exactly one
    // PhotosSidebar copy", and T6 wires PhotosSidebar into fetchAiFeatures() too (§7e-15 -- the
    // sidebar needs aiFeatures.smartview to decide whether to hide the smart-view entry) -- this
    // page itself plus the one sidebar it mounts each call the action once in the same frame,
    // which is 2 *action calls*, not 2 network requests (settings.ts's in-flight dedup merges
    // concurrent calls into 1 getConfig, see settings.test.ts's dedup case). This assertion
    // changing from 1 to 2 is a genuine behaviour change, not a loosened assertion papering over
    // a regression.
    expect(fetchAiFeatures).toHaveBeenCalledTimes(2)
    expect(fetchStorage).not.toHaveBeenCalled()
  })

  // P8a-T6 review fix (Important 1): the previous test case spies fetchAiFeatures as
  // `.mockResolvedValue(...)`, so the store's real dedup code (the `aiFeaturesInFlight` block in
  // settings.ts) never actually runs -- that assertion only proves "this page + the sidebar it
  // mounts each call the action once", not that "the two action calls ultimately land only one
  // real network request". Here `fetchAiFeatures` is not spied, letting the real implementation
  // run, and counts calls directly at the HTTP layer (`service.photos.getConfig`, a vi.fn() that
  // is mocked but has its implementation left untouched) -- that is the actual invariant §7e-15
  // needs: the sidebar and the page itself each trigger the action once in the same frame, and
  // it must land exactly one request.
  //
  // fetchRetention/fetchScanInterval must be spied individually (mockResolvedValue, so the real
  // implementation doesn't run): both of these actions also call service.photos.getConfig() (to
  // fetch the current watchDirs/retentionDays and write them back together -- the "read then
  // write" pattern noted in settings.ts's header comment), which is unrelated to aiFeatures's
  // dedup -- the first manual run without spying them got 3 calls (1 deduped aiFeatures + 1
  // fetchRetention + 1 fetchScanInterval), which isn't dedup failing, it's the test not
  // isolating the unrelated getConfig sources cleanly. fetchAbout never touches getConfig, so it
  // needs no spy.
  it('§7e-15 network-level dedup proof: PhotosSettings itself + the PhotosSidebar it mounts each call fetchAiFeatures once in the same frame, and the real getConfig fires only once', async () => {
    const store = usePhotosSettingsStore()
    vi.spyOn(store, 'fetchRetention').mockResolvedValue(undefined)
    vi.spyOn(store, 'fetchScanInterval').mockResolvedValue(undefined)
    await mountView()
    expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
  })

  it('picks up a toast event from the card and dismisses it after 2800ms', async () => {
    // Complete mounting with real timers first (mountView's internal flushPromises relies on
    // setTimeout(0) to land -- switching to fake timers beforehand would hang -- only switch to
    // fake timers once mounting has settled, to take over just the toast timing).
    const w = await mountView()
    vi.useFakeTimers()

    await w.get('[data-test="storage-card-stub"]').trigger('click')
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
    expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-storage')

    await vi.advanceTimersByTimeAsync(2799)
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(2)
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('two toasts in a row: the second resets the timer and is not cut short early by the first timer', async () => {
    const w = await mountView()
    vi.useFakeTimers()

    await w.get('[data-test="storage-card-stub"]').trigger('click') // t=0, text=toast-from-storage
    await vi.advanceTimersByTimeAsync(2000) // t=2000, still inside the first toast's 2800ms window
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)

    await w.get('[data-test="ai-card-stub"]').trigger('click') // t=2000, resets to text=toast-from-ai
    await vi.advanceTimersByTimeAsync(800) // t=2800 (when the first toast's original timer would have fired)
    // If clearTimeout didn't take effect, the first toast's old timer would clear it early right
    // here -- it must still be visible, with the second toast's text (proving the reset actually
    // happened, not that it just hasn't expired yet by coincidence).
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
    expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-ai')

    await vi.advanceTimersByTimeAsync(2000) // t=4800, when the second toast (2800ms from t=2000) is due
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('?section=ai scrolls to the AI card on mount', async () => {
    const w = await mountView('/photos/settings?section=ai')
    expect(scrollCalls).toHaveLength(1)
    expect(scrollCalls[0]).toBe(w.get('#ai').element)
  })

  it('?section=storage scrolls to the storage card on mount', async () => {
    const w = await mountView('/photos/settings?section=storage')
    expect(scrollCalls).toHaveLength(1)
    expect(scrollCalls[0]).toBe(w.get('#storage').element)
  })

  it('no scroll when ?section= is missing', async () => {
    await mountView('/photos/settings')
    expect(scrollCalls).toHaveLength(0)
    expect(queryCalls).not.toContain('#storage')
    expect(queryCalls).not.toContain('#ai')
  })

  // Cannot rely on scrollCalls alone to judge: the only two ids that exist on the page are
  // storage/ai, so any "illegal" value (e.g. the string '1' from Vue2's settings=1 scenario)
  // naturally finds no element and scrollIntoView naturally never gets called -- regardless of
  // whether the whitelist guard is present, this invariant cannot detect a mutation with
  // scrollCalls alone (verified by an actual mutation test, see task-5-report.md's mutation-test
  // record). What actually needs to be locked down is "was scrollTo(illegal value) ever called",
  // proven directly by querySelector's call arguments -- if the whitelist were removed,
  // scrollTo('1') would be called, triggering a `querySelector('#1')` call, which leaves that
  // call record behind even though no element is found.
  it('?section= illegal value (e.g. "1" -- in Vue2, settings=1 only meant "open", not a target id) does not scroll', async () => {
    await mountView('/photos/settings?section=1')
    expect(scrollCalls).toHaveLength(0)
    expect(queryCalls).not.toContain('#1')
  })

  // Review fix Important 1 (2026-08-04): vue-router 4 does not remount the same route component
  // when only the query changes -- if the user is already sitting on /photos/settings (no
  // section) and the query becomes ?section=ai (address bar edited by hand, or a future in-page
  // link pointing at this page), onMounted will not re-fire, so a watch is needed to cover this
  // path.
  it('query only becomes ?section=ai after already sitting on this page -- the watch path scrolls (without a remount)', async () => {
    const { w, router } = await mountViewWithRouter('/photos/settings')
    expect(scrollCalls).toHaveLength(0) // no section at mount time -- first confirm the starting point really doesn't scroll

    await router.push('/photos/settings?section=ai') // only the query changes, the same route component is not remounted
    await flushPromises()
    await w.vm.$nextTick()

    expect(scrollCalls).toHaveLength(1)
    expect(scrollCalls[0]).toBe(w.get('#ai').element)
  })

  // The whitelist still applies on this same path -- adding the watch must not let illegal
  // values slip through.
  it('query only becomes ?section=1 (illegal) after already sitting on this page -- the watch path also does not scroll', async () => {
    const { w, router } = await mountViewWithRouter('/photos/settings')

    await router.push('/photos/settings?section=1')
    await flushPromises()
    await w.vm.$nextTick()

    expect(scrollCalls).toHaveLength(0)
    expect(queryCalls).not.toContain('#1')
  })

  it('footer: does not render the "· v" fragment when version is missing', async () => {
    const store = usePhotosSettingsStore()
    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
      store.about = { version: '', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
    })
    const w = await mountView()
    expect(w.find('.ps-footer-app').text()).not.toMatch(/·\s*v/)
  })

  it('footer: renders "· v{version}" when version is present', async () => {
    const store = usePhotosSettingsStore()
    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
      store.about = { version: '2.3.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
    })
    const w = await mountView()
    expect(w.get('.ps-footer-app').text()).toContain('v2.3.0')
  })

  it('footer: the whole segment does not render when librarySince is missing', async () => {
    const store = usePhotosSettingsStore()
    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
      store.about = { version: '1.0.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
    })
    const w = await mountView()
    expect(w.get('.ps-footer-host').text()).not.toContain('建库于')
  })

  it('footer: renders "· 建库于 {date}" (library-established-on prefix) when librarySince is present', async () => {
    const store = usePhotosSettingsStore()
    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
      store.about = { version: '1.0.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '2026-01-15T00:00:00Z' }
    })
    const w = await mountView()
    expect(w.get('.ps-footer-host').text()).toContain('建库于')
  })

  it('footer: "运行于 {deviceName}" (running on) falls back to NAS when about is missing', async () => {
    const w = await mountView()
    expect(w.get('.ps-footer-host').text()).toContain('运行于')
    expect(w.get('.ps-footer-host').text()).toContain('NAS')
  })

  // Architecture-deviation guard 1/2 (see the four items logged in the file header + component
  // header comment).
  it('the sidebar mounts exactly once (not "auto-generated by AreaShell", and not mounted twice)', async () => {
    const w = await mountView()
    expect(w.findAllComponents(PhotosSidebar)).toHaveLength(1)
  })

  it('does not render a sign-out entry (D22)', async () => {
    const w = await mountView()
    expect(w.text()).not.toMatch(/登出|Sign out/)
  })

  it('quick nav: clicking an anchor scrolls to the corresponding card', async () => {
    const w = await mountView()
    await w.get('.ps-quicknav a[href="#ai"]').trigger('click')
    expect(scrollCalls).toHaveLength(1)
    expect(scrollCalls[0]).toBe(w.get('#ai').element)
    await w.get('.ps-quicknav a[href="#storage"]').trigger('click')
    expect(scrollCalls).toHaveLength(2)
    expect(scrollCalls[1]).toBe(w.get('#storage').element)
  })

  // Plan H Task 11 (re-shell): swaps the transitional AreaShell/.photos-layout shell for the
  // shared `.app` CSS Grid (PhotosSidebar + main.main > PhotosTopbar + .photos-main), following
  // every other re-shelled Photos view's own precedent.
  it('mounts the .app shell with PhotosTopbar (Settings title, search hidden)', async () => {
    const w = await mountView()
    expect(w.find('.photos-root .app').exists()).toBe(true)
    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.exists()).toBe(true)
    expect(topbar.props('showSearch')).toBe(false)
  })

  // PhotosSidebar.vue already has a `toggleTheme` icon button consuming the same
  // usePhotosTheme() singleton -- this page used to mount a second, redundant entry point
  // (PhotosThemeToggle.vue), which this task drops.
  it('does not render a second, page-local theme toggle -- the sidebar icon button is the only entry point', async () => {
    const w = await mountView()
    expect(w.findComponent({ name: 'PhotosThemeToggle' }).exists()).toBe(false)
  })

  // X-1/X-6: negative guard mirroring Plan G's own askNimoHostMounted.test.ts assertion for
  // this specific page -- this page must never mount AskNimoHost or pass show-ask-nimo (Vue2
  // Settings has no Ask Nimo entry point in its topbar).
  it('does not mount AskNimoHost or pass show-ask-nimo (Vue2 Settings has no Ask Nimo entry)', async () => {
    const w = await mountView()
    expect(w.findComponent({ name: 'AskNimoHost' }).exists()).toBe(false)
    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.props('showAskNimo')).toBeFalsy()
  })
})

// A real regression caught by the full sign-off gate (459 files / 5893 cases): .ps-toast was
// once mis-copied as 1100, the same layer as the global toast (AppToast.vue, also 1100) --
// AppToast.zIndex.test.ts is a repo-wide guard, but that test only runs by scanning all 459
// files in the repo, invisible within a single task's scope. This adds a local guard here that
// fails faster and doesn't depend on a repo-wide glob, pinning only this file's own output. It
// only locks the hard line "strictly below 1100" (the one invariant nailed down by
// docs/THEMING.md §8); it deliberately does not additionally lock <1000/<200 -- those are
// choices made here based on this page's own measured overlays (PhotosSidebar's narrow-screen
// drawer at 151 / scrim at 150), not a repo-wide convention, and locking specific numbers would
// only turn red on the next legitimate adjustment.
describe('z-index layering (docs/THEMING.md §8)', () => {
  it('the z-index of .ps-toast stays strictly below the global toast (1100) -- a local overlay on this page must not borrow the global toast layer', () => {
    const style = extractStyleBlock(photosSettingsRaw)
    expect(style.length).toBeGreaterThan(0)
    const block = /\.ps-toast\s*\{([^}]*)\}/.exec(style)
    expect(block, '.ps-toast rule block not found').toBeTruthy()
    const zMatch = /z-index\s*:\s*(\d+)/.exec((block as RegExpExecArray)[1])
    expect(zMatch, '.ps-toast rule block has no z-index declaration').toBeTruthy()
    const z = Number((zMatch as RegExpExecArray)[1])
    expect(z).toBeLessThan(1100)
  })
})

describe('routing: /photos/settings only appends, never reorders', () => {
  it('/photos/settings appears in the source text after the last existing /photos/* route (/photos/search)', () => {
    // ⚠️ Asserts against source-text line order via node:fs, not router.getRoutes() -- vue-router
    // 4's getRoutes() sorts dynamic-segment routes before static ones (confirmed in P6b,
    // recorded in global-constraints.md).
    const src = readFileSync('src/router/index.ts', 'utf8')
    expect(src.length).toBeGreaterThan(0)
    const idxSettings = src.indexOf("'/photos/settings'")
    const idxSearch = src.indexOf("'/photos/search'")
    expect(idxSettings).toBeGreaterThan(-1)
    expect(idxSearch).toBeGreaterThan(-1)
    expect(idxSettings).toBeGreaterThan(idxSearch)
  })
})

// Task 6 (SP7-P5 People): PhotosPeople.vue —— the people list view (banner + confidence
// dropdown + filter/sort + two warning banners + merge-suggestion banner + Pinned/Named/
// Unnamed sections + floating action menu + empty state).
// Mounts Pinia + i18n + a real router (spy on push, don't mock the whole vue-router — both
// AreaShell and PhotosSidebar use useRouter(), following the existing mounting pattern from
// PhotosAlbums.test.ts), mocks the shared package's photos methods.
// Covers the 12-item behavior checklist from brief Step 1 + the three sources of
// facesEnabled (false / missing field / request failure).
//
// Task 7 (added in this pass): the three submission-path wiring cases now that
// ClusterActionDialog is really wired up — see the "T7 three-state dialog wiring" describe
// block at the end of the file. updatePerson/mergePersons/purgePerson are the real endpoints
// that usePhotosPeople()'s store calls internally via service.photos; here we mock them on
// svc rather than mocking the whole store, giving an end-to-end verification that the store
// and dialog are genuinely wired together (same pattern as AlbumPickerDialog.test.ts).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listPersons: vi.fn().mockResolvedValue({ persons: [], facesIndexedUpTo: null }),
    mergeSuggestions: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({}),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) => `mock://face/${id}/${ver ?? ''}`),
    getTimeline: vi.fn().mockResolvedValue([]),
    updatePerson: vi.fn().mockResolvedValue(undefined),
    mergePersons: vi.fn().mockResolvedValue(undefined),
    purgePerson: vi.fn().mockResolvedValue(undefined),
    rejectMergeSuggestion: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosPeople from '../PhotosPeople.vue'
// For the style assertion from review Important 2: jsdom doesn't compute cascade/pseudo-
// elements, so we can only assert on the raw <style> text structurally (same `?raw`
// precedent as color-guard.test.ts / PersonAssetGrid.test.ts).
import photosPeopleRaw from '../PhotosPeople.vue?raw'
import { usePhotosPeople } from '../../photos/stores/people'
import { useTimelineStore } from '../../photos/stores/timeline'
import { usePhotosSettingsStore } from '../../photos/stores/settings'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
      { path: '/photos/people/:id', name: 'photos-person', component: { template: '<div/>' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/people')
  await router.isReady()
  const w = mount(PhotosPeople, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

// Named (the order is exactly the order the backend returns — sort='freq' doesn't reorder,
// following Vue2/T1 sortNamed).
// Mixing numeric id with string id: hard-rule regression (String(a)===String(b) / URL
// concatenation).
const ALICE = { id: 42, name: 'Alice', favorite: true, relation: 'family', count: 120, confidence: 0.99, lastSeen: '2026-07-20T00:00:00Z', firstSeen: '2020-01-01T00:00:00Z' }
const CAROL = { id: 3, name: 'Carol', favorite: false, relation: 'family', count: 50, confidence: 0.98, lastSeen: '2026-07-10T00:00:00Z', firstSeen: '2021-01-01T00:00:00Z' }
const BOB = { id: 'b7', name: 'Bob', favorite: false, relation: 'friend', count: 90, confidence: 0.97, lastSeen: '2026-06-01T00:00:00Z', firstSeen: '2019-01-01T00:00:00Z' }
// 未命名(name 空串)。默认 confidence=80 / showSingletons=false 下:u1+u2 可见,
// u3(0.95 但只有 1 张)是被单照片开关藏起来的那一个,u4(0.72)低于阈值。
const U1 = { id: 'u1', name: '', favorite: false, relation: '', count: 9, confidence: 0.87 }
const U2 = { id: 'u2', name: '', favorite: false, relation: '', count: 5, confidence: 0.93 }
const U3 = { id: 'u3', name: '', favorite: false, relation: '', count: 1, confidence: 0.95 }
const U4 = { id: 'u4', name: '', favorite: false, relation: '', count: 3, confidence: 0.72 }

const ALL = [ALICE, CAROL, BOB, U1, U2, U3, U4]

function ids(w: ReturnType<typeof mount>, sel: string): string[] {
  return w.findAll(sel).map((n) => String(n.attributes('data-id')))
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  svc.photos.listPersons.mockClear().mockResolvedValue({ persons: ALL, facesIndexedUpTo: null })
  svc.photos.mergeSuggestions.mockClear().mockResolvedValue([])
  svc.photos.getConfig.mockClear().mockResolvedValue({})
  svc.photos.personFaceThumbnailUrl.mockClear()
  svc.photos.updatePerson.mockClear().mockResolvedValue(undefined)
  svc.photos.mergePersons.mockClear().mockResolvedValue(undefined)
  svc.photos.purgePerson.mockClear().mockResolvedValue(undefined)
  svc.photos.rejectMergeSuggestion.mockClear().mockResolvedValue(undefined)
})
// 关键隔离(同 people.test.ts:46-54 的既有教训):_purgeTimers 是 people store 模块作用域
// 单例,不随 setActivePinia(createPinia()) 重置。T7 的删除测试用同一个 id('u1')反复调
// purgePersonWithUndo,若不清,上一条用例留下的悬挂 entry(未 advanceTimers 也未 undo())
// 会在下一条用例里被"复用首次 idx/snapshot"分支捡到,插回的是上一个 store 实例的快照——
// 用 afterEach(不是 beforeEach,理由同上引处)兜底清空。
afterEach(() => {
  usePhotosPeople().__resetForTest()
})

describe('PhotosPeople.vue — lifecycle and sections', () => {
  it('onMounted fetches people + fetches merge suggestions + reads getConfig once', async () => {
    await mountView()
    expect(svc.photos.listPersons).toHaveBeenCalledTimes(1)
    expect(svc.photos.mergeSuggestions).toHaveBeenCalledTimes(1)
    // getConfig is now called indirectly via the photosSettings store's fetchAiFeatures()
    // (folded in under §7e-10 — see the next case), but it's still "read exactly once per page
    // load" — this page and the PhotosSidebar it mounts each call fetchAiFeatures() once in the
    // same frame, and the store's internal in-flight dedup (settings.ts) merges the two
    // concurrent calls into one real request; this assertion also serves as an end-to-end
    // confirmation that the dedup is working.
    expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
  })

  // P8a-T6 (§7e-10): facesEnabled is folded into the photosSettings store, the view no
  // longer reads getConfig directly itself.
  // The брief's literal assertion `expect(service.photos.getConfig).not.toHaveBeenCalled()`
  // contradicts the existing test above (the store's fetchAiFeatures still calls getConfig
  // internally, and the mock is at the service layer, so there's no way to distinguish "the
  // view reads it directly" from "it reads it indirectly via the store" — the two assertions
  // can't both hold). This brief-vs-existing-test conflict has been logged in the task report;
  // switched to an assertion that can actually distinguish "the view reads it directly" from
  // "reads it via the store": spy on the store's fetchAiFeatures action, and prove that
  // onMounted calls this action rather than wrapping its own extra getConfig call.
  // review fix (take-along, tighten the assertion): this used to be `toHaveBeenCalled()`.
  // Before tightening it, manually verified the real count — `mountView()` mounts the full
  // `PhotosPeople` (the template includes `<PhotosSidebar />`, and T6 also wired the sidebar
  // to fetchAiFeatures), so after mounting the spy records **two** action calls (one from
  // this page itself, one from the sidebar it mounts), not 1 — temporarily changed it to
  // `toHaveBeenCalledTimes(1)` and ran it manually, confirmed it fails (got 2 times) before
  // settling on this number. The real proof of network-level dedup is the existing test above
  // (:104-113, which asserts `getConfig` is called exactly once and doesn't spy on the
  // action); this one only locks down "it calls the store, not its own extra wrapper".
  it('facesEnabled reads from the store rather than calling getConfig itself (onMounted goes through settings.fetchAiFeatures, 2 action calls total including the sidebar it mounts)', async () => {
    const settings = usePhotosSettingsStore()
    const spy = vi.spyOn(settings, 'fetchAiFeatures')
    await mountView()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  // ── Review Important 2: the accent inner ring on favorited people ────────────────────────────────
  it('Pinned avatars have data-fav="true", Named avatars are "false" (the data source for the selector condition)', async () => {
    const { w } = await mountView()
    const pinnedAvatar = w.get('[data-test="pinned-card"] .person-avatar')
    expect(pinnedAvatar.attributes('data-fav')).toBe('true')
    for (const card of w.findAll('[data-test="named-card"] .person-avatar')) {
      expect(card.attributes('data-fav')).toBe('false')
    }
  })

  it('the accent inner ring is drawn on an ::after overlay layer (not the ring\'s own inset box-shadow — that would get covered by the img)', () => {
    const style = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(photosPeopleRaw)?.[1] ?? ''
    expect(style).not.toBe('')
    // Must be an ::after rule conditioned on data-fav.
    expect(style).toMatch(/\.face-grid-lg\s+\.face-card\s+:deep\(\.person-avatar\[data-fav="true"\]\)::after\s*\{/)
    // And box-shadow must **not** be put back on .person-avatar-ring (per the CSS spec: an
    // inset shadow paints before content and descendants, so that accent ring would be
    // completely covered by .person-avatar-img, which fills the padding box).
    const ringRules = style.match(/:deep\(\.person-avatar-ring\)[^{]*\{[^}]*\}/g) ?? []
    for (const rule of ringRules) expect(rule).not.toMatch(/box-shadow/)
  })

  it('each of the three sections renders the correct members: favorites → Pinned, other named → Named, over-threshold unnamed → Unnamed', async () => {
    const { w } = await mountView()
    expect(ids(w, '[data-test="pinned-card"]')).toEqual(['42'])
    expect(ids(w, '[data-test="named-card"]')).toEqual(['3', 'b7'])
    expect(ids(w, '[data-test="cluster-card"]')).toEqual(['u1', 'u2'])
  })

  it('banner subline: named count / visible unnamed count / facesIndexedUpTo date', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: ALL, facesIndexedUpTo: '2026-07-20T10:00:00Z' })
    const { w } = await mountView()
    const sub = w.find('[data-test="people-sub"]').text()
    expect(sub).toContain('3 个已命名')
    expect(sub).toContain('2 个未命名人物')
    expect(w.find('[data-test="people-indexed"]').exists()).toBe(true)
    expect(w.find('[data-test="people-indexed"]').text()).toContain('2026')
  })

  it('facesIndexedUpTo is empty → the indexed-date segment is not rendered', async () => {
    const { w } = await mountView()
    expect(w.find('[data-test="people-indexed"]').exists()).toBe(false)
  })

  it('Pinned card shows the photo count with thousands separators, Named card shows name and count on the same line', async () => {
    const { w } = await mountView()
    expect(w.find('[data-test="pinned-card"]').text()).toContain('120')
    const carol = w.findAll('[data-test="named-card"]').find((c) => c.attributes('data-id') === '3')!
    const row = carol.find('[data-test="named-name-row"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('Carol')
    expect(row.text()).toContain('50')
  })
})

describe('PhotosPeople.vue — confidence', () => {
  it('unnamed cards render a confidence badge (0.87→87%), and the badge is not a child node of the avatar ring', async () => {
    const { w } = await mountView()
    const u1 = w.findAll('[data-test="cluster-card"]').find((c) => c.attributes('data-id') === 'u1')!
    const badge = u1.find('[data-test="cluster-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('87%')
    // The ring's overflow:hidden would clip the badge — it must be a sibling node (per the Vue2 :201 comment)
    const ring = u1.find('.person-avatar-ring').element
    // Positive control: the avatar's own fallback/image really is inside the ring (proves the contains assertion isn't a no-op)
    expect(ring.contains(u1.find('[data-test="avatar-img"]').element)).toBe(true)
    expect(ring.contains(badge.element)).toBe(false)
  })

  it('the top of the dropdown renders the subheading from Vue2 :24-26', async () => {
    const { w } = await mountView()
    await w.find('[data-test="conf-btn"]').trigger('click')
    expect(w.find('[data-test="conf-head"]').text()).toBe('最低人脸匹配分数')
  })

  it('unnamed cards render the hover action hint from Vue2 :204', async () => {
    const { w } = await mountView()
    const hint = w.findAll('[data-test="cluster-card"]')[0].find('[data-test="cluster-hint"]')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toBe('+ 命名 / 合并 / 删除')
  })

  it('the preview count next to each tier in the dropdown is correct (with showSingletons=false)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="conf-btn"]').trigger('click')
    const opts = w.findAll('[data-test="conf-option"]')
    expect(opts).toHaveLength(6)
    const countOf = (v: number) =>
      opts.find((o) => o.attributes('data-value') === String(v))!.find('[data-test="conf-count"]').text()
    expect(countOf(50)).toContain('3')   // u1 u2 u4 (u3 is a singleton, excluded)
    expect(countOf(80)).toContain('2')   // u1 u2
    expect(countOf(90)).toContain('1')   // u2
    expect(countOf(95)).toContain('0')
  })

  it('selecting ≥90 → calls setConfidence(90) and unnamed people below 90 disappear from the grid', async () => {
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'setConfidence')
    await w.find('[data-test="conf-btn"]').trigger('click')
    const opt90 = w.findAll('[data-test="conf-option"]').find((o) => o.attributes('data-value') === '90')!
    await opt90.trigger('click')
    expect(spy).toHaveBeenCalledWith(90)
    await w.vm.$nextTick()
    expect(w.find('[data-test="conf-menu"]').exists()).toBe(false)
    expect(ids(w, '[data-test="cluster-card"]')).toEqual(['u2'])
  })

  it('singleton toggle: when off, count===1 doesn\'t appear, button text shows the hidden count; clicking calls setShowSingletons(true)', async () => {
    const { w } = await mountView()
    const people = usePhotosPeople()
    expect(ids(w, '[data-test="cluster-card"]')).not.toContain('u3')
    const btn = w.find('[data-test="singleton-toggle"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('显示 1 张单照片')

    const spy = vi.spyOn(people, 'setShowSingletons')
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledWith(true)
    await w.vm.$nextTick()
    expect(ids(w, '[data-test="cluster-card"]')).toContain('u3')
    expect(w.find('[data-test="singleton-toggle"]').text()).toBe('隐藏单张照片')
  })

  it('master toggle: clicking "Hide" makes the whole unnamed grid disappear', async () => {
    const { w } = await mountView()
    expect(w.find('[data-test="cluster-grid"]').exists()).toBe(true)
    await w.find('[data-test="unnamed-toggle"]').trigger('click')
    expect(w.find('[data-test="cluster-grid"]').exists()).toBe(false)
    // When the master toggle is off, the singleton toggle disappears too (per the Vue2 :180 showUnnamed && … condition)
    expect(w.find('[data-test="singleton-toggle"]').exists()).toBe(false)
  })
})

describe('PhotosPeople.vue — filter and sort', () => {
  it('switching to family → only named people with relation==="family" remain (the unnamed section is unaffected)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="filter-chip"][data-filter="family"]').trigger('click')
    expect(ids(w, '[data-test="pinned-card"]')).toEqual(['42'])
    expect(ids(w, '[data-test="named-card"]')).toEqual(['3'])
    expect(ids(w, '[data-test="cluster-card"]')).toEqual(['u1', 'u2'])
  })

  it('the first four chips carry a count badge, recent does not (negative assertion, per Vue2)', async () => {
    const { w } = await mountView()
    const chipOf = (f: string) => w.find(`[data-test="filter-chip"][data-filter="${f}"]`)
    expect(chipOf('all').find('[data-test="chip-count"]').text()).toBe('3')
    expect(chipOf('family').find('[data-test="chip-count"]').text()).toBe('2')
    expect(chipOf('friend').find('[data-test="chip-count"]').text()).toBe('1')
    expect(chipOf('work').find('[data-test="chip-count"]').text()).toBe('0')
    expect(chipOf('recent').find('[data-test="chip-count"]').exists()).toBe(false)
  })

  it('switching sort to name → the Named section\'s DOM order becomes alphabetical (proves sortNamed is wired up)', async () => {
    const { w } = await mountView()
    expect(ids(w, '[data-test="named-card"]')).toEqual(['3', 'b7'])   // backend order: Carol, Bob
    await w.find('[data-test="sort-btn"]').trigger('click')
    await w.find('[data-test="sort-item"][data-sort-id="name"]').trigger('click')
    expect(w.find('[data-test="sort-menu"]').exists()).toBe(false)
    expect(ids(w, '[data-test="named-card"]')).toEqual(['b7', '3'])   // Bob, Carol
  })
})

describe('PhotosPeople.vue — two warning banners', () => {
  it('mlReady === false → renders the offline warning', async () => {
    const { w } = await mountView()
    const timeline = useTimelineStore()
    timeline.indexStatus.mlReady = false
    await w.vm.$nextTick()
    expect(w.find('[data-test="warn-ml-offline"]').exists()).toBe(true)
    expect(w.text()).toContain('Photos AI 后端离线')
  })

  it('mlReady === null (unknown) → renders no warning at all (three-state regression)', async () => {
    const { w } = await mountView()
    const timeline = useTimelineStore()
    expect(timeline.indexStatus.mlReady).toBe(null)
    expect(w.find('[data-test="warn-ml-offline"]').exists()).toBe(false)
    expect(w.find('[data-test="warn-faces-off"]').exists()).toBe(false)
  })

  it('getConfig returns aiFeatures.faces === false → renders the face-recognition-disabled banner, mutually exclusive with the offline banner', async () => {
    svc.photos.getConfig.mockResolvedValue({ aiFeatures: { faces: false } })
    const { w } = await mountView()
    expect(w.find('[data-test="warn-faces-off"]').exists()).toBe(true)
    const timeline = useTimelineStore()
    timeline.indexStatus.mlReady = false
    await w.vm.$nextTick()
    expect(w.find('[data-test="warn-ml-offline"]').exists()).toBe(false)
  })

  it('getConfig missing the aiFeatures field / request fails → always treated as enabled, so we don\'t scare the user', async () => {
    svc.photos.getConfig.mockResolvedValue({ aiFeatures: {} })
    const a = await mountView()
    expect(a.w.find('[data-test="warn-faces-off"]').exists()).toBe(false)

    svc.photos.getConfig.mockRejectedValue(new Error('boom'))
    const b = await mountView()
    expect(b.w.find('[data-test="warn-faces-off"]').exists()).toBe(false)
  })
})

describe('PhotosPeople.vue — merge-suggestion banner', () => {
  const SUGGESTION = { id: 'm1', fromId: 'u1', intoId: 42, intoName: 'Alice', confidence: 0.91 }

  it('mergeSuggestions non-empty → banner appears, subtext carries the percentage, two avatars stacked', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([SUGGESTION])
    const { w } = await mountView()
    const banner = w.find('[data-test="merge-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Nimo 发现了 1 个可能的合并')
    expect(banner.text()).toContain('91%')
    expect(banner.text()).toContain('Alice')
    expect(banner.findAll('.person-avatar')).toHaveLength(2)
  })

  it('clicking close → dismissAllMerges is called, banner disappears', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([SUGGESTION])
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'dismissAllMerges')
    await w.find('[data-test="merge-dismiss"]').trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    await w.vm.$nextTick()
    expect(w.find('[data-test="merge-banner"]').exists()).toBe(false)
  })

  it('clicking Review → opens the real MergeReviewDialog, positioned at item 1', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([SUGGESTION])
    const { w } = await mountView()
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)
    await w.find('[data-test="merge-review"]').trigger('click')
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(true)
    expect(w.find('[data-test="mrd-title"]').text()).toBe('可能的合并 1 / 1')
  })

  it('the warning banner and the merge banner can appear at the same time (per Vue2: two independent v-ifs)', async () => {
    svc.photos.getConfig.mockResolvedValue({ aiFeatures: { faces: false } })
    svc.photos.mergeSuggestions.mockResolvedValue([SUGGESTION])
    const { w } = await mountView()
    expect(w.find('[data-test="warn-faces-off"]').exists()).toBe(true)
    expect(w.find('[data-test="merge-banner"]').exists()).toBe(true)
  })
})

describe('PhotosPeople.vue — navigation and floating menu', () => {
  it('clicking a named card → router.push("/photos/people/<id>") (verifies URL concatenation with a numeric id)', async () => {
    const { w, router } = await mountView()
    const push = vi.spyOn(router, 'push')
    const carol = w.findAll('[data-test="named-card"]').find((c) => c.attributes('data-id') === '3')!
    await carol.trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/people/3')

    await w.find('[data-test="pinned-card"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/people/42')
  })

  it('clicking an unnamed card → the floating menu appears, coordinates come from getBoundingClientRect', async () => {
    const { w } = await mountView()
    const card = w.findAll('[data-test="cluster-card"]')[0]
    ;(card.element as HTMLElement).getBoundingClientRect = () =>
      ({ left: 100, width: 80, bottom: 200, top: 128, right: 180, height: 72, x: 100, y: 128, toJSON: () => ({}) }) as DOMRect
    await card.trigger('click')

    const menu = w.find('[data-test="cluster-menu"]')
    expect(menu.exists()).toBe(true)
    expect(menu.attributes('style')).toContain('left: 140px')
    expect(menu.attributes('style')).toContain('top: 208px')
  })

  // Added during user acceptance (Vue2 has no entry point for this): clicking anywhere on an
  // unnamed card only opens the menu, with no path at all to the detail page (in Vue2
  // PhotosPeopleView.vue:189 the whole-card @click is just openClusterMenu, and the menu at
  // :213-231 only has three items: name/merge/delete). Added a "View these photos" item at
  // the top of the menu, going through the same openPerson as the named card, so the
  // encodeURIComponent guard and path concatenation are shared, not a separate copy.
  it('menu "View these photos" → router.push to that person\'s detail page, menu closes right after clicking', async () => {
    const { w, router } = await mountView()
    const push = vi.spyOn(router, 'push')
    const card = w.findAll('[data-test="cluster-card"]').find((c) => c.attributes('data-id') === 'u2')!
    await card.trigger('click')
    await w.find('[data-test="menu-view"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/people/u2')
    expect(w.find('[data-test="cluster-menu"]').exists()).toBe(false)
  })

  it('"View these photos" is the first item in the menu (name/merge/delete follow in order)', async () => {
    const { w } = await mountView()
    await w.findAll('[data-test="cluster-card"]')[0].trigger('click')
    const items = w.find('[data-test="cluster-menu"]').findAll('button')
    expect(items.map((b) => b.attributes('data-test'))).toEqual([
      'menu-view', 'menu-name', 'menu-merge', 'menu-delete',
    ])
  })

  // T7: the three menu items each open the real ClusterActionDialog in the corresponding
  // mode (previously T6 only set a hidden placeholder state; T7 swaps it for the real
  // dialog — assert on each mode's distinctive DOM rather than a placeholder attribute).
  it('each of the three menu items opens the real dialog in the corresponding mode (name/merge/delete), menu closes right after clicking', async () => {
    const checks: Record<'menu-name' | 'menu-merge' | 'menu-delete', (w: Awaited<ReturnType<typeof mountView>>['w']) => void> = {
      'menu-name': (w) => expect(w.find('[data-test="cad-name-input"]').exists()).toBe(true),
      'menu-merge': (w) => expect(w.find('[data-test="cad-merge-input"]').exists()).toBe(true),
      'menu-delete': (w) => expect(w.find('[data-test="cad-confirm-delete"]').exists()).toBe(true),
    }
    for (const testId of ['menu-name', 'menu-merge', 'menu-delete'] as const) {
      const { w } = await mountView()
      await w.findAll('[data-test="cluster-card"]')[0].trigger('click')
      await w.find(`[data-test="${testId}"]`).trigger('click')
      expect(w.find('[data-test="cad-overlay"]').exists()).toBe(true)
      checks[testId](w)
      // menu closes right after clicking
      expect(w.find('[data-test="cluster-menu"]').exists()).toBe(false)
    }
  })

  it('clicking elsewhere on document → menu closes', async () => {
    const { w } = await mountView()
    await w.findAll('[data-test="cluster-card"]')[0].trigger('click')
    expect(w.find('[data-test="cluster-menu"]').exists()).toBe(true)
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="cluster-menu"]').exists()).toBe(false)
  })

  it('pressing Esc → menu closes (Vue2 has no Esc handling; this repo\'s overlay convention adds it)', async () => {
    const { w } = await mountView()
    await w.findAll('[data-test="cluster-card"]')[0].trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="cluster-menu"]').exists()).toBe(false)
  })

  it('pressing Esc → both the confidence dropdown and the sort dropdown close', async () => {
    const { w } = await mountView()
    await w.find('[data-test="conf-btn"]').trigger('click')
    expect(w.find('[data-test="conf-menu"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="conf-menu"]').exists()).toBe(false)

    await w.find('[data-test="sort-btn"]').trigger('click')
    expect(w.find('[data-test="sort-menu"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sort-menu"]').exists()).toBe(false)
  })

  it('clicking elsewhere on document → confidence dropdown closes', async () => {
    const { w } = await mountView()
    await w.find('[data-test="conf-btn"]').trigger('click')
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="conf-menu"]').exists()).toBe(false)
  })

  // Review Minor fix: this case used to be a false green — `expect(typeof
  // addEventListener).toBe('function')` is a dead assertion, and "dispatching doesn't throw"
  // stays green even if the whole onUnmounted block is deleted (a handler writing to a ref on
  // an already-unmounted instance doesn't throw). Changed to comparing the actual
  // **function references** for add/remove: what gets removed must be exactly the two that
  // were added.
  it('after unmounting, document listeners are removed in matching pairs (compares function references, not just "doesn\'t throw")', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const { w } = await mountView()
    const added = addSpy.mock.calls.filter(
      (c) => c[0] === 'mousedown' || c[0] === 'keydown',
    ) as Array<[string, EventListener]>
    // The two listeners this view attaches itself (PhotosSidebar's drawer keydown only attaches when opened on narrow screens, which isn't the case here)
    expect(added.map((c) => c[0])).toEqual(['mousedown', 'keydown'])

    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    const removed = removeSpy.mock.calls as Array<[string, EventListener]>
    // Only count removals whose "reference matches what was attached at mount time":
    // removing the wrong function (e.g. re-wrapping a new arrow function) would leave a
    // stray listener behind.
    // Don't assert on the total count of removed — PhotosSidebar's drawer keydown does an
    // unconditional removeEventListener (since its own attach never happened, the removal
    // is a no-op), which adds an extra call unrelated to this view.
    const matched = added.filter(([type, fn]) => removed.some((r) => r[0] === type && r[1] === fn))
    expect(matched).toHaveLength(2)
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

describe('PhotosPeople.vue — empty state', () => {
  it('peopleLoaded is true and people is empty → empty-state copy appears, none of the three section headings appear', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [], facesIndexedUpTo: null })
    const { w } = await mountView()
    expect(w.find('[data-test="people-empty"]').exists()).toBe(true)
    expect(w.text()).toContain('还没有识别出人物')
    expect(w.find('[data-test="section-pinned"]').exists()).toBe(false)
    expect(w.find('[data-test="section-named"]').exists()).toBe(false)
    expect(w.find('[data-test="section-unnamed"]').exists()).toBe(false)
  })

  it('fetch fails (peopleLoaded stays false) → the empty state is not rendered', async () => {
    svc.photos.listPersons.mockRejectedValue(new Error('boom'))
    const { w } = await mountView()
    expect(usePhotosPeople().peopleLoaded).toBe(false)
    expect(w.find('[data-test="people-empty"]').exists()).toBe(false)
  })
})

// ── T7: three-state dialog wiring (name/merge/delete submission paths + each one's re-entrancy guard) ──
// u1/u2 are unnamed (the candidates themselves), ALICE/CAROL/BOB are named (the source of merge candidates = people.named).
async function openMenuDialog(w: Awaited<ReturnType<typeof mountView>>['w'], menuTestId: 'menu-name' | 'menu-merge' | 'menu-delete', cardIdx = 0) {
  await w.findAll('[data-test="cluster-card"]')[cardIdx].trigger('click')
  await w.find(`[data-test="${menuTestId}"]`).trigger('click')
}

describe('PhotosPeople.vue — T7 three-state dialog wiring: rename', () => {
  it('success: calls renamePerson(id, name) → success toast carries name and photo count → dialog closes', async () => {
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-name')
    await w.get('[data-test="cad-name-input"]').setValue('Sara')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await flushPromises()

    expect(svc.photos.updatePerson).toHaveBeenCalledWith('u1', { name: 'Sara' })
    expect(toast.toasts[0]!.text).toContain('Sara')
    expect(toast.toasts[0]!.text).toContain('9') // u1.count === 9
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(false)
  })

  it('failure: renamePerson rejects → failure toast, dialog stays open (can retry)', async () => {
    svc.photos.updatePerson.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-name')
    await w.get('[data-test="cad-name-input"]').setValue('Sara')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await flushPromises()

    expect(toast.toasts[0]!.text).toBe(zh.photosPersonRenamedFailed)
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(true)
  })

  // Re-entrancy guard regression (this class of bug was caught three times during P4): press Enter twice in a row, the second one firing before the first request resolves.
  it('re-entrancy guard: pressing Enter twice in a row to submit a name → updatePerson is only called once', async () => {
    let resolveUpdate: (() => void) | undefined
    svc.photos.updatePerson.mockImplementation(() => new Promise((resolve) => { resolveUpdate = () => resolve(undefined) }))
    const { w } = await mountView()
    await openMenuDialog(w, 'menu-name')
    const input = w.get('[data-test="cad-name-input"]')
    await input.setValue('Sara')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keydown', { key: 'Enter' }) // the second Enter fires before the first one resolves
    await flushPromises()

    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    resolveUpdate?.()
    await flushPromises()
  })
})

describe('PhotosPeople.vue — T7 three-state dialog wiring: merge', () => {
  it('success: calls mergePersonInto(fromId, targetId) → success toast carries the target\'s name → dialog closes', async () => {
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-merge')
    // Candidate source = people.named, sorted by count descending: Alice(120) > Bob(90) > Carol(50) — the first item is Alice.
    const first = w.get('[data-test="cad-candidate"]')
    expect(first.attributes('data-id')).toBe('42')
    await first.trigger('click')
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toContain('Alice')
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(false)
  })

  it('failure: mergePersons rejects → failure toast (T7 deviation log #8: Vue2 doesn\'t await and pops a false success toast first); dialog still closes', async () => {
    svc.photos.mergePersons.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-merge')
    await w.get('[data-test="cad-candidate"]').trigger('click')
    await flushPromises()

    expect(toast.toasts[0]!.text).toBe(zh.photosPersonMergeFailed)
    // The success-toast copy must not appear — regression for the Vue2 bug of "popping success before reporting the error"
    expect(toast.toasts.some((tt) => tt.text.includes('已合并到'))).toBe(false)
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(false)
  })

  it('re-entrancy guard: clicking the same candidate twice in a row (the second click fires before the first resolves) → mergePersons is only called once', async () => {
    let resolveMerge: (() => void) | undefined
    svc.photos.mergePersons.mockImplementation(() => new Promise((resolve) => { resolveMerge = () => resolve(undefined) }))
    const { w } = await mountView()
    await openMenuDialog(w, 'menu-merge')
    const candidate = w.get('[data-test="cad-candidate"]')
    await candidate.trigger('click')
    await candidate.trigger('click') // the second click fires before the first resolves (the dialog is still open at this point)
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledTimes(1)
    resolveMerge?.()
    await flushPromises()
  })

  // P8a-T10: targetName previously had no fallback, so when the target was unnamed (or
  // personById couldn't find it at the moment of submission) it would render as
  // "merged into "". personById is looked up fresh at submission time (not the object
  // captured when the candidate was clicked), so we can use patchPerson to blank out the
  // target's name right before clicking the candidate, simulating the defensive scenario of
  // "the name goes empty right before confirming" (not contrived — real concurrent renames /
  // data refreshes take this same personById re-lookup path).
  it('P8a-T10: target name is empty → toast falls back to "the same person", doesn\'t render as "merged into ""', async () => {
    const { w } = await mountView()
    const toast = useToast()
    const people = usePhotosPeople()
    await openMenuDialog(w, 'menu-merge')
    const first = w.get('[data-test="cad-candidate"]')
    expect(first.attributes('data-id')).toBe('42') // Alice, highest count, sorted first
    people.patchPerson(42, { name: '' })
    await first.trigger('click')
    await flushPromises()

    expect(toast.toasts[0]!.text).toBe(`已合并到「${zh.photosPersonMergeAsSame}」`)
    expect(toast.toasts[0]!.text).not.toMatch(/「」/)
  })
})

describe('PhotosPeople.vue — T7 three-state dialog wiring: delete', () => {
  it('success: purgePersonWithUndo is called → dialog closes → toast carries 5000ms and an undo action', async () => {
    const { w } = await mountView()
    const people = usePhotosPeople()
    const toast = useToast()
    const purgeSpy = vi.spyOn(people, 'purgePersonWithUndo')
    const toastSpy = vi.spyOn(toast, 'show')
    await openMenuDialog(w, 'menu-delete')
    await w.get('[data-test="cad-confirm-delete"]').trigger('click')

    expect(purgeSpy).toHaveBeenCalledWith('u1')
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(false)
    // Final review Important 4: an unnamed person (name==='') falls back to
    // **photosPersonUnnamedLabel** ("Unnamed person"), without quotes (per confirmDelete's
    // fallback logic, which only adds ASCII double quotes when there's a name). It
    // previously used photosPersonThisPerson ("this person") by mistake, while both of
    // Vue2's delete paths use $t('Unnamed person'); this page's delete entry point is only
    // ever attached to unnamed people, so the wrong fallback hit exactly the main path.
    expect(toastSpy).toHaveBeenCalledWith(`${zh.photosPersonUnnamedLabel} 已删除`, 5000, {
      label: zh.photosPersonUndo,
      onClick: expect.any(Function),
    })
    // Deletion disappears from the grid immediately (purgePersonWithUndo is an optimistic local removal)
    expect(ids(w, '[data-test="cluster-card"]')).not.toContain('u1')
  })

  it('clicking the undo action in the toast → calls undo, the person reappears in the unnamed grid', async () => {
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-delete')
    await w.get('[data-test="cad-confirm-delete"]').trigger('click')
    expect(ids(w, '[data-test="cluster-card"]')).not.toContain('u1')

    const action = toast.toasts[0]!.action!
    action.onClick()
    await w.vm.$nextTick()
    expect(ids(w, '[data-test="cluster-card"]')).toContain('u1')
  })

  // Review mandatory fix 2 (round two): the delete path has **no** independent in-flight
  // guard ref — onSubmitDelete has no await anywhere and runs to completion within a single
  // dispatchEvent, so `dialog.value = null` is itself a natural re-entrancy lock. Both
  // clicks land on the same button within the same synchronous window before Vue removes
  // the panel from the DOM, so the second call gets stopped at the top of `onSubmitDelete`
  // by `!dialog.value` (the first call already nulled it out). Ran a mutation-testing check
  // (see task-7-report.md §11): temporarily changed `if (!dialog.value) return` to
  // `if (false) return` (i.e. removing this guard entirely while keeping everything else the
  // same), reran this test — `purgePersonWithUndo` gets called 2 times, and the
  // `toHaveBeenCalledTimes(1)` assertion genuinely goes red; reverting and rerunning goes
  // green again. This proves the test really does verify the real mechanism of
  // `dialog.value` being nulled out, and isn't the "still green after deleting the code"
  // false green (the kind review called out, which happened previously when a
  // `deletingSubmitting` ref was attached).
  it('the delete path is naturally re-entrancy-guarded by nulling dialog.value (no independent guard ref): clicking confirm-delete twice in a row only calls purgePersonWithUndo once', async () => {
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'purgePersonWithUndo')
    await openMenuDialog(w, 'menu-delete')
    const btn = w.get('[data-test="cad-confirm-delete"]')
    const p1 = btn.trigger('click')
    const p2 = btn.trigger('click')
    await Promise.all([p1, p2])

    expect(spy).toHaveBeenCalledTimes(1)
  })
})

// ── T8: merge-suggestion review dialog wiring (accept/reject submission paths + re-entrancy regressions + index clamping) ──
// Note on re-entrancy (review mandatory, same precedent as T7 §11's delete path): while
// drafting onReviewAccept/onReviewReject, each got its own independent in-flight guard ref.
// A mutation-testing check (changing `if (guard) return` to `if (false) return`) showed the
// two "clicking twice in a row … only called once" regression tests below still stayed
// fully green — what actually blocks the second call is MergeReviewDialog's own
// `if (!current.value) return` (the store's accept/rejectMergeSuggestion synchronously
// splices this suggestion out of the array at the very top of the function body, so
// current.value has already become undefined before any await) plus the store's own
// `if (s) {...}` idempotency check — both layers were already there, so the independent ref
// had no real protective value and has been removed (see the comment at the top of
// onReviewAccept in PhotosPeople.vue for details). The test titles now reflect the real
// mechanism and no longer say "re-entrancy guard".
const S1 = { id: 'm1', fromId: 'u1', intoId: 42, intoName: 'Alice', confidence: 0.91 }
const S2 = { id: 'm2', fromId: 'u2', intoId: 3, intoName: '', confidence: 0.6 }
const S3 = { id: 'm3', fromId: 'b7', intoId: 3, intoName: 'Carol', confidence: 0.55 }

async function openReview(w: Awaited<ReturnType<typeof mountView>>['w']) {
  await w.find('[data-test="merge-review"]').trigger('click')
}

describe('PhotosPeople.vue — T8 merge-suggestion review dialog wiring: accept', () => {
  it('success: calls mergePersons(fromId, intoId) → success toast carries intoName → dialog closes once this is the last one left', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    await w.get('[data-test="mrd-accept"]').trigger('click')
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toContain('Alice')
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)
  })

  // Review Important (independently reproduced): the "dialog closes once this is the last
  // one left" assertion above only checks whether mrd-overlay exists, but
  // MergeReviewDialog's root node is `v-if="open && current"` — when suggestions is an
  // empty array, `current` (= suggestions[index]) is naturally undefined already, so this
  // v-if is naturally false regardless of reviewOpen's actual value. Review ran a
  // mutation-testing experiment: deleting the `reviewOpen.value = false` assignment inside
  // clampReviewIndex and leaving only the return, and the test above still stayed fully
  // green — no case had ever falsified whether that `reviewOpen.value = false` line really
  // executes.
  //
  // The scenario where this actually breaks: mergeSuggestions has another path that
  // refills it — T7's mergePersonInto calls fetchMergeSuggestions() in its finally block
  // (people.ts:211-212). If reviewOpen gets stuck at true (the assignment deleted/missed),
  // then after the user "closes" the review dialog because the list went empty, as soon as
  // some other unrelated merge operation pulls mergeSuggestions back in, `current` becomes
  // non-undefined again, and the dialog will pop back open on its own even though the user
  // never clicked Review. This test directly reproduces that scenario: accept down to the
  // last one → dialog closes → simulate fetchMergeSuggestions being refilled (same call as
  // T7's finally block) → assert the dialog does **not** pop open on its own.
  it('regression: after reviewing down to the last item the dialog closes; a later refill of mergeSuggestions (e.g. the fetchMergeSuggestions triggered by T7\'s merge flow) should not auto-open it', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    const { w } = await mountView()
    await openReview(w)
    await w.get('[data-test="mrd-accept"]').trigger('click')
    await flushPromises()
    // Precondition: at this point it should already be closed (same assertion as the previous test).
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)

    // Simulate the same fetchMergeSuggestions that T7's mergePersonInto finally block would
    // trigger, refilling suggestions — this has nothing to do with the user clicking
    // Review, so it shouldn't make the review dialog pop open on its own.
    svc.photos.mergeSuggestions.mockResolvedValue([S2])
    await usePhotosPeople().fetchMergeSuggestions()
    await w.vm.$nextTick()

    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)
  })

  // Doesn't assert on the dialog opening/closing: the store's acceptMergeSuggestion failure
  // path does a corrective `void fetchMergeSuggestions()` refetch (per the comment at the
  // top of people.ts: "optimistically remove the suggestion first, refetch the suggestion
  // list to correct on failure"), and which one wins between this refetch and this
  // component's clampReviewIndex in its finally block depends on how many await hops each
  // one has left; under real network latency it's almost always clamp that runs first (the
  // suggestions are still empty → dialog closes), but under the fully synchronous mocks used
  // in this test the order flips (the refetch lands first, suggestions are already restored
  // → doesn't close). This is a race that inherently exists in the design, not a bug we're
  // fixing here, so this test only asserts the deterministic facts unrelated to the race
  // (call arguments + failure toast).
  it('failure: mergePersons rejects → failure toast', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    svc.photos.mergePersons.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    await w.get('[data-test="mrd-accept"]').trigger('click')
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toBe(zh.photosPersonMergeFailed)
  })

  it('when the main button text is missing intoName, it falls back to photosPersonMergeAsSame; the toast after accept lands on the same string too', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S2])
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    expect(w.get('[data-test="mrd-accept"]').text()).toContain(zh.photosPersonMergeAsSame)
    await w.get('[data-test="mrd-accept"]').trigger('click')
    await flushPromises()
    expect(toast.toasts[0]!.text).toContain(zh.photosPersonMergeAsSame)
  })

  // Index clamping (brief explicitly required it to live in the host): 3 suggestions,
  // position at the last one (index=2) and accept it → 2 remain, index(2) is now out of
  // bounds → clamp to max(0,2-1)=1, so the dialog switches to showing "item 2 of the
  // remaining two" instead of crashing or getting stuck at the out-of-bounds position.
  it('index clamping: after accepting the last suggestion, index is pulled back to max(0, new length-1)', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1, S2, S3])
    const { w } = await mountView()
    await openReview(w)
    // Manually push reviewIdx to the last item (the Review button only ever sets it to 0;
    // here we simulate the scenario where the user has already navigated to item 3 — there's
    // no navigation UI beyond calling the store directly, so we reach into the vm's internal
    // ref to reproduce the precondition of "currently stopped at the last item").
    ;(w.vm as unknown as { reviewIdx: number }).reviewIdx = 2
    await w.vm.$nextTick()
    expect(w.get('[data-test="mrd-title"]').text()).toBe('可能的合并 3 / 3')

    await w.get('[data-test="mrd-accept"]').trigger('click')
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledWith('b7', 3)
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(true)
    // S1 and S2 remain, index clamps to 1 → shows "2 / 2", and it's S2 (intoName is empty, falls back through AsSame)
    expect(w.get('[data-test="mrd-title"]').text()).toBe('可能的合并 2 / 2')
    expect(w.get('[data-test="mrd-accept"]').text()).toContain(zh.photosPersonMergeAsSame)
  })

  // Re-entrancy regression (see the mutation-testing note at the top of this describe
  // block): click accept twice in a row, the second one firing before the first request
  // resolves — blocked naturally by MergeReviewDialog's current.value being nulled out, not
  // by an independent guard ref.
  it('clicking accept twice in a row (the second fires before the first resolves) → mergePersons is only called once (current.value is a natural re-entrancy guard)', async () => {
    let resolveMerge: (() => void) | undefined
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    svc.photos.mergePersons.mockImplementation(() => new Promise((resolve) => { resolveMerge = () => resolve(undefined) }))
    const { w } = await mountView()
    await openReview(w)
    const btn = w.get('[data-test="mrd-accept"]')
    const p1 = btn.trigger('click')
    const p2 = btn.trigger('click') // the second click fires before the first resolves (the dialog is still open at this point)
    await Promise.all([p1, p2])
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledTimes(1)
    resolveMerge?.()
    await flushPromises()
  })
})

describe('PhotosPeople.vue — T8 merge-suggestion review dialog wiring: reject', () => {
  it('success: calls rejectMergeSuggestion(fromId, intoId) → dismissed toast → dialog closes once this is the last one left', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    await w.get('[data-test="mrd-reject"]').trigger('click')
    await flushPromises()

    expect(svc.photos.rejectMergeSuggestion).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toBe(zh.photosPersonMergeDismissedToast)
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)
  })

  // Same race note as the previous case: rejectMergeSuggestion's failure path also does a
  // corrective void fetchMergeSuggestions(), and whether the dialog opens/closes depends on
  // which of the two await chains lands first — not asserted here.
  it('failure: rejectMergeSuggestion rejects → failure toast', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    svc.photos.rejectMergeSuggestion.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    await w.get('[data-test="mrd-reject"]').trigger('click')
    await flushPromises()

    expect(svc.photos.rejectMergeSuggestion).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toBe(zh.photosPersonMergeFailed)
  })

  // Same mutation-testing conclusion as the accept case above, the same natural mechanism.
  it('clicking reject twice in a row (the second fires before the first resolves) → rejectMergeSuggestion is only called once (current.value is a natural re-entrancy guard)', async () => {
    let resolveReject: (() => void) | undefined
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    svc.photos.rejectMergeSuggestion.mockImplementation(() => new Promise((resolve) => { resolveReject = () => resolve(undefined) }))
    const { w } = await mountView()
    await openReview(w)
    const btn = w.get('[data-test="mrd-reject"]')
    const p1 = btn.trigger('click')
    const p2 = btn.trigger('click')
    await Promise.all([p1, p2])
    await flushPromises()

    expect(svc.photos.rejectMergeSuggestion).toHaveBeenCalledTimes(1)
    resolveReject?.()
    await flushPromises()
  })
})

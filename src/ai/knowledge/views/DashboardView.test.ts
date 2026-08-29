// SP8-P5a Task 12 — DashboardView test.
// Step 2 The skeleton is taken verbatim from the task brief (lines 20–205).
// This file then adds high-risk control-flow assertions required by the governance file §9
// "Test Quality" (each reinforced assertion is marked with [Reinforcement N] in comments), corresponding one-by-one
// to the 8 high-risk points named in the task:
//   1) isEmpty's `&&` — brief provided only pure-empty / pure-full extremes; a mixed-state
//      assertion is added ("wikiRoots empty but indexed_files > 0") to specifically nail the
//      regression where `&&` is mistakenly changed to `||`.
//   2) [data-on] render value must be string "true"/"false" (not boolean).
//   3) [data-layer] three colors (wiki/vec/note) each appear; onboarding side likewise.
//   4) progressPercent/fmtEta wiring: use specific numeric values that produce different
//      results if parameter order is swapped, pinning the actual arg order.
//   5) N2 three fields missing render 0 / empty string (pin, prevent "convenient optimization
//      into hidden").
//   6) N3 Promise.all + finally semantics (brief provided, kept as-is).
//   7) inline --g three locations.
//   8) Zero hardcoded copy — verified via grep in report, not in this file (vitest assertions
//      can only query render output, not source code literals).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import DashboardView from './DashboardView.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'

const STATS_FULL = {
  queue_depth: { pending: 2, running: 1, failed: 1, done: 5 },
  indexed_files: 57,
  total_vectors_text: 578,
  total_vectors_visual: 3,
  last_cursor_ms: 1,
}
const ROOTS = [
  { id: 'r1', path: '/DATA', level: 'space', watchMode: 'auto', enabled: true, lastScanAt: 1, needsReconcile: false },
  {
    id: 'r2',
    path: '/Backup',
    level: 'space',
    watchMode: 'scan_only',
    enabled: false,
    lastScanAt: 0,
    needsReconcile: true,
  },
] as never
// [I-3 reinforcement] Both roots enabled: r3 is auto (→ .k2-chip data-tone="live"),
// r4 is scan_only + needsReconcile (→ ordinary .k2-chip without data-tone + another
// .k2-chip data-tone="warn" for sync-in-progress indicator), covering three render states of .k2-chip.
const ROOTS_MIXED = [
  { id: 'r3', path: '/DATA', level: 'space', watchMode: 'auto', enabled: true, lastScanAt: 1, needsReconcile: false },
  {
    id: 'r4',
    path: '/Proj',
    level: 'project',
    watchMode: 'scan_only',
    enabled: true,
    lastScanAt: 1,
    needsReconcile: true,
  },
] as never

function mountDash() {
  const router = createRouter({
    history: createWebHashHistory('/'),
    routes: [
      { path: '/ai/knowledge', component: DashboardView },
      { path: '/ai/knowledge/:tab', component: { template: '<div/>' } },
    ],
  })
  router.push('/ai/knowledge')
  return router.isReady().then(() => mount(DashboardView, { global: { plugins: [router, i18n] } } as never))
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

function stubLoads() {
  const s = useKnowledgeStore()
  vi.spyOn(s, 'loadOverview').mockResolvedValue()
  vi.spyOn(s, 'loadRoots').mockResolvedValue()
  vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
  return s
}

describe('DashboardView — three states', () => {
  it('skeleton state: search box present, three-layer cards absent', async () => {
    stubLoads()
    const w = await mountDash()
    expect(w.find('.k2-search').exists()).toBe(true)
    expect(w.find('.k2-skel-card').exists()).toBe(true)
    expect(w.find('.k2-layer').exists()).toBe(false)
  })

  it('with data: all four surfaces present (3-layer cards / glue / root card / disabled row / live / 7 entry points)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    expect(w.findAll('.k2-layer')).toHaveLength(3)
    expect(w.find('.k2-glue').exists()).toBe(true)
    expect(w.findAll('.k2-root')).toHaveLength(1) // render only enabled roots
    expect(w.find('.k2-roots-off').exists()).toBe(true) // disabled row
    expect(w.find('.k2-live').exists()).toBe(true)
    expect(w.find('.k2-prog').exists()).toBe(true) // backlog = 3 → busy
    expect(w.findAll('.k2-entry')).toHaveLength(7)
  })

  it('empty library: show onboarding, no zero-value cards', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    expect(w.find('.k2-onboard').exists()).toBe(true)
    expect(w.find('.k2-layer').exists()).toBe(false)
    expect(w.findAll('.k2-entry')).toHaveLength(4) // emptyEntries
    expect(w.findAll('.k2-entry')[0].attributes('data-disabled')).toBe('true') // Search disabled
  })

  // [Reinforcement 1] isEmpty criterion is the `&&` in `wikiRoots.length === 0 && indexed_files === 0`
  // — the two tests above only cover "both sides empty" and "both sides full", missing the
  // regression where `&&` is mistakenly changed to `||` (which would misclassify isEmpty whenever
  // one side is empty). This mixed-state test uses "wikiRoots empty but indexed_files=57 (non-zero)";
  // the correct behavior should still be a non-empty library, rendering normal dashboard (Wiki
  // backend 404/timeout is common on-device — see Appendix C item 3 "Wiki navigation card shows
  // 0 knowledge roots"; the entire page should not be misclassified as fresh onboarding just because
  // Wiki side is empty). RED probe description at end of file.
  it('Reinforcement: wikiRoots empty but indexed_files > 0 (Wiki side has no data, Parser side has data) — not onboarding', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 57 }
    await flushPromises()
    expect(w.find('.k2-onboard').exists()).toBe(false)
    expect(w.findAll('.k2-layer')).toHaveLength(3)
  })

  // [Reinforcement 1 continued] The converse: wikiRoots non-empty but indexed_files=0, should also not be onboarding.
  it('Reinforcement: wikiRoots non-empty but indexed_files = 0 — also not onboarding', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = ROOTS
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    expect(w.find('.k2-onboard').exists()).toBe(false)
    expect(w.findAll('.k2-layer')).toHaveLength(3)
  })
})

describe('DashboardView — attribute states (handoff items 1/2/3)', () => {
  it('[data-on] render value is string "true"/"false" (handoff item 1, selector compares string)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.controlState = { ...s.controlState, concurrency: 2, paused: false }
    await flushPromises()
    const ccButtons = w.findAll('.k2-cc button')
    expect(ccButtons).toHaveLength(3)
    // CC_LEVELS = [1, 2, 4] — concurrency=2 hits the second tier
    expect(ccButtons[0].attributes('data-on')).toBe('false')
    expect(ccButtons[1].attributes('data-on')).toBe('true')
    expect(ccButtons[2].attributes('data-on')).toBe('false')
    // [RED probe note, detailed in report] Removing `String(...)` from template and re-running this test —
    // result is still all green: Vue 3's `patchAttr` for custom `data-*` attributes not in the
    // `isSpecialBooleanAttr` whitelist calls `el.setAttribute(key, value)`, which implicitly converts
    // boolean values to string "true"/"false" (unlike Vue 2's behavior of entirely removing boolean-valued
    // attributes; that rule only applies to Vue's built-in true boolean attributes, and `data-on` is not
    // on that list). That is, in this repo's Vue 3 version, `String()` on `data-on` renders idempotently —
    // but it is still kept following the established pattern in T10/`k-rail-item[data-active]` and
    // governance file handoff item 1 (defensive consistency against future Vue version upgrades or
    // reclassification of attributes into the boolean list; it is not a difference pinnable by this test).
  })

  it('[data-layer] three colors each appear on their respective layer cards (reinforcement: all three values must be checked, cannot test only one)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    const layers = w.findAll('.k2-layer')
    expect(layers.map((l) => l.attributes('data-layer'))).toEqual(['wiki', 'vec', 'note'])
  })

  it('onboarding side [data-layer] three colors likewise each appear (k2-ob-layer)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    const obLayers = w.findAll('.k2-ob-layer')
    expect(obLayers.map((l) => l.attributes('data-layer'))).toEqual(['wiki', 'vec', 'note'])
  })

  it('handoff item 3: k2-layer-num second/suffix, k2-live-ico spin, k2-drafts are child classes', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 1, done: 5 } }
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    // vec layer (second card) has .second child element
    const vecLayer = w.findAll('.k2-layer')[1]
    expect(vecLayer.find('.k2-layer-num .second').exists()).toBe(true)
    expect(vecLayer.find('.k2-layer-num .suffix').exists()).toBe(true)
    // notes layer (third card) draft > 0 → .k2-drafts
    const noteLayer = w.findAll('.k2-layer')[2]
    expect(noteLayer.find('.k2-drafts').exists()).toBe(true)
    // backlog > 0 → spinner has .spin
    expect(w.find('.k2-live-ico .spin').exists()).toBe(true)
  })

  // [Review Critical/Important fix: open finding 2, I-3] Below adds zero-coverage [data-ok]
  // and three [data-tone] hosts (.k2-chip / .k2-entry-ico / .k2-entry-badge,
  // previously only .k2-qchip was tested). Review probe actual testing: deleting
  // `data-ok="true"`, changing a tone value incorrectly, original test set **all green** —
  // this is why C-1 (onboarding second tile missing `tone: 'wiki'`) was able to slip through.

  it('[data-ok] only static render "true" in all-synced branch, completely absent in busy branch', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    // busy: backlog = 3 > 0
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 1, done: 5 } }
    await flushPromises()
    expect(w.find('.k2-live-ico').attributes('data-ok')).toBeUndefined()

    // all-synced: backlog = 0
    s.stats = { ...STATS_FULL, queue_depth: { pending: 0, running: 0, failed: 0, done: 5 } }
    await flushPromises()
    expect(w.find('.k2-live-ico').attributes('data-ok')).toBe('true')
  })

  it('[data-tone] on .k2-chip: auto → "live", scan_only without reconcile → no attribute, needsReconcile → other chip is "warn"', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS_MIXED
    await flushPromises()
    const roots = w.findAll('.k2-root')
    expect(roots).toHaveLength(2)
    // r3 (auto, no reconcile): only one chip, data-tone="live"
    const r3Chips = roots[0].findAll('.k2-chip')
    expect(r3Chips).toHaveLength(1)
    expect(r3Chips[0].attributes('data-tone')).toBe('live')
    // r4 (scan_only, needsReconcile): two chips — first (periodic scan) has no
    // data-tone attribute, second (sync in progress) data-tone="warn"
    const r4Chips = roots[1].findAll('.k2-chip')
    expect(r4Chips).toHaveLength(2)
    expect(r4Chips[0].attributes('data-tone')).toBeUndefined()
    expect(r4Chips[1].attributes('data-tone')).toBe('warn')
  })

  it('[data-tone] on .k2-entry-ico: non-empty library 7 entry points checked one by one (including C-1 wiki fix)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    const icoTones = w.findAll('.k2-entries .k2-entry-ico').map((el) => el.attributes('data-tone'))
    // Order matches entries() array: search/wiki/indexed-files/notes/roots/queue/settings
    expect(icoTones).toEqual(['accent', 'wiki', 'vec', 'note', 'wiki', undefined, undefined])
  })

  it('[data-tone] on .k2-entry-ico: empty library onboarding 4 entry points (C-1 pin — roots tile must be "wiki", not gray fallback)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    const icoTones = w.findAll('.k2-entries .k2-entry-ico').map((el) => el.attributes('data-tone'))
    // Order matches emptyEntries() array: search/roots/allowlist/settings
    // [C-1 fix pin] icoTones[1] must be 'wiki' — blueprint line 342 `tone: 'wiki'`
    // was once slipped by accident during porting, causing this tile's icon to hit
    // the gray fallback at knowledge.scss:759 instead of amber at :761 (visible color regression).
    expect(icoTones).toEqual(['accent', 'wiki', undefined, undefined])
  })

  it('[data-tone] on .k2-entry-badge: notes badge is "note", queue badge has no data-tone (default red background)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    // failed > 0 and draft > 0, make both badges render
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 1, done: 5 } }
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    const entries = w.findAll('.k2-entries .k2-entry')
    const notesEntry = entries[3] // entries() array item 4 = notes
    const queueEntry = entries[5] // item 6 = queue
    expect(notesEntry.find('.k2-entry-badge').attributes('data-tone')).toBe('note')
    expect(notesEntry.find('.k2-entry-badge').text()).toBe('2')
    expect(queueEntry.find('.k2-entry-badge').attributes('data-tone')).toBeUndefined()
    expect(queueEntry.find('.k2-entry-badge').text()).toBe('1')
  })

  it('[data-disabled] add false side (M-2): items in emptyEntries with no disabled field render "false", not only testing true side', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    const entries = w.findAll('.k2-entries .k2-entry')
    expect(entries).toHaveLength(4)
    expect(entries[0].attributes('data-disabled')).toBe('true') // search: disabled: true
    expect(entries[1].attributes('data-disabled')).toBe('false') // roots: no disabled field
    expect(entries[2].attributes('data-disabled')).toBe('false') // allowlist
    expect(entries[3].attributes('data-disabled')).toBe('false') // settings
  })
})

describe('DashboardView — icon name guard (review Important I-2)', () => {
  // Review probe B actual test: changing `sparkle` to `sparkleXX`, changing
  // `file` → `fileXX` in entries, original test set all green — KIcon.vue:79
  // silently returns empty svg for unmatched name (visible blank icon), but no
  // assertion checks svg content. Here following the established pattern in T10
  // (KnowledgeLayout.test.ts), add: iterate all rendered svgs, assert innerHTML
  // non-empty. Covers static 11 + dynamic 8 (icon field of entries/emptyEntries +
  // drive/folder choice of root) for 19 glyph names total.
  it('iterate all svg icons rendered in states other than skeleton, all innerHTML non-empty', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()

    function assertAllSvgsNonEmpty(label: string): void {
      const svgs = w.findAll('svg')
      expect(svgs.length, `${label}: should render at least one svg`).toBeGreaterThan(0)
      svgs.forEach((svg, idx) => {
        expect(
          svg.element.innerHTML,
          `${label}: svg #${idx} rendered empty (icon name may have been mistyped as glyph not in KIcon.PATHS)`,
        ).not.toBe('')
      })
    }

    // empty library onboarding: orb (layers), CTA (plus), emptyEntries 4 (search/drive/folder/settings)
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    assertAllSvgsNonEmpty('onboarding')

    // non-empty library, busy (backlog > 0), has disabled roots, draft > 0, not paused:
    // search/arrowRight/chev(×3)/clock/eye/plus(root-add)/spinner/sparkle +
    // entries 7 (search/layers/file/edit/drive/history/settings) + root icons (drive/folder)
    s.wikiRoots = ROOTS
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 1, done: 5 } }
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    s.controlState = { ...s.controlState, paused: false }
    await flushPromises()
    assertAllSvgsNonEmpty('non-empty-library-busy-not-paused')

    // all synced (backlog = 0): check
    s.stats = { ...STATS_FULL, queue_depth: { pending: 0, running: 0, failed: 0, done: 5 } }
    await flushPromises()
    assertAllSvgsNonEmpty('all-synced')

    // paused: pause
    s.controlState = { ...s.controlState, paused: true }
    await flushPromises()
    assertAllSvgsNonEmpty('paused')
  })
})

describe('DashboardView — inline --g (handoff item 2)', () => {
  it('three id explanation rows each have corresponding --g value in their style', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    const glueIds = w.findAll('.k2-glue-id')
    expect(glueIds).toHaveLength(3)
    // [M-3 strengthened while scanning] style is a static single-property string; `.toContain`
    // happens to equal exact match here, but for consistency with rigor of numeric/copy assertions,
    // unified switch to `.toBe(...)` exact match.
    expect(glueIds[0].attributes('style')).toBe('--g: var(--ly-vec);')
    expect(glueIds[1].attributes('style')).toBe('--g: var(--ly-wiki);')
    expect(glueIds[2].attributes('style')).toBe('--g: var(--ly-note);')
  })
})

describe('DashboardView — numeric and copy', () => {
  it('three-layer cards display root count / document count / note count respectively, numbers with thousands separator', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, indexed_files: 1234 }
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    const nums = w.findAll('.k2-layer-num').map((n) => n.text())
    // [Review Minor M-3, fixed] Previously this was `.toContain('1')` / `.toContain('5')`
    // substring weak assertions — numbers could change to any other value containing "1"/"5"
    // (like 21, 15) and still pass. Changed to exact `.toBe(...)` full-text match of entire
    // block (first run a temporary probe to get real rendered text, then nail it as assertion,
    // not guessing by feel).
    expect(nums[0]).toBe('1个知识根') // enabledRoots.length + suffix
    expect(nums[1]).toBe('1,234文档578 向量块') // indexed_files + suffix + second (vector chunks)
    expect(nums[2]).toBe('5条笔记2 待确认') // notesSummary.total + suffix + k2-drafts (draft > 0)
  })

  it('N2: when backend does not send rate/eta/done10m, rate row falls back to "Waiting for parser…" not NaN', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL // ← actual shape: no rate_per_min / eta_s / done_last_10m
    s.controlState = { ...s.controlState, paused: false }
    await flushPromises()
    const sub = w.find('.k2-live-sub').text()
    expect(sub).toBe('等待解析器…')
    expect(sub).not.toContain('NaN')
  })

  // [Reinforcement 5, N2 pin] Explicitly assert "done_last_10m missing renders 0, eta missing renders
  // empty string" — this is the pin for "copy as-is no change": prevent someone later from
  // conveniently optimizing `|| 0` fallback into "hide this section if no data". backlog = 0
  // goes through all-synced branch to render done10m number.
  it('N2 pin: done_last_10m missing, all-synced row renders digit 0 (not hiding the section)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, queue_depth: { pending: 0, running: 0, failed: 0, done: 5 } }
    await flushPromises()
    expect(w.find('.k2-live').exists()).toBe(true)
    // [Weak assertion lesson] Early version here was `.toContain('0')` — seemingly pinned
    // done10m rendering 0, actually a false pin: the literal copy "completed in last 10 minutes"
    // contains a "0" itself (from "10"), so even if done10m is `undefined` (interpolation empty string,
    // double space) that `.toContain('0')` would still pass. Changed to exact full-text match across
    // the row; "completed 0" (single space) vs "completed  " (empty string placeholder, double space)
    // are truly distinguishable render results. RED probe in report: replace `done10m`'s `|| 0` with
    // `as number` passthrough (no fallback), this test with exact match will turn red.
    expect(w.find('.k2-live-sub').text()).toBe('上次同步 — · 近 10 分钟完成 0 个')
  })

  it('when paused, rate row displays "Paused"', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.controlState = { ...s.controlState, paused: true }
    await flushPromises()
    expect(w.find('.k2-live-sub').text()).toBe('已暂停')
  })

  it('when backlog is 0, switch to "All Synced" branch', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, queue_depth: { pending: 0, running: 0, failed: 0, done: 5 } }
    await flushPromises()
    expect(w.find('.k2-live-title').text()).toBe('已全部同步')
    expect(w.find('.k2-prog').exists()).toBe(false)
  })

  it('when failed > 0, the chip in queue health is clickable and jumps to queue page with filter', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    await flushPromises()
    const chip = w.findAll('.k2-qchip').find((c) => c.element.tagName === 'BUTTON')!
    expect(chip.attributes('data-tone')).toBe('danger')
  })

  // [Reinforcement 4] progressPercent wiring: use specific numeric values where parameter
  // order swap produces different results, pinning actual arg order — backlogPeak = 10,
  // backlog = 3 (pending 2 + running 1). Correct order progressPercent(3, 10) = round((1 - 3/10) * 100) = 70.
  // If swapped to progressPercent(10, 3), result gets clamped by Math.max(0, ...) to 0, distinctly
  // different from 70, sufficient to catch the swap.
  it('Reinforcement: progressPercent wiring — backlogPeak and backlog parameter order cannot be swapped', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 0, done: 5 } } // backlog = 3
    s.backlogPeak = 10
    await flushPromises()
    expect(w.find('.k2-prog-pct').text()).toBe('70%')
  })

  // [Reinforcement 4 continued] fmtEta/rate wiring: backend hypothetically sends rate_per_min/eta_s
  // (won't happen on real device, see N2, but component must render correctly when field exists,
  // else dead code) — eta_s = 90 → fmtEta should output "1m" (90s = just over 1 minute, floor to 1m),
  // rate_per_min = 2.5 → toFixed(1) should output "2.5". Both numbers must appear on same line,
  // and order cannot be off (rate first, eta second).
  it('Reinforcement: rate_per_min/eta_s fields present render correctly (fmtEta wiring, hypothetical coverage, not real-device state)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, rate_per_min: 2.5, eta_s: 90 } as never
    await flushPromises()
    const sub = w.find('.k2-live-sub').text()
    expect(sub).toBe('2.5 个/分钟 · 预计 1m')
  })
})

describe('DashboardView — navigation', () => {
  it('search submit carries q parameter to search page; empty query does not navigate', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    const push = vi.spyOn(w.vm.$router, 'push')
    await w.find('.k2-search input').setValue('  ')
    await w.find('.k2-search input').trigger('keydown.enter')
    expect(push).not.toHaveBeenCalled()
    await w.find('.k2-search input').setValue(' 甲状腺 ')
    await w.find('.k2-search input').trigger('keydown.enter')
    expect(push).toHaveBeenCalledWith({ path: '/ai/knowledge/search', query: { q: '甲状腺' } })
  })

  it('three-layer cards navigate to wiki / indexed-files / notes respectively', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    const push = vi.spyOn(w.vm.$router, 'push')
    const layers = w.findAll('.k2-layer')
    await layers[0].trigger('click')
    expect(push).toHaveBeenLastCalledWith('/ai/knowledge/wiki')
    await layers[1].trigger('click')
    expect(push).toHaveBeenLastCalledWith('/ai/knowledge/indexed-files')
    await layers[2].trigger('click')
    expect(push).toHaveBeenLastCalledWith('/ai/knowledge/notes')
  })
})

describe('DashboardView — lifecycle (N3)', () => {
  it('on mount three sources concurrently fetch; if any fails, ready is set (Promise.all + finally, copy as-is)', async () => {
    // [Test harness note, not production behavior change] In production loadRoots/loadOverview/
    // loadNotesSummary each internally try/catch; in real scenarios these three promises never
    // reject (N3's "Wiki hung" means "very slow to resolve", not reject) — here mockRejectedValue
    // forcibly simulates one reject, just to avoid waiting actual 60s to assert the
    // "any settle exception also proceed" semantics of `Promise.all(...).finally(...)`.
    // Side effect: the `.finally()` chain in `onMounted` has no `.catch` (copy as-is from blueprint,
    // no adding), the derived final promise has no consumer, Node will flag it as unhandled
    // rejection — this fallback listener just swallows this one known, expected harness noise,
    // does not affect any assertion results of this test.
    const swallowExpectedRejection = (reason: unknown): void => {
      if (reason instanceof Error && reason.message === 'wiki timeout') return
      throw reason
    }
    // [SP8-P6 T10 correction — original comment "this repo lacks `@types/node`, so cannot directly
    // reference global `process` type" no longer holds] After merge `@types/node` is installed,
    // and 7 files in the repo have `/// <reference types="node" />` (`color-guard.test.ts` etc),
    // this directive is **program-level**: it pulls `@types/node/globals.d.ts` into the entire
    // compilation program, where `declare var process: NodeJS.Process` becomes visible to **all**
    // source files. `tsconfig`'s `types` array only blocks "auto-inclusion", not explicit reference.
    // Evidence (T10 bidirectional probe): create a file with no `node:` import and no reference,
    // just write `export const b = process.platform` → `vue-tsc --noEmit` **exit 0**; add one line
    // to same file `const wrong: number = 'string'` → **TS2322 exit 2** ⇒ previous exit 0 was not a miss.
    // ⇒ the `globalThis` narrowing below is **no longer necessary** on type level, direct `process.on(...)` compiles.
    // This edit only corrects the comment, not implementation (T10 discipline: only touch comments).
    // It still has independent value: explicitly list the two methods used, not depending on
    // "some file happens to have reference directive" implicit linkage — if those 7 references
    // are deleted, bare `process` immediately fails to compile, but this narrowing will not.
    const proc = (globalThis as unknown as {
      process: {
        on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
        off(event: 'unhandledRejection', listener: (reason: unknown) => void): void
      }
    }).process
    proc.on('unhandledRejection', swallowExpectedRejection)
    const s = useKnowledgeStore()
    const loadOverview = vi.spyOn(s, 'loadOverview').mockResolvedValue()
    const loadRoots = vi.spyOn(s, 'loadRoots').mockRejectedValue(new Error('wiki timeout'))
    const loadNotesSummary = vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    expect(w.find('.k2-skel-card').exists()).toBe(false) // ready is set
    // [Reinforcement 6] All three loaders are indeed called once each (not just lucky parts).
    expect(loadOverview).toHaveBeenCalledTimes(1)
    expect(loadRoots).toHaveBeenCalledTimes(1)
    expect(loadNotesSummary).toHaveBeenCalledTimes(1)
    // Acceptance feedback correction (2026-08-01): overview page's loadRoots is **background**
    // loading, must fail silently, else when Wiki hangs will show "operation failed" popup
    // after 60s on any page.
    expect(loadRoots).toHaveBeenCalledWith({ silent: true })
    proc.off('unhandledRejection', swallowExpectedRejection)
  })

  // [Review Important I-1, fixed] Previous version's comment assertion "`Promise.all` and
  // `Promise.allSettled` are completely equivalent on "three loaders each called once + ready
  // ultimately true" and cannot be distinguished from outside component" — **this judgment is wrong**.
  // `Promise.all` is **fail-fast**: if any input rejects, `Promise.all(...)` returns combined
  // promise that immediately rejects (without waiting other inputs settle), `.finally` thus
  // triggers immediately, `ready` is immediately set — even if some input (e.g. `loadOverview`)
  // never resolves. `Promise.allSettled` is opposite: it never rejects, must wait **all** inputs
  // settle (fulfilled or rejected) before resolving, `.finally` thus waits until that moment —
  // if one input hangs forever, `allSettled` version's `ready` never sets, skeleton forever stuck.
  // This is partial cause of N3's 60-second skeleton phenomenon: even if Wiki hangs causing
  // `loadRoots` very slow, as long as it eventually settles (success or fail), `Promise.all`
  // settles along — but without this fail-fast property (e.g. mistakenly changed to allSettled),
  // if a loader truly hangs forever, skeleton worse now, never escapes. Below pin directly uses
  // fail-fast observable difference: `loadRoots` immediately reject, `loadOverview` permanently
  // hangs (mock promise that never settles) —
  //   `Promise.all(...).finally(...)`(current, copy as-is from blueprint) → immediately reject triggers
  //     `.finally`, `ready` immediately set, skeleton immediately gone.
  //   `Promise.allSettled(...).finally(...)`(mistaken version) → forever waits for
  //     `loadOverview` settle, `ready` never set, skeleton forever stuck.
  // Two versions' externally observable results in this scenario are distinctly different, distinguishable.
  it('N3 pin: Promise.all is fail-fast — when loadRoots immediately rejects, even if loadOverview permanently hangs, skeleton will disappear', async () => {
    const swallowExpectedRejection = (reason: unknown): void => {
      if (reason instanceof Error && reason.message === 'wiki timeout') return
      throw reason
    }
    const proc = (globalThis as unknown as {
      process: {
        on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
        off(event: 'unhandledRejection', listener: (reason: unknown) => void): void
      }
    }).process
    proc.on('unhandledRejection', swallowExpectedRejection)

    const s = useKnowledgeStore()
    // loadOverview permanently hangs: intentionally return promise that never settles.
    vi.spyOn(s, 'loadOverview').mockReturnValue(new Promise<void>(() => {}))
    vi.spyOn(s, 'loadRoots').mockRejectedValue(new Error('wiki timeout'))
    vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
    const w = await mountDash()
    await flushPromises()
    // fail-fast: even if loadOverview never resolves, skeleton already gone.
    // If mistakenly changed to Promise.allSettled, this assertion turns red (skeleton forever stuck at true).
    expect(w.find('.k2-skel-card').exists()).toBe(false)

    proc.off('unhandledRejection', swallowExpectedRejection)
  })

  it('Reinforcement: if any of three sources has not settled, skeleton still present (not early exit if any resolves)', async () => {
    const s = useKnowledgeStore()
    vi.spyOn(s, 'loadOverview').mockResolvedValue()
    let resolveRoots!: () => void
    vi.spyOn(s, 'loadRoots').mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRoots = resolve
      }),
    )
    vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
    const w = await mountDash()
    await flushPromises()
    // loadOverview/loadNotesSummary resolved, but loadRoots still pending → skeleton still present
    expect(w.find('.k2-skel-card').exists()).toBe(true)
    resolveRoots()
    await flushPromises()
    expect(w.find('.k2-skel-card').exists()).toBe(false)
  })
})

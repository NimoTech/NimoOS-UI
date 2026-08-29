import { describe, it, expect } from 'vitest'
import { knowledgeRoutes } from './knowledgeRoutes'
import KnowledgeDeferred from './views/KnowledgeDeferred.vue'
import KnowledgeLayout from './views/KnowledgeLayout.vue'
import DashboardView from './views/DashboardView.vue'
import QueueView from './views/QueueView.vue'
import IndexedFilesView from './views/IndexedFilesView.vue'
import SettingsView from './views/SettingsView.vue'
import NotesView from './views/NotesView.vue'
import SearchView from './views/SearchView.vue'
import WikiView from './views/WikiView.vue'
import RootsView from './views/RootsView.vue'
import AllowlistView from './views/AllowlistView.vue'
import ParserStatus from './parser/ParserStatus.vue'
import ParserTest from './parser/ParserTest.vue'

describe('knowledgeRoutes', () => {
  it('one layout route carries 9 child routes + two parser routes', () => {
    expect(knowledgeRoutes).toHaveLength(3)
    const layout = knowledgeRoutes[0]
    expect(layout.path).toBe('/ai/knowledge')
    expect(layout.children?.map((c) => c.path)).toEqual(
      ['', 'search', 'wiki', 'indexed-files', 'queue', 'roots', 'allowlist', 'notes', 'settings'])
    expect(knowledgeRoutes[1].path).toBe('/ai/parser')
    expect(knowledgeRoutes[2].path).toBe('/ai/parser/test')
  })

  it('route names match Vue2 verbatim', () => {
    const names = [knowledgeRoutes[0].children!.map((c) => c.name),
                   knowledgeRoutes[1].name, knowledgeRoutes[2].name].flat()
    expect(names).toEqual(['KnowledgeDashboard', 'KnowledgeSearch', 'KnowledgeWiki',
      'KnowledgeIndexedFiles', 'KnowledgeQueue', 'KnowledgeRoots', 'KnowledgeAllowlist',
      'KnowledgeNotes', 'KnowledgeSettings', 'AIParser', 'AIParserTest'])
  })

  // 【Review R8, Critical, reversed on 2026-08-01 (not deleted)】 The original assertion
  // pinned "all 11 routes in this batch have their component pointing at KnowledgeDeferred"
  // — this assertion is itself the textbook example of what that Critical was about: the
  // parent route (the layout slot) had stayed KnowledgeDeferred all along, KnowledgeLayout
  // (T10) had zero imports anywhere in the repo, knowledge.scss never actually made it into
  // the build output, and this assertion stayed green the whole time, because it had turned
  // "the parent route is also a placeholder" into "this is the expected behavior." The
  // coordinator ruled that the parent-route step belongs to T10, so it's now reversed to:
  // the parent route (the layout slot) === KnowledgeLayout; the 9 child routes + the 2
  // standalone parser routes are still === KnowledgeDeferred (the K7 placeholder mechanism
  // itself is unchanged; the `''` child route is left for T12 to swap in the real
  // DashboardView, at which point this assertion will fail precisely, as a reminder to
  // update it in sync).
  //
  // Before (2026-07-31, T5 original):
  //   it('all 11 routes in this batch (P5a) still have the placeholder component KnowledgeDeferred', () => {
  //     const components = [
  //       ...knowledgeRoutes[0].children!.map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(components).toHaveLength(11)
  //     for (const c of components) expect(c).toBe(KnowledgeDeferred)
  //   })
  // 【T12, 2026-08-01, reversed (not deleted)】 The R8 assertion above (before this change)
  // counted the `''` child route as one of the 11 "still a placeholder" routes — now that
  // `''` has been swapped for the real DashboardView (this task's output), that assertion
  // has to be reversed in step, or it will fail precisely (which is exactly the moment the
  // R8 comment warned about).
  //
  // Before (2026-08-01 R8 original, before this reversal):
  //   it('the parent route (layout slot) is KnowledgeLayout, the 9 child routes + 2 parser routes are still the placeholder KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //     const stillDeferred = [
  //       ...knowledgeRoutes[0].children!.map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(stillDeferred).toHaveLength(11)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // After (P5a T12): `''` is individually pinned to DashboardView; the other 8 child
  // routes + 2 parser routes are still pinned to KnowledgeDeferred (the K7 placeholder
  // mechanism itself is unchanged).
  //
  // 【SP8-P5b Task 5, 2026-08-01, reversed again (not deleted)】 The assertion above counted
  // the `queue` child route too as one of the 10 "still a placeholder" routes — now that
  // `queue` has been swapped for the real QueueView (this task's output), that assertion has
  // to be reversed in step, or it will fail precisely (the same pattern the T12 R8 comment
  // warned about).
  //
  // Before (P5a T12 original, before this reversal):
  //   it('the parent route (layout slot) is KnowledgeLayout, the "" child route (dashboard) is DashboardView, the other 8 child routes + 2 parser routes are still the placeholder KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const stillDeferred = [
  //       ...knowledgeRoutes[0].children!.filter((c) => c.path !== '').map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(stillDeferred).toHaveLength(10)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // After (P5b T5): the `''` and `queue` child routes are each individually pinned to
  // DashboardView / QueueView; the other 7 child routes + 2 parser routes are still pinned
  // to KnowledgeDeferred.
  //
  // 【SP8-P5b Task 10, 2026-08-02, third reversal (not deleted)】 The assertion above counted
  // the `indexed-files` child route too as one of the 9 "still a placeholder" routes — now
  // that `indexed-files` has been swapped for the real IndexedFilesView (the output of T8/T9/
  // T10's three-part wrap-up), that assertion has to be reversed in step, or it will fail
  // precisely (the same pattern the T12 R8 comment warned about and T5 already reproduced once).
  //
  // Before (P5b T5 original, before this reversal):
  //   it('the parent route (layout slot) is KnowledgeLayout, "" is DashboardView, "queue" is QueueView, the other 7 child routes + 2 parser routes are still the placeholder KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
  //     expect(queueChild?.component).toBe(QueueView)
  //     expect(queueChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const stillDeferred = [
  //       ...knowledgeRoutes[0].children!.filter((c) => c.path !== '' && c.path !== 'queue').map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(stillDeferred).toHaveLength(9)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // After (P5b T10): the `''` / `queue` / `indexed-files` child routes are each individually
  // pinned to DashboardView / QueueView / IndexedFilesView; the other 6 child routes + 2
  // parser routes are still pinned to KnowledgeDeferred (the K7 placeholder mechanism itself
  // is unchanged).
  //
  // 【SP8-P5c Task 10, 2026-08-04, fourth reversal (not deleted)】 The assertion above counted
  // the `settings` child route **and both parser routes** as part of the 8 "still a
  // placeholder" routes — this pass reverses three at once: `settings` → SettingsView (the
  // output of T8's first half + T9's second half), `/ai/parser` → ParserStatus (T6's output),
  // `/ai/parser/test` → ParserTest (T7's output); this assertion has to be reversed in step,
  // or it will fail precisely (the same pattern the T12 R8 comment warned about, already
  // reproduced twice by T5 and P5b T10).
  // 🔴 **After this pass, the two top-level parser routes have no placeholder left at all** →
  // `stillDeferred`'s source no longer splices in `knowledgeRoutes[1]/[2]`, it's changed to
  // **only take child routes**, plus two new positive assertions each pinning them to their
  // real component (and `not.toBe(KnowledgeDeferred)`).
  // 🔴 **The K7 placeholder mechanism is still proven alive by this case**: the remaining
  // **5** child routes (`search` / `wiki` / `roots` / `allowlist` / `notes`) are still pinned
  // to KnowledgeDeferred (per the lesson from P4 I2 — once you've emptied a list, there still
  // has to be a case proving the mechanism has teeth, not just a stretch of code nobody tests
  // any more). `allowlist` staying on the placeholder is the result of the user explicitly
  // pulling it out of this batch on 2026-08-03 (governance §2.2), not a missed migration.
  //
  // Before (P5b T10 original, before this reversal):
  //   it('the parent route (layout slot) is KnowledgeLayout, "" is DashboardView, "queue" is QueueView, "indexed-files" is IndexedFilesView, the other 6 child routes + 2 parser routes are still the placeholder KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
  //     expect(queueChild?.component).toBe(QueueView)
  //     expect(queueChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const indexedFilesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'indexed-files')
  //     expect(indexedFilesChild?.component).toBe(IndexedFilesView)
  //     expect(indexedFilesChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const migrated = ['', 'queue', 'indexed-files']
  //     const stillDeferred = [
  //       ...knowledgeRoutes[0]
  //         .children!.filter((c) => !migrated.includes(c.path))
  //         .map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(stillDeferred).toHaveLength(8)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // 【SP8-P5d Task 10, 2026-08-05, fifth reversal (not deleted)】 The assertion above counted
  // the `notes` child route too as one of the 5 "still a placeholder" routes — this pass
  // reverses `notes` → NotesView (the output of T6-T9's four-part wrap-up); this assertion has
  // to be reversed in step, or it will fail precisely (the same pattern the T12 R8 comment
  // warned about, already reproduced three times by T5 / P5b T10 / P5c T10). **This pass is
  // the last piece of this batch (P5d)** — `/ai/knowledge`'s left rail item 4, "Notes," is
  // reachable for real for the first time.
  // 🔴 **The K7 placeholder mechanism is still proven alive by this case**: the remaining
  // **4** child routes (`search` / `wiki` / `roots` / `allowlist`) are still pinned to
  // KnowledgeDeferred (per the lesson from P4 I2 — once you've emptied a list, there still has
  // to be a case proving the mechanism has teeth, not just a stretch of code nobody tests any
  // more). Which batch each of the four gets reversed in is noted at the top of `deferred.ts`
  // (`search`→P5e; `wiki`/`roots`/`allowlist`→P5f).
  //
  // Before (P5c T10 original, before this reversal):
  //   it('the parent route (layout slot) is KnowledgeLayout, the four child routes "" / "queue" / "indexed-files" / "settings" and both parser routes are all real components, the other 5 child routes are still the placeholder KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
  //     expect(queueChild?.component).toBe(QueueView)
  //     expect(queueChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const indexedFilesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'indexed-files')
  //     expect(indexedFilesChild?.component).toBe(IndexedFilesView)
  //     expect(indexedFilesChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const settingsChild = knowledgeRoutes[0].children!.find((c) => c.path === 'settings')
  //     expect(settingsChild?.component).toBe(SettingsView)
  //     expect(settingsChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     expect(knowledgeRoutes[1].component).toBe(ParserStatus)
  //     expect(knowledgeRoutes[1].component).not.toBe(KnowledgeDeferred)
  //     expect(knowledgeRoutes[2].component).toBe(ParserTest)
  //     expect(knowledgeRoutes[2].component).not.toBe(KnowledgeDeferred)
  //
  //     // K7 mechanism anchor: the remaining 5 child routes must still point at the placeholder (per P4 I2).
  //     const migrated = ['', 'queue', 'indexed-files', 'settings']
  //     const stillDeferred = knowledgeRoutes[0]
  //       .children!.filter((c) => !migrated.includes(c.path))
  //       .map((c) => c.component)
  //     expect(
  //       knowledgeRoutes[0].children!.filter((c) => !migrated.includes(c.path)).map((c) => c.path),
  //     ).toEqual(['search', 'wiki', 'roots', 'allowlist', 'notes'])
  //     expect(stillDeferred).toHaveLength(5)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // After (P5d T10): the five child routes `''` / `queue` / `indexed-files` / `settings` /
  // `notes` + the two top-level parser routes are each individually pinned to their real
  // component; the remaining 4 child routes are still pinned to KnowledgeDeferred.
  //
  // Before (P5d T10 original, before this reversal):
  //   it('the parent route (layout slot) is KnowledgeLayout, the five child routes "" / "queue" / "indexed-files" / "settings" / "notes" and both parser routes are all real components, the other 4 child routes are still the placeholder KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
  //     expect(queueChild?.component).toBe(QueueView)
  //     expect(queueChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const indexedFilesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'indexed-files')
  //     expect(indexedFilesChild?.component).toBe(IndexedFilesView)
  //     expect(indexedFilesChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const settingsChild = knowledgeRoutes[0].children!.find((c) => c.path === 'settings')
  //     expect(settingsChild?.component).toBe(SettingsView)
  //     expect(settingsChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const notesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'notes')
  //     expect(notesChild?.component).toBe(NotesView)
  //     expect(notesChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     expect(knowledgeRoutes[1].component).toBe(ParserStatus)
  //     expect(knowledgeRoutes[1].component).not.toBe(KnowledgeDeferred)
  //     expect(knowledgeRoutes[2].component).toBe(ParserTest)
  //     expect(knowledgeRoutes[2].component).not.toBe(KnowledgeDeferred)
  //
  //     // K7 mechanism anchor: the remaining 4 child routes must still point at the placeholder (per P4 I2).
  //     const migrated = ['', 'queue', 'indexed-files', 'settings', 'notes']
  //     const stillDeferred = knowledgeRoutes[0]
  //       .children!.filter((c) => !migrated.includes(c.path))
  //       .map((c) => c.component)
  //     expect(
  //       knowledgeRoutes[0].children!.filter((c) => !migrated.includes(c.path)).map((c) => c.path),
  //     ).toEqual(['search', 'wiki', 'roots', 'allowlist'])
  //     expect(stillDeferred).toHaveLength(4)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // 【SP8-P5e Task 8, 2026-08-05, sixth reversal (not deleted)】 The assertion above counted
  // the `search` child route too as one of the 4 "still a placeholder" routes — this pass
  // reverses `search` → SearchView (the output of T4-T7's four-part wrap-up); this assertion
  // has to be reversed in step, or it will fail precisely (the same pattern the T12 R8 comment
  // warned about, already reproduced four times by T5 / P5b T10 / P5c T10 / P5d T10). **This
  // pass is the last piece of this batch (P5e)** — `/ai/knowledge`'s left rail item 2,
  // "Search," is reachable for real for the first time.
  // 🔴 **The K7 placeholder mechanism is still proven alive by this case**: the remaining
  // **3** child routes (`wiki` / `roots` / `allowlist`) are still pinned to KnowledgeDeferred
  // (per the lesson from P4 I2 — once you've emptied a list, there still has to be a case
  // proving the mechanism has teeth, not just a stretch of code nobody tests any more). Which
  // batch these three get reversed in is noted at the top of `deferred.ts` (all three go to
  // P5f).
  // 【SP8-P5f Task 8, 2026-08-06, seventh reversal (not deleted) — the wrap-up pass】 The
  // assertion above counted the `wiki` / `roots` / `allowlist` child routes as the 3 "still a
  // placeholder" routes — this pass reverses **all three at once**: `wiki` → WikiView (T6's
  // first half + T7's second half), `roots` → RootsView (T5), `allowlist` → AllowlistView
  // (T4); this assertion has to be reversed in step, or it will fail precisely (the same
  // pattern the T12 R8 comment warned about, already reproduced five times by T5 / P5b T10 /
  // P5c T10 / P5d T10 / P5e T8).
  // 🔴 **This pass is the last piece of this batch (P5f), and also the wrap-up of SP8-P5's six
  // batches** — rail item 3 "Wiki" / item 7 "Indexed Files" / item 8 "Allowlist" are reachable
  // for real for the first time; `/ai/knowledge` has zero placeholders left anywhere.
  // 🔴 **How the K7 placeholder mechanism proves itself changes shape in this pass**: up to
  // now every generation relied on "the remaining N routes are still === KnowledgeDeferred" to
  // prove the mechanism is alive; once the list is empty, that style of assertion degenerates
  // into **an empty loop with zero discriminating power** (per P4 I2). So it's replaced with
  // two guards pointing in **opposite directions**:
  //   ① KnowledgeDeferred appears **0 times** among the 11 routes' components (positively
  //      pinning down "zero placeholders");
  //   ② an anti-vacuity anchor — it must actually have retrieved **11** components and
  //      **every single one** must be non-undefined, otherwise "0 times" could just mean
  //      nothing was retrieved at all.
  // The proof that the mechanism itself "still has teeth" is handed off to deferred.test.ts's
  // **temporary non-empty list** case.
  //
  // Before (P5e T8 original, before this reversal):
  //   it('the parent route (layout slot) is KnowledgeLayout, the six child routes "" / "queue" / "indexed-files" / "settings" / "notes" / "search" and both parser routes are all real components, the other 3 child routes are still the placeholder KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
  //     expect(queueChild?.component).toBe(QueueView)
  //     expect(queueChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const indexedFilesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'indexed-files')
  //     expect(indexedFilesChild?.component).toBe(IndexedFilesView)
  //     expect(indexedFilesChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const settingsChild = knowledgeRoutes[0].children!.find((c) => c.path === 'settings')
  //     expect(settingsChild?.component).toBe(SettingsView)
  //     expect(settingsChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const notesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'notes')
  //     expect(notesChild?.component).toBe(NotesView)
  //     expect(notesChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const searchChild = knowledgeRoutes[0].children!.find((c) => c.path === 'search')
  //     expect(searchChild?.component).toBe(SearchView)
  //     expect(searchChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     expect(knowledgeRoutes[1].component).toBe(ParserStatus)
  //     expect(knowledgeRoutes[1].component).not.toBe(KnowledgeDeferred)
  //     expect(knowledgeRoutes[2].component).toBe(ParserTest)
  //     expect(knowledgeRoutes[2].component).not.toBe(KnowledgeDeferred)
  //
  //     // K7 mechanism anchor: the remaining 3 child routes must still point at the placeholder (per P4 I2).
  //     const migrated = ['', 'queue', 'indexed-files', 'settings', 'notes', 'search']
  //     const stillDeferred = knowledgeRoutes[0]
  //       .children!.filter((c) => !migrated.includes(c.path))
  //       .map((c) => c.component)
  //     expect(
  //       knowledgeRoutes[0].children!.filter((c) => !migrated.includes(c.path)).map((c) => c.path),
  //     ).toEqual(['wiki', 'roots', 'allowlist'])
  //     expect(stillDeferred).toHaveLength(3)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  it('the parent route (layout slot) is KnowledgeLayout, the 9 child routes and both parser routes are **all** real components — zero placeholders left (SP8-P5, wrap-up of six batches)', () => {
    expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)

    const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
    expect(dashboardChild?.component).toBe(DashboardView)
    expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)

    const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
    expect(queueChild?.component).toBe(QueueView)
    expect(queueChild?.component).not.toBe(KnowledgeDeferred)

    const indexedFilesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'indexed-files')
    expect(indexedFilesChild?.component).toBe(IndexedFilesView)
    expect(indexedFilesChild?.component).not.toBe(KnowledgeDeferred)

    const settingsChild = knowledgeRoutes[0].children!.find((c) => c.path === 'settings')
    expect(settingsChild?.component).toBe(SettingsView)
    expect(settingsChild?.component).not.toBe(KnowledgeDeferred)

    const notesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'notes')
    expect(notesChild?.component).toBe(NotesView)
    expect(notesChild?.component).not.toBe(KnowledgeDeferred)

    const searchChild = knowledgeRoutes[0].children!.find((c) => c.path === 'search')
    expect(searchChild?.component).toBe(SearchView)
    expect(searchChild?.component).not.toBe(KnowledgeDeferred)

    // ── 🔴 P5f T8 addition: one positive assertion each for the three newly-reversed routes
    //    (test: if any one of them reverts to KnowledgeDeferred → both its own `toBe(real
    //    component)` and the "zero placeholders" assertion below fail at the same time).
    const wikiChild = knowledgeRoutes[0].children!.find((c) => c.path === 'wiki')
    expect(wikiChild?.component).toBe(WikiView)
    expect(wikiChild?.component).not.toBe(KnowledgeDeferred)

    const rootsChild = knowledgeRoutes[0].children!.find((c) => c.path === 'roots')
    expect(rootsChild?.component).toBe(RootsView)
    expect(rootsChild?.component).not.toBe(KnowledgeDeferred)

    const allowlistChild = knowledgeRoutes[0].children!.find((c) => c.path === 'allowlist')
    expect(allowlistChild?.component).toBe(AllowlistView)
    expect(allowlistChild?.component).not.toBe(KnowledgeDeferred)

    expect(knowledgeRoutes[1].component).toBe(ParserStatus)
    expect(knowledgeRoutes[1].component).not.toBe(KnowledgeDeferred)
    expect(knowledgeRoutes[2].component).toBe(ParserTest)
    expect(knowledgeRoutes[2].component).not.toBe(KnowledgeDeferred)

    // 🔴 K7 mechanism anchor (shape reversed in P5f T8): this used to be "the remaining N
    // routes are still === KnowledgeDeferred"; once the list is empty that style degenerates
    // into an empty loop ⇒ replaced with a positive "zero placeholders" pin + an anti-vacuity
    // anchor (per P4 I2).
    const allComponents = [
      ...knowledgeRoutes[0].children!.map((c) => c.component),
      knowledgeRoutes[1].component,
      knowledgeRoutes[2].component,
    ]
    // Anti-vacuity ①: must actually retrieve 11 — otherwise "zero placeholders" could just mean nothing was retrieved at all.
    expect(allComponents).toHaveLength(11)
    // Anti-vacuity ②: all 11 must be truthy (undefined is both !== KnowledgeDeferred and renders nothing).
    expect(allComponents.filter((c) => c != null)).toHaveLength(11)
    // The actual point: the placeholder appears 0 times among the 11 routes.
    expect(allComponents.filter((c) => c === KnowledgeDeferred)).toEqual([])
    // The child route path list is pinned in sync too, so "deleting a route" can't slip this assertion through green.
    expect(knowledgeRoutes[0].children!.map((c) => c.path)).toEqual(
      ['', 'search', 'wiki', 'indexed-files', 'queue', 'roots', 'allowlist', 'notes', 'settings'])
  })
})

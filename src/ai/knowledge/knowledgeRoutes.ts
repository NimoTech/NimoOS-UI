// SP8-P5a Task 5 — knowledge base 11 routes (blueprint: the Vue 2 panel's src/router/route.js:155-200,
// read via `git show main:` rather than the on-disk working tree, which was a stale branch).
//
// Divergence declarations (following governance §2 three-part):
// 1) Route names verbatim from blueprint PascalCase (KnowledgeDashboard etc.), rest of this repo's
//    routes are kebab-case (ai-agent/ai-settings) — this task intentionally keeps blueprint naming;
//    deep links/programmatic navigation 1:1 match names; 1:1 Vue2 takes precedence over this repo's
//    naming convention.
// 2) Components use this repo's existing top-level eager import style (see src/router/index.ts),
//    not blueprint's () => import(...) lazy-loading — follows this repo's existing route files.
// 3) Don't copy blueprint meta.requireAuth/meta.showBackground and hidden fields — this repo's
//    meta semantics differ (guard.ts only recognizes meta.public for public routes); follow this
//    repo's existing ai-agent/ai-settings routes (both don't write meta); auth falls back to
//    global authGuard.
//
// [Review R8, Critical, 2026-08-01 fix] Parent route (layout position) originally also pointed to
// placeholder KnowledgeDeferred — KnowledgeDeferred lacks `<router-view/>` outlet, so
// KnowledgeLayout (T10) had zero imports in entire repo, became dead code; knowledge.scss also
// never actually entered build output (`dist/assets/*.css` no `knowledge-app` search hit).
// T5/T10/T12 three briefs didn't specify "which task should wire parent route to KnowledgeLayout",
// coordinator ruled this belongs to T10 (shell task output shouldn't be dead code).
// Now parent route component changed to KnowledgeLayout, its own `<router-view/>` has content
// to render. 9 child routes + 2 standalone parser routes **still** point to KnowledgeDeferred —
// `''` child route reserved for T12 to replace with real DashboardView; remaining 8 child routes
// and 2 parser routes reserved for later batches to replace one by one (K7 mechanism unchanged,
// just parent layer changes from "placeholder to placeholder" to "real layout + placeholder children").
// [T12, 2026-08-01] The `''` child route (dashboard slot) is flipped from the placeholder page
// KnowledgeDeferred to the real DashboardView (K7 mechanism unchanged, flipping is not deleting —
// see the before/after original-text comparison in knowledgeRoutes.test.ts). The remaining 8
// child routes + 2 standalone parser routes are still placeholder pages, left for later batches
// to replace one by one.
//
// [SP8-P5b Task 5, 2026-08-01] The `queue` child route (task-queue slot) is likewise flipped from
// the placeholder page KnowledgeDeferred to the real QueueView (K7 mechanism unchanged, flipping
// is not deleting — see the before/after original-text comparison in knowledgeRoutes.test.ts,
// following the T12 precedent for the `''` child route). The remaining 7 child routes + 2
// standalone parser routes are still placeholder pages, left for later batches to replace one by
// one.
//
// [SP8-P5b Task 10, 2026-08-02] The `indexed-files` child route (indexed-files slot) is likewise
// flipped from the placeholder page KnowledgeDeferred to the real IndexedFilesView (K7 mechanism
// unchanged, flipping is not deleting — see the before/after original-text comparison in
// knowledgeRoutes.test.ts, following the same T12/T5 precedent). The remaining 6 child routes + 2
// standalone parser routes are still placeholder pages, left for later batches to replace one by
// one.
//
// [SP8-P5c Task 10, 2026-08-04] This batch flips **three** routes at once (following the T12 /
// P5b T5 / P5b T10 three same-style precedents, flipping is not deleting):
//   · `settings` child route → real SettingsView (output of T8 first half + T9 second half);
//   · top-level `/ai/parser`      → real ParserStatus (output of T6);
//   · top-level `/ai/parser/test` → real ParserTest (output of T7).
// 🔴 This is also the **first time `src/ai/styles/parser-styles.scss` (T2b output) is
// entry-reachably imported** — before this ParserStatus/ParserTest had zero production imports
// in entire repo, module doesn't enter Vite graph; that scss file's side-effect import never
// evaluated, no CSS compiled in output (governance §12.3 E-13: `.vue` just "exists and imports"
// doesn't enter output).
// [M-5, 2026-08-05, P5e-T8 incidental fix] 🔴 This section is a **snapshot of state at P5c-T10
// submission (2026-08-04)**; original text uses present tense "remaining 5 child routes ... still point
// to KnowledgeDeferred" — this statement was already advanced once by the P5d Task 10 record below
// (5→4), now advanced again by the P5e Task 8 record at end of file (4→3). **This original text
// preserved intact per "reverse not delete", only tone changed from present to historical record,
// not changing historical facts it describes**: at the moment P5c-T10 completed, `search` / `wiki` /
// `roots` / `allowlist` / `notes` these 5 child routes truly all still pointed to KnowledgeDeferred;
// K7 placeholder mechanism itself preserved; `allowlist` explicitly moved out this period by user
// 2026-08-03 (governance §2.2), not a migration miss. **After P5c-T10 reverse, parser's two
// top-level routes had no placeholder remnants (remains so).**
// 🔴 Current latest state always follows last reverse record at end of file + `deferred.ts` header,
// don't just read this section.
//
// [SP8-P5d Task 10, 2026-08-05] The `notes` child route (notes slot) is likewise flipped from
// the placeholder page KnowledgeDeferred to the real NotesView (output of the T6-T9 four-task
// closeout; the K7 placeholder mechanism itself unchanged — see the before/after original-text
// comparison in knowledgeRoutes.test.ts, following the T12 / P5b T5 / P5b T10 / P5c T10 four
// same-style precedents). **This move is the final step of this period (P5d)** — `/ai/knowledge`
// left rail item 4 "Notes" is truly reachable for the first time. The remaining 4 child routes
// (`search` / `wiki` / `roots` / `allowlist`) still point to KnowledgeDeferred; ownership is
// documented in the `deferred.ts` file header.
// [M-5 recurrence, fixed in passing by P5f-T8, 2026-08-06 — tone only, does not change the
// historical facts it describes]
// 🔴 The sentence above, "the remaining 4 child routes **still point to** KnowledgeDeferred," is
// a **snapshot of state at the moment P5d-T10 was written (2026-08-05)**, written in present
// tense; it has since been advanced once by P5e-T8 (4→3). Preserved intact per "flip, don't
// delete," **read as a historical record**: *at the moment P5d-T10 was completed*, those 4 child
// routes truly all still pointed to the placeholder page. See the most recent flip record at the
// end of the file for the current state.
//
// [SP8-P5e Task 8, 2026-08-05, sixth flip (not a deletion)] The `search` child route (search
// slot) is likewise flipped from the placeholder page KnowledgeDeferred to the real SearchView
// (output of the T4-T7 four-task closeout; the K7 placeholder mechanism itself unchanged — see
// the before/after original-text comparison in knowledgeRoutes.test.ts, following the T12 / P5b
// T5 / P5b T10 / P5c T10 / P5d T10 five same-style precedents). **This move is the final step of
// this period (P5e)** — `/ai/knowledge` left rail item 2 "Search" is truly reachable for the
// first time. The remaining 3 child routes (`wiki` / `roots` / `allowlist`) still point to
// KnowledgeDeferred, all owned by P5f (see the `deferred.ts` file header).
// [M-5 recurrence, fixed in passing by P5f-T8, 2026-08-06 — tone only, does not change the
// historical facts it describes]
// 🔴 Same as above: "the remaining 3 child routes **still point to** KnowledgeDeferred" is a
// **snapshot of state at the moment P5e-T8 was written (2026-08-05)**; this move (P5f-T8) has
// already flipped all 3 of them to real components (3→0). Preserved per "flip, don't delete,"
// **read as a historical record**.
// 🔴 **General reading rule (M-5 has recurred three periods running now, spelled out here for
// good)**: this file header is a **generation-by-generation appended lineage**, where each
// paragraph only describes the state "at the moment that move was written." **The current latest
// state always follows the last flip record at the end of the file — never cite the "N
// remaining" figure from any intermediate paragraph.**
//
// [SP8-P5f Task 8, 2026-08-06, seventh reverse (not delete) — final closing move] This move reverses
// **three routes** (following T12 / P5b T5 / P5b T10 / P5c T10 / P5d T10 / P5e T8 six precedents):
//   · `wiki`      child route → true **WikiView** (T6 first half + T7 second half output);
//   · `roots`     child route → true **RootsView** (T5 output);
//   · `allowlist` child route → true **AllowlistView** (T4 output).
// 🔴 **This move is the final step of this period (P5f) and the closing move of SP8-P5 six batches**
// — `/ai/knowledge` left rail item 3 "Wiki" / item 7 "Index Directory" / item 8 "Allowlist"
// truly reachable for first time.
// 🔴 **After this move, all 11 routes in this file (9 child + 2 parser top-level) never point
// to KnowledgeDeferred again** — placeholder page has zero remnants in `/ai/knowledge` region.
// 🔴 But K7 mechanism of `KnowledgeDeferred.vue` and `deferred.ts` **both preserved** (K8 /
// following P4 I2): knowledgeRoutes.test.ts uses "KnowledgeDeferred appears 0 times in all
// components" + one "actually got 11 components" anti-empty-loop anchor to pin this state;
// deferred.test.ts uses temporary non-empty list to prove judgment mechanism itself still works.
// When future placeholder page needed, just point back to KnowledgeDeferred.
// 🔴 This is also **first time `WikiView.vue` / `RootsView.vue` / `AllowlistView.vue` are
// entry-reachably imported** — before this all three had zero production imports in entire repo,
// modules don't enter Vite graph (governance §12.3 E-13: `.vue` just "exists" doesn't enter output).
// This move already tested per governance §8 build pipeline gate: before change `dist/assets/*.js`
// has `__name:"WikiView"` / `"RootsView"` / `"AllowlistView"` and `kw-split` all **0 hits**,
// after change all hit.
import type { RouteRecordRaw } from 'vue-router'
// 🔴 [P5f T8 declaration] After this move flips the last three routes, **this file no longer has
// any route pointing to KnowledgeDeferred** ⇒ this import line has become an "unused import" in
// this file. **Kept intentionally, not deleted** (K8 / following P4 I2's "keep the capability
// when you keep the code" + governance §9.10 "hardening only"):
//   · It is the sole production-side anchor of the K7 placeholder mechanism — deleting it would
//     leave `KnowledgeDeferred.vue` with zero production imports repo-wide, dropping it out of
//     the Vite graph entirely, leaving the mechanism as just a file nobody references;
//   · If a new page ever needs a placeholder again, just point that route's component back to
//     it — one line;
//   · `noUnusedLocals` is not enabled; both `vue-tsc --noEmit` and `vite build` exit 0 (verified).
// knowledgeRoutes.test.ts still consumes it route-by-route via `not.toBe(KnowledgeDeferred)`, and
// pins the current state with "KnowledgeDeferred appears 0 times across the 11 components" plus
// an anti-empty-loop anchor.
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

export const knowledgeRoutes: RouteRecordRaw[] = [
  {
    path: '/ai/knowledge',
    component: KnowledgeLayout,
    children: [
      { path: '', name: 'KnowledgeDashboard', component: DashboardView },
      { path: 'search', name: 'KnowledgeSearch', component: SearchView },
      // Before (P5e T8 original text, pre-flip): component: KnowledgeDeferred — see the P5f T8 record in the file header.
      { path: 'wiki', name: 'KnowledgeWiki', component: WikiView },
      { path: 'indexed-files', name: 'KnowledgeIndexedFiles', component: IndexedFilesView },
      { path: 'queue', name: 'KnowledgeQueue', component: QueueView },
      // Before (P5e T8 original text, pre-flip): component: KnowledgeDeferred.
      { path: 'roots', name: 'KnowledgeRoots', component: RootsView },
      // Before (P5e T8 original text, pre-flip): component: KnowledgeDeferred.
      { path: 'allowlist', name: 'KnowledgeAllowlist', component: AllowlistView },
      { path: 'notes', name: 'KnowledgeNotes', component: NotesView },
      { path: 'settings', name: 'KnowledgeSettings', component: SettingsView },
    ],
  },
  { path: '/ai/parser', name: 'AIParser', component: ParserStatus },
  { path: '/ai/parser/test', name: 'AIParserTest', component: ParserTest },
]

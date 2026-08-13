// SP8-P5a placeholder mechanism (divergence K7) — following P2a's DEFERRED_SECTIONS precedent: rail keeps
// Vue2's 9 items 1:1; unmigrated pages fall to placeholder; replace in batches. P5f will empty DEFERRED_TABS,
// **but mechanism itself preserved** (following P4 I2 lesson: after emptying, must still have test cases
// proving it works, not just orphaned untested code).
//
// [SP8-P5b Task 5, 2026-08-01] 'queue' migrated (QueueView.vue + knowledgeRoutes.ts reverse),
// removed from here; mechanism itself unchanged.
// [SP8-P5b Task 10, 2026-08-02] 'indexed-files' migrated (IndexedFilesView.vue three-move
// completion + knowledgeRoutes.ts reverse), removed from here; mechanism unchanged.
// [SP8-P5c Task 10, 2026-08-04] 'settings' migrated (SettingsView.vue, T8 first half + T9
// second half + knowledgeRoutes.ts reverse), removed from here → DEFERRED_TABS shrinks 6→5.
// 🔴 'allowlist' **kept**: upper design originally included AllowlistView in P5c, user explicitly
// moved out this period 2026-08-03 (governance §2.2), not doing this period; still placeholder.
// 🔴 `/ai/parser` and `/ai/parser/test` reversed together are **top-level routes, not rail tabs**,
// never in DEFERRED_TABS, so no corresponding items to remove (governance §5.1 / T10 brief §2).
// [SP8-P5d Task 10, 2026-08-05] 'notes' migrated (NotesView.vue, T6-T9 four-move completion +
// knowledgeRoutes.ts reverse), removed from here → DEFERRED_TABS shrinks 5→4.
// 🔴 Fulfills governance §15.1 "cross-period placeholder abandonment" general lesson — this
// period's ticket 1 cause is "previous three periods all missed nav entry"; placeholder abandoned
// with no owner. Specify which period each remaining 4 items revert to:
//   · 'search'                       → **P5e**
//   · 'wiki' / 'roots' / 'allowlist' → **P5f**
// K7 placeholder mechanism itself unchanged (following P4 I2 lesson; see KnowledgeTabId comment
// below and deferred.test.ts).
//
// [SP8-P5e Task 8, 2026-08-05, fifth reverse (not delete)] 'search' migrated (SearchView.vue,
// T4-T7 four-move completion + knowledgeRoutes.ts reverse), removed from here → DEFERRED_TABS
// shrinks 4→3. Following T5 (queue) / P5b-T10 (indexed-files) / P5c-T10 (settings) / P5d-T10 (notes)
// four precedents: reverse + add one forward assertion, delete no existing assertions (deferred.test.ts
// synced). 🔴 Restate which period each remaining **3** items revert to:
//   · 'wiki' / 'roots' / 'allowlist' → **P5f** (all three to P5f, no split to other periods).
// K7 placeholder mechanism itself still unchanged (following P4 I2 lesson — before emptying list,
// each step must still have test cases proving mechanism works, not just orphaned code; see
// KnowledgeTabId comment below and deferred.test.ts "mechanism anchor" case).
//
// [SP8-P5f Task 8, 2026-08-06, sixth reverse (not delete) — final closing move] 'wiki' / 'roots' /
// 'allowlist' three items migrated (P5f, four-move T4-T7: T4 = AllowlistView.vue · T5 = RootsView.vue ·
// T6 + T7 = WikiView.vue first/second half; knowledgeRoutes.ts simultaneously reverses three child routes),
// removed from here → DEFERRED_TABS shrinks 3→**0**.
// 🔴 **SP8-P5 six batches (P5a / P5b / P5c / P5d / P5e / P5f) all completed; placeholder list empty** —
// `/ai/knowledge` left rail 9 items (dashboard / search / wiki / notes / indexed-files / queue / roots /
// allowlist / settings) **zero placeholder pages**; every item maps to real page.
// 🔴 **Mechanism itself preserved per K8 / following P4 I2 lesson** — empty list doesn't mean delete
// mechanism. P4 I2 original lesson: "kept code without capability"; same applies backwards: **only
// asserting "array empty" is zero discriminative power** (hardcoding isDeferred below to `return false`,
// only asserting empty array still passes all cases). So deferred.test.ts keeps three-layer guards:
//   ① Under empty list, isDeferred(any of 9 tabs) always false;
//   ② Mechanism anchor — judgment source must be DEFERRED_TABS itself;
//   ③ 🔴 **Temporary non-empty list** — push one item at runtime (`as const` only at compile time;
//      array object itself mutable at runtime); isDeferred must immediately judge true for it, false for
//      others; clear and self-verify restoration after use. This is the real judge of "mechanism still
//      works", **must not degrade to only asserting empty array**.
// 🔴 If future page needs placeholder: just add tab id back to DEFERRED_TABS below; mechanism needs
// no rebuild.
export type KnowledgeTabId =
  | 'dashboard'
  | 'search'
  | 'wiki'
  | 'notes'
  | 'indexed-files'
  | 'queue'
  | 'roots'
  | 'allowlist'
  | 'settings'

// Before (P5e T8 original, before reverse — honoring "reverse not delete", keep original):
//   export const DEFERRED_TABS = [
//     'wiki',
//     'roots',
//     'allowlist',
//   ] as const satisfies readonly KnowledgeTabId[]
export const DEFERRED_TABS = [] as const satisfies readonly KnowledgeTabId[]

export function isDeferred(id: KnowledgeTabId): boolean {
  return (DEFERRED_TABS as readonly string[]).includes(id)
}

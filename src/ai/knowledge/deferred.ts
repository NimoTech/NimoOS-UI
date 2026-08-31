// Placeholder mechanism (divergence K7) — following the DEFERRED_SECTIONS precedent: rail keeps
// Vue2's 9 items 1:1; unmigrated pages fall to placeholder; replace in batches. The last batch will empty DEFERRED_TABS,
// **but mechanism itself preserved** (lesson learned earlier: after emptying, must still have test cases
// proving it works, not just orphaned untested code).
//
// 'queue' migrated (QueueView.vue + knowledgeRoutes.ts reverse),
// removed from here; mechanism itself unchanged.
// 'indexed-files' migrated (IndexedFilesView.vue three-move
// completion + knowledgeRoutes.ts reverse), removed from here; mechanism unchanged.
// 'settings' migrated (SettingsView.vue, first half +
// second half + knowledgeRoutes.ts reverse), removed from here → DEFERRED_TABS shrinks 6→5.
// 🔴 'allowlist' **kept**: upper design originally included AllowlistView earlier, user explicitly
// moved it out this period 2026-08-03 (governance §2.2), not doing this period; still placeholder.
// 🔴 `/ai/parser` and `/ai/parser/test` reversed together are **top-level routes, not rail tabs**,
// never in DEFERRED_TABS, so no corresponding items to remove (governance §5.1).
// 'notes' migrated (NotesView.vue, four-move completion +
// knowledgeRoutes.ts reverse), removed from here → DEFERRED_TABS shrinks 5→4.
// 🔴 Fulfills governance §15.1 "cross-period placeholder abandonment" general lesson — this
// period's ticket 1 cause is "previous three periods all missed nav entry"; placeholder abandoned
// with no owner. The remaining 4 items revert in later batches:
//   · 'search'                       → next batch
//   · 'wiki' / 'roots' / 'allowlist' → final batch
// K7 placeholder mechanism itself unchanged (see KnowledgeTabId comment
// below and deferred.test.ts).
//
// (fifth reverse, not delete) 'search' migrated (SearchView.vue,
// four-move completion + knowledgeRoutes.ts reverse), removed from here → DEFERRED_TABS
// shrinks 4→3. Following the same precedents as queue / indexed-files / settings / notes:
// reverse + add one forward assertion, delete no existing assertions (deferred.test.ts
// synced). 🔴 The remaining **3** items revert together:
//   · 'wiki' / 'roots' / 'allowlist' → final batch (all three together, no further split).
// K7 placeholder mechanism itself still unchanged (before emptying list,
// each step must still have test cases proving mechanism works, not just orphaned code; see
// KnowledgeTabId comment below and deferred.test.ts "mechanism anchor" case).
//
// (sixth reverse, not delete — final closing move) 'wiki' / 'roots' /
// 'allowlist' three items migrated (four-move: AllowlistView.vue · RootsView.vue ·
// WikiView.vue first/second half; knowledgeRoutes.ts simultaneously reverses three child routes),
// removed from here → DEFERRED_TABS shrinks 3→**0**.
// 🔴 **All batches now completed; placeholder list empty** —
// `/ai/knowledge` left rail 9 items (dashboard / search / wiki / notes / indexed-files / queue / roots /
// allowlist / settings) **zero placeholder pages**; every item maps to real page.
// 🔴 **Mechanism itself preserved per K8** — empty list doesn't mean delete
// mechanism. Earlier lesson: "kept code without capability"; same applies backwards: **only
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

// Before (original, before reverse — honoring "reverse not delete", keep original):
//   export const DEFERRED_TABS = [
//     'wiki',
//     'roots',
//     'allowlist',
//   ] as const satisfies readonly KnowledgeTabId[]
export const DEFERRED_TABS = [] as const satisfies readonly KnowledgeTabId[]

export function isDeferred(id: KnowledgeTabId): boolean {
  return (DEFERRED_TABS as readonly string[]).includes(id)
}

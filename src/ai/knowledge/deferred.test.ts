import { describe, it, expect } from 'vitest'
import { DEFERRED_TABS, isDeferred, type KnowledgeTabId } from './deferred'

describe('Placeholder mechanism (K7)', () => {
  // [SP8-P5b Task 5, 2026-08-01, reverse (not delete)] 'queue' migrated to real QueueView.vue
  // (knowledgeRoutes.ts synchronized reverse), removed from placeholder list; mechanism itself
  // (isDeferred source still DEFERRED_TABS) unchanged.
  //
  // Before (P5a T3 original):
  //   it('P5a only implements dashboard, the other 8 tabs get placeholders', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'indexed-files', 'notes', 'queue', 'roots', 'search', 'settings', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //   })
  //
  // [SP8-P5b Task 10, 2026-08-02, second reverse (not delete)] 'indexed-files' migrated to
  // real IndexedFilesView.vue (T8/T9/T10 three-move completion, knowledgeRoutes.ts synchronized
  // reverse), removed from placeholder list; mechanism itself (isDeferred source still DEFERRED_TABS)
  // unchanged. Following T5 same pattern: reverse + add one forward assertion, delete no existing.
  //
  // Before (P5b T5 original, before reverse):
  //   it('P5a implements dashboard, P5b-T5 implements queue, the other 7 tabs get placeholders', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'indexed-files', 'notes', 'roots', 'search', 'settings', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //   })
  // [SP8-P5c Task 10, 2026-08-04, third reverse (not delete)] 'settings' migrated to real
  // SettingsView.vue (T8 first half + T9 second half, knowledgeRoutes.ts synchronized reverse),
  // removed from placeholder list → 6 items become 5; mechanism itself (isDeferred source still
  // DEFERRED_TABS) unchanged. Following T5 / P5b T10 same pattern: reverse + add forward assertion.
  // 🔴 'allowlist' **still in list**: upper design originally included AllowlistView in P5c, user
  // explicitly moved out this period 2026-08-03 (governance §2.2) → it stays in placeholder
  // list **as expected**, not migration miss. 🔴 Two parser routes reversed together **are
  // top-level routes, not rail tabs**, never in DEFERRED_TABS, so this assertion unrelated
  // (governance §5.1).
  //
  // Before (P5b T10 original, before reverse):
  //   it('P5a implements dashboard, P5b-T5 implements queue, P5b-T10 implements indexed-files, the other 6 tabs get placeholders', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'notes', 'roots', 'search', 'settings', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //     expect(isDeferred('indexed-files')).toBe(false)
  //   })
  //
  // [SP8-P5d Task 10, 2026-08-05, fourth reverse (not delete)] 'notes' migrated to the real
  // NotesView.vue (T6-T9 four-move completion, knowledgeRoutes.ts synchronized reverse), removed
  // from placeholder list
  // → 5 items become 4; mechanism itself (isDeferred source still DEFERRED_TABS) unchanged.
  // Following T5 / P5b T10 / P5c T10 same pattern: reverse + add one forward assertion, delete no
  // existing assertions. **This move is the last one of this period (P5d).**
  // 🔴 'allowlist' still in the list (user explicitly moved it out of this period on 2026-08-03,
  // governance §2.2), 'search' /
  // 'wiki' / 'roots' are also still in the list — see which period each reverses in at the top of
  // `deferred.ts`
  // (`search`→P5e; `wiki`/`roots`/`allowlist`→P5f).
  //
  // Before (P5c T10 original, before reverse):
  //   it('P5a implements dashboard, P5b-T5 implements queue, P5b-T10 implements indexed-files, P5c-T10 implements settings, the other 5 tabs get placeholders', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'notes', 'roots', 'search', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //     expect(isDeferred('indexed-files')).toBe(false)
  //     expect(isDeferred('settings')).toBe(false)
  //   })
  //
  // [SP8-P5e Task 8, 2026-08-05, fifth reverse (not delete)] 'search' migrated to the real
  // SearchView.vue (T4-T7 four-move completion, knowledgeRoutes.ts synchronized reverse), removed
  // from placeholder list
  // → 4 items become 3; mechanism itself (isDeferred source still DEFERRED_TABS) unchanged.
  // Following T5 / P5b T10 / P5c T10 / P5d T10 same pattern: reverse + add one forward assertion,
  // delete no existing assertions. **This move is the last one of this period (P5e).**
  // 🔴 'wiki' / 'roots' / 'allowlist' are still in the list — all three belong to P5f (see the top
  // of `deferred.ts`); no further split into another period.
  //
  // Before (P5d T10 original, before reverse):
  //   it('P5a implements dashboard, P5b-T5 implements queue, P5b-T10 implements indexed-files, P5c-T10 implements settings, P5d-T10 implements notes, the other 4 tabs get placeholders', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'roots', 'search', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //     expect(isDeferred('indexed-files')).toBe(false)
  //     expect(isDeferred('settings')).toBe(false)
  //     expect(isDeferred('notes')).toBe(false)
  //   })
  // [SP8-P5f Task 8, 2026-08-06, sixth reverse (not delete) — the wrap-up move] 'wiki' / 'roots' /
  // 'allowlist' three items migrated to real pages (P5f T4 = AllowlistView.vue · T5 = RootsView.vue ·
  // T6+T7 = WikiView.vue upper/lower half; knowledgeRoutes.ts synchronized reverse in the same move),
  // removed from placeholder list
  // → 3 items become **0 items**. Following T5 / P5b T10 / P5c T10 / P5d T10 / P5e T8 same pattern:
  // reverse + add a forward assertion, delete no existing assertions. **This move is the last one
  // of this period (P5f), and also the wrap-up of the six SP8-P5 batches** — DEFERRED_TABS is now
  // empty, the rail's 9 items have zero placeholder pages.
  // 🔴 Mechanism itself (isDeferred source still DEFERRED_TABS) unchanged, see the two guards below.
  //
  // Before (P5e T8 original, before reverse):
  //   it('P5a implements dashboard, P5b-T5 implements queue, P5b-T10 implements indexed-files, P5c-T10 implements settings, P5d-T10 implements notes, P5e-T8 implements search, the other 3 tabs get placeholders', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'roots', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //     expect(isDeferred('indexed-files')).toBe(false)
  //     expect(isDeferred('settings')).toBe(false)
  //     expect(isDeferred('notes')).toBe(false)
  //     expect(isDeferred('search')).toBe(false)
  //   })
  it('P5a…P5f all six batches complete: placeholder list is empty, all 9 rail tabs have isDeferred === false', () => {
    expect([...DEFERRED_TABS].sort()).toEqual([])
    // 🔴 §9.20: "with an empty list, isDeferred(any tab) is false" — list all 9 items individually, don't
    //    just assert an empty array (KnowledgeLayout's NAV order is the rail order, see KnowledgeLayout.vue).
    const ALL_TABS: readonly KnowledgeTabId[] = [
      'dashboard', 'search', 'wiki', 'notes', 'indexed-files',
      'queue', 'roots', 'allowlist', 'settings',
    ]
    // Anti-idling: the table above must really have 9 items (missing one would make the loop below verify one fewer tab).
    expect(ALL_TABS).toHaveLength(9)
    for (const id of ALL_TABS) expect(isDeferred(id), `${id} still classified as a placeholder page`).toBe(false)
  })

  // [SP8-P5f Task 8] 🔴 Now that the list is empty, the line below (`for (const id of DEFERRED_TABS)`) has
  // become an **empty loop with zero discriminative power** (governance "parameterized guards must guard
  // against empty loops"). This move **doesn't change its assertion body** (following this file's five-
  // generation convention of "only add, never change existing assertions" + §9.10 "only allowed to
  // strengthen"): its discriminative power is now taken over by the **temporary non-empty list** in the
  // "mechanism nail" case below; and once a new tab is ever added back to DEFERRED_TABS in the future,
  // this line will **automatically re-arm itself**. Already declared explicitly in p5f-task-8-report.md.
  it('isDeferred returns true for every tab in the list', () => {
    for (const id of DEFERRED_TABS) expect(isDeferred(id)).toBe(true)
  })

  // Mechanism nail (following P4 I2: "kept the code but not the capability") — once DEFERRED_TABS is
  // emptied in the future, this case must still prove isDeferred is really reading that constant,
  // not just always returning false.
  // [SP8-P5f Task 8, 2026-08-06] 🔴 **This move's brief required "the mechanism nail case must not be
  // touched at all" — empirically this doesn't hold**, handled per governance §10 declaration
  // discipline 3 (ruling R18: the brief's criterion is only a hint) + ruling R21 (overturning an
  // existing conclusion requires two independent methods), both raw outputs pasted in
  // p5f-task-8-report.md:
  //   Method ① `pnpm exec vue-tsc --noEmit`:
  //     deferred.test.ts(109,34): error TS2493: Tuple type 'readonly []' of length '0'
  //                               has no element at index '0'.
  //     deferred.test.ts(110,23): error TS2345: Argument of type 'undefined' is not
  //                               assignable to parameter of type 'KnowledgeTabId'.
  //   Method ② `pnpm exec vitest run src/ai/knowledge/deferred.test.ts`:
  //     FAIL … > isDeferred's determination source is DEFERRED_TABS itself
  //     AssertionError: expected false to be true   ← :110 `isDeferred(listed)`
  // The cause is **structural, not an implementation bug**: the original text's last two lines assert
  // "the item at index 0 in the list must be judged true", and once the list is empty that premise can
  // never hold (`DEFERRED_TABS[0]` doesn't exist by type, and is undefined at runtime).
  // ⇒ Upholding "reverse, don't delete": the original block is kept on file below, and replaced with a
  //   **more discriminative** version instead —
  //   using a **temporary non-empty list** (`as const` only takes effect at compile time, the array
  //   object itself is mutable at runtime) to prove
  //   isDeferred is really reading that constant. This is exactly what §9.20's second clause requires —
  //   "don't just assert an empty array": if you only assert the empty array, hard-coding isDeferred to
  //   `return false` would still pass everything green.
  //
  // Before (P5a T3 original, unchanged through five generations, first change in this move):
  //   it('isDeferred's determination source is DEFERRED_TABS itself', () => {
  //     const notListed = 'dashboard' as const
  //     // The brief's original text was `DEFERRED_TABS.includes(notListed)` — vue-tsc reports TS2345:
  //     // DEFERRED_TABS's tuple type only contains 8 literals (not 'dashboard'), and .includes<T>
  //     // requires the argument to belong to T. This is a type-strictness issue in the test code, not
  //     // a Vue2 logic conflict, already declared per governance file §2 "brief test errors are not
  //     // implementation concessions"; fixed using the same widen-to-readonly-string[] approach used
  //     // internally by isDeferred, assertion strength unchanged (still really does a membership check).
  //     expect((DEFERRED_TABS as readonly string[]).includes(notListed)).toBe(false)
  //     expect(isDeferred(notListed)).toBe(false)
  //     const listed = DEFERRED_TABS[0]
  //     expect(isDeferred(listed)).toBe(true)
  //   })
  it('isDeferred\'s determination source is DEFERRED_TABS itself (list now empty: use a temporary non-empty list to prove the mechanism can still judge true)', () => {
    // Precondition: after this move the list really is empty — without this, the "only judged true once added" comparison below has no baseline.
    expect(DEFERRED_TABS).toHaveLength(0)

    const notListed = 'dashboard' as const
    expect((DEFERRED_TABS as readonly string[]).includes(notListed)).toBe(false)
    expect(isDeferred(notListed)).toBe(false)

    // 🔴 Temporary non-empty list (§9.20 second clause). Criterion: change isDeferred to `return false`
    //    → the `isDeferred('wiki') === true` line below must go red.
    const mutable = DEFERRED_TABS as unknown as KnowledgeTabId[]
    try {
      mutable.push('wiki')
      expect(isDeferred('wiki'), 'isDeferred isn\'t reading DEFERRED_TABS — pushed it in and it\'s still judged false').toBe(true)
      // Only the one that was pushed in is judged true, the others are still judged false ⇒ it's doing a membership check, not always-true.
      expect(isDeferred('roots')).toBe(false)
      expect(isDeferred('allowlist')).toBe(false)
    } finally {
      mutable.length = 0
    }

    // Self-proving restoration: the temporary item must be fully cleared (otherwise it would leak into other cases in this file and later importers).
    expect(DEFERRED_TABS).toHaveLength(0)
    expect(isDeferred('wiki')).toBe(false)
  })
})

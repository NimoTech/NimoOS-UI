# Task 2 Report: wire the effective target set into action dispatch and menu shape

## Addendum: fix for the Step 6 blind spot (coordinator-requested)

The coordinator confirmed the concern raised below ("Concerns" section) was a real defect in the
brief's test, not just a caveat to note, and asked for the test itself to be fixed so Step 6's
forced-RED self-proof actually does what it's meant to do.

### What changed

`src/views/Files.contextTarget.test.ts`:
- Added `import FileContextMenu from '../files/components/FileContextMenu.vue'`.
- Rewrote the fourth test's assertion from reading the parent's `ctxTargetCount` computed
  (`(w.vm as any).ctxTargetCount`) to reading the prop as the child component actually receives it:
  `w.findComponent(FileContextMenu).props('selectedCount')`. Test name and setup (select b,c;
  right-click a) are unchanged. Added an English comment explaining why the assertion targets the
  child's prop rather than the parent's computed.

`findComponent(FileContextMenu)` resolved without any issue — `FileContextMenu` is mounted directly
(not behind a stub) as the direct wrapper of the file list in `Files.vue`'s template, so no workaround
was needed.

`src/views/Files.vue` required no code change for this fix — the wiring from Task 2 was already
correct; only the test's ability to prove it was deficient.

### Covering tests

- `src/views/Files.contextTarget.test.ts` (all 4 cases, especially case 4)
- `src/views/Files.test.ts`, `src/views/Files.openEntry.test.ts`, `src/files/components/FileContextMenu.test.ts` (regression check)

### Redone forced-RED proof — exact commands and real output

**1. Revert** `src/views/Files.vue`'s template line to `:selected-count="files.selectedCount"`.

**2. Run:**
```
pnpm exec vitest run src/views/Files.contextTarget.test.ts
```
**Real output (fails as required):**
```
 FAIL  src/views/Files.contextTarget.test.ts > Files.vue context-menu target (F11) > Menu prop reflects the effective target set, not the original selection count
AssertionError: expected 2 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 2

 ❯ src/views/Files.contextTarget.test.ts:124:69

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```
This is the correct failure: with the template reverted, `FileContextMenu` receives the raw
selection count (2, from b+c) instead of the effective target-set count (1, just a) — exactly the
regression this test exists to catch. (Unrelated stderr noise in this run: repeated `[Vue warn]:
Component "i18n-t" has already been registered...` from double-registering the i18n plugin across
this test file's own `createI18n` instance and one already installed elsewhere in the suite run —
pre-existing, unrelated to this fix, and does not affect the assertion or its failure.)

**3. Restore** the template line to `:selected-count="ctxTargetCount"`, **re-run:**
```
pnpm exec vitest run src/views/Files.contextTarget.test.ts
```
**Real output:**
```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### Regression checks after the fix

```
pnpm exec vitest run src/views/Files.test.ts src/views/Files.openEntry.test.ts src/files/components/FileContextMenu.test.ts
```
```
 Test Files  3 passed (3)
      Tests  60 passed (60)
```

```
pnpm exec vue-tsc --noEmit
```
No output — no type errors.

### Post-fix repo state

`git diff -- src/views/Files.vue` is empty after the revert/restore cycle (confirmed) — the
production wiring from the original Task 2 commit (`e22b106`) is untouched. Only the test file
changed.

Commit: `ce85005 fix(files): assert the context-menu prop the child actually receives`

### Conclusion

The "Concerns" section below is now resolved: test 4 asserts the value on the actual rendered
child prop, and the forced-RED proof demonstrates it fails when the template binding regresses,
closing the exact blind spot Step 6 was designed to surface.

---


## What I implemented

In `src/views/Files.vue`:

1. Added `import { contextTargets } from '../files/util/contextTarget'`.
2. Replaced the buggy `selectedOr()` helper (rule: "any non-empty selection wins") with:
   - `selectedEntries` — a computed holding the current selection in listing order (extracted so three call sites stop repeating the same `.filter(isSelected)`).
   - `ctxTargets(entry)` — delegates to Task 1's pure `contextTargets(entry, selectedEntries.value)`.
   - `ctxTargetCount` — computed as `ctxTargets(ctxEntry.value).length`, the count that now drives the menu's single/multi shape.
3. Rewired every consumer of the old wrong logic to `ctxTargets(entry)`:
   - `onShare()` (folder filter for share creation)
   - `onCtxAction`'s `delete` branch — this removed the **second, inlined** copy of the wrong selection logic that lived only in that branch.
   - `onCtxAction`'s `copy` / `cut` / `download` branches.
4. `selectionHasFolder` and `snapshotSelection` now read `selectedEntries` instead of re-filtering `files.entries` inline.
5. Template: `FileContextMenu`'s `:selected-count` prop now reads `ctxTargetCount` instead of the raw `files.selectedCount`.
6. Confirmed no remaining references to `selectedOr`: `grep -n "selectedOr" src/views/Files.vue` prints nothing (exit code 1).

New file: `src/views/Files.contextTarget.test.ts`, created verbatim from the brief — an end-to-end test that mounts the real `Files.vue` component (not just the pure `contextTargets` unit) and drives `onCtxAction` directly, per the brief's rationale about the "manual forwarding chain" blind spot from the SP12 Plan A retro.

## What I tested and results

### TDD Evidence — RED

Command:
```
pnpm exec vitest run src/views/Files.contextTarget.test.ts
```

Output (before any wiring changes, only the new test file existed):
```
FAIL  Copy on unselected a when b,c are selected → clipboard contains only a
  expected { type: 'copy', item: [ …(2) ] } to deeply equal { type: 'copy', …(1) }
  - "from": "/DATA/a.txt"
  + "from": "/DATA/b.txt"
  + "from": "/DATA/c.txt"

FAIL  Delete branch also acts on clicked entry only (delete was once a second inline implementation)
  expected [ '/DATA/b.txt', '/DATA/c.txt' ] to deeply equal [ '/DATA/a.txt' ]

FAIL  Menu prop reflects the effective target set, not the original selection count
  expected undefined to be 1 // Object.is equality

Test Files  1 failed (1)
     Tests  3 failed | 1 passed (4)
```

This matches the brief's predicted RED exactly: clipboard held b,c instead of a (old "any non-empty selection wins" rule), and `ctxTargetCount` was undefined (didn't exist yet). The one passing case ("Copy on selected b...") passed by coincidence — selecting an already-selected item behaves the same under both the old and new rule.

### TDD Evidence — GREEN

Command:
```
pnpm exec vitest run src/views/Files.contextTarget.test.ts src/files/util/contextTarget.test.ts
```

Output (after wiring):
```
Test Files  2 passed (2)
     Tests  11 passed (11)
```

### Forced-RED self-proof (Step 6) — actual outcome, including an unexpected result

Command (with prop reverted to `:selected-count="files.selectedCount"`):
```
pnpm exec vitest run src/views/Files.contextTarget.test.ts
```

Actual output:
```
Test Files  1 passed (1)
     Tests  4 passed (4)
```

**This did not go red, contrary to the brief's prediction of "test 4 FAILs."** I investigated why: test 4 asserts
`(w.vm as any).ctxTargetCount).toBe(1)` — it reads the `ctxTargetCount` script-setup computed directly off the
component instance (via `@vue/test-utils`'s `vm` proxy, which is backed by `instance.$.setupState`, independent of
`defineExpose`). That computed is defined in the `<script setup>` block and its value doesn't depend on what the
template binds to `FileContextMenu`'s `selected-count` prop — reverting the *template* line doesn't touch the
*computed*, so the assertion still holds. In other words, test 4 verifies that `ctxTargetCount` is *computed*
correctly, but does not verify that the template actually *wires* it into `FileContextMenu`. A regression that
reintroduced `:selected-count="files.selectedCount"` in the template while leaving `ctxTargetCount` untouched (as I
did here) would slip past this test silently.

I did not alter the test's assertions — the brief calls for the test to be used verbatim, and Step 1's own text
already flags this general risk category ("手工转发链" / manual forwarding chain blind spot); this is a live instance
of exactly that blind spot inside the "self-proof" test itself. I'm reporting it rather than silently accepting the
green, per the instruction not to fake this step.

Command (prop restored to `:selected-count="ctxTargetCount"`):
```
pnpm exec vitest run src/views/Files.contextTarget.test.ts
```
Output:
```
Test Files  1 passed (1)
     Tests  4 passed (4)
```

Net effect on the deliverable: none — the actual wiring (Step 3/4 diff) is correct and verified by direct code
review (`grep` above) plus tests 1–3, which do exercise the real `onCtxAction` dispatch end-to-end and would catch a
regression there. The gap is narrowly in test 4's ability to catch a *template-prop* regression specifically,
which is a test-design limitation inherited from the brief, not a defect in the implementation.

### Step 7 — existing Files tests

Command:
```
pnpm exec vitest run src/views/Files.test.ts src/views/Files.openEntry.test.ts src/files/components/FileContextMenu.test.ts
```
Output:
```
Test Files  3 passed (3)
     Tests  60 passed (60)
```

### Extra check (not required by the brief, done for confidence)

`pnpm exec vue-tsc --noEmit` — no output, no type errors introduced.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-files-fixes/src/views/Files.vue` (modified)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-files-fixes/src/views/Files.contextTarget.test.ts` (new)

Commit: `e22b106 fix(files): act on the clicked entry when it is outside the selection`

Note: `docs/superpowers/plans/2026-08-09-sp12-files-legacy-fixes.md` has an unstaged, uncommitted modification in
the worktree that predates this task (translating Chinese `it()`/`describe()` text to English in the plan doc's
embedded code sample) — I did not touch it and deliberately excluded it from my `git add`/commit, matching the
brief's exact file list.

## Self-review findings

- Verified `grep -n "selectedOr" src/views/Files.vue` prints nothing (required self-check from the brief).
- Verified `FileContextMenu.vue`'s `single` shape gate is `props.selectedCount <= 1` (`src/files/components/FileContextMenu.vue:20`), confirming `ctxTargetCount` is the correct value to gate menu shape on.
- Checked all remaining inline `files.entries.filter((e) => files.isSelected(e.path))` occurrences in the template (`SnapshotSelectionToolbar`'s `@download`, `SelectionToolbar`'s `@copy`/`@cut`/`@download`) — these are toolbar batch entry points unrelated to the right-click menu's single/multi ambiguity (no `entry` argument involved, always the full selection), and the brief's step list did not include them, so I left them as pre-existing style rather than doing unscoped cleanup.
- Confirmed no color literals were introduced (this task touches no CSS).
- Confirmed no files under `src/files/upload/`, `UploadPanel.vue`, `uploads.ts`, or `useUploadConflicts.ts` were touched.

## Concerns

- The Step 6 forced-RED self-proof did not actually go red for the prop-only revert, for the reason detailed above: test case 4 checks the `ctxTargetCount` computed value on the component instance, not the value the template actually binds into the `FileContextMenu` child's `selected-count` prop. The wiring itself (Step 4's template edit) is correct today, and a full regression review confirms it, but test 4 as written is not a complete guard against a future template-only regression on that one line. Flagging for whoever owns the test-suite/brief maintenance to decide whether to strengthen test 4 (e.g., assert on the rendered `FileContextMenu`'s received prop instead of the parent's computed) in a follow-up.

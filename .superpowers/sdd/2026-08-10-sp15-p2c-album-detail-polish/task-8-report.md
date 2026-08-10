# Task 8 report: delete the smart-view detail page's "Add condition" entry

## Target vs brief

Read the target first: `33b05636:src/views/Photos/PhotosSmartViewDetail.vue:26-30` (comment)
and `:697-710` (methods). The comment reads (verbatim): "用户追加需求(2026-07-31):'Add
condition' 入口(+弹出层)整体删除——既有条件的展示与点击移除(sv-cond-removable/removeCond)
保留不动,新增/编辑条件改走创建面板/描述编辑,不算能力丢失。" ("User follow-up request
(2026-07-31): the 'Add condition' entry (button + popover) is deleted entirely — the existing
condition display and click-to-remove (sv-cond-removable/removeCond) stay unchanged; adding/
editing conditions moves to the create panel / description edit instead, not a loss of
capability.") The four Vue2 methods it names as deleted (`openAddCond`/`closeAddCond`/
`submitCond`/`addCondSuggestion`, at :697-710) never existed under those names in this repo —
their New-UI equivalents lived as `openPop()`/`close()`/`submit()`/`addSuggestion()` inside the
now-deleted `SmartViewConditionEditor.vue`. Brief and target agreed; no conflict to resolve.

## What was deleted

- **`src/photos/components/SmartViewConditionEditor.vue`** — the whole file, `git rm`'d. This
  component only ever did two things: render removable chips and run the add popover (open/
  close/draft/suggestions/submit/click-outside/Esc). Once the add half was gone it was down to
  a single `v-for` over `conds` with a click handler and no local state, props beyond `conds`/
  `busy`, or lifecycle hooks — a component that thin does not earn a separate file, test file,
  props/emits contract, and scoped `<style>` block of its own. **Ruling: fold it back into the
  host page.** The remaining `remove` markup (the chip `v-for`, the ✕ SVG, and the
  `.sv-cond`/`.sv-cond-removable`/`.sv-cond-x` CSS) moved into
  `src/views/PhotosSmartViewDetail.vue`'s `.sv-header-conds` block (template) and its own
  `<style scoped>` block, right after the existing `.sv-header-conds` rule. `removeCond()` is
  now called directly from the template instead of via a `remove` emit.
- **`src/photos/components/__tests__/SmartViewConditionEditor.test.ts`** — deleted with the
  component (`git rm`).
- **The page's `addCond()` function** (`src/views/PhotosSmartViewDetail.vue`) — deleted; it had
  no caller left once the editor's `add` emit was gone.
- **The `SmartViewConditionEditor` import** in the page — deleted.
- **`COND_SUGGESTIONS` / `condSuggestionsFor`** in `src/photos/util/smartViewSuggest.ts` — these
  fed the popover's suggestion chips and had zero other callers (verified by grep before
  deletion — see below). `SV_SUGGEST_POOL`/`inferChips`/`SV_QUICK_TEMPLATES`/`QuickTemplate` in
  the same file are unrelated (used by `SmartViewCreateDialog.vue` and
  `AlbumConvertToSmartDialog.vue`) and were left untouched.
- Their test coverage in `src/photos/util/__tests__/smartViewSuggest.test.ts` (the
  `describe('COND_SUGGESTIONS / condSuggestionsFor', …)` block, 4 tests) — deleted, replaced
  with a one-line English comment pointing at this report.

## What was kept / added

- `removeCond()` survives, now guarded by `if (store.patchBusy) return` at its top (previously
  this guard lived inside the deleted component's own `removeCond`, gating the `remove` emit).
  Kept deliberately rather than silently dropped when folding the component back in — see
  "Busy-guard disposition" below.
- The `data-busy` attribute on each chip and its `[data-busy="true"]` CSS rule (dimmed,
  `cursor: not-allowed`) — the visual half of the same guard, also moved in from the deleted
  component.
- `data-test="sv-header-conds"` on the container div, replacing `sv-cond-editor-mount` (there is
  no mounted sub-component anymore, so the old name was no longer accurate).

## Busy-guard disposition (a judgment call worth flagging)

The kept `if (store.patchBusy) return` guard on `removeCond()` is **technically redundant**:
`smartViews.ts`'s own `updateSmartView` already has `if (patchBusy.value) return` at its top
(smartViews.ts:246), so a second concurrent call is a harmless no-op either way. I kept the
page-level guard anyway because (a) it was already reviewed and tested when it lived inside
`SmartViewConditionEditor.vue`, and per this repo's "port visually, fix logic, don't silently
regress" convention, an already-approved correctness improvement over Vue2 (Vue2's own
`removeCond` at :697-701 has no reentry guard at all) shouldn't quietly disappear during a
refactor; and (b) it's what makes the `data-busy` visual affordance's existence make sense —
without it, the guard would live only in the store and the dimmed/not-allowed chip would be
theatre with no matching behavior one layer up. This is belt-and-suspenders, not dead code: it
short-circuits before the store call is even attempted, avoiding a wasted array `.filter()` and
a function call into the store on every extra click during a pending PATCH.

## TDD evidence

**RED** (tests written first, run against the pre-deletion code):

```
pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts -t "T7/T8"
```
Result: `3 failed | 2 passed | 89 skipped (94)` — confirmed failing for the right reasons:
- `renders one removable chip per sv.conds entry` — failed because `[data-test="sv-header-conds"]`
  didn't exist yet (container was still named `sv-cond-editor-mount`).
- `no longer offers an add-condition entry` — failed because the add button/popover still
  existed.
- `leaves no orphaned add-condition identifiers behind in the page source` — failed because
  `SmartViewConditionEditor` was still imported/referenced.
- The other two ("clicking a chip…" and "busy blocks a second click…") already passed —
  expected, since they exercise the `remove` path which pre-deletion code already supported
  correctly via the child component's existing `busy` prop guard; they are re-homed coverage,
  not new capability.

**GREEN** (after deletion + fold-in):

```
pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts src/views/PhotosSmartViewDetail.assets.test.ts src/photos/util/__tests__/smartViewSuggest.test.ts src/i18n/parity.test.ts src/styles
```
Result: `Test Files 8 passed (8)` / `Tests 1207 passed (1207)`. File count sanity-checked: the
four named files + the four files vitest resolves under `src/styles` (`wallpaper.css.test.ts`,
`theme.sp9.test.ts`, `color-guard.test.ts`, `selectPopup.test.ts`) = 8, matching the reported
count — no path silently skipped.

Also ran with `--reporter=verbose` and diffed stderr volume against a `git stash`'d baseline
(818 warn/error lines on both sides, same i18n-double-registration/`getConfig` noise unrelated
to this change) to confirm no *new* warnings were introduced.

`pnpm exec vue-tsc --noEmit` — clean, no output, both before and after the final edit round.

## Grep results for every removed identifier (post-deletion)

```
$ grep -rn "SmartViewConditionEditor" src
src/photos/components/SmartViewSidePanel.vue:27:  (historical comment, pre-existing, citing where the busy-guard convention was established — not a live reference)
src/views/__tests__/PhotosSmartViewDetail.test.ts:224: (prose explaining what used to be mounted here)
src/views/__tests__/PhotosSmartViewDetail.test.ts:272: ('SmartViewConditionEditor', — the string this task's own regression test asserts is absent from the page source)

$ grep -rn "openAddCond\|closeAddCond\|submitCond\|addCondSuggestion" src
src/views/__tests__/PhotosSmartViewDetail.test.ts:271: (same regression test's identifier list)

$ grep -rn "\baddCond\b" src
(no hits outside the same regression test's identifier list and one pre-existing T8 comment
 that referenced it before this task and has since been corrected to say "removeCond" only)

$ grep -rn "COND_SUGGESTIONS\|condSuggestionsFor" src
src/photos/util/smartViewSuggest.ts:79: (explanatory comment noting the deletion)
src/photos/util/__tests__/smartViewSuggest.test.ts:95: (same)

$ grep -rn "sv-cond-add\|sv-cond-pop\|sv-cond-suggestion\|sv-cond-submit\|sv-cond-done\|sv-cond-editor-mount" src
src/views/__tests__/PhotosSmartViewDetail.test.ts:243-244: (this task's own "entry is gone" assertions)
```

No production code (`.vue` template/script/style outside test files) contains any of the seven
removed identifier families. The only remaining hits are: this task's own regression tests
(which exist specifically to assert absence), explanatory comments pointing at this report, and
one pre-existing historical comment in `SmartViewSidePanel.vue` that cites where a convention
originated (accurate as history, not a live dependency — left as-is).

## `remove` confirmed working end-to-end, not just present in markup

Strengthened the existing "clicking a chip → store.updateSmartView receives condsRaw" test to
also assert the DOM after the round trip resolves: the clicked chip is gone and the remaining
chip is the right one (`src/views/__tests__/PhotosSmartViewDetail.test.ts`, the "…and the chip
is actually gone once the round trip resolves" test). This exercises the full path: click →
`removeCond()` → `store.updateSmartView('7', { condsRaw: [...] })` → the store's local merge
(`smartViews.ts`'s `splice(i, 1, { ...old, ...patch })` fallback for a null mock response) →
`sv.conds` changes → the page's `sv` computed follows → the template re-renders with one fewer
chip. This is a real round trip through the store, not a mocked assertion on call arguments
alone.

## Assertion disposition table

| Original assertion | New home | Disposition |
|---|---|---|
| `SmartViewConditionEditor.test.ts`: "conds 3 条 → 3 个 .sv-cond-removable + 1 个 .sv-cond-add" | — | **Deleted.** Add button capability gone; the "3 removable chips" half is covered by the re-homed page-level chip-count test. |
| `SmartViewConditionEditor.test.ts`: "conds 为 [] → 0 removable + 1 add" | — | **Deleted.** Same reason. |
| `SmartViewConditionEditor.test.ts`: "点 chip 任意处 → remove 事件" | `PhotosSmartViewDetail.test.ts` "clicking a chip → store.updateSmartView receives…" | **Re-homed**, upgraded from asserting an emit to asserting the actual store call + DOM after round trip (there is no emit anymore — the page calls `removeCond` directly). |
| `SmartViewConditionEditor.test.ts`: "点叉 → 同样触发 remove" | Covered structurally: the folded-in markup's `.sv-cond-x` is inside the same clickable `<span>` as before (click bubbles to the parent handler exactly as it did inside the deleted component) | **Re-homed implicitly** — not a separate test, because the DOM structure (✕ nested inside the whole-chip click target) is unchanged and the parent-click test already covers the bubbling path. |
| `SmartViewConditionEditor.test.ts`: "弹层开关 + 聚焦" (2 tests) | — | **Deleted.** No popover left. |
| `SmartViewConditionEditor.test.ts`: "提交条件" (3 tests: submit, empty+Enter, dedup) | — | **Deleted.** No add path left. |
| `SmartViewConditionEditor.test.ts`: "建议区" (4 tests) | — | **Deleted.** `COND_SUGGESTIONS`/`condSuggestionsFor` deleted with them. |
| `SmartViewConditionEditor.test.ts`: "busy" (3 tests: submit disabled, Enter blocked, suggestion-click blocked) | `PhotosSmartViewDetail.test.ts` "store.patchBusy blocks a second click on the same chip…" | **Re-homed** as the one busy scenario that still applies (remove reentry), since submit/Enter/suggestion no longer exist. |
| `SmartViewConditionEditor.test.ts`: "点外部关闭" (3 tests) | — | **Deleted.** No popover to click outside of. |
| `SmartViewConditionEditor.test.ts`: "Esc" (2 tests, incl. the "return only in non-Escape branch" source-text guard) | — | **Deleted.** No document-level Esc listener left to guard once the popover is gone. |
| `SmartViewConditionEditor.test.ts`: "cssCascade" (2 tests: `.sv-cond-removable:hover` variant ownership; `.sv-cond-add[data-open]` == `:hover` invariant) | The `.sv-cond-removable:hover` half is covered by `PhotosSmartViewDetail.test.ts`'s existing "样式:hover 级联归属变体" describe block, which already runs the same `winningHoverBackground` check against the page's own style block (now containing the moved-in `.sv-cond-removable:hover` rule) | **Re-homed for `.sv-cond-removable`**, **deleted for `.sv-cond-add[data-open]`** (the rule itself is gone, there is nothing left to assert an invariant about). |
| `SmartViewConditionEditor.test.ts`: "cssCascade.ts 共享 helper 回归" (2 synthetic-CSS tests, no dependency on this component's own styles) | — | **Deleted**, but harmlessly — these were regression tests for `cssCascade.ts` itself using synthetic CSS strings, unrelated to any markup in this component. If Task 11 or a future reviewer wants this coverage kept, it belongs in `cssCascade.test.ts` (the shared helper's own test file), not resurrected here — flagging as a possible gap, not silently dropping meaningful coverage. |
| `PhotosSmartViewDetail.test.ts` (pre-existing, Task 7): "sv-cond-editor-mount 渲染 SmartViewConditionEditor…" | "renders one removable chip per sv.conds entry" | **Re-homed**, `data-test` renamed `sv-cond-editor-mount` → `sv-header-conds`. |
| `PhotosSmartViewDetail.test.ts`: "点 chip 删除 → store.updateSmartView…" | "clicking a chip → store.updateSmartView receives the filtered conds…" | **Re-homed**, strengthened with the post-round-trip DOM assertion (see above). |
| `PhotosSmartViewDetail.test.ts`: "弹层输入 + Enter → store.updateSmartView…" | — | **Deleted.** No add path left. |
| `PhotosSmartViewDetail.test.ts`: "store.patchBusy 期间转发为 SmartViewConditionEditor 的 busy=true(primary 按钮禁用)" | "store.patchBusy blocks a second click on the same chip…" | **Re-homed**, re-targeted from the (now-nonexistent) submit button's `disabled` attribute to asserting the actual call count stays at 1 and the chip's `data-busy` attribute flips to `"true"`. |

New test added (not a rehome): "leaves no orphaned add-condition identifiers behind in the page
source" — a source-text grep-in-test guard per the brief's own Step 1 template, using the raw
`?raw` import the file already had for other source-text assertions.

## i18n keys this removal orphans (for Task 11)

Per the dispatch's instruction, **no i18n keys were deleted in this task.** Grepped every key
the deleted component/util referenced, across `.vue`/`.ts` outside the two locale files
themselves, post-deletion:

| Key | Consumers remaining | Verdict |
|---|---|---|
| `photosSvAddCondition` | none | **Orphaned** — was only the add button's label. |
| `photosSvNewCondition` | none | **Orphaned** — was only the popover's heading. |
| `photosSvEGSceneSunset` | none | **Orphaned** — was only the popover input's placeholder. |
| `photosSvSuggestions` | none | **Orphaned** — was only the suggestions section heading. |
| `photosSvDone` | none | **Orphaned** — was only the popover's "Done" button. |
| `photosSvAdd` | none (exact-match grep for `'photosSvAdd'`/`"photosSvAdd"`/`t('photosSvAdd'` returns nothing; the substring hits under a bare "photosSvAdd" grep are all *other* keys — `photosSvAddedThisWeek`, `photosSvAddAnother`, `photosSvAddPhotos`, `photosSvAddFailed` — each still consumed elsewhere and NOT orphaned) | **Orphaned** — was only the popover's "Add" submit button. |
| `photosSvRemoveC` | `PhotosSmartViewDetail.vue`'s kept chip `:title` binding | **Not orphaned** — still the removable chip's tooltip, now read directly by the page instead of by the deleted component. |

Six keys orphaned: `photosSvAddCondition`, `photosSvNewCondition`, `photosSvEGSceneSunset`,
`photosSvSuggestions`, `photosSvDone`, `photosSvAdd`.

## Files changed

- `src/photos/components/SmartViewConditionEditor.vue` — deleted.
- `src/photos/components/__tests__/SmartViewConditionEditor.test.ts` — deleted.
- `src/views/PhotosSmartViewDetail.vue` — import removed; `addCond()` removed; `removeCond()`
  gained a `patchBusy` guard; `.sv-header-conds` template block folded in with the remove-only
  chip markup; `<style scoped>` gained `.sv-cond`/`.sv-cond-removable`/`.sv-cond-x` rules moved
  in from the deleted component (add-related rules were not carried over).
- `src/views/__tests__/PhotosSmartViewDetail.test.ts` — the T7 describe block rewritten per the
  disposition table above; the pre-existing T8-comment's stale `addCond` reference corrected.
- `src/photos/util/smartViewSuggest.ts` — `COND_SUGGESTIONS`/`condSuggestionsFor` removed.
- `src/photos/util/__tests__/smartViewSuggest.test.ts` — their test coverage removed.

## Self-review

- **Completeness**: add gone (button + popover unreachable, asserted by test), `remove` intact
  and verified end-to-end (round trip through the real store, not just a call-args check), no
  orphaned selectors/identifiers/handlers (grepped above), no orphaned test helpers/fixtures
  (the whole `SmartViewConditionEditor.test.ts` file that only existed to drive the add path is
  deleted, not left half-alive).
- **Quality/YAGNI**: did not keep the `busy` prop plumbing pattern (props/emits contract) now
  that there's no separate component — `store.patchBusy` is read directly in the page template
  and in `removeCond()`, no indirection through a prop that only ever had one value source.
- **Discipline**: ran the fold-in decision through an explicit written ruling rather than
  defaulting to "keep the file to minimize diff."
- **Testing**: RED confirmed before deletion (3 failures for the right reasons, 2 pre-existing
  passes correctly not touched), GREEN after, `vue-tsc --noEmit` clean, `--reporter=verbose`
  stderr diffed against a stashed baseline to rule out newly introduced warnings.
- **No newly authored Chinese**: `git diff --cached | grep -nP '^\+.*[\x{4e00}-\x{9fff}]'`
  returns only four lines, all of them the literal quoted phrase "用户追加需求" cited verbatim
  from the Vue2 source's own comment (and from the task brief, which quotes the same phrase) —
  a citation inside otherwise-English sentences, not newly authored Chinese prose. One
  pre-existing Chinese comment I touched incidentally (the T8 wiring comment, which had a now-
  stale `addCond/removeCond` reference) was translated to English in full rather than leaving a
  mixed-language patch, since I was already editing that exact line.
- **No colour literals**: grepped the diff for `#`/`rgb(`/`rgba(`/`hsl(` — zero hits. All new
  CSS uses existing tokens (`--chip-bg-hi`, `--fg-muted`, `--fg-faint`, `--fg`, `--remove-fg`).
- **No `*` immediately before `/` in CSS comments**: checked manually and by counting `/*`
  vs `*/` occurrences in the page's `<style>` block (46/46, balanced) — no premature closes.

## Concerns

- The deleted `cssCascade.ts`-regression pair (synthetic-CSS tests for the shared helper's
  vacuous-truth and attribute-selector-specificity fixes) had no dependency on this component's
  own markup and arguably belongs permanently in `cssCascade.test.ts` rather than living and
  dying inside whichever component happened to need the fix first. Not fixed in this task
  (out of scope — flagging for whoever next touches `cssCascade.ts`).
- None of the six orphaned i18n keys were removed here per explicit instruction; Task 11 should
  delete all six once it re-confirms zero consumers itself.

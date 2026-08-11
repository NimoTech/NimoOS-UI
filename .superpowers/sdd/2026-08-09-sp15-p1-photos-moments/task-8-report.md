# Task 8 report: the two photo grids on the moment detail page

Commit: `fbe99bc` — `feat(photos): render the moment's featured and full photo grids`
(branch `sp15-photos-moments`, worktree `.claude/worktrees/sp15-photos-moments`, not pushed).

## What was implemented

`src/views/PhotosMomentDetail.vue` (built on Task 7's page):

- **Featured grid** — rendered only via `<template v-if="featuredAssets.length">` (no empty
  shell when there are none), heading `data-test="mo-featured-head"` with a count pill, tiles
  `data-test="mo-featured-tile"`. Manual members (from `with_members` receipts, already loaded
  by Task 7 into `manualIds`) get a pin badge (`data-test="mo-pin-tag"`), non-manual members
  do not.
- **All photos grid** — heading `data-test="mo-all-head"`, three mutually exclusive states:
  loading (`data-test="mo-all-loading"`, shown only while `allLoading && !allAssets.length`),
  populated (tiles `data-test="mo-all-tile"`), empty (`data-test="mo-all-empty"`, "no photos
  yet").
- **Selection state** (`selecting` / `selectedIds` refs, exactly as the brief specified, for
  Task 9 to consume): a `Select`/`Cancel` toggle button (`data-test="mo-select-toggle"`) in a
  new `.sv-actions` block next to the header; clicking a tile either opens the lightbox
  (`lightbox.openAt(p, list)`, `list` being whichever grid — Featured or All — the tile came
  from) or, in selection mode, only toggles that tile's selection and never opens the lightbox.
  A selection bar (`data-test="mo-select-bar"`) shows the count once at least one tile is
  selected; leaving selection mode clears `selectedIds`, not just hides the bar (see the
  self-review test below).
- CSS: `.sv-section-head`/`.sv-grid-photos`/`.tile`/`.sv-pin-tag`/`.sv-tile-check`/
  `.sv-select-bar`/`.sv-actions`/`.sv-action-btn` restated (scoped styles don't cross component
  boundaries in this repo) from `photos-smartview.scss`, using the exact same token
  substitutions `PhotosSmartViewDetail.vue` already established for the same source rules.

`src/i18n/zh_cn.photos.ts` / `en_us.photos.ts`: added `photosMoAllPhotos`, `photosMoLoading`,
`photosMoNoPhotosYet`. The Select/Cancel button text and the selection-count text reuse
existing keys verbatim (`photosPersonSelect`, `photosCancel`, `photosSelectedCount`) rather
than adding fresh keys for identical wording — see deviations 7/9 in the file header.

## TDD evidence

**RED** — `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose`
(after adding the test block, before touching the component):

```
 × the two photo grids > renders the Featured section with a photo count in its heading when it has assets
   → Cannot call text on an empty DOMWrapper.
 ✓ the two photo grids > renders no Featured section at all — not an empty shell — when Featured has no assets
 × the two photo grids > shows a pin badge on manual Featured members and not on non-manual ones
   → expected [] to have a length of 1 but got +0
 × the two photo grids > shows "no photos yet" once All photos has finished loading and found none
   → expected false to be true
 × the two photo grids > opens the lightbox on a tile click outside selection mode; inside selection mode a click only toggles selection
   → Cannot read properties of undefined (reading 'trigger')
 × the two photo grids > leaving selection mode clears the selection, not just the bar's visibility
   → Cannot call trigger on an empty DOMWrapper.

 Test Files  1 failed (1)
      Tests  5 failed | 26 passed (31)
```

Five of six new tests failed for the expected reason (missing markup/hooks); the "no Featured
section" test passed trivially because nothing existed yet, which is correct — it stayed green
through the whole implementation.

**GREEN** — same command after implementing:

```
 Test Files  1 passed (1)
      Tests  31 passed (31)
```

Combined with parity (brief step 4): `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/i18n/parity.test.ts --reporter=verbose` → **40 passed** (31 + 9). The brief predicted "23"; actual is 31 in this file alone — its predicted counts have been wrong in every task so far, this one included.

No `[Vue warn]` or stray `console.error`/`console.warn` in the output (grepped explicitly).

## The carried-over timezone fix

Task 7's fixture for "same day" used `timeFrom: '2016-11-20T01:00:00Z'` /
`timeTo: '2016-11-20T09:00:00Z'`. At UTC−2 or further west, `01:00Z` is still the previous
local calendar day, so `fmt(from) !== fmt(to)` and the component renders a range instead of a
single date — contradicting the nearby comment's claim of "timezone-safe on any machine".

Fix: moved both timestamps to the middle of the UTC day (`12:00Z` / `13:00Z`), which stays on
the same local calendar day for every real IANA zone (offsets in use run from UTC−12 to
UTC+14, comfortably inside a one-hour window centred on noon UTC). Extended the comment to
explain why the new fixture is genuinely timezone-safe rather than just re-asserting it.

Verification:

```
$ TZ=America/New_York pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose
 ✓ About sidebar > time window: shows exactly one date when the two ends fall on the same day
 Tests  31 passed (31)   (full file, default TZ too — see GREEN above)
```

## Deviations from the Vue 2 original (recorded in the file header, deviations 6-9)

1. **Test's `openAt` spy strategy** (not a Vue2 deviation, but a deviation from the brief's
   literal test code): the brief's `vi.spyOn(lb, 'openAt')` does not work.
   `useLightbox()` returns a fresh object literal every call, but `openAt` is a module-level
   function referenced by identity — spying on one object's copy of the property never
   intercepts the *component's own* separate `useLightbox()` call. This exact trap is already
   documented and fixed in `PhotosSmartViewDetail.test.ts:33-39` (T6). I followed that
   established fix: `vi.mock('../photos/lightbox/useLightbox', () => ({ useLightbox: () =>
   lbMock }))` with a hoisted `{ openAt: vi.fn() }`. Confirmed necessary, not cosmetic: with
   the brief's literal code the assertion `expect(openAt).toHaveBeenCalledTimes(1)` fails with
   `0 !== 1` (the spy is simply never invoked), it does not silently pass.
2. **Strengthened the "leaving selection mode clears selection" test.** The brief's version
   only checked that the bar disappears immediately after leaving selection mode — but the
   bar's own `v-if` is `selecting && selectedIds.length`, so it would disappear for that reason
   alone even if `toggleSelecting` forgot to clear `selectedIds`. Added a second assertion:
   re-enter selection mode without picking anything, and the bar must still not appear. This
   is the case that actually distinguishes "selection was cleared" from "selection is merely
   hidden while `selecting` is false" — self-review requirement in the task brief.
3. Only the **Select** toggle joins the action bar in this task. Vue2's action bar has four
   buttons (Add photos / Select / Save as Album / more menu); the other three need machinery
   (library picker, export, delete confirmation) that belongs to Tasks 9/10.
4. Select/Cancel button text reuses `photosPersonSelect`/`photosCancel` verbatim rather than
   adding a fresh pair of keys for the same two English words.
5. The pin badge's icon reuses the same outline pin path already used for the header's place
   condition, rather than Vue2's separate filled-teardrop `pin` icon glyph — one pin shape per
   file.
6. The selection bar renders only the "{n} selected" count. The "Remove from this moment"
   button is Task 9's bulk-removal wiring (the `excludeMomentAssets` call + toast), not added
   here.

## Verification results

| Gate | Command | Result |
|---|---|---|
| Target file + parity | `vitest run src/views/PhotosMomentDetail.test.ts src/i18n/parity.test.ts --reporter=verbose` | **40 passed** (31 + 9) |
| Type check | `vue-tsc --noEmit` | clean (0 errors) — one incidental fix needed: `mockAssets`'s helper signature had to accept optional params to match the mock's declared type |
| i18n parity | `vitest run src/i18n/parity.test.ts` | 9/9 passed |
| Styles/color-guard | `vitest run src/styles` | **1075/1075 passed** (matches stated baseline exactly). One real finding along the way: a first draft of the pin-badge comment wrote the literal `rgba(0,0,0,0.55)` *inside* a comment describing what token replaced it — the guard doesn't strip comments, so it flagged correctly. Reworded to describe the colour in words. |
| OSS export | `vitest run oss` | **448/448 passed**, verified on a truly clean tree (see below) |
| Full suite | `vitest run` (background, pre-commit) | 674/678 files, 10705 passed / 70 skipped / **3 failed** — all three failures are the same `oss/*` git-dirty-tree guard tripping on uncommitted files, not a real regression (see below) |

**OSS gate and the dirty tree**: `oss/export.mjs`'s `--publish` integration tests refuse to run
against an uncommitted tree (by design — it's the export script's own safety guard, not a
vitest quirk). Before committing, 3 of 448 oss tests failed purely because the tree had
uncommitted changes (all mine, plus one pre-existing modified file, `progress.md`, an SDD
ledger file outside this task's scope — the project's own workflow notes in that file say it's
deliberately left uncommitted until "the final ledger commit" at the end of the whole
SP15-P1 effort, not per task). After committing this task's four files, I confirmed 448/448 by
temporarily stashing just `progress.md` (the one remaining dirty file), running oss on a fully
clean tree (**448/448 passed**), then restoring the stash — `progress.md` is back to its
pre-existing state, unmodified by this task.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosMomentDetail.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosMomentDetail.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/zh_cn.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/en_us.photos.ts`

`src/files/**` untouched. No new files added under `src/`, so no `oss/manifest.mjs` changes
were needed (confirmed by the 448/448 result).

## Self-review

- Every `data-test` hook from the brief is present with the exact spelling:
  `mo-featured-head`, `mo-featured-tile`, `mo-pin-tag`, `mo-all-empty`, `mo-select-toggle`,
  `mo-all-tile`, `mo-select-bar`.
- Featured section genuinely disappears when empty — `<template v-if="featuredAssets.length">`
  wraps both the heading and the grid, no wrapper element left behind.
- Selection mode suppresses the lightbox (`onTileClick` branches on `selecting.value` before
  ever calling `lightbox.openAt`) and leaving it clears `selectedIds` (`toggleSelecting`
  explicitly empties the array, not just relying on the bar's own `v-if` to hide the leftover
  state — verified by the strengthened re-entry test above).
- Checked each new test against "would it still pass if the behavior were removed": the pin
  badge test asserts an exact count of 1 (not `>0`), the empty-section test asserts absence via
  `.exists()`, the openAt test uses the properly-mocked module so a missing call is a real
  failure, and the selection-clearing test was rewritten specifically because the original
  version could pass vacuously.
- Test output is pristine — grepped for `Vue warn`/`console.error`/`console.warn` across the
  full verbose run, no matches.

## Concerns

- None blocking. The one thing worth flagging for whoever picks up Task 9/10: the Select
  toggle button and the selection bar's count-only content are deliberately minimal (see
  deviations 3 and 6) — Task 9 will need to add the "Remove from this moment" button inside
  the existing `.sv-select-bar` `<div>`, and Task 9/10 will add Add photos/Save as Album/more
  menu as siblings of the Select button inside the existing `.sv-actions` `<div>`. Both mount
  points already exist with the right surrounding markup, so no restructuring should be needed.

---

## Fix round 1

Commit: `021b759` — `test(photos): assert lightbox entry-list scoping on the moment detail tiles`.

### Finding addressed

The reviewer's two prior findings (the `openAt` module-mock deviation, and the strengthened
clear-selection test) were both reviewed and upheld — no changes needed there. One new
finding, Important: the tile-click test asserted only `openAt` was called once. It never
checked the arguments, and its fixture used an empty Featured set, so a regression that always
passed `allAssets` — including for a Featured tile — would have kept every existing test green.
The code comment on `onTileClick` itself calls out that the list-scoping matters for lightbox
paging, and Task 9 leans on it further, so it needed a real test, not just an "it opened"
smoke check.

### Fix

1. Extended the existing all-photos tile-click test with argument assertions: `openAt`'s first
   argument is the clicked photo (`id: 'a1'`), its second argument's ids are `['a1', 'a2']`.
2. Added a new case that clicks a Featured tile with a **disjoint** fixture
   (`featured: [{id:'f1'}]`, `all: [{id:'a1'},{id:'a2'}]`) and asserts `openAt` receives that
   photo with the *featured* list (`['f1']`) — not `['a1', 'a2']`. The disjoint ids make
   "passed the wrong list" detectable by content; if both lists held the same objects the
   assertion would prove nothing.
3. Left the existing selection-mode suppression assertions in the first test untouched, as
   instructed.

### Mutation check

Temporarily changed `onTileClick` in `PhotosMomentDetail.vue` to always call
`lightbox.openAt(p, allAssets.value)` regardless of which grid the tile came from:

```
FAIL  the two photo grids > opens the lightbox with the Featured list as the entry list when a Featured tile is clicked, not the all-photos list
AssertionError: expected [ 'a1', 'a2' ] to deeply equal [ 'f1' ]
 Tests  1 failed | 31 passed (32)
```

Exactly the new Featured-scoping case went red; the other 31 tests in the file (including the
now-augmented all-photos case, since `allAssets` is genuinely what that click should pass)
stayed green. Reverted the mutation — `git diff src/views/PhotosMomentDetail.vue` came back
empty, confirming the revert restored the exact committed content — and re-ran:

```
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

### Verification

| Check | Command | Result |
|---|---|---|
| Target file | `vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose` | **32/32 passed** (31 → 32: one test split into two, one net test added) |
| TZ re-check | `TZ=America/New_York vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose` | **32/32 passed** — the round-1 fixture fix did not regress |
| Type check | `vue-tsc --noEmit` | clean (0 errors) |
| Styles | `vitest run src/styles` | **1075/1075 passed** — unchanged from the original submission |
| OSS export | `vitest run oss` | **445/448 passed** (3 failed) — same pre-existing cause as the original report: `.superpowers/sdd/2026-08-09-sp15-p1-photos-moments/progress.md` is the sole modified file left in the tree (the SDD ledger, explicitly out of this task's scope and, per this round's instruction, not to be stashed even temporarily). All three failures are `export.mjs`'s own git-dirty-tree guard tripping on that one file — the same root cause already proven, in the original report, to resolve to 448/448 on a clean tree. This round changed only the test file (no files added/removed under `src/`), so it cannot have altered oss's manifest/strip-list behaviour; not re-verified with a stash this round per the explicit "never stash progress.md" instruction. |

### Files changed this round

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosMomentDetail.test.ts` (only file touched; `PhotosMomentDetail.vue` was mutated for the check above and reverted to its exact committed state — no diff)

### Concerns

None. The `.vue` component itself needed no change — the gap was purely in test coverage.

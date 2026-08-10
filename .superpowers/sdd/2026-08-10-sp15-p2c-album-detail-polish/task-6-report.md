# Task 6 report — SV detail header action row + Sort/density (new construction)

Commit: `be739e5` — `feat(photos): rebuild the smart-view header actions with sort and density`
(single commit, parent `222f11f`)

---

## 1. What I implemented

`src/views/PhotosSmartViewDetail.vue`, header action row rebuilt to the target
(`33b05636:src/views/Photos/PhotosSmartViewDetail.vue:49-90`):

```
Sort:  [capsule ▾]  │  Pause/Resume   Edit/Done  │  [▦][▪]
└──── v-if="!edit" ──┘  └── unconditional ──┘  └── v-if="!edit" ──┘
```

- **Sort capsule (new).** `sortBy: 'score' | 'taken'`, default `'score'`. Two options only
  (the album page has three): Match score / Date taken. `.order-pill` + `.sv-sort-menu` with
  the target's check-glyph-on-the-active-row markup; `pickSort` closes the menu; click-outside
  and Escape both close it.
- **Sorting is real, not decorative.** Both grids render `matchedSet` / `recentSet`, which run
  `store.matchedAssets` / `store.recentAssets` through `sortAlbumPhotos(list, sortBy)`. That
  helper (`src/photos/util/albumView.ts:74`) is a plain photo comparator keyed off a string
  mode — its `'taken'` branch is the comparator Vue2 writes inline as `sortedByMode`
  (:577-587), and its fallback returns the list untouched, which is exactly Vue2's `'score'`
  ("the order as it stands" — the backend already returns match_score DESC). Reused rather than
  re-implemented; the store arrays themselves are untouched. **Plan Task 9 depends on this
  state existing** — the lightbox still receives `store.matchedAssets`, which is Task 9's job.
- **Density pair (new).** `'comfortable' | 'compact'`, matching PhotosAlbumDetail.vue's enum
  (Vue2 spells the first one `'comfort'` — deliberately not copied, per Global Constraint 5).
  Both grids take `.is-compact` (`minmax(180px→120px)`); the excluded band deliberately does
  not, as in the target.
- **Edit/Done replaces Add photos + Select.** See §5 for the state decision.
- **Edit-mode bottom bar reshaped** to the target's three elements (:318-333): hint line,
  Remove from this view, Add photos. Re-gated from `edit && selectedIds.length` to `edit && sv`.
- **Separators** reuse `.album-detail-actions-sep`, each inside the `v-if` of the group it
  parts, so neither can be left dangling (asserted).
- CSS: `.group`, `.sv-actions .order-pill`, `.album-detail-actions-sep`, `.density`,
  `.sv-sort-wrap/menu/item`, `.sv-grid-photos.is-compact` — rule bodies restated from
  PhotosAlbumDetail.vue's own (the phase's KEEP-THE-DUPLICATION ruling; scoped styles do not
  cross SFCs), so the two pages render the same row.

## 2. Where the Vue 2 source disagreed with the brief — and which I followed

**(a) `it('no longer renders refine-in-search in the header')` — NOT WRITTEN. Reported, as
instructed.** The brief lists that test and a matching mutation ("leave Refine in the header →
that test should redden"), but the brief's own scope line says Refine and the "..." menu move
to the sidebar in **Task 7**, and the plan's Task 7 section builds `.sv-side-actions` and folds
Export's items into the "..." menu. The dispatch prompt confirms: *"Leave them where they are;
Task 7 moves them."* Writing that test would require me to do Task 7's work, and deleting the
three controls without their new home would leave rename / duplicate / convert / delete /
export / refine unreachable for a whole task.

So Refine, the Export menu and the "..." menu are **parked at the END of `.sv-actions`**, with
a comment saying so. This is precisely the call Task 3 made on the album page ("the '...' menu
is parked in .sv-actions … until T5 moves it", progress ledger), and it leaves everything
before them already in the target's order, so Task 7 only lifts them out.

Instead of that test I wrote a **stronger** one for what this task actually owns: `renders sort
and density in the header outside edit mode` asserts the first seven children of `.sv-actions`
in sequence (`group → sv-sort-wrap → sep → pause → edit → sep → density`). A reordering is
caught; each element merely existing proves nothing. Mutation-verified (§4).

**(b) The sort menu's check glyph — I followed the target, and the album page now differs.**
Vue2 renders `.albums-sort-item` on **both** detail pages with a check glyph on the active row
plus a same-width spacer when there is none (SV :57-68, Album :87-102). PhotosAlbumDetail.vue's
`.album-sort-item` in this repo has **no glyph** — it marks the active row with
`background: var(--accent-soft)` only. That markup **predates Task 3** (Task 3 moved the
existing control into `.sv-actions`, it did not build it), so it is not a decision of this
phase. For new construction I followed the target: glyph + `.lbl`, plus the same
`[data-active] { background: var(--accent-soft) }` Vue2 also has. Net effect: the two pages'
capsules and rows are identical, but the SV **dropdown** shows a checkmark and the album's does
not. **Flagging for the controller** — closing it means adding the glyph to
PhotosAlbumDetail.vue, which is out of this task's file scope.

**(c) Escape closes the sort menu — deviation, registered in code.** Vue2 gives the sort popup
a click-outside but no Escape. PhotosAlbumDetail.vue:539 already closes its own sort menu on
Escape, and this page answers Escape for its three other overlays. Added as a fifth independent
`if` so the "one Escape closes everything, no early return" invariant (deletion-check 8) is
untouched; `sortMenuOpen` joins `anyOverlayOpen` so the listener is attached while it is open.

**(d) The bottom bar's gate.** The brief did not mention it; the target (:318) is `v-if="edit"`
alone and it has to be — the bar carries the empty-selection hint and Add photos, both
unreachable otherwise. Added `&& sv` for the same reason PhotosAlbumDetail.vue:1005 has
`&& album` (the bar is a sibling of `.photos-layout`, outside the `v-else` that requires a
smart view). What used to make an empty Remove request impossible (the bar not existing) is now
the button's own `:disabled="!selectedIds.length || store.assetBusy"` plus `removeSelected`'s
early return — the same two places the album page puts it.

## 3. TDD evidence

**RED** — tests written first, implementation absent:

```
$ pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts
 Test Files  1 failed (1)
      Tests  9 failed | 81 passed (90)
```
(failures: `Cannot call trigger on an empty DOMWrapper` on `sv-sort-btn` / `sv-edit-toggle` /
`sv-density-compact`, and `toContain(undefined)` for the two missing i18n keys)

**GREEN** — after implementation, including the re-homed P2a suite:

```
$ pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts \
      src/views/PhotosSmartViewDetail.assets.test.ts src/i18n src/styles
 Test Files  13 passed (13)
      Tests  1377 passed (1377)

$ pnpm exec vue-tsc --noEmit        # clean, no output
$ pnpm test                          # 687 files / 10991 tests, all passed
$ pnpm build                         # built in 17.19s
$ pnpm exec vitest run oss           # 21 files / 479 tests passed (clean tree)
```

Note on the oss suite: it fails on a **dirty** working tree by design (Global Constraint 7 —
`export.mjs` asserts a clean tree). Three oss tests were red mid-task for that reason only;
after committing they are green. Nothing about them is related to this change.

**Output pristine** (`--reporter=verbose`, filtered to this task's tests): zero stderr, zero
`[Vue warn]`.
```
$ pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts \
      -t 'SP15-P2c Task 6' --reporter=verbose
 Tests  9 passed | 81 skipped (90)      # no stderr block printed at all
```

**Pre-existing noise I did NOT introduce and deliberately did not fix** (observed while
verifying the above, worth one line in the ledger):
`src/views/__tests__/PhotosSmartViewDetail.test.ts`'s service mock lacks `getConfig` and
`getSmartViewExcluded`, so every test in that file prints
`[photos-settings] fetchAiFeatures TypeError` and `[photos-smartviews] loadExcluded TypeError`.
The assets test file mocks both precisely to avoid this and says why ("a noisy baseline is how
a real error goes unnoticed"). I left it alone: adding `getConfig` would make
`settings.fetchAiFeatures` **succeed with `{}`** instead of falling into its catch, which sets
`ALL_ON` — i.e. it can flip AI feature gates under 81 pre-existing tests. That is a change that
deserves its own task, not a drive-by in this one.

## 4. Mutation verification (per-mutation results)

Each mutation applied to the committed code, suite run, then reverted from a byte-copy.

| # | Mutation | Expected | Result |
|---|---|---|---|
| A | Brief's mutation 1 — sort capsule renders in edit mode too (`<template v-if="!edit">` → `<template>`) | `keeps pause and edit visible in edit mode while sort and density disappear` reddens | **CONFIRMED.** 2 failed / 108 passed. That test reddened, and so did `renders sort and density in the header outside edit mode` (the bare `<template>` disturbs the child sequence it asserts). No other test moved. |
| B | Substitute for the brief's mutation 2 (see §2a — Refine legitimately stays put this task): move Add photos back out of the bottom bar into `.sv-actions` | `shows add-photos in the bottom select bar rather than the header` reddens | **CONFIRMED.** 2 failed / 108 passed — that test plus the row-order test. This is the structural equivalent of the mutation the brief named: it asserts the relocation this task actually performed. |
| C | Extra, mine — grids read `store.matchedAssets` / `store.recentAssets` directly, i.e. the Sort control sorts nothing | `re-sorts both grids by taken date…` reddens | **CONFIRMED.** 1 failed / 109 passed, exactly that test. Confirms the sort test has teeth and is not satisfied by the capsule merely relabelling itself. |

After each revert: `110 passed (110)`.

## 5. State decision: reuse `selecting`, renamed `edit`

**Decision: reuse.** P2a's `selecting` ref is renamed `edit`; no second flag was introduced.
Registered in a comment at `PhotosSmartViewDetail.vue` (the `const edit = ref(false)` block).

Reasoning: the flag Edit/Done drives *is* the flag that suppresses the lightbox, draws the tile
checkmarks, gates the bottom bar and is reset by the route watcher. Vue2 made the identical
call and said so at :449-451 ("behaviour unchanged, only the name and the entry point"). A
separate `edit` beside `selecting` would be two names for one mode, and six predicates
(`onTileClick`, the route watcher, `removeSelected`, `onExcludedTileClick`, both grids'
`data-selected`) would each have to pick one and stay right about it forever.

**i18n consequence, grepped as the brief requires.** The button's copy changes from
`photosPersonSelect`/`photosCancel` to `photosAlbumEdit`/`photosAlbumDone`. Neither old key is
orphaned: `photosPersonSelect` is still used by `PersonAssetGrid.vue:124` and
`PhotosMomentDetail.vue:648`; `photosCancel` has 38 other consumers. Nothing deleted.

## 6. i18n — new vs already existing

**Genuinely new (2), added to both `zh_cn.photos.ts` and `en_us.photos.ts`:**

| key | en | zh | source of the zh value |
|---|---|---|---|
| `photosSortScore` | `Match score` | `匹配分数` | Vue2 `33b05636:src/assets/lang/zh_CN.json:2145` |
| `photosSvClickToSelect` | `Click to select` | `点击选择` | Vue2 `zh_CN.json:2012` |

`photosSortScore` is the one key the plan predicted (progress ledger, Task 3: *"T6 MUST REUSE
THE SAME KEYS and add only photosSortScore"*). `photosSvClickToSelect` is a second one the
plan's table did not list: the bottom bar's empty-selection hint has no home in this repo — the
album page uses `photosAlbumHintSelectCover` (`点击选择 · ★ 设为封面`), whose cover/drag clause
is meaningless on a smart view, and there is no bare `点击选择` key. Grep-verified before adding.

**Already existed, reused verbatim (9)** — every one grep-checked before I considered adding it:
`photosAlbumSort` (`排序：`), `photosAlbumSortTaken` (`拍摄日期`), `photosAlbumEdit` (`编辑`),
`photosAlbumDone` (`完成`), `photosDensityComfortable` (`舒适`), `photosDensityCompact`
(`紧凑`), `photosSelectedCount`, `photosSvAddPhotos`, `photosSvRemoveFromView`.

So the brief's expectation ("the only genuinely new one should be Match score") was **11/12
right** — one more key was needed. `parity.test.ts` green.

## 7. Assertion re-homing table (original → new home, by name)

13 of the 20 tests in `src/views/PhotosSmartViewDetail.assets.test.ts` broke. **All 13 were
re-homed; none was deleted; none lost meaning.** Two shared helpers were added at the top of
the file — `enterEdit(w)` (clicks `sv-edit-toggle`) and `selectedTiles(w)` (counts
`.tile[data-selected="true"]`) — with a comment explaining the two moves and why the weakened
shorthand had to be replaced.

Three kinds of change, marked in the table: **(sel)** selector `sv-select-toggle` →
`sv-edit-toggle` via `enterEdit`; **(reach)** `sv-add-photos` now needs edit mode first;
**(strengthened)** the old assertion leaned on "the bar is gone ⇔ nothing is selected", which
the new `v-if="edit"` gate makes untrue, so it now reads the selection directly.

| # | Original test | New home | Change |
|---|---|---|---|
| 1 | `add photos > opens the picker, pins what it confirms, and reports the count it was told` | same name, same file | (reach) `enterEdit(w)` before the Add photos click. Assertions unchanged. |
| 2 | `add photos > reports nothing and keeps the picker open when the store drops the call as busy` | same name | (reach) |
| 3 | `add photos > reports a failure and keeps the picker open so the user can retry` | same name | (reach) |
| 4 | `add photos > hands the picker the ids already in the view, String()-normalised` | same name | (reach) |
| 5 | `add photos > passes the static "Add selected" submit label Vue2 gives this picker, not the counting one` | same name | (reach) |
| 6 | `selection and removal > suppresses the lightbox while selecting, and shows the count` | **renamed** `…while in edit mode, and shows the count` | (sel). Assertions unchanged (bar text contains `1`, `openAt` not called). |
| 7 | `selection and removal > still opens the lightbox when not selecting` | **renamed** `still opens the lightbox outside edit mode` | Title only — this test never touched the toggle. |
| 8 | `selection and removal > removes the selection, then leaves selection mode` | **renamed** `…then leaves edit mode` | (sel) + **strengthened**: also asserts `sv-edit-toggle` carries `data-open="false"`, so "left edit mode" is proven on the control and not only by the bar vanishing. |
| 9 | `selection and removal > confirms with both removal tiers added together` | same name | (sel). The `unpinned+excluded = 5` toast assertion is untouched. |
| 10 | `selection and removal > reports nothing and keeps the selection when the store drops the removal as busy` | same name | (sel) + **strengthened**: `expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(true)` → `selectedTiles(w) === 1` **and** bar text contains `1`. The old form is now vacuous (the bar is up in edit mode regardless). |
| 11 | `selection and removal > keeps the selection on failure so the user can retry` | same name | (sel) + **strengthened**, identical substitution to #10. |
| 12 | `selection and removal > leaving selection mode clears what was selected` | **renamed** `leaving edit mode clears what was selected` | (sel) + **strengthened**: was "bar gone after toggle-off/on"; now asserts `selectedTiles === 1` before, then `selectedTiles === 0` **and** the bar showing `photosSvClickToSelect` after leaving and re-entering. |
| 13 | `selection and removal > drops the selection and closes the picker when the route id changes` | same name | (sel) + **strengthened**: the final "re-enter and check for stale ids" step was `bar.exists() === false`, which the new gate makes always-false-then-true; it now asserts `selectedTiles(w) === 0` and the empty-selection hint on sv2. The picker-closed assertion and the mid-test `selectedTiles === 1` are kept. The stale comment describing the old `v-if` was rewritten to describe the new trap, which is one step worse. |
| 14 | `excluded section > an excluded tile does nothing while in selection mode` | **renamed** `…while in edit mode` | (sel) + **strengthened**: `bar.exists() === false` → `selectedTiles === 0` and the empty-selection hint. Same reason. |

(That is 13 broken tests plus #7, which only needed its title brought in line.)

The other 6 tests in the file (`pin badge > marks only the pinned tiles`, and the five
`excluded section` tests other than #14) never touched either control and are byte-identical.

**Nothing was dropped.** Verified by count: the file was 20 tests before and is 20 tests after,
and `grep -c "sv-select-toggle"` in it is now 1 — the single mention inside the explanatory
comment.

## 8. Tests added (9, all written and passing — none skipped)

In `src/views/__tests__/PhotosSmartViewDetail.test.ts`, describe `SP15-P2c Task 6: header
action row`:

1. `renders sort and density in the header outside edit mode` — label copy, capsule default
   label, two density buttons, **and the first seven children of `.sv-actions` in sequence**.
2. `offers match score and date taken as the two sort options` — ids, labels and order, plus
   `score` marked active by default.
3. `re-sorts both grids by taken date when that option is picked, and relabels the capsule` —
   real reorder of both grids' tiles, capsule relabel, menu closes.
4. `switches both grids to the compact density` — `.is-compact` on both grids, `data-active`
   flips on both buttons.
5. `keeps pause and edit visible in edit mode while sort and density disappear` — plus both
   separators gone.
6. `enters and leaves edit mode from the single edit toggle` — copy Edit↔Done, `data-open`,
   the bar following it.
7. `shows add-photos in the bottom select bar rather than the header` — absent from the header,
   exactly one instance overall, in the bar, reachable with nothing selected, and it opens the
   picker.
8. `disables Remove until something is selected` — the guard that replaced the old bar gate.
9. `closes the sort menu on an outside mousedown and on Escape`.

The brief's six titles map onto 1, 2, 5, (skipped — §2a), 6, 7; 3, 4, 8 and 9 are additions
covering behaviour the brief's titles left unguarded (a Sort control that sorts nothing, a
density control that styles nothing, and the two popup-dismissal paths).

## 9. Files changed

- `src/views/PhotosSmartViewDetail.vue` (+235 / −40)
- `src/views/__tests__/PhotosSmartViewDetail.test.ts` (9 new tests)
- `src/views/PhotosSmartViewDetail.assets.test.ts` (13 re-homed, 2 helpers, 4 renames)
- `src/i18n/zh_cn.photos.ts`, `src/i18n/en_us.photos.ts` (2 keys each)

## 10. Self-review

- **Completeness** — every brief requirement except the one that contradicts the phase's task
  split, which is reported rather than silently dropped (§2a). Header order matches the target
  and the album page for the elements this task owns.
- **Global Constraint 2 (English)** — `git diff --cached | grep -nP '^\+.*[\x{4e00}-\x{9fff}]'`
  returns only the two new i18n **values** and a comment listing the reused keys' stored
  Chinese values (the same form the surrounding file already uses). Everything I newly authored
  is English. Two comments I *edited* (the two grid-band comments) were pre-existing Chinese and
  were translated in full rather than left half-and-half, per CLAUDE.md's "translate when you
  are already editing that code".
- **Constraint 3 (no colour literals)** — `grep -E '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\('` over the
  added lines: zero hits. New colours are `--chip-bg`, `--chip-bg-hi`, `--chip-border`,
  `--fg`, `--fg-muted`, `--divider`, `--popup-bg`, `--card-border`, `--card-shadow-hi`,
  `--accent-soft`, `--accent-text`. `src/styles` guard green.
- **Constraint 4 (`*` before `/` in CSS comments)** — every `*` in the added CSS is part of a
  well-formed delimiter; the one `/` inside comment prose (`.albums-sort-menu / .albums-sort-item`)
  is space-separated. Checked by eye and by the fact that all four added rule groups are
  asserted live by the tests (a swallowed rule would take `.density`/`.sv-sort-item` with it).
- **Constraint 5 (density enum)** — `'comfortable' | 'compact'`, identical to
  PhotosAlbumDetail.vue:67. Confirmed by grep, not by memory.
- **Constraint 6** — every run was foreground.
- **YAGNI** — no composable extracted for the sort menu; it is ~20 lines of template and the
  phase's sharing ruling covers positioning logic only. `sortAlbumPhotos` reused instead of a
  second comparator.

## 11. Concerns / hand-offs

1. **Task 7 inherits three parked controls** at the end of `.sv-actions` (Refine, Export,
   "..."), documented in a comment right above the row. Until it runs, this page carries a
   known 1:1 break against target :127-225 — the same shape as Task 3's carry-over into Task 5.
2. **Sort-menu check glyph asymmetry** (§2b): PhotosAlbumDetail.vue's dropdown has no check
   glyph although Vue2 gives both pages one. Not introduced here (it predates Task 3), but it
   is now visible as a difference between two pages this phase is trying to make identical.
   Controller's call.
3. **Task 9 is now unblocked and now *needed*.** The grids render sorted; `lb.openAt` still
   receives `store.matchedAssets`. Under Sort = Date taken, the lightbox's next/prev order
   disagrees with what the user sees. That is exactly the gap Task 9 exists to close, and the
   existing test asserting `call[1] === store.matchedAssets` still passes, so nothing silently
   masks it.
4. **Pre-existing stderr noise** in `src/views/__tests__/PhotosSmartViewDetail.test.ts` (§3),
   left alone deliberately — the safe half (`getSmartViewExcluded`) and the risky half
   (`getConfig`, which can flip AI feature gates) should be triaged together, not piecemeal.

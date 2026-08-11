# Task 3 report: Albums mixed grid + AI-off banner

Commit: `1040729` (branch `sp15-photos-moments`, base `95efa6f`)

## What I implemented

1. **`src/views/PhotosAlbums.vue` (script)**
   - Replaced the Task-2 interim `views` computed (which fed `buildMixedAlbums`/`sortMixed`
     an *empty* smart list and then unwrapped only `kind === 'user'`) with the real
     `mixedItems` computed: `sortMixed(buildMixedAlbums(albums.albums.map(albumToView), smartViews.smartViews), sort.value)`.
   - `isEmpty` now reads `mixedItems.value.length === 0` instead of `albums.albums.length === 0`.
   - Added `aiSmartViewOff = computed(() => settings.aiFeatures.smartview === false)`.
   - Added `openSmartCard(id: string)` → `router.push('/photos/smart-views/' + id)`.
   - `onMounted` now also fires `void smartViews.fetchSmartViews()` and
     `void settings.fetchAiFeatures()`, fire-and-forget alongside the existing
     `void albums.fetchAlbums()`.
   - Local `type SortId` union deleted; every use site now imports and uses
     `MixedSortId` from `util/mixedAlbums.ts` (no duplicate type left behind).
   - New imports: `SmartViewCard`, `usePhotosSmartViews`, `usePhotosSettingsStore`,
     `type MixedSortId`.

2. **`src/views/PhotosAlbums.vue` (template)**
   - Header count: `views.length` → `mixedItems.length`.
   - Added the AI-off banner (`.albums-ai-banner`, `data-test="albums-ai-banner"`) inside
     `.albums-scroll`, before `<section>`. Markup copied verbatim from
     `PhotosSmartViews.vue:169-186`'s `.svs-banner*`, classes renamed to `.albums-ai-banner*`.
   - Section subtitle now swaps between `photosAlbumsMineHint` (non-empty) and the new
     `photosAlbumsNoneYetHint` (empty), keyed off `mixedItems.length`.
   - Grid `v-for` changed from `v-for="view in views"` to
     `<template v-for="item in mixedItems" :key="item.kind + '-' + item.id">` dispatching
     `<SmartViewCard v-if="item.kind === 'smart'" ... @open="openSmartCard" />` vs the
     existing `.album-card` markup (unchanged internals, just `view.` → `item.view.`).
   - Added an inline comment above the `v-for` documenting why the kind prefix on `:key`
     is load-bearing (see mutation-check finding below).

3. **`src/views/PhotosAlbums.vue` (style)**
   - Added `.albums-ai-banner*` (4 rules), rule bodies copied verbatim from
     `PhotosSmartViews.vue`'s `.svs-banner*` — same `--dem-fg`/`--dem-bg`/`--dem-bd` tokens,
     same margins/padding/font-sizes, nothing rescaled.
   - Added a registered comment above `.album-grid` explaining why `minmax(220px, 1fr)`
     is intentionally left unchanged (not unified with `SmartViewCard`'s
     `minmax(320px, 1fr)`), citing Vue2's own split between `.album-grid-user` and the
     smart-views grid.

4. **`src/photos/components/SmartViewCard.vue`**
   - Added `data-test="sv-card"` to the root `<div class="sv-card" ...>` (line 66). See
     "data-test addition" section below — this is a deliberate net-new marker, not a
     pre-existing one the brief mis-assumed.

5. **`src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts`**
   - Added `photosAlbumsNoneYetHint` to both, inserted right after `photosAlbumsEmptyHint`
     (the closest existing key in the same "no albums" semantic cluster — the
     `photosAlbums*` family is not globally alphabetical in this file, e.g.
     `photosAlbumNew` sits between `photosAlbumsMineHint` and `photosAlbumsEmptyTitle`, so
     "insert alphabetically among neighbours" was applied locally to the adjacent
     Empty/NoneYet cluster, not to the whole file).

6. **`src/views/__tests__/PhotosAlbums.test.ts`**
   - Added `listSmartViews`/`getConfig` to the hoisted `svc.photos` mock (cleared/reseeded
     in `beforeEach`).
   - Added a `/photos/smart-views/:id` stub route and a `/photos/settings` stub route to
     `makeRouter()` (the latter to avoid a `[Vue Router warn]: No match found` for the
     banner's `RouterLink to="/photos/settings?section=ai"` — not in the brief's snippet,
     found while confirming pristine test output, see below).
   - Added a `mountAlbums(opts)` helper (not given verbatim by the brief — only its call
     sites were) plus a module-scope `push` spy variable, since the brief's test bodies
     reference a bare `push` identifier without destructuring it from `mountAlbums`.
   - Added the 6 test cases from the brief's Step 1, verbatim.

## TDD evidence

**RED** — `pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts` (before any
`PhotosAlbums.vue`/i18n/`SmartViewCard.vue` changes, tests + mocks + stub routes already
added):

```
 ❯ src/views/__tests__/PhotosAlbums.test.ts (27 tests | 4 failed)
     × renders smart albums and manual albums in one grid
     × counts both kinds in the header total
     × opens the smart view detail route when a smart card is clicked
     × shows the smart-views-off banner only when the backend says it is off

 FAIL ... renders smart albums and manual albums in one grid
AssertionError: expected [] to have a length of 1 but got +0
 FAIL ... counts both kinds in the header total
AssertionError: expected '...1 个相册...' to contain '2'
 FAIL ... opens the smart view detail route when a smart card is clicked
Error: Cannot call trigger on an empty DOMWrapper.
 FAIL ... shows the smart-views-off banner only when the backend says it is off
AssertionError: expected false to be true
```

Two of the six new tests ("swaps the section subtitle…" and "keeps the manual grid
alive…") passed even against the interim implementation — expected, since the interim
code already rendered manual albums unconditionally and the pre-existing `isEmpty` panel
already contained the string `'还没有相册'`. Not a sign of a weak test; both keep passing
post-implementation for the right reason (see mutation checks below for the one genuinely
weak spot I found).

**GREEN** — after Steps 3-6:

```
$ pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts
 Test Files  1 passed (1)
      Tests  27 passed (27)
```

```
$ pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts src/styles src/i18n/parity.test.ts
 Test Files  6 passed (6)
      Tests  1111 passed (1111)
```

```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

```
$ pnpm test   # full repo, run before commit
 Test Files  4 failed | 681 passed (685)
      Tests  3 failed | 10810 passed | 70 skipped (10883)
```

The 3 failures are all in `oss/cli-args.test.mjs` / `oss/export-rsync.test.mjs`, and all
three fail with the same underlying message: `工作树不干净,导出中止` (dirty working tree
abort) — expected per this phase's ledger CONTROLLER FACT (`oss/*.test.mjs` asserts a
clean tree; an uncommitted task diff always trips it). Re-ran both files after committing
on a clean tree:

```
$ git status --porcelain   # empty
$ pnpm exec vitest run oss/cli-args.test.mjs oss/export-rsync.test.mjs
 Test Files  2 passed (2)
      Tests  6 passed (6)
```

Confirmed clean — not a real regression.

Also ran `--reporter=verbose` on the focused file to check for hidden `[Vue warn]`s (per
this repo's known "default reporter hides Vue warn" gotcha):
- `[Vue warn]: Component "i18n-t" has already been registered...` appears on many tests
  in this file, **including tests that predate this task** (verified: `git stash` +
  re-run showed the identical 147 occurrences with none of my changes present). Pre-existing
  repo-wide artifact of reusing a module-level `createI18n()` instance across mounts, not
  something this task introduced or should fix.
- One warning I *did* introduce: `[Vue Router warn]: No match found for location with
  path "/photos/settings?section=ai"`, from the new banner's `RouterLink` with no matching
  route in the test router. Fixed by adding a `/photos/settings` stub route to
  `makeRouter()` (mirrors the existing fix in `PhotosSmartViews.test.ts` for the same
  banner). Confirmed gone after the fix.

## Mutation checks (self-review)

1. **Banner gate.** Temporarily set `aiSmartViewOff = computed(() => true)` (unconditional
   render). Result: `shows the smart-views-off banner only when the backend says it is
   off` went red — the "missing field means on" half of the assertion failed
   (`expected true to be false`). Caught. Reverted.

2. **Grid key kind-prefix.** Temporarily changed `:key="item.kind + '-' + item.id"` to
   `:key="item.id"` (dropping the prefix). Result: **all 27 tests in the file still
   passed** — nothing in the current suite catches a dropped kind prefix. This is a real
   gap: no fixture ever gives a manual album and a smart view the same id, so the
   collision this prefix exists to prevent is never exercised. I reverted the mutation and
   left a registered inline comment at the `v-for` explaining the rationale (matching the
   ambiguity note in my brief), but did **not** add a new collision-fixture test — the
   brief didn't ask for one and it would be scope creep beyond the assigned test list.
   Flagging this for the reviewer to decide whether it's worth a follow-up test.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosAlbums.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/__tests__/PhotosAlbums.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/zh_cn.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/en_us.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/components/SmartViewCard.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/.superpowers/sdd/2026-08-10-sp15-p2b-smartview-albums-ia-merge/progress.md`

No test files were newly *added* (only existing ones modified), so no `oss/manifest.mjs`
edit is expected or was made — confirmed by the clean oss-test rerun above.

## `data-test="sv-card"` addition

Confirmed by grep before writing any test: `SmartViewCard.vue` had **zero** `data-test`
attributes anywhere in the file — the brief's premise ("既有标记") was wrong for this
component. Added `data-test="sv-card"` to the component's single root element
(`src/photos/components/SmartViewCard.vue:66`, the `<div class="sv-card" @click="onClick">`).
This is the only markup change made to that file; registered both in a header comment in
the component itself and here. `SmartViewCard.test.ts` (21 tests) still passes unmodified.

## Self-review findings

- Header count uses `mixedItems.length` — yes (banner + test both verified).
- Section subtitle swaps on empty — yes, keyed off `mixedItems.length` (not
  `albums.albums.length`), so a smart-only or manual-only non-empty grid both correctly
  skip the "none yet" copy.
- Banner renders only on explicit `smartview === false` — yes, verified by mutation check.
- Smart card click routes to `/photos/smart-views/<id>` — yes, verified by test + router
  stub.
- Interim `views` computed fully replaced — yes, `grep -n "\bviews\b" src/views/PhotosAlbums.vue`
  after the change returns zero hits outside of unrelated identifiers (`AlbumView`, etc.);
  no leftover unused symbol, no dead import.
- Task 4 discipline: did not touch `confirmCreate`, the picker, or the "Let Nimo draft it"
  fill option. `grep -n "newAlbumSource\|createOpen\|confirmCreate" src/views/PhotosAlbums.vue`
  shows those blocks unchanged from before this task (only the imports/computed/onMounted/
  template sections I list above were touched).
- Banner visual parity: rule bodies for `.albums-ai-banner*` are a byte-for-byte copy of
  `PhotosSmartViews.vue`'s `.svs-banner*` values (same margins, padding, font sizes,
  `--dem-*` tokens) — only the class names differ.

## Issues or concerns

- The grid-key mutation-check gap above (nothing in the current suite would fail if the
  kind prefix were dropped). Not fixed with a new test; flagged for reviewer triage.
- `PhotosSmartViews.vue` still renders its own copy of the AI-off banner — expected per
  the brief ("Task 5 will remove the original from that page; leaving both for now is
  correct"), not an oversight.
- No new color/hex/rgb literals introduced; all colors in the added CSS are `var(--…)`
  tokens already in use elsewhere (`--dem-fg`/`--dem-bg`/`--dem-bd`, `--accent-text`).

## Corrections to the brief

None found that affected the actual implementation — the brief's Step 1-8 content matched
what the codebase needed, with two exceptions already flagged as facts up front by the
task-launcher (which I verified independently and confirmed accurate):

1. `SmartViewCard.vue` has zero `data-test` attributes (not "an existing marker" as the
   brief's own text speculated before the launcher's correction) — confirmed by grep,
   handled as instructed.
2. The brief's own note about `SmartViewCard`'s emit contract (`(e: 'open', id: string)`)
   was confirmed correct by reading the component source — `openSmartCard(id: string)`
   matches directly, no adapter needed.

One thing not in the brief that I had to work out myself: the brief's test snippets
reference a bare `mountAlbums(...)` helper and a bare `push` spy variable without ever
defining either. I designed `mountAlbums()` and the module-scope `push` reassignment
pattern to match the exact call shapes the given test bodies use (documented in the test
file's own comments). This is implementation, not a brief correction, but noting it since
"use the brief's values verbatim" only covers what the brief actually spelled out.

---

# Fix report: review round 1

Commit: `1a576c9` (on top of `1040729`, branch `sp15-photos-moments`)

Review came back with 3 Important + 2 Minor. All five addressed below.

## Important 1 — Chinese comment in `SmartViewCard.vue:27-29`

Translated the `data-test="sv-card"` registration comment to English verbatim in content,
no wording changes beyond the language. Diff:

```diff
-// SP15-P2b Task 3(登记新增):根节点原来没有 `data-test`——grep 确认过,组件里此前零个
-// data-test 属性。PhotosAlbums.vue 的混排网格测试需要一个稳定选择器来数「这是几张智能
-// 卡」,补 `data-test="sv-card"`,只加这一处,不动组件其余任何标记。
+// SP15-P2b Task 3 (registered addition): the root element had no `data-test` before this --
+// grep-confirmed zero data-test attributes anywhere in this component. PhotosAlbums.vue's
+// mixed-grid tests need a stable selector to count "how many smart cards", so added
+// `data-test="sv-card"` here, and only here -- no other markup in this file was touched.
```

## Important 2 — Chinese sentences appended to `PhotosAlbums.vue`'s grid-width comment

Translated only the new sentences (the `.album-grid` `minmax(220px, 1fr)` rationale); the
three pre-existing Chinese lines directly above it (the `.albums-scroll` scroll-container
placement note) are untouched, per the reviewer's instruction:

```
/* ── 分区头 + Grid ──
   滚动容器挪到这一层(照 Vue2 photos.scss:3202-3206 的 .albums-body):分区头与网格一起
   滚动,.album-grid 本身只负责网格布局,不再兼任滚动容器。
   SP15-P2b Task 3: minmax(220px, 1fr) below is deliberately NOT changed to the
   minmax(320px, 1fr) SmartViewCard was designed against (PhotosSmartViews.vue's .sv-grid) --
   ... */
```

## Important 3 — duplicate "还没有相册" message

Verified the reviewer's grep claim independently before touching anything:
`grep -rn "photosAlbumsEmptyTitle\|photosAlbumsEmptyHint"` across `src/` returned exactly
four hits — the two locale definitions and the two template consumers in `PhotosAlbums.vue`.
No other consumer exists; safe to delete.

Changes:
1. Deleted the `v-else-if="isEmpty"` `.empty-state` block (`data-test="albums-empty"`).
   The `albums.loadError` `v-if` branch above it is untouched — that state is real and
   separate (fetch failed vs. fetch succeeded with zero results).
2. Deleted the now-unused `isEmpty` computed.
3. Deleted `photosAlbumsEmptyTitle` / `photosAlbumsEmptyHint` from both
   `src/i18n/zh_cn.photos.ts` and `src/i18n/en_us.photos.ts`, with a comment at the
   remaining `photosAlbumsNoneYetHint` key explaining why (parity test still passes: both
   files lost the same two keys).
4. Section subtitle ternary changed from `mixedItems.length ? ... : ...` to
   `albums.albumsLoaded && mixedItems.length === 0 ? t('photosAlbumsNoneYetHint') :
   t('photosAlbumsMineHint')`, with an English comment citing Vue2 `939a7d3a:PhotosAlbumsView.vue:91-93`
   and explaining the load-gate.
5. Updated 4 existing tests that asserted on the deleted `[data-test="albums-empty"]`
   selector — each now asserts on `.albums-section-hint`'s text instead (`zh.photosAlbumsMineHint`
   while `albumsLoaded` is false / a load error is showing, `zh.photosAlbumsNoneYetHint` when
   the fetch succeeded with zero results). Also renamed/reworded the first test in the file
   ("albumsLoaded 且列表空 → 渲染空态,「新建」占位卡仍在" → "...→ 分区副标题显示空态文案,...")
   since it no longer renders a standalone panel.
6. Added `does not flash the none-yet copy before the fetches resolve` — mounts without
   awaiting the album fetch's resolution and asserts the subtitle still reads
   `photosAlbumsMineHint`, then resolves and re-asserts the same. Deliberately does not use
   `mountAlbums()` (it always awaits `flushPromises`), for the same reason the pre-existing
   "首次加载飞行中" test builds its own mount.

**Mutation check (as instructed):** removed the `albums.albumsLoaded &&` guard from the
subtitle ternary (leaving `mixedItems.length === 0 ? ... : ...`). Result:

```
$ pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts -t "does not flash the none-yet copy"
 FAIL  ... does not flash the none-yet copy before the fetches resolve
AssertionError: expected '还没有相册——手动创建一个，或者让 Nimo 建一个会自动保持更新的智能相册。' to be '你创建的相册'
```

Red as expected. Reverted immediately after confirming.

## Minor 1 — untested kind-prefix guard

Added the instructed fixture (`renders both a manual album and a smart view that share the
same raw id`, seeding `albums: [{ id: '1', ... }]` and `smartViews: [{ id: '1', ... }]`,
asserting one `album-card` and one `sv-card` render).

**Mutation check, re-run against the new fixture:** dropped the `item.kind + '-'` prefix
from `:key` again (same mutation as the original task report). Result: **the new fixture
still does not go red** — both cards render correctly either way.

I did not stop at that observation; I probed further to understand why, spying on
`console.warn` during the mutated mount to check whether Vue's own "duplicate keys" dev
warning at least fires (which would be a weaker but real signal):

```
$ pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts -t "TEMP PROBE" --reporter=verbose
WARN CALLS: [only the pre-existing "already been registered" i18n warnings — no
             "duplicate keys" warning]
```

No duplicate-key warning either. Root cause: Vue's `isSameVNodeType` check (used by both
the keyed-diff algorithm and the duplicate-key detector) compares `type` **and** `key`
together. The manual-album branch renders a plain `div`; the smart branch renders the
`SmartViewCard` component — two different `type`s. Because the types already differ, Vue
never treats these two vnodes as candidates for the same slot regardless of what the key
string is, so a cross-kind id collision specifically (div vs. component) is a case Vue's
own diffing structurally can't confuse, prefix or no prefix.

This means the fixture (and the literal "assert both cards render" check) documents the
intent and gives a concrete regression point for anyone reading the test file, but it does
**not** close the detection gap the original mutation check found — that gap is still open
for this specific cross-type collision. (It's possible a same-kind collision — two manual
albums sharing an id, or two smart views sharing one — would behave differently on a
reactive re-render/reorder, since those share a vnode `type`; I did not chase that down
further, as it's a different scenario from the one Minor 1 named and the coordinator's
instruction was scoped to "manual album and a smart view share the same raw id.")
I removed the temporary `console.warn` probe test before committing — it is not part of
the shipped diff. Flagged in the ledger (`progress.md`) for the reviewer/controller to
decide whether a different test shape is warranted or the residual risk is accepted.

## Minor 2 — banner deviation notes

Added a one-line English pointer inside the copied banner's existing comment block, citing
`PhotosSmartViews.vue:177-178` and naming both deviations (the real `RouterLink` replacing
Vue2's non-clickable placeholder, and not copying Vue2's bare trailing period) without
restating their full rationale — that lives in the source file's own header comment.

## Covering tests run

```
$ pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts src/i18n/parity.test.ts src/styles
 Test Files  6 passed (6)
      Tests  1113 passed (1113)
```

```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

Full repo suite (`pnpm test`) was **not** re-run, per the coordinator's explicit
instruction that the listed commands cover the amended code.

## Files changed (this fix round)

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/components/SmartViewCard.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosAlbums.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/__tests__/PhotosAlbums.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/zh_cn.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/en_us.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/.superpowers/sdd/2026-08-10-sp15-p2b-smartview-albums-ia-merge/progress.md`

# Task 8 report: `Photos.vue` 接线（保留未加载月份 / 按需请求 / 死刻度置灰）

## What was implemented

1. **`src/views/Photos.vue`** — `gridMonths`'s filter (`:75-79` pre-change) used to drop every
   month whose (EXIF-filtered) photo array was empty. In bucket mode an unloaded month's
   `photos` is *always* `[]`, so that filter silently threw away every month the user has not
   scrolled to yet — the grid would receive nothing to paint. Added:
   - `exifFilterActive` computed: true iff `exifFilter.years/places/cameras` is non-empty.
   - `gridMonths` filter now keeps a month if it has real (filtered) photos, **or** it is an
     unloaded bucket month (`loaded === false`) and no EXIF filter is active. Once a filter is
     active, an unloaded month is dropped again — its membership under that filter is unknown
     to the frontend (spec §5.1, registered limitation; comment says so verbatim).
   - Added `@need-bucket="(k: string) => store.fetchBucket(k)"` on the `<PhotosGrid>` template
     tag, so the grid's on-demand request now actually reaches the store.
   - `filteredCount` left untouched per the brief (it counts real photos on purpose).

2. **`src/photos/components/PhotosGrid.vue`** — `scrubberTicks` used to iterate `props.months`
   while the template's month containers iterate `filteredMonths` (tab-filtered). Any month
   hidden by the current tab still got a tick that pointed at a container that doesn't exist.
   Changed `scrubberTicks` to iterate `filteredMonths.value` (the same array the template
   renders from) and added a `disabled: boolean` field per minor tick, computed as
   `!hasContent(m)`. Year ticks are never disabled (not click targets). Template changes:
   `:data-disabled="tk.disabled"`, cursor is `default` when `tk.major || tk.disabled`, and the
   click handler is gated `!tk.major && !tk.disabled`. Added
   `.scrubber-tick[data-disabled="true"] { opacity: 0.35; }` — no new color token needed.

3. **New test file `src/views/__tests__/Photos.buckets.test.ts`** — full mount-based coverage
   (mock set/harness copied from `Photos.integration.test.ts`) for the three cases the brief
   specified: an unloaded month survives into `gridMonths` and reaches `PhotosGrid`'s `months`
   prop; it is dropped once an EXIF filter narrows the view; `need-bucket` emitted by the grid
   reaches `store.fetchBucket` with the right key.

4. **`src/photos/components/__tests__/PhotosGrid.test.ts`** — added one test for the disabled
   scrubber tick (see the trap below for why it needed two months, and a *further* fixture
   correction beyond what the brief anticipated).

5. **`oss/manifest.mjs`** — registered the new test file, alphabetically between
   `Photos.integration.test.ts`'s predecessor and successor (`Photos.buckets.test.ts` sorts
   before `Photos.integration.test.ts`), with a one-line "why" comment.

## A second trap beyond the one the brief flagged

The brief already warned that a single unloaded month on `tab: 'doc'` can't work (no OCR
estimate ⇒ `anyContent` false ⇒ the whole scrubber `v-if` never mounts), and told me to add a
second month that "has content on the doc tab (a loaded month holding a photo with
`hasOcr: true`)". I built exactly that and it still failed with the ticks list empty.

Root cause: `matchesTab(p, tab)` (`src/photos/util/tabFilter.ts`) only special-cases
`'all'`/`'video'`/`'ocr'` by literal string; `'doc'` is not one of those strings, so it falls
through to the *default* branch — the same branch `'photo'` uses — `!isVideo && !hasOcr`. A
photo with `hasOcr: true` therefore does **not** match under `tab: 'doc'`, so the "content"
month's `filtered` array was empty too, `hasContent()` was false for *both* months, `anyContent`
stayed false, and the scrubber never rendered — the exact same failure mode the brief had
already warned about, one level deeper.

Fixed by using a plain (non-OCR, non-video) photo for the "has content on this tab" month
instead — under `tab: 'doc'`, that plain photo matches the same default branch a `'photo'` tab
photo would. Documented this in a code comment on the test so it doesn't get silently
"corrected" back to `hasOcr: true` later. This is a one-line factual claim in the brief that
didn't match the actual `matchesTab` implementation; noting it here as the report's
required "brief vs. reality" callout, and recommend registering `'doc'` as either a genuinely
mapped tab or scrubbing it from test vocabulary in a future pass — not done here, out of scope.

## TDD evidence

**RED** — stashed the two implementation files (`src/views/Photos.vue`,
`src/photos/components/PhotosGrid.vue`), keeping the new test file, then ran:

```
pnpm test src/views/__tests__/Photos.buckets.test.ts
```

Result: 3 failed / 3 tests, against the pre-change code —
- `keeps unloaded months in gridMonths...`: `expected undefined to be truthy` (month absent
  from `PhotosGrid`'s `months` prop — the old filter dropped it).
- `drops unloaded months once an EXIF filter is active`: `expected false to be true` (month was
  never present to begin with, since bucket mode filter dropped it pre-change).
- `forwards need-bucket to the store`: `expected "wrappedAction" to be called with... Number of
  calls: 0` (no `@need-bucket` listener existed on `<PhotosGrid>` yet).

Then `git stash pop` restored the implementation changes.

**GREEN** —

```
pnpm test src/views/__tests__/Photos.buckets.test.ts src/photos/components/__tests__/PhotosGrid.test.ts
```
→ 2 test files passed, 46/46 tests passed (first run caught the `matchesTab`/`'doc'` fixture bug
above via 1 failure; fixed the fixture, reran, 46/46 green).

```
pnpm test oss
```
→ 21 test files passed, 487/487 tests passed (run once with a dirty tree first — 4 export
tests failed purely on the "工作树不干净" guard, unrelated to this task's code; `oss/photosStripCoverage.test.mjs`
was green even then. Re-ran clean after committing: all 21/21 files green, confirming the guard
failures were a tree-state artifact, not a defect).

```
pnpm exec vue-tsc --noEmit
```
→ exit 0, no output.

```
pnpm test src/photos src/views/__tests__
```
→ 131 test files passed, 2665/2665 tests passed. (Output contains several `Error: Not
implemented: navigation (except hash changes)` lines from jsdom — documented pre-existing noise
per the task instructions, not failures.)

Also ran two extra targeted gates as part of self-review (not in the brief's list, but touched
by this change):
- `pnpm test src/styles/color-guard.test.ts` → 1056/1056 passed (confirms the new
  `opacity: 0.35` rule and comment don't trip the repo-wide color/comment scanners).
- `pnpm test src/photos/util/__tests__/gridMetricsCssParity.test.ts` → 4/4 passed (confirms the
  grid's `minmax`/`gap`/`padding-right` numbers were left untouched, as required).

## Files changed

- `src/views/Photos.vue` — `gridMonths` filter + `@need-bucket` wiring.
- `src/photos/components/PhotosGrid.vue` — `scrubberTicks` source + disabled tick
  attrs/cursor/click-gate + CSS rule.
- `src/photos/components/__tests__/PhotosGrid.test.ts` — added the disabled-tick test.
- `src/views/__tests__/Photos.buckets.test.ts` — new file, 3 tests.
- `oss/manifest.mjs` — registered the new test file.

Commit: `3c12c57` — `feat(photos): wire bucket loading into the timeline view`.

## Self-review checklist (from the task)

- **Unloaded month reaches the grid and paints a skeleton end-to-end through the real view**:
  confirmed via `Photos.buckets.test.ts`'s first test, which mounts the real `Photos.vue` (not a
  stub), puts the store in bucket mode with one unloaded month, and asserts the month arrives at
  `PhotosGrid`'s `months` prop with `loaded === false`. `PhotosGrid.test.ts`'s existing
  bucket-mode-skeleton suite (untouched by this task) already covers that an unloaded month
  paints a skeleton once it reaches the grid — the two together cover the full path.
- **Turning on an EXIF filter hides it**: confirmed via the second `Photos.buckets.test.ts` test.
- **`need-bucket` actually lands on `fetchBucket`**: confirmed via the third test, spying on
  `store.fetchBucket` and emitting `need-bucket` from the real `PhotosGrid` component instance.
- **No tick can be clicked that has nowhere to go**: the click handler is gated
  `!tk.major && !tk.disabled`, and `disabled` is computed from the exact same `filteredMonths`
  array the template's month containers read — they cannot disagree.
- **Two non-bucket consumers of `PhotosGrid` untouched**: `PhotosFavorites.vue` and
  `PhotosPlaceAssets.vue` feed synthetic groups with `loaded === undefined`; the tick's
  `disabled` flag is `!hasContent(m)`, and `hasContent` already existed pre-task with the same
  semantics used for month-container rendering, so a synthetic group behaves exactly as before
  (its content, if any, was already going to render — nothing about `disabled` changes that).
  No store changes were made in this task, so nothing about the store-side behavior for these
  two consumers changed either. Confirmed no regressions via the 2665-test wide sweep, which
  includes their test files.
- **Manifest entry in place, `pnpm test oss` proves it**: `oss/manifest.mjs` line inserted
  alphabetically; `pnpm test oss/photosStripCoverage.test.mjs` run in isolation is green, and the
  full clean-tree `pnpm test oss` run (487/487) is green too.
- **Test output pristine**: no unexpected console errors in the new/changed test files; the only
  console noise across the wide sweep is the documented `Not implemented: navigation` jsdom
  message and (in one run, before assertions were fixed) my own debugging iteration — not present
  in the final green run's relevant test files.

## Concerns

- The `matchesTab`/`'doc'`-tab fixture issue documented above is worth a look if anyone reuses
  `'doc'` as a test-only tab name elsewhere expecting OCR semantics — it silently behaves like
  `'photo'` instead. No code change proposed here (out of this task's scope; `matchesTab` itself
  is untouched and correct for the real tabs `'all'/'video'/'ocr'`/default). The coordinator's
  review confirmed this is a known, branch-wide issue (spans Tasks 3/6/8) being resolved
  separately in the final task — left alone here per that instruction.
- No other concerns. Scope was held to the five files listed in the brief's Scope line plus the
  test file and manifest entry.

## Fix round 1 (coordinator review)

Two defects, both traced by the coordinator to the brief itself rather than to the
implementation:

1. **Important 1 — Chinese comment vs. English-comments constraint.** The brief's Step 3 handed
   over the `gridMonths` comment block in Chinese for verbatim paste, which contradicts both the
   brief's own Global Constraints ("code comments English") and the workspace `CLAUDE.md`'s hard
   requirement — whose one carve-out ("legacy Chinese gets translated when you are already
   editing that code") applied exactly here, since this comment block was being edited in this
   task. Rewrote `src/views/Photos.vue:79-87`'s comment in English, preserving every fact the
   original carried: unloaded bucket months have `photos === []`, so the old unconditional filter
   dropped exactly the months the grid needs in order to paint structure; those months are also
   where the scroll length and jump anchors come from; an active EXIF filter restores the drop
   because an unloaded month's membership under that filter is genuinely unknown to the frontend
   (owner ruling 2026-08-10, spec §5.1 — a registered limitation, not an oversight). Did not touch
   any other pre-existing Chinese comment in the file.

2. **Minor 3 — stale count in `oss/manifest.mjs`.** The comment at `oss/manifest.mjs:115-116` said
   "21 view tests ... the other 18 in this area"; adding `Photos.buckets.test.ts` in the prior
   commit made those 22 and 19 respectively (verified by counting the list: 3 entries not under
   `__tests__/` + 19 entries under `__tests__/` = 22 total). Bumped both numbers.

Re-ran the three covering commands in the foreground on a clean tree (after committing):

```
pnpm test src/views/__tests__/Photos.buckets.test.ts
```
→ 1 file passed, 3/3 tests passed.

```
pnpm test oss
```
→ 21 files passed, 487/487 tests passed (clean tree — no dirty-tree guard failures this time).

```
pnpm exec vue-tsc --noEmit
```
→ exit 0, no output.

Commit: `c634f60` — `fix(photos): translate gridMonths comment to English, bump stale test count`
(on top of `3c12c57`).

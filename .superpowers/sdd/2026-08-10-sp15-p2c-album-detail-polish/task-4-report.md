# Task 4 report: 相册详情侧栏三节

## What was implemented

`src/views/PhotosAlbumDetail.vue`:

1. **About section** (new `.sv-side-section` above Stats, inside `aside.sv-detail-side`):
   four `.mo-about-row` rows — Type / Created / Time span / Place — matching
   `33b05636:src/views/Photos/PhotosAlbumDetail.vue:283-290` and reusing
   `PhotosMomentDetail.vue`'s `.mo-about-row` idiom (its scoped CSS rule body copied verbatim
   into this file's `<style>`, since scoped styles don't cross SFCs here).
2. **Stats section trimmed from 4 cells to 2** (Photos/Videos only) — Span and Created were
   dropped because they are the exact same data now shown as their own About rows, matching the
   target's own comment at `:292-309`.
3. **By-month histogram left untouched** (already built in P2b Task 6).
4. **Four new computed properties**, ported from the target's `:570-579` and `:591-613`:
   - `timeSpanLabel` — prefers `spanLabel` (album.dateRange); falls back to computing min/max
     `takenAt` over currently-loaded `photos.value`; `DASH` if neither exists.
   - `placesAgg` — frequency-counts `p.place` over `photos.value`, sorted descending.
   - `placesLabel` — top 3 names by frequency joined with `" · "`, `"+N"` remainder; `DASH` when
     empty.
   - `placesTitle` — every place with its count (`"name (count)"`), joined with `" · "`; empty
     string (not `DASH`) when there is nothing to hint at.
5. **Folded-in fix** (Task 3 review finding, `:798` pre-edit): the select bar's `v-if` gate
   changed from `edit` alone to `edit && album`.

`src/i18n/zh_cn.photos.ts` / `en_us.photos.ts`: one new key, `photosDetailTimeSpan`
(`'时间跨度'` / `'Time span'`).

## i18n keys — new vs. reused

Per the plan's i18n table (`docs/superpowers/plans/2026-08-10-sp15-p2c-album-detail-polish.md`
§i18n, read from `33b05636:src/assets/lang/zh_CN.json`):

| Row label | Plan's proposed key | What I actually used | Status |
|---|---|---|---|
| About | `photosDetailAbout` | **`photosMoAbout`** (`'关于'`/`'About'`) | reused — already existed, identical value |
| Type | `photosDetailType` | **`photosMoType`** (`'类型'`/`'Type'`) | reused — already existed, identical value |
| Created | `photosDetailCreated` | **`photosAlbumStatCreated`** (`'创建于'`/`'Created'`) | reused — already existed, identical value |
| Time span | `photosDetailTimeSpan` | **`photosDetailTimeSpan`** (added) | **new** — no existing key means "Time span"; `photosMoSpan` ('跨度'/'Span') and `photosMoTime` ('时间'/'Time') are both different labels for different things |
| Place | `photosDetailPlace` | **`photosMoPlace`** (`'地点'`/`'Place'`) | reused — already existed, identical value |

Also reused (not in the plan's table but needed for the Type row's *value*, not its label):
`photosAlbumLabel` (`'相册'`/`'Album'`) — Task 3's report had already flagged this key as
reserved for Task 4's About·Type row.

So **4 of 5 were already there** (About/Type/Created/Place); only **Time span** is genuinely
new. Confirmed via `grep -n "photosMo\|photosAlbum" src/i18n/zh_cn.photos.ts` before adding
anything, per the phase's standing instruction (this plan's i18n table had already been wrong
once this phase for Task 3).

## Where the Vue2 target and the brief disagreed

None found for this task's core scope — the brief's prose for the About/Stats/computed sections
matched the target at `33b05636:PhotosAlbumDetail.vue:145-300,591-613` on every point checked
(row order, placeholder literal, top-3-plus-remainder format, title format, DASH-vs-empty-string
split between `placesLabel`/`placesTitle`, Stats cell count and captions).

The one disagreement is the deferred finding from Task 3 (not this task's own brief), already
registered in the file's own comment at the time: the select bar's brief said "renders once
something is selected"; the target (`:326-327`) renders on `edit` alone. That was Task 3's call
already made correctly — I did not touch that decision, only the `&& album` addition on top of
it.

## Folded-in select-bar fix

**Chose:** `v-if="edit && album"` over resetting `edit.value = false` in the route-id watcher.

**Why:** The select bar's pre-P2c home was inside the `v-else-if="album"` branch, so "no album →
not rendered" was structural, not something any watcher had to maintain. `edit && album`
restores that invariant directly at the point that actually depends on it. A watcher-based fix
(reset `edit` when `route.params.id` changes) only covers navigation-triggered transitions — it
would miss the case where `album` disappears for a reason *other* than a route change (e.g. a
concurrent `fetchAlbums()` call decides the album no longer exists while the id in the URL hasn't
moved). The direct condition covers both paths with less state to keep in sync, and reads as
"this bar makes no sense without an album" rather than "remember to clean up `edit` here too."

Also fixes the second half of the finding for free: since the "Add photos" button lives inside
the now-hidden bar, the picker can no longer be opened for a missing album, so
`batchAddToAlbum` can no longer be called against a nonexistent id through this path.

Added test: `navigating to a missing album while mid-edit hides the select bar instead of
floating it over 'Album not found'` — enters edit mode on a real album (id `7`), then navigates
to `/photos/albums/999`, and asserts the not-found screen shows while `.sv-select-bar` does not.
Confirmed RED against the pre-fix `v-if="edit"` (mutation 4 below).

## Tests

Command: `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles`

**RED** (stashed `PhotosAlbumDetail.vue` + the two i18n files, kept only the test file changes,
ran against the old implementation):

```
$ git stash push -- src/views/PhotosAlbumDetail.vue src/i18n/en_us.photos.ts src/i18n/zh_cn.photos.ts
$ pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts
...
 Test Files  1 failed (1)
      Tests  11 failed | 56 passed (67)
```

11 failing tests, exactly the new/changed ones:
- `shows a stats rail with photos and videos` (rewritten from the stale 4-cell test)
- `reports zero videos rather than a dash when the album has none` (index shifted 2→1)
- `navigating to a missing album while mid-edit hides the select bar...` (fold-in fix)
- all 8 tests in the new `P2c detail sidebar` describe block

`git stash pop` restored the implementation.

**GREEN** (after restoring the implementation):

```
$ pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles
 Test Files  6 passed (6)
      Tests  1154 passed (1154)
```

Verbose run (`--reporter=verbose`) checked for stderr noise on passing tests: the only stderr
present is pre-existing noise unrelated to this task's changes — `[Vue warn]: Component "i18n-t"
has already been registered...` (from the module-level `i18n` instance being reinstalled by
every `mount()` in this file, present before this task), deliberate `console.error` calls the
suite already asserts on (`[photos-albums] fetchAlbums Error: net`, `[album-detail] reorder
Error: boom`, etc.), and one pre-existing `[Vue Router warn]: No match found for location
"/photos/smart-views/sv-new"` from an existing unrelated test. Nothing new.

### Brief's Step-1 test list — all written and passing

| Brief test title | Status |
|---|---|
| renders the About section with type, created, time span and place rows | written, passing |
| shows the top three places joined by a middle dot and a +N remainder | written, passing |
| orders places by frequency, not by the order they appear in the asset list | written, passing |
| puts every place with its count in the title attribute | written, passing |
| falls back to the placeholder when no member has a place | written, passing |
| derives the time span from loaded members when the album carries no dateRange | written, passing |
| renders exactly two stat cells, photos and videos | written, passing |
| keeps the monthly histogram section | written, passing |

None skipped.

### Existing tests updated (stats trim broke them)

- `shows a stats rail with photos, span, videos and created` → renamed `shows a stats rail with
  photos and videos`, asserts 2 cells instead of 4; the Span/Created assertions it used to carry
  moved to two new About-row tests (`derives the time span...` and `falls back to the placeholder
  for Created and Time span when both are unusable`).
- `falls back to a dash when the span or the created date is unusable` → replaced by the About-row
  equivalent above (stat cells no longer carry this data at all).
- `reports zero videos rather than a dash when the album has none` → cell index updated 2→1.

### Place-ordering fixture notes (per the brief's warning about near-misses)

- 5-place fixture (top-3 + remainder test): counts `C=3, E=2, A=B=D=1`; first-appearance order is
  `A,B,C,D,E`, frequency order is `C,E,A,(B,D)` — genuinely different, so a mutant that drops the
  sort produces `"A · B · C +2"` instead of the correct `"C · E · A +2"`. Verified below.
- 2-place fixture (frequency-vs-appearance-order test + title test): `Rome` appears once and
  first; `Paris` appears three times, all later. Expected `"Paris · Rome"` — a mutant without the
  sort would produce `"Rome · Paris"`. Verified below.

## Mutation verification (4)

All four applied via `Edit`, confirmed the named test reddened with a scoped `vitest run -t`,
then reverted and confirmed the full targeted suite is green again.

1. **Removed the descending sort in `placesAgg`** (dropped `.sort((a,b) => b[1]-a[1])`).
   `orders places by frequency, not by the order they appear in the asset list` → **RED**:
   `expected 'Rome · Paris' to be 'Paris · Rome'`. Reverted.

2. **Restored Stats to 4 cells** (re-added Span and Created cells).
   `renders exactly two stat cells, photos and videos` → **RED**:
   `expected [...] to have a length of 2 but got 4`. Reverted.

3. **Made `placesTitle` return `DASH` instead of `''` when empty.**
   `falls back to the placeholder when no member has a place` → **RED**:
   `expected '—' to be ''` (on the `title` attribute assertion). Reverted.

4. **Reverted the fold-in fix** (`v-if="edit && album"` → `v-if="edit"`).
   `navigating to a missing album while mid-edit hides the select bar instead of floating it
   over 'Album not found'` → **RED**: `expected true to be false` (the select bar was still
   present over the not-found screen). Reverted.

After each revert, `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts
src/i18n/parity.test.ts src/styles` was re-run to confirm 1154/1154 green before moving to the
next mutation.

## Type check

`pnpm exec vue-tsc --noEmit` → no output, clean.

## Files changed

- `src/views/PhotosAlbumDetail.vue`
- `src/views/__tests__/PhotosAlbumDetail.test.ts`
- `src/i18n/zh_cn.photos.ts`
- `src/i18n/en_us.photos.ts`

## Self-review

- **Chinese**: `git diff --cached | grep -nP '^\+.*[\x{4e00}-\x{9fff}]'` → one hit, the new
  i18n value literal (`'时间跨度'`) itself. No newly-authored Chinese in comments/code/test
  descriptions.
- **Color literals**: none added; every new CSS rule uses existing `var(--…)` tokens
  (`--fg-muted`, `--divider`, `--fg`). Checked with a hex/rgb grep over the staged diff, no hits
  outside `var(--…)`.
- **`*` immediately before `/` in CSS comments**: checked the staged diff's added lines for
  `*/` and confirmed every occurrence has intervening content, not a bare `*` glued to `/`.
- **Placeholder single-source rule**: `createdLabel`, `timeSpanLabel`, and `placesLabel` all
  return the one module-level `const DASH = '—'` (declared once, at line 115, already the
  source T3's `v-if="createdLabel !== DASH"` uses) — no second `'—'` literal was introduced.
  `placesTitle` deliberately returns `''` rather than `DASH` when empty (per the target's own
  `placesTitle()` at `:609-613`), and that decision is driven by the same
  `placesAgg.value.length` gate as `placesLabel`, so the two can't drift out of sync — documented
  in the code comment.
- **YAGNI**: no extra abstraction added; `PlaceCount` is a 6-line local interface, not a shared
  type, since nothing else in the file needs it.

## Concerns

None. The task's scope (About section, stats trim, histogram left alone, the folded-in select-bar
fix) is fully implemented, tested, and verified; no blockers encountered.

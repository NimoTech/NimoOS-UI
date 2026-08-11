# Task 10 report — Albums page: smart albums get the manual album card shape; SmartViewCard deleted

**Status:** DONE
**Commit:** `750dd2d` refactor(photos): render smart albums with the manual album card shape

---

## 1. What I implemented

Target read: `git -C ../NimoOS-UI show 9f7e941f:src/views/Photos/PhotosAlbumsView.vue` (:93-146) plus
`9f7e941f:src/views/Photos/photos.scss` — both sub-commits of that PR, and cross-checked against
`33b05636` (identical for this file's card markup).

### a. Smart card is now the manual album card's shape

`src/views/PhotosAlbums.vue` no longer renders `<SmartViewCard>`. The smart branch of the grid's
`v-for` is an inline `<div class="album-card" data-test="album-smart-card">` containing:

- `.album-cover` with a **single** cover from `seeds[0]`. Empty/missing seeds fall through to the
  same `.album-cover-fallback` + `.album-cover-icon` svg the manual card uses — never an `<img>`
  with an empty `src`.
- `.al-smart-badge` (sparkles svg + `photosSvBadgeSmartView`) top-left of the cover.
- `.al-live-dot` top-right, `:data-paused="!live"`, `:title` = Live/Paused, wrapping `<span class="live-dot">`.
- `.album-title` = the smart view's name.
- `.album-meta` = photo count · separator dot · Live/Paused.

The collage, the condition chips and the threshold pill are gone from the card face.

New helper `smartCoverUrl(sv)` (script) mirrors the target's `smartCoverUrl`: `seeds[0]` → the
shared `service.photos.thumbnailUrl(seed, 'large')`, `''` when there is no seed.

### b. Create tile matches an album card's total height

`.album-create` became the same vertical flex column as `.album-card` (`gap: 8px; padding: 4px`),
the dashed frame moved inward to a new `.album-create-cover` (which keeps the `4 / 5` aspect ratio,
the dashed border and the hover transition, now driven by `.album-create:hover .album-create-cover`),
and two `aria-hidden` lines with `style="visibility:hidden"` — one `.album-title`, one `.album-meta`,
each holding `&nbsp;` — pad the tile out. **No hardcoded pixel height anywhere**; the tile follows
the theme's font metrics exactly as the target intends.

### c. Component deleted

`src/photos/components/SmartViewCard.vue` and `src/photos/components/__tests__/SmartViewCard.test.ts`
are deleted. Verified beforehand that `PhotosAlbums.vue:411` was the only production consumer; every
other repo hit is a comment citing it as a precedent (MomentCard, PhotosFilterChip,
SmartViewCreateDialog, PhotosSearch, dateRange.ts, …) or its own test.

### d. Data layer untouched

`buildMixedAlbums`, `sortMixed`, `item.kind`, and the grid's `:key` are byte-for-byte unchanged.

---

## 2. The `#116` follow-up fix — confirmed ported

The second sub-commit of `9f7e941f` is
`fix(photos-ui): al-live-dot 显式补呼吸点样式(后代选择器不匹配的空心点缺陷)`. What it fixed: **no
bare `.live-dot` rule existed anywhere** — every `.live-dot` rule was a descendant selector bound to
some other ancestor (`.sv-collage-status .live-dot`, `.live-pill .live-dot`, …), so the dot placed
inside the new `.al-live-dot` bubble inherited no size, no colour and no animation and painted as a
hollow ring. Vue 2 had to restate the dot's spec explicitly for that context.

Ported as:

```css
.al-live-dot .live-dot { width: 6px; height: 6px; border-radius: 50%; … animation: pulse 1.6s infinite; }
.al-live-dot[data-paused="true"] .live-dot { … animation: none; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
```

In this repo the same trap is worse, not better: scoped SFC styles do not cross component
boundaries at all, so after deleting SmartViewCard.vue there was no `.live-dot` rule left in the
whole page. The `@keyframes pulse` had to come along too (it lived in the deleted component).

Guarded by a source-text test (`styles the breathing dot explicitly inside .al-live-dot`) rather
than left unobservable — see mutation 3 below.

---

## 3. TDD evidence

### RED

Command: `pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts`

```
 Test Files  1 failed (1)
      Tests  14 failed | 34 passed (48)
```

The 14 failures (all before any implementation existed):

```
 FAIL … mixed grid (SP15-P2b) > renders smart albums and manual albums in one grid
 FAIL … mixed grid (SP15-P2b) > opens the smart view detail route when a smart card is clicked
 FAIL … mixed grid (SP15-P2b) > renders both a manual album and a smart view that share the same raw id, across a re-sort
 FAIL … smart card shape (Task 10) > renders a smart album with the same card shape as a manual album
 FAIL … smart card shape (Task 10) > uses the first seed as the smart card cover, and only that one
 FAIL … smart card shape (Task 10) > falls back to the neutral cover when the smart view has no seeds
 FAIL … smart card shape (Task 10) > shows the smart badge and the live dot on the cover
 FAIL … smart card shape (Task 10) > shows the paused state in both the dot and the meta row
 FAIL … smart card shape (Task 10) > puts the photo count and the live state in the meta row
 FAIL … smart card shape (Task 10) > no longer puts conditions or the threshold on the card face
 FAIL … smart card shape (Task 10) > opens the smart view detail when the card is clicked, with a numeric wire id too
 FAIL … smart card shape (Task 10) > gives the create tile the same total height as an album card
 FAIL … smart card shape (Task 10) > styles the breathing dot explicitly inside .al-live-dot (the #116 follow-up fix)
 FAIL … smart card shape (Task 10) > does not use --on-accent for the badge sitting on the cover photo
```

### GREEN

`pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts src/i18n/parity.test.ts src/styles`

```
 Test Files  6 passed (6)
      Tests  1129 passed (1129)
```

Verbose run (`--reporter=verbose`) — output is pristine. The only stderr is the repo's known
pre-existing pattern from this file creating its own `createI18n` beside the setup singleton,
7 lines × 48 tests, identical before and after this task:

```
 48 [Vue warn]: Component "i18n-t" has already been registered in target app.   (× the 7 i18n registrations)
```

No duplicate-key warnings, no vue-router "no match" warnings, no prop warnings.

Two intermediate reds worth recording (both my own mistakes, both fixed):

1. `does not use --on-accent…` failed at first because **my own explanatory comment names the token
   it rules out**. Fixed by stripping block comments in the test's `styleBlock()` helper (the deleted
   test did the same thing via `cssCascade.extractStyleBlock`).
2. `color-guard.test.ts` reddened on the string `#116` inside a CSS comment — `#[0-9a-fA-F]{3,8}` reads
   it as a hex literal. The comment now cites the SHA `9f7e941f` instead. (Worth remembering: PR
   numbers are hex-shaped.)

### Gates after implementation

| Gate | Result |
|---|---|
| `pnpm exec vitest run` (full) | **685 files / 10955 tests, 0 failures** |
| `pnpm exec vue-tsc --noEmit` | exit 0 |
| `pnpm exec vitest run oss/` (post-commit) | **8 files / 149 tests passed** |
| `git diff --cached \| grep -nP '^\+.*[\x{4e00}-\x{9fff}]'` | 0 hits |

Note: one pre-commit full-suite run showed `src/home/components/DesktopContextMenu.test.ts >
handles a right-click on blank canvas` failing. It passes in isolation and passed in the final full
run; it is an unrelated load-dependent flake in a file this task does not touch.

---

## 4. Mutation results

### Mutation 1 — remove the `kind` prefix from `:key` (`item.kind + '-' + item.id` → `item.id`)

**First attempt: DID NOT REDDEN.** The test I wrote from the brief ("both cards render, correct
titles, across a re-sort") passed 48/48 with the prefix removed. Reporting that plainly, as
instructed, along with what I then measured.

**Why the brief's premise is incomplete.** Duplicate keys do not corrupt this grid's *output*. Two
reasons stack:

- A duplicate key is only consulted on an **update** (`patchKeyedChildren`), never on the initial
  mount — so any single-render assertion is dead on arrival.
- On update, the `<template v-for>` key lands on a per-item **Fragment**, and each `v-if` branch
  inside carries its own compiler-generated key (`0` for smart, `1` for manual). So when a colliding
  smart fragment is patched into a manual one, the branch keys differ, the subtree is unmounted and
  rebuilt **from the new vnode** — and the rendered text is therefore always correct. The
  duplicate-key dev warning also never fires here (the 2-item reorder is fully absorbed by the
  sync-from-start pass, so Vue never builds `keyToNewIndexMap`).

**What *is* observable.** I probed it with a throwaway test (fixture: manual album id `'1'` +
smart view id `'1'`, default `created` sort → switch to `name`, comparing DOM element identity):

| | text after re-sort | smart card element reused | manual card element reused | duplicate-key warning |
|---|---|---|---|---|
| with `kind` prefix | `['Manual One','Smart One']` ✅ | **true** (moved) | **true** (moved) | none |
| without prefix | `['Manual One','Smart One']` ✅ | **false** (rebuilt) | **false** (rebuilt) | none |

So the prefix is load-bearing, just not for correctness: without it every re-sort **tears both
colliding cards down and recreates them** instead of moving them, which means each cover `<img>` is a
brand-new element the browser has to fetch and decode again (visible flicker on a real library).

**Test rewritten accordingly** — `moves, rather than rebuilds, a manual album and a smart view that
share the same raw id` asserts DOM element identity across the re-sort, keeping the title assertion
as a sanity check with an explicit comment saying the titles alone guard nothing.

**Re-run of mutation 1 against the rewritten test: REDDENS.**

```
 FAIL … > moves, rather than rebuilds, a manual album and a smart view that share the same raw id
 AssertionError: the smart card was rebuilt instead of moved: expected <div …> to be <div …>
      Tests  1 failed | 47 passed (48)
```

### Mutation 2 — render an `<img>` even with an empty src (drop the `v-if` on the cover img)

**REDDENS.**

```
 FAIL … > falls back to the neutral cover when the smart view has no seeds
      Tests  1 failed | 47 passed (48)
```

### Mutation 3 — delete the explicit `.al-live-dot .live-dot` rules (the `#116` follow-up fix)

The brief anticipated this being unobservable in jsdom. It is unobservable *by rendering*, so I made
it observable by source text instead — the technique `color-guard.test.ts` and
`photosGlassSurfaces.test.ts` already use for CSS no unit test can see.

**REDDENS.**

```
 FAIL … > styles the breathing dot explicitly inside .al-live-dot (the #116 follow-up fix)
 AssertionError: no explicit .al-live-dot .live-dot rule -- the dot renders as a hollow ring
      Tests  1 failed | 1119 passed (1120)   (run included src/styles)
```

The file was restored from a pristine backup after each mutation and the prefix/markup re-verified
by grep each time.

---

## 5. Assertion disposition table

### From the deleted `src/photos/components/__tests__/SmartViewCard.test.ts` (21 assertions/its)

| # | original | disposition |
|---|---|---|
| 1 | 结构清点 → `.sv-collage/.sv-collage-badge/.sv-collage-status/.sv-name/.sv-conds/.sv-stats/.sv-thresh-mini` | → **new home**: `renders a smart album with the same card shape as a manual album` (asserts the *replacement* structure: `.album-card` + `.album-cover` + `.album-title` + `.album-meta`, and `.sv-card` absent) |
| 2 | D15: `seeds.length === 0` → 3 placeholders, 0 img | **deleted** — the collage is gone; its one invariant that survives (never an empty-src `<img>`) is re-homed, see #5 |
| 3 | D15: `seeds.length === 1` → 1 img + 2 placeholders | **deleted** — collage gone |
| 4 | D15: `seeds.length === 2` → 2 img + 1 placeholder | **deleted** — collage gone |
| 5 | D15: `seeds.length >= 3` → 3 img | **deleted as written**; replaced by `uses the first seed as the smart card cover, and only that one` (exactly one `<img>`, from `seeds[0]`) + `falls back to the neutral cover when the smart view has no seeds` |
| 6 | `thumbnailUrl` called with `(seeds[i], 'large')` | → **new home**: `uses the first seed as the smart card cover, and only that one` — asserts `('seed-a','large')` **and** that `seed-b` is never requested |
| 7-9 | condition chips: 2 chips / 3 chips / 7 chips → `+4` | **deleted** — chips are off the card face by design. Replaced by the negative assertion `no longer puts conditions or the threshold on the card face`. Chip rendering itself is still covered on the detail page (`PhotosSmartViewDetail.test.ts`) |
| 10 | status pill `live: true` → copy + `data-paused="false"` | → **new home**: `shows the smart badge and the live dot on the cover` |
| 11 | status pill `live: false` → copy + `data-paused="true"` | → **new home**: `shows the paused state in both the dot and the meta row` (the dot *and* the meta row, since the state now appears twice) |
| 12-13 | `addedThisWeek` 0 → hidden / >0 → rendered with the number | **deleted** — Vue 2's unified card has no "+N this week" element at all. Deliberate 1:1, not an omission |
| 14 | click → `emit('open', 'sv-abc')` | → **new home**: `opens the smart view detail route when a smart card is clicked` (already existed in PhotosAlbums.test.ts; selector updated) |
| 15 | numeric wire id `7` → emits `'7'` | → **new home**: `opens the smart view detail when the card is clicked, with a numeric wire id too`. The `String()` guard moved: it is now the store's `id: String(r.id)` (smartViews.ts:98), so the test asserts the end-to-end route rather than the mechanism |
| 16 | source-text: `toLocaleString(` has a locale argument | **deleted** — the unified card renders the count through vue-i18n interpolation, exactly as Vue 2 does (`$t('{n} photos', { n })`). There is no `toLocaleString` on this card |
| 17 | both locales render `count=1234` as `1,234` | **deleted** — same reason. The thousands separator was a registered *New-UI addition* on the old collage card; the target's unified card shows the raw number. Removing it restores 1:1 |
| 18 | `.sv-collage-badge`/`.sv-collage-status` rule bodies don't contain `--on-accent` | → **new home**: `does not use --on-accent for the badge sitting on the cover photo` (same reasoning, new class) |
| 19 | every `theme-exception` comment is free of `;` `}` `#` | **deleted** — it scanned a file that no longer exists. The identical risk in `PhotosAlbums.vue` is caught by `color-guard.test.ts` itself: a `;` inside a theme-exception comment closes the exemption window early, so the literal on the next line is reported as an offender (this is how the guard is written, `color-guard.test.ts:129-136`) |
| 20 | `.sv-name` has `text-overflow: ellipsis`, `.sv-meta` has `min-width: 0` | **deleted** — both were registered New-UI additions beyond Vue 2. The unified card uses `.album-title`, which does not truncate — same as the manual card next to it, and same as the target. Returning to 1:1 |
| 21 | `.sv-collage-overlay` uses `linear-gradient` | **deleted** — no collage, no gradient scrim (the badge/dot now carry their own backgrounds instead) |

### From `src/views/__tests__/PhotosAlbums.test.ts` (existing assertions touching the old card)

| original | disposition |
|---|---|
| `renders smart albums and manual albums in one grid` → `[data-test="sv-card"]` × 1 | **kept, selector re-homed** to `[data-test="album-smart-card"]` |
| `opens the smart view detail route when a smart card is clicked` → `[data-test="sv-card"]` | **kept, selector re-homed** |
| `renders both a manual album and a smart view that share the same raw id` (counted 1 `album-card` + 1 `sv-card`) | **rewritten and renamed** → `moves, rather than rebuilds, a manual album and a smart view that share the same raw id`; the count assertions survive, and the DOM-identity assertions are added because the counts alone do not redden under the mutation (§4) |

### One assertion elsewhere, deliberately left alone

`src/views/PhotosSmartViews.moments.test.ts:276` — `expect(w.findAll('[data-test="sv-card"]')).toHaveLength(0)`.
That selector is now produced by nothing, so the assertion is **vacuous**. Left untouched: it belongs
to Task 5's "everything the smart-view list used to own is gone from this page" block, whose three
sibling assertions (`sv-hero-create`, `sv-create-card`, `sv-skeleton`) are equally historical;
rewriting one of four in this task would be arbitrary scope creep. Flagged here so it is a known
vacuity rather than a silent one.

---

## 6. i18n — new vs existing

**Zero new keys.** Every string on the new card reuses an existing pair (both files, so
`parity.test.ts` is untouched and passes):

| key | zh_cn / en_us | pre-existing? |
|---|---|---|
| `photosSvBadgeSmartView` | 智能视图 / Smart View | **existed** (was SmartViewCard's badge) |
| `photosSvLive` | 即时生效 / Live | **existed** |
| `photosSvPaused` | 已暂停 / Paused | **existed** |
| `photosPeoplePhotosCount` | `{n} 张照片` / `{n} photos` | **existed** — see note |
| `photosAlbumNew`, `photosAlbumNewHint` | — | **existed** (create tile, unchanged) |

**Note on the count key.** Vue 2's unified card deliberately uses `{n} photos` here, *not* the manual
card's `{n} items` (target :141 vs :162). Grepping the locale files for that meaning found two exact
matches — `photosPeoplePhotosCount` and `photosPlacesPhotoCount`, both `{n} photos` / `{n} 张照片`,
and both matching Vue 2's own `zh_CN.json` translation of `{n} photos` verbatim. Per the instruction
to reuse rather than add, I reused `photosPeoplePhotosCount`. Its "People" prefix is cosmetic: this
repo already consumes it well outside the People page (`PhotosFavorites.vue:231` and `:239` for
face/place counts, `PersonPlacesTab.vue:86`, `ClusterActionDialog.vue:220`). Registered in a comment
at the call site.

---

## 7. Where the Vue 2 source disagreed with the brief

| # | brief said | target / measurement said | followed |
|---|---|---|---|
| 1 | "add a test with a manual album and a smart view sharing the same raw id, asserting both cards render" — and mutation-check it | Asserting that **does not redden**. Duplicate keys never corrupt this grid's output (per-branch `v-if` keys rebuild the subtree from the new vnode); what breaks is DOM element identity — cards are rebuilt instead of moved | **measurement**. Test asserts DOM identity; full analysis in §4 |
| 2 | mutation 3 "if no test covers it, say it is CSS-only and unobservable in jsdom" | It is unobservable *by rendering*, but perfectly observable by source text — the technique two existing guards in this repo already use | **made it observable**; mutation 3 reddens |
| 3 | brief did not mention the meta-row count key | Target uses `{n} photos` for the smart card, distinct from the manual card's `{n} items` | **target** (`photosPeoplePhotosCount`) |
| 4 | brief did not mention a tooltip on the dot | Target has `:title="live ? Live : Paused"` on `.al-live-dot` | **target** — ported, and asserted |
| 5 | brief listed only `SmartViewCard.vue` markup changes | Target also moves `@keyframes pulse` into scope: it lived in the deleted component, and scoped SFC styles do not cross component boundaries in this repo | **target** — keyframes restated in `PhotosAlbums.vue` |
| 6 | (implicit) `rgba(255,255,255,0.55)` for the fallback icon | This repo already maps that surface to `.album-cover-icon { color: var(--on-accent); opacity: .7 }` on the manual card | **repo token** — the smart card reuses the manual card's fallback markup verbatim, so zero new colour |

---

## 8. Files changed

- `src/views/PhotosAlbums.vue` (+141 / −16 net) — import removed, `smartCoverUrl()` added, smart
  card markup inlined, create tile restructured, `.al-smart-badge` / `.al-live-dot` /
  `.al-live-dot .live-dot` / paused variant / `@keyframes pulse` / `.album-create-cover` styles added.
- `src/views/__tests__/PhotosAlbums.test.ts` (+199 / −22) — 3 assertions re-homed, 11 tests added.
- `src/photos/components/SmartViewCard.vue` — **deleted** (299 lines).
- `src/photos/components/__tests__/SmartViewCard.test.ts` — **deleted** (248 lines).

Not touched, as instructed: `oss/manifest.mjs` (verified unnecessary — `'src/photos'` at :90 is a
whole-directory entry and `oss/photosStripCoverage.test.mjs` scopes to `src/views`,
`src/views/__tests__`, `packages/service/src`), `src/photos/util/mixedAlbums.ts`, the stores.

---

## 9. Self-review

- **Card shape** — single cover, badge, dot, title, meta; collage/chips/threshold off the face. ✅
- **Create tile** — `.album-create-cover` + two invisible lines, no hardcoded height. ✅
- **Component deleted** — plus its test; last consumer removed first. ✅
- **Live-dot follow-up fix** — ported and guarded. ✅
- **No newly authored Chinese** — `git diff --cached | grep -nP '^\+.*[\x{4e00}-\x{9fff}]'` → 0 hits.
  Three hits appeared on the first pass (a quoted zh locale value, the Vue 2 commit subject, a
  deleted test's describe name); all three rewritten in English rather than argued into the i18n carve-out. ✅
- **No colour literals outside `theme-exception`** — `src/styles/color-guard.test.ts` green. The four
  literals I added (`#fff` on the badge, `rgba(0,0,0,.55)` on the bubble, `#34C759` / `#FF9F0A` on the
  dot) each carry a theme-exception comment naming the precedent (`PhotosGrid.vue .tile-vid`), matching
  what the deleted component did for the identical surfaces. The badge background is
  `color-mix(in srgb, var(--accent) 85%, transparent)` — token-driven, no exemption needed. ✅
- **No `*` immediately before `/` in CSS comments** — checked; `color-guard.test.ts`'s comment-integrity
  suite green. ✅
- **Empty-seed path** — renders `.album-cover-fallback`, never an `<img>`; asserted, and mutation-verified. ✅
- **YAGNI / data layer** — `git diff` shows no change to `mixedAlbums.ts`, `item.kind`, or the stores. ✅
- **Fixtures** — `mountAlbums()`, `svc` hoisted mock, `makeRouter()`, `push` spy all reused verbatim
  from the existing file; no invented helpers beyond a local `styleBlock()` for the two source-text tests. ✅

## 10. Concerns

1. **The `:key` prefix guard is weaker than the phase assumed.** It protects DOM reuse (image
   re-fetch / flicker on re-sort), not rendered correctness. If a later task wants a correctness
   guarantee out of that key it will not find one — the per-branch `v-if` keys already provide it.
   Recorded in the code comment at the `v-for` so the next reader does not re-derive it.
2. **Dangling precedent comments.** Six files still cite `SmartViewCard.vue` by name in comments
   (MomentCard, PhotosFilterChip, SmartViewCreateDialog, PhotosSearch, SearchPeoplePopover,
   dateRange.ts, plus `photosGlassSurfaces.test.ts:10`). The brief said this is expected and not to be
   swept; leaving them, but they now point at a deleted file.
3. **`PhotosSmartViews.moments.test.ts:276` is now a vacuous assertion** (see §5). Left in place with
   a rationale rather than silently.
4. **Not verified on a real device.** jsdom neither cascades nor paints, so the visual outcome the
   whole task is about — badge/dot positioning over a 4:5 cover, the breathing animation, and whether
   the create tile's two invisible lines really land it at an album card's exact height — is asserted
   only by source text. Worth one screenshot at acceptance, at both themes.

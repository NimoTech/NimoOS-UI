# Task 6 report: 网格三态渲染(unloaded months render as sized skeletons)

## Fix round (review came back "Needs fixes")

Two findings, both in `src/photos/components/PhotosGrid.vue`.

### Important 1 — skeleton invisible in the default (dark/glass) theme

**Root cause confirmed as described.** `:root`'s `--chip-bg` (`theme.css:220`) is
`linear-gradient(160deg, rgba(255,255,255,0.26), rgba(255,255,255,0.1))` — a gradient with
no solid-color component. `background: var(--chip-bg)` is shorthand, so it resets
`background-color` to transparent; the very next declaration,
`background-image: linear-gradient(...)` (the sweep), then overwrote the chip-bg gradient's
own `background-image` contribution entirely — leaving only the sweep visible in the dark
theme. Light theme happened to look fine because there `--chip-bg` is a plain color
(`#ffffff`, `theme.css:346`), which lives in `background-color`, untouched by the
`background-image` collision.

**Fix**: moved the sweep onto a `::after` pseudo-element, layered on top of the surface
instead of colliding with it.

```css
.month-skeleton {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: var(--chip-bg);
}
.month-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: linear-gradient(90deg, transparent 0%, var(--hover) 50%, transparent 100%);
  background-size: 40% 100%;
  background-repeat: no-repeat;
  animation: month-skeleton-sweep 1.4s ease-in-out infinite;
}
@keyframes month-skeleton-sweep { 0% { background-position: -40% 0; } 100% { background-position: 140% 0; } }
@media (prefers-reduced-motion: reduce) { .month-skeleton::after { animation: none; } }
```

`.month-skeleton` itself now owns only `background: var(--chip-bg)` (its full gradient or
solid color survives, whichever the theme defines); `::after` owns only the sweep's
`background-image`/`background-size`/`background-repeat`/`animation`. `overflow: hidden` +
`position: relative` on the parent clips the full-bleed `inset: 0` pseudo-element to the
parent's rounded corners. `prefers-reduced-motion` guard moved to target `::after` (that's
where the animation now lives). Still only `var(--chip-bg)` / `var(--hover))` — no new color
literals.

**Verified in a real headless Chromium render, not by reading.** Used the cached Playwright
Chromium binary at `/home/nimo/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`
(confirmed present and executable on this machine). Built a minimal static HTML page
(`/tmp/claude-1000/.../scratchpad/skeleton-check.html`) that inlines the **fixed**
`.month-skeleton`/`::after`/`@keyframes` rules exactly as landed in `PhotosGrid.vue`, plus
the `:root` and `:root[data-theme="light"]` values of `--chip-bg`/`--hover` copied verbatim
from `src/styles/theme.css` (lines 56/220 for dark, 346/445 for light). A page-load script
toggles `data-theme` and reads `getComputedStyle` for the element and its `::after`, then
writes the result into `document.title` (a reliable way to exfiltrate values from
`--dump-dom` headless output). Ran:

```
chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=2000 --dump-dom file://.../skeleton-check.html
```

Extracted `<title>` JSON:

```json
{
  "dark":  { "backgroundColor": "rgba(0, 0, 0, 0)",
             "backgroundImage": "linear-gradient(160deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.1))",
             "afterBackgroundImage": "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(0, 0, 0, 0) 100%)" },
  "light": { "backgroundColor": "rgb(255, 255, 255)",
             "backgroundImage": "none",
             "afterBackgroundImage": "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(28, 27, 25, 0.043) 50%, rgba(0, 0, 0, 0) 100%)" }
}
```

Reading this: in the dark theme, the element's own `background-image` is now the full
`--chip-bg` gradient (survives intact — no collision), and its `::after` carries the sweep
gradient using `--hover`'s dark value. In the light theme, the element's own
`background-color` is the solid `--chip-bg` white (survives — `background: var(--chip-bg)`
with a plain color sets `background-color`, not `background-image`, so `backgroundImage:
"none"` here is correct and expected), and `::after` carries the sweep using `--hover`'s
light value (`0.043` vs. the source `0.045` — float rounding in Chromium's serialization,
not a bug). **Both themes now show both layers**: surface + sweep, confirming the fix.

Also took screenshots of two follow-up static pages (one per theme, sweep frozen at
`background-position: 50% 0` instead of animating, so the highlight band is visible in a
single frame) via `chrome --headless=new --screenshot`. Dark render: a visibly lighter
diagonal-glass tile with a brighter vertical highlight band through the middle third. Light
render: a white card with a faint warm-grey highlight band through the middle third. Visually
confirms neither theme is a "faint smudge" or a blank rectangle.

### Minor 2 — false comment on `wrapWidth`

Corrected the comment that claimed resize re-triggers the estimate (nothing in this file
listens for resize; `measureWrap()` runs once, at mount):

```ts
// Container width drives the column count (auto-fill/minmax), so it is read from
// the scroll wrap. Measured once at mount below; re-measuring on resize/window
// changes is not wired up yet (Task 7 owns the observer that will do it).
const wrapWidth = ref(0)
```

Left `MONTH_HEAD_HEIGHT`'s unused import untouched, per the coordinator's instruction (Task
7 either uses or removes it).

### Re-ran covering tests (foreground)

`pnpm test src/photos/components/__tests__/PhotosGrid.test.ts`:
```
Test Files  1 passed (1)
     Tests  34 passed (34)
```

`pnpm exec vue-tsc --noEmit`: no output, clean exit.

Also re-ran `pnpm test src/photos/util/__tests__/gridMetricsCssParity.test.ts` as a sanity
check that the grid's `minmax`/gap/`padding-right` numbers were untouched by this fix (they
weren't touched at all — only `.month-skeleton`'s own rules and one comment changed):
```
Test Files  1 passed (1)
     Tests  4 passed (4)
```

Committed separately on top of `634c332` (not amended, per the review flow): `8ef1b0e` —
"fix(photos): layer month-skeleton sweep on ::after instead of overwriting chip-bg".

## What was implemented (original round)

Followed the brief (`task-6-brief.md`) verbatim.

1. **`src/photos/util/assetToPhoto.ts`** — widened the `Month` interface with three
   optional fields: `loaded?: boolean`, `count?: number`, `videoCount?: number`, with the
   comment spelling out the `loaded === undefined` ⇒ "already loaded" contract for legacy
   and synthetic (favorites/place-assets) consumers.

2. **`src/photos/util/timelineBuckets.ts`** — collapsed `bucketToMonth`'s return type from
   the intersection `Month & { loaded: boolean; count: number; videoCount: number }` back
   to plain `Month`, now that `Month` itself carries those fields.

3. **`src/photos/stores/timeline.ts`** — removed the store-local `TimelineMonth` type
   alias (`Month & { loaded?: boolean; count?: number; videoCount?: number }`) and changed
   `months = computed<TimelineMonth[]>(...)` to `computed<Month[]>(...)`. Verified first
   (via a research subagent) that `TimelineMonth` was declared only in this file, used only
   as that one generic parameter, never exported/imported elsewhere — so this is a pure
   type simplification with zero behavior change, matching the brief's "only if" condition.

4. **`src/photos/components/PhotosGrid.vue`**:
   - Imported `estimateSectionBodyHeight`, `skeletonItemCount`, `MONTH_HEAD_HEIGHT` from
     `../util/gridMetrics` (per brief; `MONTH_HEAD_HEIGHT` is currently unused in this
     task's code — it's declared for Task 7/8 consumers per the brief's exact import line).
   - Added `(e: 'need-bucket', key: string): void` to `defineEmits` — declared only, never
     fired (Task 7 wires the `IntersectionObserver` that fires it).
   - Added `wrapWidth` ref + `measureWrap()`, and four helpers: `skeletonCountOf`,
     `hasContent`, `anyContent` (computed), `sectionBodyHeight`, `isLoaded`.
   - `onMounted` now calls `measureWrap()` once and picks the first month via `hasContent`
     instead of `filtered.length > 0`.
   - Template: empty-state `v-if="!anyContent"`; month container `v-if="hasContent(m)"`;
     month-count shows `isLoaded(m) ? m.filtered.length : skeletonCountOf(m)`; the tile
     grid is now behind `v-if="isLoaded(m)"` with a sibling `v-else` `.month-skeleton` div
     carrying `data-test="month-skeleton"` and an inline `:style="{ height: ... + 'px' }"`;
     scrubber `v-if="anyContent"`.
   - Added `.month-skeleton` CSS (shimmer using `var(--chip-bg)` / `var(--hover)`, no new
     literals) with `@keyframes month-skeleton-sweep` and a `prefers-reduced-motion` guard.
     Did not touch `.grid`/`minmax`/gap/padding-right numbers (CSS-parity guard untouched).

5. **`src/photos/components/__tests__/PhotosGrid.test.ts`** — appended the 7 tests from the
   brief verbatim (`bucketMonth` helper + `describe('PhotosGrid bucket-mode skeletons', ...)`).

## TDD evidence

**RED** — `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts` (after adding only
the tests, before touching `PhotosGrid.vue`):

```
Test Files  1 failed (1)
     Tests  4 failed | 30 passed (34)
```
4 failures, all in the new `describe` block:
- `renders a sized skeleton for an unloaded month instead of the empty state` — empty-state
  rendered (`expected true to be false`), confirming the pre-fix empty-state condition fires
  on an all-unloaded bucket.
- `keeps the month head visible on a skeleton, with the estimated count` — `.month-title`
  didn't exist (`Cannot call text on an empty DOMWrapper`), confirming the month container's
  `v-if` never renders for an unloaded month.
- `renders the month container so jump anchors exist before anything loads` — `#m-2026-08`
  absent.
- `keeps the scrubber visible while every month is still a skeleton` — `.scrubber` absent.

The other 3 new tests (doc-tab hides unloaded month, empty months array, loaded/legacy
months render tiles) passed even before the fix, since those paths were unaffected by the
bug — expected, and unchanged by the fix.

**GREEN** — `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts` (after the fix):

```
Test Files  1 passed (1)
     Tests  34 passed (34)
```
All 27 pre-existing cases plus all 7 new cases pass, unchanged.

**Type check** — `pnpm exec vue-tsc --noEmit`: no output, exit clean.

**Regression sweep** — `pnpm test src/photos src/views/__tests__`:

```
Test Files  130 passed (130)
     Tests  2653 passed (2653)
```
First run of the sweep hit vitest's "Errors 1 error / ELIFECYCLE Test failed" from an
unrelated, pre-existing flake: a leftover `setTimeout` in `src/photos/stores/smartViews.ts`
(`previewSmartView`) firing after `PhotosAlbums.test.ts` had already completed and torn
down its mock, throwing `service.photos.previewSmartView is not a function` as an unhandled
exception (not attached to any assertion — all 2653 tests still reported passed). Verified
this is pre-existing and unrelated to this task: stashed all Task 6 changes, ran
`pnpm test src/views/__tests__/PhotosAlbums.test.ts` alone on the clean baseline (48/48
pass, no exception in isolation — it's a cross-file timer leak that only surfaces when
run alongside other files in the same worker), then `git stash pop` to restore the work.
A second full-sweep run with the Task 6 changes in place completed clean with no unhandled
exception and exit 0 — confirms the flake is intermittent/order-dependent, not caused by
this task's code.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/util/assetToPhoto.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/util/timelineBuckets.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/stores/timeline.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/components/PhotosGrid.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/components/__tests__/PhotosGrid.test.ts`

Commit: `634c332` — "feat(photos): render unloaded months as sized skeletons"

## Self-review checklist (from the task prompt)

- **Unloaded month renders a skeleton with positive inline height**: confirmed by test
  (`sk.attributes('style')` height parsed > 0). In jsdom, `wrapRef.value.clientWidth` is
  always 0, so `estimateSectionBodyHeight` falls back to `FALLBACK_CONTAINER_WIDTH` (1200)
  per `gridMetrics.ts`'s existing design — never zero from a zero container width.
- **Month head still shows the estimated count on a skeleton**: confirmed
  (`.month-count` contains "9" for count=12, videoCount=3, photo tab → 12-3=9).
- **`#m-<key>` anchors exist before anything loads**: confirmed
  (`#m-2026-08` present with zero loaded photos).
- **Scrubber survives an all-skeleton first paint**: confirmed (`.scrubber` and
  `.scrubber-tick` elements present with two fully-unloaded months).
- **Doc tab hides unloaded months**: confirmed — `skeletonItemCount` returns 0 for
  `tab==='doc'` (no directory counter by design), so `hasContent` is false and the
  empty-state renders instead.
- **Empty `months` array still shows the empty state**: confirmed.
- **Legacy and synthetic groups are untouched**: confirmed by two dedicated tests
  (`loaded: true` explicit month, and a `month()`-helper legacy group with no `loaded`
  field at all) — both render real tiles, no skeleton, `isLoaded` returns true for
  `loaded === undefined` per the documented contract.
- **All pre-existing PhotosGrid.test.ts cases pass unchanged**: confirmed, 27/27 plus the
  new 7 = 34/34.
- **Test output pristine**: focused run and type check are silent/clean; the full sweep
  carries only the pre-documented, unrelated jsdom `Not implemented: navigation` noise and
  (intermittently, order-dependent) the pre-existing `previewSmartView` timer flake — neither
  touches PhotosGrid or this task's files, and the final sweep run completed with exit 0
  and zero failing tests.

## Concerns

- `MONTH_HEAD_HEIGHT` is imported into `PhotosGrid.vue` per the brief's exact import
  statement but is not referenced by any code added in this task — it is inert until a
  later task (7/8) uses it, matching the brief's "Consumes" list. `vue-tsc --noEmit` does
  not flag unused imports (no `noUnusedLocals` in `tsconfig.json`), and there is no lint
  script in `package.json` / no `eslint` binary available to double-check separately, so
  this was left as specified rather than second-guessed.
- The `previewSmartView` unhandled-exception noise in the regression sweep is real but
  pre-existing, order-dependent, and outside this task's file scope (`smartViews.ts`,
  triggered from `PhotosAlbums.test.ts`) — flagging it here rather than silently ignoring
  it, in case it becomes a recurring flake worth its own ticket.

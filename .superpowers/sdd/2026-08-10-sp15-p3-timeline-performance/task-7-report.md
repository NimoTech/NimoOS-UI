# Task 7 report: IntersectionObserver windowing + measured height + jsdom fallback

## What I implemented

`src/photos/components/PhotosGrid.vue`:

- New windowing state block (after `isLoaded`): `WINDOW_MARGIN = '200% 0px'`,
  `activeKeys` (reactive `Set<string>` of in-window month keys), `measuredHeights`
  (plain `Map<string, number>`, not reactive — only read while rendering a
  section that just changed), module-scope `observer` handle, `windowingActive`
  ref.
- `onIntersect(entries)`: on enter, adds the key to `activeKeys` and — only if
  the month's `loaded === false` — emits `need-bucket`. On leave, records
  `entry.target.offsetHeight` into `measuredHeights` *before* removing the key
  from `activeKeys` (the removal is what triggers the tiles to unmount on the
  next render), so the height read is always the tiles' own height, never the
  placeholder's.
- `syncObserver()`: disconnects and re-observes every month container that
  `hasContent()`. Deviation from the brief's literal code: the brief used
  `document.getElementById('m-' + m.key)`, but `@vue/test-utils` mounts
  components detached from the live `document` by default, so
  `getElementById` returns null in every test and no test in the FakeIO
  block would have observed anything. Replaced with `wrapRef.value
  .querySelectorAll('.month-group')` filtered by `el.id` against a wanted-set
  — `querySelector`/`querySelectorAll` work on any subtree regardless of
  document attachment. This also sidesteps needing to CSS-escape a month key
  like `2026-08` into an id selector (`CSS.escape` also isn't polyfilled in
  this project's jsdom setup — tried it first, it threw `undefined`).
- `isWindowed(m)`: `!windowingActive.value` (no observer in the environment)
  short-circuits to `true` — pre-windowing behavior. Otherwise checks
  `activeKeys`.
- `placeholderHeight(m)`: returns the measured height or `null` if never
  measured.
- `onMounted`: after the existing `measureWrap()`/`activeMonth` logic, if
  `IntersectionObserver` exists, constructs it with `root: wrapRef.value` and
  the margin, flips `windowingActive`, calls `syncObserver()`.
- New `watch` on `filteredMonths.value.map(m => m.key).join('|')` — re-measures
  the wrap and re-syncs the observer after `nextTick` whenever the month set
  changes (directory refresh adding/removing months).
- `onBeforeUnmount`: `observer?.disconnect(); observer = null`.
- Template: the `isLoaded(m)` branch is now three-way —
  `isLoaded && isWindowed` → real `.grid` tiles;
  `isLoaded && placeholderHeight(m) !== null` → `.month-placeholder` with
  inline `height: <measured>px`;
  else → the Task 6 `.month-skeleton` (estimated height). An unloaded month
  that's out of the window still falls through to skeleton, never placeholder
  — matches the contract ("out of window and never-measured, or `!loaded` ⇒
  skeleton").
- CSS: `.month-placeholder { border-radius: 8px; }` — deliberately no
  `background`/shimmer, since a placeholder is not "loading".

## The two Task 6 loose ends

- **`MONTH_HEAD_HEIGHT` import**: removed. Nothing in this task's
  implementation needed it (heights are either measured via `offsetHeight` or
  come from `sectionBodyHeight`'s existing estimate); left the constant itself
  untouched in `gridMetrics.ts` since its test still covers it.
- **`wrapWidth` resize comment**: decided to wire the `watch` the brief
  specifies (re-measure + re-sync on month-set change) rather than adding a
  real `ResizeObserver`/window-resize listener — that's what the brief's code
  does and what the tests check. Corrected the comment above `wrapWidth` to
  say it's re-measured "whenever the month set changes (see the windowing
  watch below)" and explicitly note there's no resize listener, so a bare
  window resize with an unchanged month set does not re-measure. This avoids
  promising a resize-triggered re-measurement that doesn't exist.

I also found the `isWindowed` comment (as given in the brief) claimed a
container-width-zero fallback ("a display:none container reports width 0")
that the code never actually checks. I traced why: in jsdom, `clientWidth` is
always 0, so if I had added that check it would force `isWindowed` to always
return `true`, which contradicts (and breaks) the "swaps a rendered month for
a measured placeholder" / "renders tiles again" tests — those tests deliberately
control windowing via the FakeIO instance regardless of `wrapWidth`. Since the
width-zero branch isn't implemented and isn't tested, I rewrote the comment to
only claim what the code does (no-observer fallback), rather than leave a
comment describing behavior that isn't there — this is exactly the kind of
false comment the brief's own instructions warned against repeating.

## TDD evidence

**RED** — `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts`
(after appending the brief's Step 1 test block verbatim, before touching the
component):
```
Test Files  1 failed (1)
     Tests  7 failed | 35 passed (42)
```
All 7 new `PhotosGrid windowing` cases failed with
`TypeError: Cannot read properties of undefined (reading 'fire'/'targets')`
— `FakeIO.instances[0]` was `undefined` because nothing ever constructed an
`IntersectionObserver`. Expected: no observer wired yet, no `need-bucket` ever
emitted.

**GREEN** — after implementing (with the `document.getElementById` →
`querySelectorAll('.month-group')` fix and the comment correction):
```
$ pnpm test src/photos/components/__tests__/PhotosGrid.test.ts
Test Files  1 passed (1)
     Tests  42 passed (42)

$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

**Wide regression sweep** (brief Step 5):
```
$ pnpm test src/photos src/views/__tests__
Test Files  130 passed (130)
     Tests  2661 passed (2661)
```
Console noise: several `Error: Not implemented: navigation (except hash
changes)` from jsdom inside `favorites.test.ts` (`exportZip`'s
`location.href` assignment) — this is a pre-existing, documented non-defect
(listed in the task's "known non-defects"), unrelated to this change, and
does not fail any test.

Also ran the CSS-numbers guard directly since I touched the same component's
`<style>` block:
```
$ pnpm test src/photos/util/__tests__/gridMetricsCssParity.test.ts
Test Files  1 passed (1)
     Tests  4 passed (4)
```

## Files changed

- `src/photos/components/PhotosGrid.vue`
- `src/photos/components/__tests__/PhotosGrid.test.ts`

Commit: `6aa423d` — "feat(photos): window month sections with an
IntersectionObserver"

## Self-review checklist (per the task's own list)

- Synthetic group never emits `need-bucket`: covered by "never asks for a
  bucket for a group that has no bucket at all" (uses `month()`, `loaded`
  undefined) — passes; guarded in code by `m.loaded === false` (strict,
  not `!m.loaded`).
- Measured height is the tiles' height, not the placeholder's: `onIntersect`
  reads `offsetHeight` in the `else` (leaving) branch *before* `activeKeys`
  loses the key, and the removal from `activeKeys` is what causes the v-if to
  swap to the placeholder on the next render — order is correct by
  construction. **Correction (see "Fix round" below): my original claim that
  the test itself proved this ordering was wrong** — the original static
  `offsetHeight` stub returned 321 regardless of read order, since jsdom does
  no layout and there is no real "placeholder's own height" for a
  wrong-ordered read to fall back to. The test now uses a getter that
  encodes the contract, and I verified by deliberately reversing the
  ordering that the test does fail when it should.
- Re-entering the window brings tiles back: covered, passes.
- Unmount disconnects: covered (`FakeIO.targets` empty after `w.unmount()`).
- A month added by a later `months` change gets observed: covered via the
  `watch` + `syncObserver`.
- No observer ⇒ everything renders, all pre-existing cases pass unchanged:
  35 pre-existing PhotosGrid cases + 130-file/2661-test sweep, all green.
- No dead imports: `MONTH_HEAD_HEIGHT` removed from the import line.
- Test output pristine: only the pre-flagged jsdom navigation noise, no new
  warnings.

## Concerns

- None outstanding. The two deviations from the brief's literal code
  (`document.getElementById` → scoped `querySelectorAll`, and the corrected
  `isWindowed` comment) were both necessary — the first because the brief's
  version could never have passed any of its own tests, the second to avoid
  documenting a fallback path that isn't implemented and can't be added
  without breaking other brief-specified tests.
- Did not verify anything in a real browser: no CSS or visual change was made
  beyond what's already covered by the CSS-numbers guard test and the
  no-hex/no-rgb scan (`.month-placeholder` only sets `border-radius`, no
  color at all), so per the task's own verification note a browser check
  wasn't required here.

## Fix round (review Important 1)

**The problem.** `src/photos/components/__tests__/PhotosGrid.test.ts` line
542's test ("swaps a rendered month for a measured placeholder when it leaves
the window") stubbed `offsetHeight` with a static
`Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 321 })`
on the outer `#m-2026-08` `.month-group` element — the node that survives the
`v-if`/`v-else-if` swap (only its children change). Because jsdom performs no
layout, `el.offsetHeight` is just whatever was defined on it; a static value
answers 321 no matter when it's read, before or after `activeKeys.value = next`
drops the tiles. So an implementation with the read moved to *after* the
tiles are gone — the exact ratchet-down bug the brief warns about — would
have passed this identical assertion. My original report claimed this test
was evidence the ordering was correct; that claim was wrong (the ordering IS
correct, but the test didn't prove it — corrected in the Self-review section
above).

**The fix.** Replaced the static stub with a getter, per the reviewer's
suggested approach:
```ts
Object.defineProperty(el, 'offsetHeight', {
  configurable: true,
  get: () => (el.querySelector('.grid') ? 321 : 0),
})
```
This answers 321 only while the `.grid` tile container is still in the
subtree (i.e. before the tiles are dropped) and 0 once it's gone — so a read
taken at the wrong time surfaces as a 0px placeholder height and fails
`expect(ph.attributes('style')).toContain('321px')`.

**Verifying the guard actually bites.** Per the reviewer's instruction, I
temporarily reversed the ordering in `onIntersect` in `PhotosGrid.vue` (not
committed — reverted after) by collecting the leaving entries into an array,
setting `activeKeys.value = next` first, then reading `offsetHeight` inside
a `nextTick().then(...)` callback (i.e. after Vue has already patched the
DOM and dropped the tiles):

```ts
function onIntersect(entries: IntersectionObserverEntry[]) {
  const next = new Set(activeKeys.value)
  const TEMP_toMeasure: Array<{ key: string; el: HTMLElement }> = []
  for (const entry of entries) {
    const key = keyOf(entry.target)
    if (!key) continue
    if (entry.isIntersecting) { /* unchanged */ }
    else {
      TEMP_toMeasure.push({ key, el: entry.target as HTMLElement })
      next.delete(key)
    }
  }
  activeKeys.value = next
  // TEMP: measure AFTER the reactive drop + DOM patch
  void nextTick().then(() => {
    for (const { key, el } of TEMP_toMeasure) {
      const h = el.offsetHeight
      if (h > 0) measuredHeights.set(key, h)
    }
  })
}
```

RED run with the reversed ordering:
```
$ pnpm test src/photos/components/__tests__/PhotosGrid.test.ts
 FAIL  ... > swaps a rendered month for a measured placeholder when it leaves the window
AssertionError: expected false to be true // Object.is equality
  ❯ ph.exists() -> false (expected true)
Test Files  1 failed (1)
     Tests  1 failed | 41 passed (42)
```
The failure is even sharper than a wrong-height assertion: with the
measurement deferred past the render, `measuredHeights` has nothing recorded
at render time, `placeholderHeight(m)` returns `null`, and the component
falls all the way through to the `.month-skeleton` branch instead of a
placeholder at all — so `ph.exists()` is `false`. This confirms the getter
stub is sensitive to ordering, not just to a hardcoded value.

Reverted `PhotosGrid.vue` to the committed (correct-ordering) version
(`git diff` confirmed clean against `HEAD` before re-testing).

GREEN run with the real (correct-ordering) implementation restored:
```
$ pnpm test src/photos/components/__tests__/PhotosGrid.test.ts
Test Files  1 passed (1)
     Tests  42 passed (42)

$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

Wide regression sweep re-run after the fix:
```
$ pnpm test src/photos src/views/__tests__
Test Files  130 passed (130)
     Tests  2661 passed (2661)
```
(Same pre-existing jsdom `Not implemented: navigation` console noise from
`favorites.test.ts`'s `exportZip`, unrelated to this change.)

**Minor folded in.** `syncObserver()` now prunes `measuredHeights` for any
key no longer present in `filteredMonths.value` before doing anything else
(even before the `if (!observer) return` guard, since the map should be
pruned whenever the month set changes regardless of whether an observer
exists in this environment):
```ts
const currentKeys = new Set(filteredMonths.value.map((m) => m.key))
for (const key of measuredHeights.keys()) {
  if (!currentKeys.has(key)) measuredHeights.delete(key)
}
```

**Files changed in this round:**
- `src/photos/components/PhotosGrid.vue` (measuredHeights pruning only —
  `onIntersect` itself is unchanged from the first commit)
- `src/photos/components/__tests__/PhotosGrid.test.ts` (stub fix)

Commit: `a48df46` — "fix(photos): pin the measure-before-drop ordering with
a stateful stub"

**Concerns:** none outstanding.

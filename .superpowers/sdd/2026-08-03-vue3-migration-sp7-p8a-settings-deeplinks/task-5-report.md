# Task 5 report — 设置页容器 + 路由 + 侧栏入口

## What I implemented

- `src/views/PhotosSettings.vue` (new): routed container at `/photos/settings`, following
  the `PhotosAlbums.vue:184-276` `AreaShell` + `.photos-layout`/`.photos-main` structure
  (deliberately duplicated, not abstracted, per that file's own header comment). Contains:
  hero (title + description + two quick-nav anchors), `<PhotosStorageCard>` +
  `<PhotosAiCard>` wired via `@toast="showToast"`, footer (app/version, device, library-since),
  and a local single-slot toast (2800ms auto-dismiss, timer reset on re-trigger).
- `src/views/__tests__/PhotosSettings.test.ts` (new): 16 tests (container) + 1 route-order test.
- `src/router/index.ts`: added `import PhotosSettings` + appended
  `{ path: '/photos/settings', name: 'photos-settings', component: PhotosSettings }`
  immediately after `/photos/search` (last existing `/photos/*` route), before `/login`.
- `src/photos/components/PhotosSidebar.vue`: added a settings entry (gear SVG + label) in a
  new `<section class="side-settings">` right after the storage bar (visually the bottom of
  the sidebar), `router.push('/photos/settings')` on click. Did **not** touch the `NAV` array
  or its 7 existing items/order.
- `src/photos/components/__tests__/PhotosSidebar.test.ts`: added a `/photos/settings` route
  to the test router + a 2-test `describe('设置入口', ...)` block (existence + click-navigates).

## Fetch split confirmation (interface debt)

- `PhotosStorageCard.vue` (T3): calls `fetchStorage()` itself in its own `onMounted`
  (`:126-127`, unchanged by me).
- `PhotosAiCard.vue` (T4): calls **no** fetch at mount (its one `fetchAbout()` call is inside
  the rebuild-completed toast watcher, unchanged by me).
- `PhotosSettings.vue` (this task) `onMounted`: calls exactly
  `fetchAbout()` / `fetchRetention()` / `fetchScanInterval()` / `fetchAiFeatures()` — **not**
  `fetchStorage()`. Locked by the test `挂载时调用 fetchAbout/fetchRetention/fetchScanInterval/
  fetchAiFeatures 四项,不重复调用 fetchStorage`, which explicitly spies on all five actions
  and asserts `fetchStorage` was never called by the container.

## Tests + results

Command:
```
pnpm exec vitest run \
  src/views/__tests__/PhotosSettings.test.ts \
  src/photos/components/__tests__/PhotosSidebar.test.ts \
  src/photos/components/__tests__/PhotosStorageCard.test.ts \
  src/photos/components/__tests__/PhotosAiCard.test.ts \
  src/router/index.test.ts \
  src/styles/color-guard.test.ts \
  src/i18n/parity.test.ts \
  --reporter=verbose
```
Result: **7 test files passed, 843 tests passed**, 0 failures.
`[Vue warn]` count in `PhotosSettings.test.ts`'s own run: **0** (verified with
`grep -c "\[Vue warn\]"` on a `--reporter=verbose` run of that file alone).

`pnpm exec vue-tsc --noEmit`: no output, no errors.

### Pre-existing `[Vue warn]` noise in `PhotosSidebar.test.ts` (not caused by this task)

Running `PhotosSidebar.test.ts` full file with `--reporter=verbose` shows ~100+
`[Vue warn]: Component "i18n-t" has already been registered in target app.` lines starting
partway through the file. I verified this is **pre-existing, unrelated to my two added
tests**: I copied the file's content at `HEAD` (`git show HEAD:...`) into a temporary sibling
test file, ran it standalone, and got **105** such warnings — before any of my edits existed.
Root cause: this file (predating the "don't build your own `createI18n` in tests" global
constraint) installs its own local `i18n` instance via `global.plugins: [i18n, testRouter]`
on top of the one `vitest.setup.ts` already installs globally into `config.global.plugins`;
vue-i18n's global component registration (`i18n-t`, `I18nT`, etc.) collides on the second
install onto the same mounted app. I did **not** fix this — it's out of scope for T5 (a
different file's legacy test-setup debt, not something my two added tests introduced or can
fix without touching the whole file's plugin wiring), and "禁止无关重构" applies. Flagging as
a minor debt item for whoever next touches this file.

## TDD evidence

RED (Step 1, before implementation — component + route + sidebar entry did not exist yet):
running `vitest run src/views/__tests__/PhotosSettings.test.ts` against a repo with only the
test file authored and no `PhotosSettings.vue` fails at import resolution (`Failed to resolve
import "../PhotosSettings.vue"`). I did not keep a separate captured transcript of that exact
failure since I authored component and test together per my own TDD workflow, but confirmed
red→green through two dedicated **mutation** verifications instead (below), which is the
task's own prescribed acceptance gate for its two named invariants.

GREEN: see "Tests + results" above — full 16/16 (+1 route-order) passing.

## Mutation verification (Step 6, both required)

**Mutation 1 — remove `clearTimeout(toastTimer)` from `showToast()`:**
```
pnpm exec vitest run src/views/__tests__/PhotosSettings.test.ts -t "重置计时" --reporter=verbose
```
Result: **FAILED** as expected —
`AssertionError: expected false to be true` on
`expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)` at t=2800ms relative to
the first toast (the stale timer from the first `showToast()` call fired and cleared the
second toast early). Reverted the edit; full suite re-confirmed green.

**Mutation 2 — remove the `?section` whitelist (`if (section === 'storage' || section ===
'ai')` → `if (section) scrollTo(String(section))`):**

First attempt using only `scrollIntoView`-call tracking **did not** turn red — I discovered
and document this as a real test-design gap I found and fixed rather than reporting a false
green: the only two ids in the rendered page are `#storage`/`#ai`, so any "illegal" query
value (e.g. Vue2's `settings=1`) simply matches no element via `querySelector` regardless of
whether the whitelist guard exists — `scrollIntoView` is never called either way, so
`scrollCalls.length === 0` can't distinguish correct code from the mutation. I added a second
recording spy on `Element.prototype.querySelector` (forwarding to the real implementation,
catching the `SyntaxError` that `#1` throws as an invalid CSS id-selector so it doesn't leak
as an unhandled rejection) and reassert on **`queryCalls`** — "was `scrollTo` ever invoked with
this id at all" — instead of on the DOM side-effect. With that fix:
```
pnpm exec vitest run src/views/__tests__/PhotosSettings.test.ts -t "非法值" --reporter=verbose
```
Result: **FAILED** as expected — `expected [ '#1' ] to not include '#1'`. Reverted the edit;
full suite re-confirmed green (843/843).

## Architecture deviation registrations (all four, per brief)

Recorded in `PhotosSettings.vue`'s header comment (and covered by dedicated tests):
1. Real route (`/photos/settings`) + one `AreaShell`/`PhotosSidebar` copy — not a full-screen
   `open`-prop overlay with its own nested sidebar/topbar copy. Test: `侧栏只挂一份`.
2. No `open` prop / no ESC-close / no `$emit('close')` — dismissed via browser back, like
   every other routed view in this area.
3. `themeMixin`/`photosThemeClass` not ported (standing ledger item, whole migration).
4. Footer "Sign out" not ported (D22) — New-UI's global logout differs mechanically. Test:
   `不渲染登出入口(D22)`.

A fifth, non-mandatory but honestly-recorded deviation: the toast omits Vue2's
`photos-icon :name="toast.icon"` glyph (purple `#8A7AFF`) — this repo has no `PhotosIcon.vue`
equivalent (confirmed zero `grep` hits, same conclusion T12's `PhotosFilterChip.vue` header
already reached), and the app's own global toast (`AppToast.vue`) is also plain-text with no
icon. Documented in the component header under "实现记录".

## Brief-vs-repo-reality discrepancy (flagged, resolved in favor of the actual code)

The brief's Step 1 guard test literally reads
`expect(wrapper.findComponent(PhotosSidebar).exists()).toBe(false)`, framed as "AreaShell
already provides it." I read `AreaShell.vue` in full: it has **no** sidebar concept at all —
just a header/slot shell. Every existing `/photos/*` view (`PhotosAlbums.vue`, `PhotosPlaces.vue`,
etc.) mounts exactly **one** `<PhotosSidebar/>` directly inside the `AreaShell` slot, and the
same dispatch that cites this test also explicitly instructs "`<PhotosSidebar />` in its
sidebar slot ... closest precedent PhotosAlbums.vue." Following the brief literally (`false`,
i.e. zero copies) would mean the settings page renders with no sidebar/nav at all — a real UX
regression contradicting the same dispatch's own precedent instruction. I implemented one
`<PhotosSidebar/>` (matching every sibling view) and adjusted the guard test to assert
**exactly one** (`findAllComponents(PhotosSidebar)).toHaveLength(1)`), which is what the
underlying invariant ("don't double-mount") actually needs, and documented this in both the
component header and the test file header.

The brief's Step 1 also says "挂载时拉齐五项数据" (five fetches) where the task's own later
"Interface Debt" section overrides this to exactly four (`fetchStorage` staying in the card).
Implemented per the Interface Debt section (more specific/authoritative), test title and
assertions adjusted accordingly; documented in both the component header and the test file.

## Files changed

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/PhotosSettings.vue` (new)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/__tests__/PhotosSettings.test.ts` (new)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/router/index.ts` (modified)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/components/PhotosSidebar.vue` (modified)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/components/__tests__/PhotosSidebar.test.ts` (modified)

## Self-review

- All five numbered 1:1 contracts (hero+quicknav, toast, four mount fetches, `?section=`
  deep-link, footer) implemented and each has a dedicated test.
- All four mandatory deviations registered in the component header; guard tests exist for
  #1 and #4 (the two the brief specifically asks tests for).
- No unrelated refactors; `PhotosAlbums.vue`'s layout structure copied, not abstracted (per
  its own stated convention); sidebar `NAV` array/order untouched (verified: existing
  `PhotosSidebar.test.ts` "渲染七条导航项" test, unmodified, still passes — 7 items, same order).
- No `#hex`/`rgb()`/named colors introduced anywhere (component's own `<style>` uses only
  existing tokens: `--fg`, `--fg-muted`, `--accent-text`, `--chip-border`, `--toast-bg`,
  `--toast-fg` (existing fallback pattern from `AppToast.vue`), `--card-shadow-hi`, `--blur`,
  `--ease`); `color-guard.test.ts` passes with `views/PhotosSettings.vue` explicitly checked.
- No new `.on`/`[data-on]`/`[data-active]` hover-variant elements introduced by this task
  (quick-nav anchors and the sidebar settings button are plain, unconditioned hover states),
  so the hover-specificity guard doesn't apply here — confirmed by reading my own diff.
- Toast-timer-reset test genuinely proves the reset (advances to exactly the first timer's
  original expiry point and asserts the *second* toast's text is still showing), and mutation
  1 turning it red confirms this.
- `?section=` invalid-value test genuinely proves the guard (via `querySelector` call-tracking,
  not just DOM side effects) — mutation 2's initial false-negative and the fix are documented
  above rather than silently patched over.

## Concerns

1. **Known limitation, flagged for T6's awareness (not fixed here, out of scope):** vue-router 4
   does not remount a route component on a query-only change. If a user is already on
   `/photos/settings?section=storage` and clicks a same-page link to
   `/photos/settings?section=ai` (the T6 "Settings · AI behavior" link), `onMounted` will not
   re-fire and the page will not re-scroll. Documented in the component header. T6 should be
   aware when wiring that link.
2. **Pre-existing `[Vue warn]` debt in `PhotosSidebar.test.ts`** (documented above under "Tests +
   results") — not introduced by this task, not fixed (out of scope), flagged for whoever next
   touches that file's test setup.
3. The toast intentionally omits Vue2's icon glyph (see deviation #5 above) — a real, if minor,
   visual difference from Vue2. Flagged rather than silently decided.

---

## Fix report — review Important 1 (2026-08-04): close the query-only scroll gap

**Reviewer finding:** `onMounted`'s `?section=` scroll only runs once at mount time. Since
vue-router 4 does not remount a route component on a query-only navigation, a user already
sitting on `/photos/settings` who arrives at `?section=ai` via a same-route query change
(hand-edited address bar, or a future settings-page-internal link) got no scroll. Ruling: fix
now rather than defer to T6.

### What changed

`src/views/PhotosSettings.vue`:
- Factored the whitelist check out of the inline `if` into two small named helpers shared by
  both the mount path and the new watch path, so they cannot drift apart:
  ```ts
  type SectionId = 'storage' | 'ai'
  function isSectionId(v: unknown): v is SectionId {
    return v === 'storage' || v === 'ai'
  }
  function scrollToSection(section: unknown): void {
    if (isSectionId(section)) scrollTo(section)
  }
  ```
- `onMounted` now calls `void nextTick(() => scrollToSection(route.query.section))` (same
  behavior as before, just routed through the shared helper).
- Added, immediately after `onMounted` (not merged into it, not `{ immediate: true }` —
  per the reviewer's explicit instruction not to trade the working mount path for a subtler
  consolidated one without proof):
  ```ts
  watch(() => route.query.section, (section) => scrollToSection(section))
  ```
  `watch` without `immediate` does not fire at setup time, so this adds no duplicate call on
  initial mount — it only fires on a genuine post-mount query change. No `nextTick` needed
  here (unlike the mount path) because `#storage`/`#ai` are unconditionally rendered static
  content that already exists by the time any post-mount query change can occur.
- Updated the component's header comment: the former "known limitation, left for T6" note is
  now a record that both the mount-time and post-mount-query-change paths are handled, and
  that they share the same whitelist function.

### Covering tests

Added to `src/views/__tests__/PhotosSettings.test.ts`:
1. `已停留在本页时 query 才变为 ?section=ai——watch 路径补上滚动(不靠重新 mount)` — mounts
   at `/photos/settings` (no section, asserts zero scroll at that point as a baseline), then
   `router.push('/photos/settings?section=ai')` on the **same** router instance (query-only
   change, same route component, no remount), flushes, and asserts exactly one
   `scrollIntoView` call on the `#ai` element.
2. `已停留在本页时 query 才变为 ?section=1(非法值)——watch 路径同样不滚动` — same query-only
   transition but to `?section=1`, asserting via the existing `querySelector`-call-tracking
   spy (`queryCalls`, built in the original T5 pass specifically because DOM side-effects
   alone can't distinguish "guard present" from "guard absent" when the illegal value matches
   no real element) that `'#1'` was never queried — i.e., `scrollTo` was never invoked at all
   for the illegal value on this path either.

Added a second mount helper `mountViewWithRouter(path)` (returns `{ w, router }` instead of
just `w`) used only by these two tests, so the router instance can be reused for the
post-mount `push()` without changing `mountView`'s existing return shape (would have required
touching every other test's destructuring).

### Exact commands + output

```
pnpm exec vitest run src/views/__tests__/PhotosSettings.test.ts --reporter=verbose
```
Result: **18/18 passing** (16 original + 2 new). `[Vue warn]` count in this run: **0**
(`grep -c "\[Vue warn\]"` on the captured log).

```
pnpm exec vue-tsc --noEmit
```
Result: no output, no errors.

Also re-ran the full task test scope (container + sidebar + both cards + router + color-guard
+ i18n parity):
```
pnpm exec vitest run \
  src/views/__tests__/PhotosSettings.test.ts \
  src/photos/components/__tests__/PhotosSidebar.test.ts \
  src/photos/components/__tests__/PhotosStorageCard.test.ts \
  src/photos/components/__tests__/PhotosAiCard.test.ts \
  src/router/index.test.ts \
  src/styles/color-guard.test.ts \
  src/i18n/parity.test.ts \
  --reporter=verbose
```
Result: **7 files passed, 845/845 tests passed** (843 + 2 new).

### Mutation verification (required)

Removed the `watch(...)` call entirely from `PhotosSettings.vue` (hand-edit), leaving only the
mount-time scroll:
```
pnpm exec vitest run src/views/__tests__/PhotosSettings.test.ts -t "watch 路径补上滚动" --reporter=verbose
```
Result: **FAILED** as expected —
```
AssertionError: expected [] to have a length of 1 but got +0
```
on `expect(scrollCalls).toHaveLength(1)` — with the watch removed, the query-only transition
to `?section=ai` produces zero scroll calls, exactly the gap the reviewer identified. Restored
the `watch(...)` line by hand (verified against the read-back source, no `git checkout`/
`stash` used); re-ran the full file — 18/18 green again (confirmed above).

### Not touched (per coordinator's ledger note)

The ~105/119 pre-existing `[Vue warn]` in `PhotosSidebar.test.ts` (legacy local `createI18n`)
remain untouched, as instructed — ledgered for the final whole-branch review, not this task's
scope under 禁止无关重构.

---

## Fix report — round 3: full-suite z-index collision (2026-08-04)

**Finding (full-suite gate, 459 files / 5893 examples):** `src/components/AppToast.zIndex.test.ts`
failed — `.ps-toast` in `PhotosSettings.vue` was `z-index: 1100`, identical to the global
toast's own layer (`AppToast.vue` `.toast-stack`, also 1100). `docs/THEMING.md §8` reserves
1100 exclusively for the one global toast singleton; anything else at ≥1100 is flagged because
every modal scrim in the repo carries `backdrop-filter`, and the guard's stated purpose is
specifically "toast must clear every modal scrim" — not "every page-local toast may claim the
same number." My original justification comment (copied from `AppToast.vue`'s own reasoning)
was wrong for a page-local toast and invited exactly this regression.

### What I checked before picking a number

Per the coordinator's instruction, I re-verified what else renders on `/photos/settings` that
could sit above a low z-index and cover the toast:
- `PhotosStorageCard.vue`: `grep -n "z-index"` → no matches.
- `PhotosAiCard.vue`: `grep -n "z-index"` → no matches (one comment mentions
  `SnapshotSettingsDialog.vue` by name as a styling precedent, not an actual mounted dialog —
  confirmed no `Dialog`/`ui-dialog` component is imported or rendered by either card).
- `PhotosSidebar.vue` (mounted once on this page per the T5 architecture decision): **does**
  have z-index — `.side-scrim { z-index: 150 }` and `.photos-sidebar.is-drawer { z-index: 151 }`
  (the mobile drawer + its scrim). This is the one real thing on this page that can render
  above a naive "just pick something in the 60–150 local-fixed-bar band" choice — a toast at
  exactly 150 would tie with the scrim (ambiguous stacking) and lose to the drawer at 151.
- No `ui-dialog`-style overlay (1000/1001 band) is reachable from anything this page mounts.

I surveyed all distinct `z-index` values currently used across `src/**/*.vue`/`*.css`
(`grep -rhn z-index ... | sort -n | uniq -c`): 0,1,2,3,4,5,6,7,10,20,21,30,40,41,50,60,70,100,
120,150,151,200,220,230,240,300,500,900,1000,1001,1100. **160** is unused elsewhere, clears the
sidebar drawer (151) with a small margin, and sits well clear of both the 200+ region-modal band
and the 1000+/1100 global-modal/toast bands.

**Chosen value: 160.** Rationale recorded in the component: it only needs to clear what
actually renders on this specific page (the sidebar drawer at 151), not the whole repo's modal
ladder — a page-local toast does not need to "beat" global scrims the way the one true global
toast does.

### What changed

`src/views/PhotosSettings.vue`:
- `.ps-toast`'s `z-index` changed from `1100` → `160`.
- Rewrote the comment above it: no longer cites `AppToast.vue`'s "must clear every modal
  scrim" reasoning (that's a property of the *global* singleton, not this page-local pill).
  States explicitly which real same-page elements (151/150, the sidebar drawer/scrim) it
  needed to clear, why 160 was chosen over other candidates, and that only "<1100" is a
  repo-wide invariant — the specific value 160 is a local judgment call, not something to
  re-derive from the ladder table's nominal bracket boundaries.

`src/views/__tests__/PhotosSettings.test.ts`:
- Added import of `photosSettingsRaw` (`?raw`) and `extractStyleBlock` (reused from
  `src/photos/components/__tests__/cssCascade.ts`, the established pattern for reading a raw
  `<style>` block in this area).
- New `describe('z-index 层级(docs/THEMING.md §8)', ...)` with one test: extracts the
  `.ps-toast` rule block via regex, asserts a `z-index` declaration exists, and asserts the
  numeric value is `< 1100`. Deliberately does **not** pin the exact value 160 or assert
  `<1000`/`<200` — only the repo-wide invariant (strictly below the global toast) is a hard
  rule; the specific local number is a judgment call that should be free to change later
  without making this test a source of false failures.

### Covering tests + exact commands + output

```
pnpm exec vitest run src/views/__tests__/PhotosSettings.test.ts --reporter=verbose
```
Result: **20/20 passing** (18 previous + 2 new: the z-index guard here is 1, plus this run
also re-confirms all prior tests). `[Vue warn]` count in this run: **0**.

```
pnpm exec vitest run src/components/AppToast.zIndex.test.ts --reporter=verbose
```
Result: **4/4 passing** (repo-wide guard, including the two named-selector checks for
`PhotosPersonDetail.vue`/`ClusterActionDialog.vue`). `[Vue warn]` count: **0**.

```
pnpm exec vitest run src/styles/color-guard.test.ts --reporter=verbose
```
Result: **748/748 passing**. `[Vue warn]` count: **0**.

```
pnpm exec vue-tsc --noEmit
```
Result: no output, no errors.

### Mutation verification (required)

Hand-edited `.ps-toast`'s `z-index` back to `1100`:
```
pnpm exec vitest run src/views/__tests__/PhotosSettings.test.ts -t "z-index" --reporter=verbose
```
Result: **FAILED** as expected — `AssertionError: expected 1100 to be less than 1100`.

```
pnpm exec vitest run src/components/AppToast.zIndex.test.ts --reporter=verbose
```
Result: **FAILED** as expected — reproduces the coordinator's original finding verbatim:
```
- []
+ [
+   "  src/views/PhotosSettings.vue: z-index 1100 (toast = 1100)",
+ ]
```

Restored `z-index: 160` by hand (no `git checkout`/`stash`). `git diff -- src/views/PhotosSettings.vue`
confirmed the file is back to the intended fixed state (single hunk: comment rewrite + the one
`z-index: 1100` → `z-index: 160` line change, nothing else touched). Re-ran both guards plus
the full local test file together — **24/24 passing**, 0 `[Vue warn]`.

### Note on repo state at time of this fix

Between round 2 and this round, the phase progressed: `git log` shows T6 through T10 already
committed on top of my `1537bbe` (current HEAD before this fix: `da90689`). T6's own review fix
had, in the interim, added a `service.photos.getConfig` mock and a network-level dedup test to
`PhotosSettings.test.ts` (visible in the file as "P8a-T6 review fix" comments) and changed the
`fetchAiFeatures` call-count assertion in the mount-fetch test from 1 to 2 (PhotosSidebar now
also calls it). None of that is mine to touch or re-litigate — I only edited around it: added my
new `describe` block and the two new imports, and made the one `PhotosSettings.vue` style
change. I did not modify any T6–T10 content.

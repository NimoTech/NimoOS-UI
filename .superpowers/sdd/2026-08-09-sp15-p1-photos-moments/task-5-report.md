# Task 5 report: mount the "Moments · For You" band on the smart-views page

Commit: `16f96cf` — `feat(photos): show the For You moments band on the smart views page`

## What was implemented

- `src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts`: added `photosMoHeroTitle` and
  `photosMoHeroDesc` (brief's strings, verbatim) under the existing `// ── SP15-P1 Moments ──`
  section.
- `src/views/PhotosSmartViews.vue`:
  - Imports `MomentCard` and `usePhotosMoments`; instantiates the `moments` store.
  - `showMoments` computed: `!aiSmartViewOff.value && moments.moments.length > 0` — reuses the
    existing `aiSmartViewOff` computed (did not add a second one, per dispatch).
  - `moGrid` template ref (`ref<HTMLElement | null>(null)`), for Task 6's drag wiring.
  - `onMomentOpen(id)` → `router.push('/photos/moments/' + id)`.
  - `onMounted` now also calls `void moments.fetchMoments()`.
  - Template: new `.mo-section` block (title/desc from i18n, `.mo-grid` with `v-for="m in
    moments.moments"` rendering `MomentCard` with `:size`/`:template` from `moments.sizeMap`)
    inserted between the AI banner and the hero. The hero's root div now binds
    `:class="{ 'sv-hero-secondary': showMoments }"`.
  - Added a comment at the `??` fallback binding explaining it can never actually fire (per
    dispatch's "one thing to get right") — `sizeMap` is a computed derived from the same
    `moments.moments` list, keyed by the same `m.id`, so every id iterated here always has a
    matching `sizeMap` entry in the same tick.
  - `<style scoped>`: added `.mo-section`, `.mo-hero`/`.mo-hero h2`/`.mo-hero p`,
    `.sv-hero.sv-hero-secondary`, `.mo-grid` + its three `:deep()` span rules, and the
    `@media (max-width: 1055px)` narrow-container downgrade — all copied from the brief
    verbatim (only the "span − 1" wording in one Chinese comment was spelled out as "减 1"
    instead of a bare hyphen, purely cosmetic).
- `src/views/PhotosSmartViews.moments.test.ts` (new): 9 tests across 5 `describe` blocks —
  band gating (4), grid (2), relationship with the sv-hero divider (2), fetching (1).

## Deviations from the brief's literal test code (both mechanical, not semantic)

The brief's test-file code block was translated into English titles/comments per the
dispatch's constraint, and additionally required two mechanical fixes to actually pass —
both logged in the test file's header comment:

1. **No local `createI18n()`.** `vitest.setup.ts` already installs the `src/i18n` singleton
   into `config.global.plugins` for every mount, and `@vue/test-utils` *concatenates* that
   with any `global.plugins` array passed to an individual `mount()` call rather than
   replacing it. Passing a second `createI18n()` instance (as the brief's literal code does)
   installs a second i18n plugin onto the same app; vue-i18n's `install()` unconditionally
   registers global components/directives, producing `[Vue warn]: Component "i18n-t" has
   already been registered in target app` (and five siblings) on every mount. This exact
   problem and fix already exist in this codebase at `MomentCard.test.ts:5-14` and
   `PhotosToolbar.test.ts:7-12` (Task 4's own test file), and match the project memory note
   "New-UI 测试别另建 createI18n". Fix: drop the `createI18n`/`zh`/`en` imports, mount with only
   `plugins: [router]`, and rely on the global singleton (defaults to `zh_cn`, which is all
   this file needs — the brief only asserts Chinese text).
2. **Store fixtures are written *after* `mountPage()` returns, not before.** The brief's test
   does `s.moments = [makeMoment()]` and then mounts. But `PhotosSmartViews.vue`'s `onMounted`
   unconditionally fires a real `moments.fetchMoments()` (and `settings.fetchAiFeatures()`)
   against the mocked service. The mocked `listMoments`/`getConfig` resolve in a microtask and
   the real store code unconditionally overwrites `moments.value` / `aiFeatures.value` once
   that resolves — which races ahead of the test's assertions (Vue's reactivity flush is
   itself a microtask, so it beats even a `setTimeout(0)` wait). Concretely: pre-populating the
   store before mount, then asserting after a macrotask wait, observed the band disappearing
   again because the mocked (empty) `listMoments` response clobbered the test's data before
   the assertion ran. Fix: `mountPage()` now `await`s `flushPromises()` before returning (so
   the initial network calls have fully settled), and each test sets its fixture data *after*
   that, then `await nextTick()`, then asserts. This is a fixture-ordering fix only — same
   scenarios, same assertions, same `describe`/`it` structure and titles (translated).

I verified both by reproducing the failure first: running the brief's literal mechanics
produced 5/9 failures with exactly the symptoms described above (see TDD section).

## TDD evidence

**RED** — `pnpm exec vitest run src/views/PhotosSmartViews.moments.test.ts --reporter=verbose`
(test file present, page/i18n not yet implemented):

```
 Test Files  1 failed (1)
      Tests  6 failed | 3 passed (9)
```

Failures were exactly the 6 assertions that depend on the band/grid/divider existing
(`[data-test="mo-section"]` not found, `.mo-card` not found, click-navigate had nothing to
click, `sv-hero-secondary` class absent, `listMoments` never called). The 3 passes were the
"absence" assertions, trivially true before any implementation exists — expected.

**GREEN** — after i18n keys + page changes, then fixing the two test-mechanics issues above,
same command:

```
 ✓ src/views/PhotosSmartViews.moments.test.ts > band gating > renders nothing when there are no moments (the core semantics of Vue2 showMoments) 62ms
 ✓ src/views/PhotosSmartViews.moments.test.ts > band gating > renders the band when moments exist, with title/description from i18n 22ms
 ✓ src/views/PhotosSmartViews.moments.test.ts > band gating > hides the band when aiFeatures.smartview is false, even with moments present 10ms
 ✓ src/views/PhotosSmartViews.moments.test.ts > band gating > treats a missing aiFeatures.smartview field as enabled (no scary default) 12ms
 ✓ src/views/PhotosSmartViews.moments.test.ts > grid > renders one card per moment, sizing/template pulled from the store sizeMap 11ms
 ✓ src/views/PhotosSmartViews.moments.test.ts > grid > clicking a card navigates to /photos/moments/:id 10ms
 ✓ src/views/PhotosSmartViews.moments.test.ts > relationship with the smart-views hero > when the band is present, the sv-hero below it gets the sv-hero-secondary divider class 8ms
 ✓ src/views/PhotosSmartViews.moments.test.ts > relationship with the smart-views hero > when the band is absent, sv-hero does not carry that class 10ms
 ✓ src/views/PhotosSmartViews.moments.test.ts > fetching > fetches moments once on mount 6ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

**Actual count: 9/9** (matches the brief's prediction this time — first task in the series
where the predicted count landed exactly). No stderr output at all for this file (no `[Vue
warn]`, no console.error).

## Pre-existing page test (before/after)

`src/views/__tests__/PhotosSmartViews.test.ts` (not modified, per dispatch constraint 9 /
brief's explicit "既有该页测试文件不动"):

- **Before** (stashed my changes, ran against `HEAD`): `18 passed (18)`.
- **After** (my changes restored): `18 passed (18)`.

No regression in pass/fail count. However, a new **console.error** (not a `[Vue warn]`) now
prints on every mount in that file:

```
[photos-moments] listMoments TypeError: __vite_ssr_import_2__.service.photos.listMoments is not a function
```

Cause: that file's mocked `service.photos` object predates this task and only defines
`listSmartViews`/`getConfig`/`thumbnailUrl`/`previewSmartView` — it has no `listMoments`. Since
`PhotosSmartViews.vue`'s `onMounted` now unconditionally calls `moments.fetchMoments()`, and
that store's `fetchMoments()` catches and `console.error`s any failure by design (moments.ts's
own doc comment: "Vue 2 did the same, just console.error and nothing else — clearing the view
would make a single network blip look like every moment vanished"), the missing mock produces
a caught, harmless, but noisy error on every mount in that file. I could not fix this without
either touching the forbidden test file or adding a defensive guard to the page that wasn't
asked for (and would mask a real dependency-shape signal for whoever eventually does touch
that file). Flagged as a concern below rather than silently worked around.

## vue-tsc / parity / style guards

- `pnpm exec vue-tsc --noEmit` → clean, no output, exit 0.
- `pnpm exec vitest run src/i18n/parity.test.ts --reporter=verbose` → `9 passed (9)`.
- `pnpm exec vitest run src/styles --reporter=verbose` → `1072 passed (1072)` (4 test files:
  `color-guard.test.ts`, `selectPopup.test.ts`, and two others under `src/styles`) — same count
  the dispatch predicted as the current baseline, unchanged by this task (no new color
  literals were written; every colour below is a token).

## Every colour written, and its token

All new CSS in this task uses existing tokens already defined in both theme blocks of
`src/styles/theme.css` — no new token was added, no literal was written:

- `.mo-hero h2` → `color: var(--fg)`
- `.mo-hero p` → `color: var(--fg-muted)`
- `.sv-hero.sv-hero-secondary` → `border-top: 1px solid var(--divider)`

(`--fg`, `--fg-muted`, `--divider` all confirmed present with values in both `:root` and
`:root[data-theme="light"]` blocks via grep before use.) No `theme-exception` was needed in
this task's own additions.

## Self-review

- **Band disappears with no moments, and with the AI switch off** — both covered by dedicated
  tests ("renders nothing when there are no moments" and "hides the band when
  aiFeatures.smartview is false, even with moments present") and both pass against the real
  computed, not a mock.
- **`:deep()` actually reaches the card** — kept exactly as the brief specifies
  (`.mo-grid :deep(.mo-card)`, `.mo-grid :deep(.mo-card-wide)`, `.mo-grid
  :deep(.mo-card.mo-card-tall)`); not simplified away, per dispatch constraint 5.
- **No test asserts only "a mock was called" in place of real output** — the one test that
  does check a mock call count ("fetches moments once on mount") is checking the one thing
  that genuinely has no DOM signature (a fetch was dispatched), matching the established
  convention in the sibling pre-existing test file's own "拉取" describe block. Every other
  test asserts real rendered DOM (`data-test` attributes, `.mo-card` elements/classes, router
  state, text content).
- **Nothing added beyond what was asked** — no extra props, no extra i18n keys, no
  `defineExpose`, no changes to `momentLayout.ts`/`moments.ts`/`MomentCard.vue`. The `??`
  fallback comment is the one deliberate addition beyond the brief's literal markup, and the
  dispatch explicitly asked for it.
- **Test output is pristine for the new file** — verified zero stderr lines in the verbose run
  above. The pre-existing (untouched) test file has its own pre-existing `[Vue warn]` noise
  (present before this task, confirmed via the stashed baseline run) plus the new
  console.error described above — flagged as a concern, not silently absorbed.
- CSS comments were checked for stray `*/` sequences (`grep -n '\*/' src/views/PhotosSmartViews.vue`)
  — every occurrence is a legitimate comment terminator.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosSmartViews.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosSmartViews.moments.test.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/zh_cn.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/en_us.photos.ts`

## Concerns

- The console.error noise in the pre-existing `src/views/__tests__/PhotosSmartViews.test.ts`
  (described above) is a direct, mechanical consequence of this task's page change landing on
  a test file this task is forbidden to touch. It does not fail any assertion and matches the
  store's documented failure-swallowing design, but it is new noise in that file's test run
  that a future task touching that file (or a Task 6/7 that also calls into `moments`) should
  be aware can be silenced by adding `listMoments: vi.fn(async () => [])` to that file's mock
  once it's back in scope.
- Task 6 (drag-reordering) depends on `ref="moGrid"` and the `.mo-grid`/`.mo-card` DOM shape
  built here; both were kept exactly as specified with no changes.

---

## Fix round 1 (coordinator review)

Commit: `f5d2d1e` — `fix(photos): translate new moments CSS comments, silence collateral test noise`

Two Important findings from review, both addressed:

### Finding 1 — new CSS comments were still Chinese

The English-comment ruling applies to every comment a task adds, not just script/test
comments — I had translated the `<script setup>` comment and the whole new test file but
missed the `<style scoped>` block. Translated all five comments added in the original commit
(`.mo-section` header, the `--font-display` deviation note, the `sv-hero-secondary` divider
note, the `.mo-grid` dense-packing/row-height note, the three-tier span note, and the narrow-
container media-query note), conveying meaning rather than a literal gloss, keeping every
source reference (`photos-smartview.scss:144-186`) exactly, and spelling out the row-height
arithmetic in words ("a card's rendered height works out to its row span multiplied by 132px,
plus its span minus one multiplied by the 16px gap") rather than symbols. Re-checked for stray
`*/` sequences after editing (`grep -n '\*/' src/views/PhotosSmartViews.vue`) — every hit is a
legitimate comment terminator, none reintroduced. Left every pre-existing Chinese comment in
the file untouched, per the fix request.

### Finding 2 — collateral console noise in the pre-existing page test

Confirmed the reasoning for lifting the "don't touch that file" restriction (the two live
concurrent branches, `sp12-files-fixes` and `sp16-kvm-settings-fixes`, work in the files area
and KVM/settings area respectively — neither touches `PhotosSmartViews.test.ts`), so made the
minimal fix: added `listMoments: vi.fn(async () => [])` to that file's `svc.photos` mock
object (one line, plus a two-line comment explaining why it's there), touching nothing else in
the file — no restructuring, no assertion changes, and the file's own pre-existing `[Vue warn]`
double-registration noise was left alone as instructed (that is a separate, older problem).

**Confirmed the `[photos-moments]` error is gone**: `grep -n '\[photos-moments\]'` against a
full verbose run of `PhotosSmartViews.test.ts` now returns no match (exit code 1), where
before the fix it appeared on 4 of the file's 18 tests (the ones whose flow reaches
`onMounted`'s now-real `moments.fetchMoments()` call — the skeleton/create-open-dialog/click
tests that don't wait past mount didn't happen to hit it, though the noise was present in the
component's onMounted for every one of the 18).

Before/after test count for that file: **18/18 passing both before and after** — the fix is
about eliminated noise, not about newly-passing or newly-failing assertions.

### Verification run

`pnpm exec vitest run src/views/PhotosSmartViews.moments.test.ts src/views/__tests__/PhotosSmartViews.test.ts src/i18n/parity.test.ts --reporter=verbose`:

```
 Test Files  3 passed (3)
      Tests  36 passed (36)
```

(9 new-file tests + 18 pre-existing page tests + 9 parity tests = 36.) The only remaining
stderr in that run is the pre-existing `[Vue warn]` double-registration noise (present before
this task, left alone per the fix request) and one pre-existing, intentionally-triggered
`[photos-settings] fetchAiFeatures Error: boom` log from the file's own "getConfig reject"
test — neither is new, neither is the `[photos-moments]` error this fix targeted, and grep
confirms the latter is fully gone:

```
$ pnpm exec vitest run src/views/__tests__/PhotosSmartViews.test.ts --reporter=verbose 2>&1 | grep -n '\[photos-moments\]'
(no output, exit code 1)
```

`pnpm exec vue-tsc --noEmit` → clean, exit 0.

`pnpm exec vitest run src/styles --reporter=verbose` → `1072 passed (1072)`, unchanged from
before this fix (only comment text changed, no rule bodies, no selectors, no new literals).

### Files changed (fix round 1)

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosSmartViews.vue` (CSS comments only)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/__tests__/PhotosSmartViews.test.ts` (added `listMoments` mock, one line + comment)

### Concerns (fix round 1)

None new. The pre-existing `[Vue warn]` noise in `PhotosSmartViews.test.ts` remains, by
explicit instruction, as a separate known issue for a future task.

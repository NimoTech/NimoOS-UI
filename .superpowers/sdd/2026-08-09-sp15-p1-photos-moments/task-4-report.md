# Task 4 report: MomentCard.vue

## What was implemented

- `src/photos/components/MomentCard.vue` — the mosaic card for the Moments band, ported from
  Vue2 899af59b:PhotosSmartViewsView.vue:367-433 (inline `MomentCard` component), styles from
  photos-smartview.scss:186-268. Reuses `.sv-card`/`.sv-collage`/`.sv-meta` class names from
  `SmartViewCard.vue` and layers `.mo-*` overrides on top, per the brief's explicit requirement
  to mirror SmartViewCard's three-row meta structure.
- `src/photos/components/__tests__/MomentCard.test.ts` — 11 test cases across four `describe`
  blocks (collage shapes / size classes / meta row / interaction).
- Six new i18n keys added to both `src/i18n/zh_cn.photos.ts` and `src/i18n/en_us.photos.ts`
  under a new `// ── SP15-P1 Moments ──` section: `photosMoBadge`, `photosMoTypeTrip`,
  `photosMoTypePets`, `photosMoTypeFamily`, `photosMoTypeTheme`, `photosMoAddedThisWeek`
  (Chinese wording for the last one copied verbatim from the existing `photosSvAddedThisWeek`,
  not retranslated, per the brief's explicit instruction).

Deviations from Vue2 (documented in the component's file-header comment, matching the brief):
1. `emit('open', id)` passes only the id string (precedent: `SmartViewCard.vue:32`).
2. Out-of-range featured collage slots render nothing, instead of an `<img>` with `src=undefined`
   (which the browser resolves against the current page and fetches).
3. Asset-count thousands separator follows the i18n locale (`toLocaleString(localeTag)`), not a
   bare `toLocaleString()`.
4. The amber badge's gradient collapses to a flat `--warn-fg` (no second amber token in this repo
   to build a gradient from) — cosmetic-only deviation.
5. `.sv-name` two-line clamp copied as-is.

## Typing correction to the brief (constraint 6)

The brief's test helper (`mountCard(over = {}, size = 'standard', template = 'T1', locale = 'zh_cn')`)
and the `for (const tpl of ['T1','T2','T4'])` loop both infer plain `string`, which fails
`vue-tsc --noEmit` against the `MomentSize`/`MomentTemplate` prop types. Fixed by typing
`size: MomentSize = 'standard'`, `template: MomentTemplate = 'T1'`, and the loop array as
`MomentTemplate[]`. No assertions were changed.

## Second deviation from the brief's literal test code (found during self-review, not anticipated)

The brief's test file builds its own `createI18n(...)` instance per `mountCard()` call and passes
it via `global: { plugins: [...] }`. Running the tests with `--reporter=verbose` (constraint 8)
surfaced repeated `[Vue warn]: Component "i18n-t" has already been registered in target app.`
(and five sibling warnings) on every mount that used a custom locale. Root cause: `vitest.setup.ts`
already installs the shared `src/i18n` singleton into `config.global.plugins` for every mount;
`@vue/test-utils` **concatenates** that with any `global.plugins` passed to an individual `mount()`
call rather than replacing it, so a second `createI18n()` gets installed on the same app alongside
the global one, and vue-i18n's `install()` unconditionally calls `app.component`/`app.directive`
for both — producing the "already registered" warnings on every affected mount. This is exactly
the pattern the project memory flags ("New-UI 测试别另建 createI18n(与 setup 单例重复安装)") and
is fixed elsewhere in the codebase with an identical comment in
`src/photos/components/__tests__/PhotosToolbar.test.ts:7-12`. Confirmed this is pervasive, pre-
existing, and not something this task introduced: `SmartViewCard.test.ts` (existing, already
merged) uses the identical `createI18n`-per-mount pattern and produces 119 occurrences of the
same warning when run with `--reporter=verbose`.

Fix applied to my test file only: dropped the local `createI18n`/`messages` construction, imported
the shared singleton (`import { i18n } from '../../../i18n'`), and switched locale via
`i18n.global.locale.value = locale` before each mount, letting `vitest.setup.ts`'s already-
installed global plugin serve the render. No assertion text was changed — only the plumbing that
picks which locale is active. Re-ran with `--reporter=verbose`: zero `[Vue warn]` lines.

## TDD evidence

**RED** — `pnpm exec vitest run src/photos/components/__tests__/MomentCard.test.ts --reporter=verbose`
(before `MomentCard.vue` existed):
```
FAIL  src/photos/components/__tests__/MomentCard.test.ts [ src/photos/components/__tests__/MomentCard.test.ts ]
Error: Failed to resolve import "../MomentCard.vue" from "src/photos/components/__tests__/MomentCard.test.ts". Does the file exist?
...
Test Files  1 failed (1)
     Tests  no tests
```
Expected and correct failure reason — the component doesn't exist yet.

**GREEN** — `pnpm exec vitest run src/photos/components/__tests__/MomentCard.test.ts src/i18n/parity.test.ts --reporter=verbose`:
```
 ✓ src/photos/components/__tests__/MomentCard.test.ts > collage shapes > T1 / T2 / T4 render three images: cover + two featured, fixed order
 ✓ src/photos/components/__tests__/MomentCard.test.ts > collage shapes > T3 renders two images: cover + the sole featured asset
 ✓ src/photos/components/__tests__/MomentCard.test.ts > collage shapes > single renders only the cover, and attaches mo-collage-single
 ✓ src/photos/components/__tests__/MomentCard.test.ts > collage shapes > does not render an img with an undefined src when featured ids run short (does not copy Vue2's out-of-bounds index)
 ✓ src/photos/components/__tests__/MomentCard.test.ts > size classes > wide / tall attach mo-card-wide / mo-card-tall respectively; standard attaches neither
 ✓ src/photos/components/__tests__/MomentCard.test.ts > size classes > data-id lands on the card root (drag reorder reads it off DOM order)
 ✓ src/photos/components/__tests__/MomentCard.test.ts > meta row > type pill maps recipeKey prefix to one of four buckets
 ✓ src/photos/components/__tests__/MomentCard.test.ts > meta row > does not render the green badge when addedThisWeek is 0
 ✓ src/photos/components/__tests__/MomentCard.test.ts > meta row > does not render the place pill when place is empty
 ✓ src/photos/components/__tests__/MomentCard.test.ts > meta row > asset count uses locale thousands separators (not a bare toLocaleString)
 ✓ src/photos/components/__tests__/MomentCard.test.ts > interaction > click emits open with only the id
 ✓ src/i18n/parity.test.ts > i18n locale parity > en_us 与 zh_cn 顶层 key 集合完全一致(含 sp9 分片)
 ✓ src/i18n/parity.test.ts > i18n locale parity > en_us 值均为非空字符串
 ✓ src/i18n/parity.test.ts > i18n locale parity > zh_cn 值均为非空字符串
 ✓ src/i18n/parity.test.ts > i18n locale parity > 分片不得覆盖基座已有 key(静默改文案)
 ✓ src/i18n/parity.test.ts > i18n locale parity > 抽查若干英文文案
 ✓ src/i18n/parity.test.ts > photosPlaces 键(SP7-P6a) > 六个大洲键齐备,且 regionLabelKey 的返回值全部有译文
 ✓ src/i18n/parity.test.ts > photosPlaces 键(SP7-P6a) > 中文文案不含工程词「簇」「聚类」「气泡」
 ✓ src/i18n/parity.test.ts > photosPlaces 键(SP7-P6a) > P6b 地点键在两个 locale 都存在且无空值
 ✓ src/i18n/parity.test.ts > photosPlaces 键(SP7-P6a) > insight 键的插值占位符两个 locale 完全一致(漏一个槽 <i18n-t> 会静默丢内容)

 Test Files  2 passed (2)
      Tests  20 passed (20)
```
**Actual counts: 11 card tests + 9 parity tests = 20**, not the brief's predicted "11 + 9/9"
combined phrasing (matches numerically, but the brief's "9/9" reads like a fraction — the real
parity suite in this repo has 9 total test cases, not 9 assertions inside 1 test; confirmed by
listing them above). No [Vue warn] output on this run (after the i18n-singleton fix above).

## vue-tsc

`pnpm exec vue-tsc --noEmit` → exit 0, no output. Clean.

## Full-suite sanity check (beyond the task's required scope, run out of caution)

Ran `pnpm exec vitest run` for the whole repo before committing: 4 test files / 3 tests failed,
all in `oss/**` (`cli-args.test.mjs`, `tree.test.mjs`, `export-rsync.test.mjs`). Root cause: the
OSS export guard refuses to run against a dirty git working tree, and my four new/modified files
were still uncommitted at that point — every failure's stderr literally printed
`工作树不干净,导出中止` listing my own pending files. Re-ran the same three suites after
committing (`8d58375`): all pass. Confirmed not a regression.

Separately spot-checked `oss/tree.test.mjs`'s "leak guard" sub-test on its own after committing —
it fails on `packages/service/src/photos.moments.test.ts` containing the word "photo" (OSS has no
Photos module). `git log` confirms this test file was added in commit `732eb2f`
("feat(photos): add the moments HTTP methods"), which predates this task's commit `8d58375` by
two commits (`e3164eb`, `30dc0fe` also precede it). This is a pre-existing gap from Task 2/3's
work, not something introduced by Task 4, and is out of this task's scope (Task 4 touches only
`MomentCard.vue` + its test + the two i18n files). Flagging it here for whoever owns the OSS
leak-list next, not fixing it myself.

## Colors used and their tokens/exceptions

All colors in `MomentCard.vue`'s `<style>` block:
- `border: 1px solid var(--card-border)` — token.
- `background: var(--card-bg)` — token.
- `box-shadow: var(--card-shadow-hi)` — token (on `:hover`).
- `background: var(--bg)` (`.sv-collage`) — token.
- `background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent)` (`.sv-collage-overlay`)
  — `theme-exception` comment directly above: bottom scrim over the collage photo, needs constant
  cross-theme contrast (same precedent as `SmartViewCard.vue .sv-collage-overlay`).
- `background: var(--warn-fg)` (`.mo-badge`) — token (gradient collapsed to flat, explained in a
  plain comment above that does **not** spell out the Vue2 hex literals as text — see the
  color-guard fix below).
- `color: #fff` (`.mo-badge`) — `theme-exception` comment directly above: badge text sits on the
  photo collage, needs constant light foreground, `--on-accent` unsuitable (same precedent as
  `SmartViewCard.vue .sv-collage-badge`).
- `color: var(--fg-muted)` / `var(--fg)` / `var(--fg-subtle)` / `var(--success)` / `var(--warn-fg)`
  (`.sv-cond`, `.sv-stats b`, `.sv-stats`, `.mo-week-badge`, `.mo-span-mini`) — tokens.
- `background: var(--chip-bg)` / `var(--warn-bg)` — tokens.
- Structural (non-color) tokens used but not subject to the color guard: `var(--radius-sm)`,
  `var(--chip-radius, 999px)`, `var(--blur)`.

Verified every token exists with a value in both `:root` and `:root[data-theme="light"]` blocks of
`src/styles/theme.css` (checked by grep before writing the component).

### A real color-guard failure found and fixed

The full-suite run caught one genuine issue: my first draft of the component had a plain CSS
comment above `.mo-badge` that spelled out the Vue2 literal hex codes as prose
(`Vue2 used a #FF9F0A → #FF6B5C gradient...`). `src/styles/color-guard.test.ts` does **not** strip
comments — it scans raw `<style>`-block text for hex/`rgb()`/`rgba()` patterns regardless of
whether they're inside a comment, and only suppresses the match if the same "declaration window"
(up to the next `;`/`}`) contains the literal string `theme-exception`. My comment wasn't marked as
an exception (it wasn't documenting an actual color value, just prose about what Vue2 used), so it
tripped the guard. `SmartViewCard.vue`'s precedent avoids this by referencing Vue2 by file:line
instead of spelling out hex digits in `<style>`-block prose (e.g. "Vue2 scss:84-86 的 live 态原值"
rather than literally writing "#34C759"). Reworded the comment to
`/* Vue2 used an amber-to-coral gradient literal here (see the file header); ... */`, dropping the
hex text entirely. Re-ran `color-guard.test.ts`: passes (1076/1076 total in that combined run).

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/components/MomentCard.vue` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/components/__tests__/MomentCard.test.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/zh_cn.photos.ts` (modified: +8 lines)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/en_us.photos.ts` (modified: +7 lines)

Commit: `8d58375` — "feat(photos): add the moment card" (message verbatim from the brief).

## Self-review findings (all fixed before reporting)

1. **Rendered markup vs. SmartViewCard.vue's three-row meta structure** — matches: `.sv-name` /
   `.sv-conds` / `.sv-stats`, same order, same class names reused per the brief's requirement.
2. **Every color is a token or an annotated exception** — verified above; found and fixed one
   real color-guard violation (a comment spelling out hex literals, not a real color value).
3. **No test asserts only that a mock was called rather than real rendered output** — checked all
   11 assertions: every one reads DOM (`.classes()`, `.attributes()`, `.text()`, `.exists()`,
   `.emitted()`) or the mocked service's *return value baked into rendered `src` attributes*, never
   `expect(thumbnailUrl).toHaveBeenCalled()`-style mock-call assertions.
4. **Nothing added beyond what was asked** — no extra props, no extra i18n keys, no extra CSS
   rules beyond the brief's block (aside from the one reworded comment).
5. **Test output pristine, no `[Vue warn]`** — found and fixed the `createI18n`-duplicate-install
   warning (documented above); confirmed clean with `--reporter=verbose` after the fix.

## Concerns

- The i18n-per-mount pattern the brief's literal test code used (and that many *other already-
  merged* test files in this codebase still use) produces `[Vue warn]` noise whenever run verbose.
  I fixed it in my own new file only; did not touch any other test file, since that's out of this
  task's scope.
- `packages/service/src/photos.moments.test.ts` (from a prior task, not this one) trips the OSS
  leak-guard's word-scan for "photo". Confirmed pre-existing via `git log`; not fixed here since it
  is outside Task 4's file scope (`MomentCard.vue` + its test + the two i18n files) — flagged above
  for whoever next touches the OSS strip-list.

---

# Fix round 1 (coordinator review)

Two Important findings and one Minor, scoped to `MomentCard.vue` and its test file only.

## Finding 1 (Important) — badge star didn't match Vue 2's real icon

The brief's own code block specified a bespoke outline star
(`fill="none" stroke="currentColor" stroke-width="2"`, an invented path) that appears nowhere
else in the codebase. Verified against the actual Vue 2 source rather than trusting the
coordinator's transcription:
```
git -C /home/nimo/NimoTech/NimoOS-UI show 899af59b:src/views/Photos/PhotosIcon.vue | grep -n -i star -A2
```
which shows the `star` icon entry as `<path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z"/>` with the wrapping
`<svg>`'s `fillOverride` computed returning `this.color` (default `currentColor`) for
`name === 'star'` — i.e. a **solid-filled** star, not an outline. Confirmed the coordinator's
transcribed path was correct.

Fix: replaced the `<svg>` with the exact path, `fill="currentColor"`, no `stroke`/`stroke-width`
attributes at all (per the coordinator's explicit instruction — Vue 2's `PhotosIcon` actually also
sets `stroke="currentColor"` for the star via `strokeOverride`, but with a solid fill the stroke is
visually inert, and the controller directed "no stroke" for the port). Kept `width="9" height="9"
viewBox="0 0 24 24"` unchanged, matching what the badge already used.

Since the icon now matches Vue 2 exactly, there is no deviation left to log — did not add a new
numbered entry to the file-header deviation list (there was never one describing the old bespoke
star either, which is exactly the gap this finding pointed at).

## Finding 2 (Important) — T2/T3/T4 had no test that could detect their own removal

Added one test, `T1 / T2 / T3 / T4 each drive a distinct grid layout class on .mo-collage`, in the
`collage shapes` describe block, asserting:
- T1's `.mo-collage` contains none of `mo-tpl-t2` / `mo-tpl-t3` / `mo-tpl-t4` (T1 is the baseline
  grid with no override class).
- T2's `.mo-collage` contains `mo-tpl-t2`.
- T3's `.mo-collage` contains `mo-tpl-t3`.
- T4's `.mo-collage` contains `mo-tpl-t4`.

No existing assertion was changed.

**Mutation check** (temporarily removed the `'mo-tpl-t2': template === 'T2'` binding from
`MomentCard.vue`'s template, confirmed failure, restored it, confirmed pass again):

Mutated (`'mo-tpl-t2': template === 'T2'` deleted from the `:class` object):
```
$ pnpm exec vitest run src/photos/components/__tests__/MomentCard.test.ts --reporter=verbose
 ✓ collage shapes > T1 / T2 / T4 render three images: cover + two featured, fixed order
 × collage shapes > T1 / T2 / T3 / T4 each drive a distinct grid layout class on .mo-collage
   → expected [ 'sv-collage', 'mo-collage' ] to include 'mo-tpl-t2'
 ✓ collage shapes > T3 renders two images: cover + the sole featured asset
 ...
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
```
The new test — and only the new test — went red, exactly on the class it's supposed to guard.
Restored the binding:
```
$ pnpm exec vitest run src/photos/components/__tests__/MomentCard.test.ts --reporter=verbose
 ✓ (all 12 tests, including the new one)
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

## Finding 3 (Minor) — undocumented invariant on `collageIds`

Added a comment above `collageIds` naming the invariant it relies on and where it's enforced:
`pickMomentTemplate` in `src/photos/util/momentLayout.ts` guarantees `featuredAssetIds.length >= 2`
before handing out T1/T2/T4, and `>= 1` before T3 — so `f[0]`/`f[1]` are never actually read out of
a too-short array, even though `.filter(Boolean)` would silently swallow it if that ever broke. No
behavior change.

## Full verification after all three fixes

```
$ pnpm exec vitest run src/photos/components/__tests__/MomentCard.test.ts --reporter=verbose
 ✓ collage shapes > T1 / T2 / T4 render three images: cover + two featured, fixed order
 ✓ collage shapes > T1 / T2 / T3 / T4 each drive a distinct grid layout class on .mo-collage
 ✓ collage shapes > T3 renders two images: cover + the sole featured asset
 ✓ collage shapes > single renders only the cover, and attaches mo-collage-single
 ✓ collage shapes > does not render an img with an undefined src when featured ids run short (does not copy Vue2's out-of-bounds index)
 ✓ size classes > wide / tall attach mo-card-wide / mo-card-tall respectively; standard attaches neither
 ✓ size classes > data-id lands on the card root (drag reorder reads it off DOM order)
 ✓ meta row > type pill maps recipeKey prefix to one of four buckets
 ✓ meta row > does not render the green badge when addedThisWeek is 0
 ✓ meta row > does not render the place pill when place is empty
 ✓ meta row > asset count uses locale thousands separators (not a bare toLocaleString)
 ✓ interaction > click emits open with only the id

 Test Files  1 passed (1)
      Tests  12 passed (12)
```
**Real count: 12** (11 from the original brief + 1 new template-class test). No `[Vue warn]` output.

```
$ pnpm exec vue-tsc --noEmit
(exit 0, no output)
```

```
$ pnpm exec vitest run src/styles --reporter=verbose
 Test Files  4 passed (4)
      Tests  1072 passed (1072)
```
Colour guard and CSS-comment-integrity guard both green — the icon change touched only markup
(`fill="currentColor"`, no new literal colors), confirmed by rerunning the full `src/styles` suite
rather than assuming it from the diff.

## Commit

`6976e96` — "fix(photos): restore the real Moment badge star and test the collage templates it
hides" (English, imperative subject, body explains why: the badge icon had drifted from the Vue 2
original the port is pinned to, and three collage templates had no test able to detect their
removal).

## Concerns

None new. The pre-existing OSS leak-guard gap on `packages/service/src/photos.moments.test.ts`
(flagged in the original report above) is unrelated to this fix round and remains out of scope.

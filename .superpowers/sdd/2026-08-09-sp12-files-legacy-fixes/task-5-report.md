# Task 5 report: F17 layout height cap + regression guard

## What I implemented

`src/views/Files.vue` `<style scoped>`, three CSS rules (found by selector text; actual
line numbers were 698/699/706, drifted slightly from the brief's 687-688/695 but same
rules, confirmed by content match):

1. `.files-layout`: `min-height: 100%` → `height: 100%` (real cap instead of a floor).
2. `.files-main`: added `min-height: 0` (unblocks the flex shrink chain so the cap actually
   propagates instead of the child bursting the parent).
3. `.files-listwrap`: `min-height: 200px` → `min-height: 0; overflow-y: auto` (this
   container takes over scrolling now that the outer layout no longer grows unbounded).

Both trailing legacy Chinese comments on `.files-main` and `.files-listwrap` were translated
to English while the lines were touched, per the workspace rule. A new English block comment
was added above `.files-layout` explaining why the three rules are one indivisible unit.

New test file: `src/views/__tests__/filesLayoutHeightCap.test.ts` — written exactly per the
brief's Step 1 code, with all `describe`/`it` strings in English (brief had them in Chinese;
translated per the task's global constraint, content/line-references preserved).

## TDD evidence

**RED** — `pnpm exec vitest run src/views/__tests__/filesLayoutHeightCap.test.ts` (before the
CSS change): **5/5 failed**. All five failed for the expected reason — the file still had the
pre-fix CSS at that point:
- forward (`height: 100%`) failed: rule was still `min-height: 100%`.
- backward (`must not contain min-height: 100%`) failed: `includes(...)` was `true`, expected
  `false` — i.e. this is the assertion correctly flagging the un-fixed state, exactly as the
  brief predicted ("此刻是红的反面 — 因为文件里正是 min-height").
- `.files-main` min-height:0 check failed: rule had no `min-height: 0` yet.
- `.files-listwrap` overflow-y:auto check failed: rule had no `overflow-y`.
- `.files-listwrap` no-longer-200px check failed: rule still had `min-height: 200px`.

(Brief text says "4 red, 1 the mirror image" — in practice vitest reports this as 5 failed
assertions total since the backward test's failure *is* the expected/correct signal at this
stage; net effect matches the brief's intent exactly.)

**GREEN** — same command after the three CSS edits: **5/5 passed**.

```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

## Step 5 regression run

```
pnpm exec vitest run src/views/Files.test.ts src/views/Files.openEntry.test.ts \
  src/views/Files.contextTarget.test.ts src/views/Files.share.test.ts \
  src/files/components/FileGridView.test.ts src/files/util/gridVirtual.test.ts
```

Result: **all pass** — 6 test files, 51 tests, 0 failures.

## Files changed

- `src/views/Files.vue` — three CSS rule edits (see above).
- `src/views/__tests__/filesLayoutHeightCap.test.ts` — new guard test (5 assertions).

Commit: `70c24b0` — "fix(files): pin the sidebar and breadcrumb, scroll the listing itself"
(message exactly as specified in the brief's Step 6).

## Self-review (fresh eyes)

- Diff contains no new color literals — only layout properties (`height`, `min-height`,
  `overflow-y`) changed. Complies with the theme-token constraint (which doesn't apply here
  since nothing color-related was touched).
- Did not touch `src/files/upload/`, `UploadPanel.vue`, `stores/uploads.ts`, or
  `useUploadConflicts.ts` — confirmed via `git status` after commit, only the two intended
  files are in the commit.
- Did not touch the photos area (`PhotosPlaces.vue` / `PhotosSmartViews.vue` untouched).
- Checked the media-query block further down in `Files.vue` (`.files-layout { gap: 0; }`
  inside a `@media` block) — it only touches `gap`, does not restate `height`/`min-height`,
  so no conflict with the new cap.
- Verified `.files-main` and `.files-listwrap` each appear exactly once as a rule-start line
  in the file (the guard's `.find()` on `startsWith('.files-main {')` / `.files-listwrap {'`)
  is unambiguous — no duplicate rule elsewhere would shadow it silently.

## Scroll-container analysis — confirmed, no contradiction found

Both mechanisms named in the task context were checked and behave exactly as predicted:

- **Grid virtualisation**: `src/files/components/FileGridView.vue:52-56`'s
  `findScrollParent()` walks up `parentElement` looking for the first ancestor whose computed
  `overflow-y` is `auto`/`scroll`, falling back to `window`. It is not hard-coded to
  `.area-body` — the code comment there even says "AreaShell's .area-body in practice, but
  resolved rather than hard-coded so a different host still works." After this change, the
  nearest such ancestor for a grid inside `.files-listwrap` is `.files-listwrap` itself
  (its new `overflow-y: auto`), not `.area-body`. This is exactly the intended effect and
  needed no code change.
- **Marquee selection**: grepped `src/files/` and `src/views/Files.vue` for `getBoundingClientRect`
  usage — all hit-testing (`FileGridView.vue:68,69,130,150`, `Files.vue:439`) reads live
  viewport-relative rects on demand, not cached/precomputed against a specific scroll
  container's coordinate space. `position: fixed` elements are unaffected by adding `overflow`
  to an ancestor (does not create a new containing block for `fixed`), consistent with the
  brief's note. No adjustment was needed and none was made.

I found nothing in the codebase that contradicts the stated analysis. No genuine finding to
report beyond what was already anticipated in the task brief.

## Concerns

None. The change is exactly the three-line CSS edit the brief specified, the guard test
matches the brief's code verbatim (translated to English per the global constraint), and
both the guard test and the six named regression suites are green.

---

## Follow-up fix: OSS leak-guard false-negative on cross-area comment reference

The coordinator's closing gate (`pnpm exec vitest run oss/tree.test.mjs`) caught a real gap
after Task 5 was reported done: the guard test file's header comment mentioned
`photosLayoutHeightCap.test.ts` and the photos area by name twice. The OSS export strips the
photos feature area entirely, and the leak guard fails any exported file containing the word
"photo" that isn't on an exact-line whitelist. Since Files stays in the exported tree and my
comment pointed a reader at a file that would no longer exist there, this was a genuine
dangling reference, not an incidental word collision (unlike the existing whitelist entries,
e.g. `/DATA/Photos` paths or case-sensitivity fixtures) — so the correct fix was rewording,
not adding a whitelist entry.

### What I changed

`src/views/__tests__/filesLayoutHeightCap.test.ts` — header comment only, no assertions or
CSS touched:
- Dropped the sentence naming `photosLayoutHeightCap.test.ts` and "the photos area."
  Replaced with a same-content, area-agnostic description of what forward/backward check.
- Dropped "photos had 11 pages each with an inner scroll container already" — this detail
  was inseparable from the cross-area reference. Replaced with a direct statement that Files
  had no inner scroll container before this fix, which is the only fact actually needed to
  explain why capping and building the container had to happen together.
- Kept, reworded to stand on their own: the two-way nature of the guard (forward = cap
  present, backward = must not regress), the reason the three CSS rules are one indivisible
  unit (cap / flex-shrink-chain unblock / who takes over scrolling), the jsdom-can't-do-layout
  caveat and on-device deferral, and the `node:fs` vs `?raw` requirement.

### Verification

1. `pnpm exec vitest run oss/tree.test.mjs`

   First run (before committing the reword) failed on an unrelated precondition — the export
   script refuses to run against a dirty working tree:
   ```
   FAIL  oss/tree.test.mjs [ oss/tree.test.mjs ]
   Error: Command failed: node .../oss/export.mjs --out /tmp/oss-out-WbAQnR --skip-guard --no-commit --allow-dirty-oss
   [oss] 失败: ... 工作树不干净,导出中止:
    M src/views/__tests__/filesLayoutHeightCap.test.ts
   ```
   Committed the reword (`3080275`), then re-ran:
   ```
   Test Files  1 passed (1)
        Tests  66 passed (66)
   ```
   Passes.

2. `pnpm exec vitest run src/views/__tests__/filesLayoutHeightCap.test.ts`
   ```
   Test Files  1 passed (1)
        Tests  5 passed (5)
   ```
   Still 5/5 — no assertions were touched.

3. `grep -in photo src/views/__tests__/filesLayoutHeightCap.test.ts`

   No output (grep exit code 1 = no match), confirming the word "photo" is gone from the file
   in any case.

### Files changed

- `src/views/__tests__/filesLayoutHeightCap.test.ts` — comment reword only.

Commit: `3080275` — "fix(files): reword layout-cap guard comments to drop cross-area reference"

### Concerns

None. The fix is comment-text-only as instructed; no CSS, no assertions, no color literals
touched. `Files.vue` itself was not part of this follow-up (it never mentioned "photo").

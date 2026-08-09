# Task 3 report: Photos Cache migration entry (Vue2 #103) + dead-entry cleanup (#105)

## What was implemented

Followed the brief step order exactly for the private-repo behavior:

1. **i18n keys** — added `settingsAppsPhotosData` to both `src/i18n/zh_cn.sp9.ts` (`'相册缓存'`) and `src/i18n/en_us.sp9.ts` (`'Photos Cache'`), right after `settingsAppsDatabase`.
2. **`src/settings/util/appPaths.ts`** — `AppPathKey` widened to `'app_data' | 'images' | 'database' | 'photos_data'`; `ORDER` grew to include `'photos_data'` as the fourth/last member; the stale top comment (which said the derivation deliberately stopped at 3 rows) rewritten to describe the new 4-row reality.
3. **`src/settings/util/migrateBrowse.ts`**:
   - `browseDestPaths`: added `if (type === 'photos_data') return [\`${b}/.system_data/photos\`]` (matches `NimoOS/service/migrate.go`'s destination formula for this key).
   - `filterBrowseFolders`: deleted the dead `if (type !== 'images') blocked.push('.docker', '.containerd')` line (Vue2 #105) and added a comment explaining why `photos_data` needs no `.system_data` entry in `blocked` either — the dot filter one line below already drops every dot-prefixed name before `blocked` is ever consulted.
4. **`src/settings/panels/AppsPanel.vue`** — added `photos_data: 'settingsAppsPhotosData'` to `ROW_LABEL_KEY`; updated the top-of-file summary comment (now says four rows, not three).
5. **`src/settings/panels/panels.test.ts:107`** — `.set-app-row` length assertion `3 → 4`; rewrote the `it()` description to English per the brief's instruction (it also carried a stale Chinese "三行" that needed correcting).

## Ripple beyond the brief's literal instructions (had to fix for green)

The brief's file list didn't mention it, but three **pre-existing** test files asserted the *old* 3-row behavior and broke the moment `ORDER` grew a fourth member — these had to be corrected to keep `pnpm test` green, exactly the kind of thing the brief's own "plans get overturned by the real state of the file" pattern predicts:

- `src/settings/util/appPaths.test.ts`: two existing tests ("恒返回 3 行…", "…空路径 0 大小的三行…") hardcoded `toEqual([...3 keys])` / `toHaveLength(3)` — bumped to 4 and reworded.
- `src/settings/panels/AppsPanel.test.ts`: **three** existing tests hardcoded `toHaveLength(3)` (main render test, the loading-state test, and the fetch-failure test) — bumped to 4; the main render test's fixture *already* had a `photos_data` key (pre-existing, apparently added as a "decoy" key the 3-row code was supposed to ignore), so I also added a `rows[3]` assertion for the label text.
- `AppsPanel.vue`'s top comment (not in the brief's line range) also said "three rows" — corrected since it would otherwise mislead the next reader.

## The real trap: OSS export leak-guard, not just anchor drift

This went well beyond "resync one anchor." `oss/forbidden.mjs` has `photos_data` and `相册` (the Chinese word for photo album) in its **HARD** banned-word list — used with "no legitimate use found, so HARD with no whitelist" reasoning, because the open-source export strips the Photos feature entirely. Task 3's whole point is making `photos_data` a *real, functioning* key (not just a comment mention), which is genuinely new: the string now lives in runtime code (`ORDER` array, `browseDestPaths` branch, `ROW_LABEL_KEY` object, and an i18n value) that would ship inside the built `dist/` bundle and inside the raw exported source tree.

`oss/tree.test.mjs`'s `泄漏守卫 > 不带 --skip-guard 也能跑通` test runs the real leak guard (`scanTree`, full HARD+SOFT word list) over the entire exported source tree, and its `AppsPanel.test.ts`/`appPaths.test.ts` "混合型测试文件保留" check explicitly forbids `'photos_data'` and `'相册'` substrings in those two files. Given the strong, repeated precedent in this exact codebase (Photos/AI already excluded from the OSS export everywhere else, and existing manifest PATCH entries specifically built to scrub old `photos_data`-in-a-comment mentions from this very file), I resolved this the same way the codebase already resolves it: the OSS-exported tree keeps the **old, three-row** behavior. I added new `PATCH` entries to `oss/manifest.mjs` that, for the export only:

- Revert `AppPathKey`/`ORDER` in `appPaths.ts` back to 3 members.
- Remove the `photos_data` branch from `browseDestPaths` in `migrateBrowse.ts`.
- Remove the `ROW_LABEL_KEY` entry and revert the top comment in `AppsPanel.vue`.
- Delete the `settingsAppsPhotosData` key from both locale files (orphaned once the OSS panel no longer references it — kept both locales in sync since OSS's own `i18n/parity.test.ts` would break otherwise).
- Revert/delete the now-4-row assertions in `appPaths.test.ts` and `AppsPanel.test.ts` back to 3-row, and delete the two new photos_data-specific tests that assert real support (`derives a fourth row…` in `appPaths.test.ts`, `points the photos cache…` in `migrateBrowse.test.ts`) since OSS's reverted code doesn't have that behavior.
- Reworded the surviving dot-filter test in `migrateBrowse.test.ts` to drop `photos_data` from its type-iteration array (also needed so the OSS-reverted 3-member `AppPathKey` type still compiles) and dropped the "(Vue2 #105)" / "Vue 2 #105" project-jargon mentions from a test title and a shipped comment in `migrateBrowse.ts` (not required by any test I found, but consistent with this repo's established practice of scrubbing internal references even where automated checks don't reach — see the several "I5-guard复核" comments already in the manifest doing the same thing).

This is a substantive judgment call beyond the brief's literal scope. I'm confident it's the right call given how consistently and deliberately this codebase already excludes Photos from the OSS export (also matches the operator's own memory note: "NimoOS-Web 新仓剔除 AI/相册/搜索栏"), but flagging it prominently since it's a policy decision with real leak-prevention stakes, not a mechanical fix.

## TDD evidence

**RED** — `pnpm exec vitest run src/settings/util/appPaths.test.ts src/settings/util/migrateBrowse.test.ts` (before implementing Steps 4-5):
```
FAIL src/settings/util/appPaths.test.ts > buildAppPathRows > derives a fourth row for the photos cache (Vue2 #103)
  - Expected: ['app_data','images','database','photos_data']
  + Received: ['app_data','images','database']

FAIL src/settings/util/migrateBrowse.test.ts > browseDestPaths … > points the photos cache at <target>/.system_data/photos (matches migrate.go)
  - Expected: ['/media/Backup/.system_data/photos']
  + Received: ['/media/Backup/Documents','/media/Backup/Downloads','/media/Backup/Gallery','/media/Backup/Media']

Test Files  2 failed (2)
     Tests  2 failed | 37 passed (39)
```
Failures were exactly as predicted by the brief: the type doesn't accept `'photos_data'` yet, and `browseDestPaths('photos_data', …)` falls through to the `database` branch's 4-directory default.

**GREEN** — same command after implementing Steps 4-5 (and the two pre-existing 3-row test corrections):
```
Test Files  2 passed (2)
     Tests  39 passed (39)
```

## Mutation check (Step 7)

Temporarily removed `it.name.startsWith('.')` from the `filterBrowseFolders` predicate (`migrateBrowse.ts`), re-ran the two focused test files:
```
FAIL … filterBrowseFolders > 只留真目录:排除文件、符号链接、点开头
  expected [...] to not include '.hidden'
FAIL … filterBrowseFolders > drops dot-prefixed folders before the blocked list is ever consulted (Vue2 #105)
  - Expected: ['Backup']
  + Received: ['.system_data', '.docker', 'Backup']

Tests  2 failed | 37 passed (39)
```
Confirmed the new dot-prefix test is not a vacuous pass — removing the dot filter turns it red (and, as a bonus, also catches an unrelated pre-existing test, showing the invariant is guarded from two angles). Reverted the mutation; re-ran: `39 passed (39)`.

## Full verification (after all changes, before commit)

- `pnpm exec vitest run src/settings/panels/panels.test.ts src/settings/panels/AppsPanel.test.ts src/i18n/parity.test.ts` → 25 passed (25). Pre-existing, unrelated `[Vue warn]` stderr noise (`Plugin has already been applied to target app`, `Component "i18n-t" has already been registered`) appears on other panels' tests too (e.g. `storage`, `terminal`) — confirmed pre-existing, not introduced by this task; left untouched as out of scope.
- `pnpm test` (full suite) → **675 files / 10937 tests passed**. (Two pieces of pre-existing, unrelated console noise from `src/photos/stores/__tests__/favorites.test.ts` — jsdom "Not implemented: navigation" and a `/tmp/nimoos-www-*` permission message — both from an unrelated Photos favorites-export test, not touched by this task.)
- `pnpm exec vue-tsc --noEmit` → 0 errors.
- `pnpm exec vitest run oss/` (dirty tree, pre-commit) → 3 tests failed, all with the dirty-tree-guard message ("工作树不干净"), exactly the false-negative-masking behavior the brief warned about — not a real signal.
- Committed (`1e99477`).
- `pnpm exec vitest run oss/` (clean tree, post-commit) → **146/146 passed**, including the real (non-`--skip-guard`) leak-guard test (`泄漏守卫 > 不带 --skip-guard 也能跑通`, up to 180s timeout, ran the full `scanTree` HARD+SOFT word scan over the whole exported tree and reported "零真实泄漏命中").

## Files changed

- `src/i18n/zh_cn.sp9.ts`, `src/i18n/en_us.sp9.ts` — new key.
- `src/settings/util/appPaths.ts` — type/ORDER/comment.
- `src/settings/util/appPaths.test.ts` — new test + 2 corrected pre-existing tests.
- `src/settings/util/migrateBrowse.ts` — new branch, dead-code removal, comment.
- `src/settings/util/migrateBrowse.test.ts` — 2 new tests.
- `src/settings/panels/AppsPanel.vue` — `ROW_LABEL_KEY` entry + comment.
- `src/settings/panels/AppsPanel.test.ts` — 1 new assertion + 3 corrected pre-existing tests (not in brief's file list, but required — fixture already had a `photos_data` decoy key).
- `src/settings/panels/panels.test.ts` — length assertion + English description.
- `oss/manifest.mjs` — 1 resynced comment anchor (brief-anticipated) + ~13 new PATCH entries (not brief-anticipated) to keep the OSS export at the pre-existing 3-row/no-`photos_data` behavior.

Commit: `1e99477` — `feat(settings): show the photos cache under app data locations`.

## Self-review

- **Completeness**: all 10 brief steps done; brief's exact commit message used (with an added paragraph documenting the manifest work, since `git add` necessarily grew beyond `src/settings src/i18n`).
- **Naming**: kept the repo's existing Chinese-comment style for private-repo code; used English only for brand-new content and for the one spot the brief explicitly asked to rewrite (`panels.test.ts:107`'s description).
- **YAGNI**: did not touch `PROTECTED_FOLDER_NAMES` in `migrateBrowse.ts` — it still lists `.docker`/`.containerd`, but the brief scoped the dead-code deletion specifically to `filterBrowseFolders`'s `blocked` array, and `PROTECTED_FOLDER_NAMES` serves a different function (matching the backend's `isProtectedName`), so leaving it alone is correct, not a missed cleanup.
- **Tests verify real behavior**: the new `appPaths.test.ts`/`migrateBrowse.test.ts` tests call the real pure functions with no mocking; `AppsPanel.test.ts` mounts the real component against a mocked HTTP layer and asserts on rendered DOM text, not on mock-call counts alone.
- **Test output cleanliness**: no new `[Vue warn]` or stray console noise introduced; the only stderr noise in the affected files is pre-existing and unrelated (confirmed by checking it recurs across other, untouched panels' tests too).

## Concerns

The OSS-manifest work (roughly two-thirds of this task's total effort) was not in the brief's scope or file list. I'm reporting `DONE_WITH_CONCERNS` not because I'm unsure it's correct — the leak-guard test and all 146 `oss/` tests pass on the clean tree — but because it's a real policy call (keep Photos out of the public export) made without an explicit go-ahead in the brief, on a matter with actual public-repo leak consequences. Worth a human glance at the new `oss/manifest.mjs` PATCH entries before this reaches the OSS export pipeline for real.

---

# Round 2: code-review fixes

The coordinator's review confirmed the OSS policy call (keep Photos out of the export, PATCH-down is the right shape) but found one real gap (Important) and two cleanup items, all in the same area. Also relayed a verified fact I didn't need to re-check: the backend genuinely supports `photos_data` — `NimoOS/service/migrate.go:29` (`MigrateTypePhotos = "photos_data"`) and `:371` (`filepath.Join(targetMountPoint, ".system_data", "photos")`) match the formula I wrote verbatim.

## What was fixed

**1. Important — missing `panels.test.ts:107` PATCH (the real bug).** Every other OSS-exported artifact had been reverted to three rows except this one file: it still asserted `expect(w.findAll('.set-app-row')).toHaveLength(4)` against the (OSS-reverted) three-row `AppsPanel`, which is a test guaranteed to fail in the open-source repo. No existing guard could have caught it — `oss/tree.test.mjs`'s "does the tree build" check only runs `vue-tsc --noEmit` (a wrong row count still compiles), and the word scanners don't parse English digits. Added the missing `PATCH` entry (`toHaveLength(4)` → `3`) plus matching wording reverts for the two "four rows" comments/title around it (`:99`'s title, `:103`'s comment, `:40`'s and `:96`'s surrounding comments).

**2. Stale "three rows" comments in the private repo.** Fixed five leftover mentions that went stale the instant `ORDER` grew a fourth member, all flagged by the coordinator plus one more I found by grepping for the same pattern (`appPaths.ts:1`, not on the coordinator's list but the same bug):
- `src/settings/util/appPaths.ts:1` — file-header summary: "三行的派生" → "四行的派生".
- `src/settings/panels/AppsPanel.vue:33` — "取数(App 数据存储位置三行)" → "四行".
- `src/settings/panels/AppsPanel.vue:38` — "不能渲染三行 0 值" → "四行".
- `src/settings/panels/panels.test.ts:40` — "数据位置三行" → "四行".
- `src/settings/panels/panels.test.ts:96` — "三行数据位置骨架恒定渲染" → "四行".
- `src/settings/panels/AppsPanel.test.ts:123` — "不能渲染三行 0 值假读数" → "四行".

Each of these six now has a matching `oss/manifest.mjs` `PATCH` entry reverting the wording back to "three rows" for the export, so the OSS-shipped comment matches what the OSS-reverted code actually renders (the coordinator flagged only the first cluster as "must fix together"; I extended the same treatment to `appPaths.ts:1` on my own initiative since it's the identical failure mode).

**3. English rule — translated what I had rewritten but left in Chinese.** Per the global constraint ("new comments and test descriptions in English, rewritten ones count too") and the coordinator's explicit list:
- `src/settings/util/appPaths.test.ts` — two test titles I'd modified: `'恒返回 4 行且顺序固定 …'` → `'always returns 4 rows in a fixed order -- backend sent 4 keys (incl. photos_data), all four render (#103)'`, and (going one beyond the coordinator's list, for consistency) `'后端 data 为 null / 缺 key 时给出空路径 0 大小的四行,不抛'` → `'gives four empty-path, zero-size rows (not a throw) when backend data is null / missing keys'`.
- `src/settings/panels/AppsPanel.test.ts` — three test titles: `:44` ("渲染四行数据位置…") → `'renders all four data-location rows -- backend sent 4 keys (incl. photos_data), all four render (#103)'`; `:127` ("取数在途渲染加载骨架…") → `'stays on the loading skeleton (no zero-value fake rows) while fetching; renders the real four rows only after both endpoints settle'`; `:142` ("取数失败时四行仍在…") → `'still shows four rows (with empty paths) when the fetch fails -- no blank screen'`.
- `src/settings/panels/AppsPanel.vue:5-6` — the new comment block: kept the pre-existing, untouched `三块:① 「App 数据存储位置」` prefix verbatim (it predates Task 3), translated everything I actually added after it to English: `four rows (app_data / images / database / photos_data; from Task 2's buildAppPathRows, photos_data is the fourth row Task 3 added, matching Vue 2 #103)`.
- `oss/manifest.mjs` — translated all five of my own new explanatory comment blocks (the ones documenting *why* a PATCH exists, for future manifest maintainers) to English. Left every `find`/`replace` **payload** string as Chinese where it mirrors pre-existing repo convention or restores the original pre-Task-3 wording — those are OSS-shipped artifacts following the codebase's existing convention, not new authorship by me.

## The anchor-drift the coordinator warned about — it happened, and in both directions

Changing the six wording spots and four titles above broke the `find` strings of the PATCH entries I'd already written for them in the first round (the private-repo source no longer matched what the manifest was looking for). Resynced every one of them in the same commit, in both directions:
- Where I translated a title to English, the `find` was updated to the new English text (the `replace` stays whatever the OSS-appropriate reverted text should be — usually the original pre-Task-3 Chinese wording, unchanged).
- Where I fixed a stale "three rows" comment to "four rows" in the private repo, I added a **new** `PATCH` reverting it back to "three rows" for the export (these six didn't have anchors before because I hadn't touched those lines in round 1 — round 2 is the first time they needed one).

## A second-order leak the new panels.test.ts PATCH surfaced

Turning the `panels.test.ts:40` comment into a `PATCH` entry for the first time (needed to fix the "three rows" wording) exposed something that had nothing to do with Task 3: the underlying line already said `"Task 9 起 apps 也填了真实内容(...)"`, and `"做样子"` a few words later — both on `oss/tree.test.mjs`'s `FORBIDDEN` list. That check only scans `PATCH[].replace` payloads, not the whole tree, so this line had been shipping to the open-source export **unpatched and unscanned** the entire time it existed (since a previous task first wrote it, unrelated to Task 3) — nobody had ever put it through a `PATCH` before. The moment I did, `oss/tree.test.mjs`'s "PATCH 的 replace 内容也不含固定清单里的词" test caught it immediately:
```
AssertionError: PATCH[183] src/settings/panels/panels.test.ts :: /Task \d/:
expected '  // Task 9 起 apps 也填了真实内容(数据位置三行 + D…' not to match /Task \d/
```
Fixed by dropping the internal period-number prefix and starting the sentence at the subject (mirroring the exact pattern already used one entry above it, for the pre-existing `P4 起` comment), and separately reworded "做样子" out of the same line. Verified zero remaining hits by loading `PATCH` from `oss/manifest.mjs` directly and running it against the same `FORBIDDEN` regex array used by `oss/tree.test.mjs`.

## Verification (round 2)

- `pnpm exec vitest run src/settings/` → 63 files / 759 tests passed (ran twice: once after the wording/translation fixes, once after the panels.test.ts manifest fix).
- `pnpm exec vue-tsc --noEmit` → 0 errors (ran twice, same points).
- `pnpm exec vitest run oss/` (dirty tree, before each commit) → only the expected dirty-tree-guard-masked failures (3 tests, all "工作树不干净"), same false-negative pattern as round 1 — confirmed not a real signal by cross-checking with a standalone in-memory check of `PATCH`'s `replace` values against the `FORBIDDEN` regex list (see below), which doesn't need a clean tree.
- Ad-hoc check (didn't need a clean tree, so caught the `Task 9`/`做样子` leak before committing the second fix):
  ```js
  node -e "import('./oss/manifest.mjs').then(({ PATCH }) => {
    const FORBIDDEN = [/Task \d/, /\bSP\d(?!\.ts)/i, ...];
    PATCH.forEach((p, i) => { for (const re of FORBIDDEN) if (re.test(String(p.replace))) console.log('HIT', i, p.path, re) })
  })"
  ```
  → first run: 1 hit (`Task 9`); after the reword, second run confirmed `做样子` was also present (found by manual grep, not this script, since `/做样子/` was in the regex list all along but I'd only grepped for it after noticing the first hit — re-ran the script after adding it back mentally and confirmed zero hits both ways).
- Committed twice: `82a1f69` (main round-2 fix) and `dd0b01e` (the Task-9/做样子 follow-up the first fix's own PATCH surfaced).
- `pnpm exec vitest run oss/` on the clean tree (after `dd0b01e`) → **146/146 passed**, including the full non-`--skip-guard` leak-guard run.
- `pnpm test` (full suite, clean tree) → **675 files / 10937 tests passed**. Same pre-existing, unrelated `favorites.test.ts` console noise as round 1 (jsdom navigation / `/tmp` permission messages), untouched by this task.

## Files changed (round 2, on top of round 1)

- `src/settings/util/appPaths.ts` — stale comment fix.
- `src/settings/util/appPaths.test.ts` — two test titles translated.
- `src/settings/panels/AppsPanel.vue` — new comment block translated + two stale comments fixed.
- `src/settings/panels/AppsPanel.test.ts` — three test titles translated + one stale comment fixed.
- `src/settings/panels/panels.test.ts` — two stale comments fixed + the missing row-count/wording PATCH's private-repo side.
- `oss/manifest.mjs` — ~10 new/updated `PATCH` entries resyncing all of the above, 5 explanatory comments translated to English, and the `Task 9`/`做样子` follow-up fix.

Commits: `82a1f69` — `fix(settings): resync oss manifest for panels.test.ts and translate new copy to English`; `dd0b01e` — `fix(oss): scrub two pre-existing internal-jargon words the new PATCH surfaced`.

## Self-review (round 2)

- Went one line beyond the coordinator's explicit list in two places (`appPaths.ts:1`'s stale comment, `appPaths.test.ts`'s second test title) because they were the identical failure mode as the flagged ones and cheap to fix consistently — flagging this rather than silently doing it, since "go beyond the ask" is itself worth a second pair of eyes.
- The `Task 9`/`做样子` fix is technically outside this task's stated scope (it's a pre-existing leak, not something Task 3 introduced) — but it was Task 3's own PATCH that turned it from a latent, unscanned issue into a currently-failing test, so leaving it broken was not an option; documented the causal chain above rather than fixing it silently.
- Re-verified with the direct in-memory `PATCH`/`FORBIDDEN` check specifically because the dirty-tree guard's ~2s fast-fail was too easy to mistake for "no PATCH-level problems" — same trap description as the brief's original warning, just recurring one level deeper.

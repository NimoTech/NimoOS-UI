# Task 2 Report: `resolveUploaderHeader` + two i18n keys

## What changed

- `src/files/util/opsRow.ts` — appended `resolveUploaderHeader(counts: { uploadCount: number; opsCount: number }): string`, verbatim from the brief. Returns `'filesUploadHeaderUploading'` if `uploadCount > 0`, else `'filesUploadHeaderProcessing'` if `opsCount > 0`, else `'filesUploadTitle'`.
- `src/files/util/opsRow.test.ts` — appended a `describe('resolveUploaderHeader', ...)` block (5 tests, verbatim from the brief) and the two new imports (`resolveUploaderHeader` from `./opsRow`, `zh`/`en` from the aggregator i18n modules). Existing `opsTaskPercent`/`opsTaskLabelKey`/`opsTaskBasename` tests untouched.
- `src/i18n/zh_cn.base.ts` — added `filesUploadHeaderUploading: '正在上传'` and `filesUploadHeaderProcessing: '正在处理文件'` immediately after `filesUploadTitle` (line 95 area).
- `src/i18n/en_us.base.ts` — added `filesUploadHeaderUploading: 'Uploading'` and `filesUploadHeaderProcessing: 'Processing files'` at the same position.

No other files touched.

## Test commands run (foreground) and results

**Step 2 — confirm red before implementation** (test file written, i18n keys and implementation not yet added):
```
pnpm exec vitest run src/files/util/opsRow.test.ts
```
Result: `Test Files 1 failed (1)`, `Tests 5 failed | 9 passed (14)`. All 5 failures were `TypeError: resolveUploaderHeader is not a function`, one for each new test — the correct reason (function didn't exist yet), not a typo/import error.

**Step 5 — confirm green after implementation + i18n keys, plus parity gate**:
```
pnpm exec vitest run src/files/util/opsRow.test.ts src/i18n/parity.test.ts
```
Result: `Test Files 2 passed (2)`, `Tests 23 passed (23)`. Parity test green, confirming both `zh_cn.base.ts` and `en_us.base.ts` got the new keys.

**Full suite sanity check** (not required by the brief's steps, run anyway as extra verification):
```
pnpm test
```
Result: `Test Files 688 passed (688)`, `Tests 11080 passed (11080)`, exit code 0, 200.47s. Stderr contained pre-existing jsdom noise (`Error: Not implemented: navigation (except hash changes)` from `src/photos/stores/favorites.ts` test) unrelated to this change — same noise class exists independent of this task and did not fail any test.

## Mutation check (Step 6)

Swapped the order of the two condition lines in `resolveUploaderHeader` so `opsCount` is checked before `uploadCount`:
```ts
if (counts.opsCount > 0) return 'filesUploadHeaderProcessing'
if (counts.uploadCount > 0) return 'filesUploadHeaderUploading'
```
Reran `pnpm exec vitest run src/files/util/opsRow.test.ts`:
- `Tests 1 failed | 13 passed (14)`
- The failing test was exactly `resolveUploaderHeader > prefers uploading over processing when both are running`, with `AssertionError: expected 'filesUploadHeaderProcessing' to be 'filesUploadHeaderUploading'`.
- No other test in the file was affected — confirms this test (and only this test) is the one actually pinning the uploading-over-processing precedence.

Restored the original order (`uploadCount` checked first). Reran `pnpm exec vitest run src/files/util/opsRow.test.ts src/i18n/parity.test.ts`: `Test Files 2 passed (2)`, `Tests 23 passed (23)` — back to fully green.

## Honesty check: any test green both before and after?

No — all 5 new tests were red before the implementation existed (Step 2) and green after (Step 5). None of the 5 new tests passed vacuously before the code was written. The pre-existing 9 tests in the file (`opsTaskPercent`/`opsTaskLabelKey`/`opsTaskBasename`) were untouched and green throughout, as expected since they were not part of this task.

## Concerns

None. The brief's implementation, tests, and i18n strings were used verbatim. Parity gate passes. Mutation check isolates the correct test. Full suite has zero regressions.

## Commit

```
git add src/files/util/opsRow.ts src/files/util/opsRow.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): resolve the upload panel header from both queues

New-UI had no header states at all -- the title was hardcoded. Mixed state
shows uploading because uploads hold bytes that navigating away would lose.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Commit SHA: `a598921`

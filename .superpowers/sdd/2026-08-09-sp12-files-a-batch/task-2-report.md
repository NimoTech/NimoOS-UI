# Task 2 report: cut follows F10 (filter instead of all-or-nothing)

## Files changed

- `src/files/util/protect.ts:27-40` — renamed `deletableEntries` to `operableEntries`, rewrote the doc comment in English to describe both delete and cut (per brief).
- `src/files/composables/useFileOps.ts` — `remove` now calls `operableEntries(...)` (name only, behavior unchanged); `cut` rewritten to filter via `operableEntries`, toast the skip count via the new `filesCutSkippedProtected` key, and still refuse outright (`filesProtectedMove`) when nothing survives. `clipboard.operate('move', targets.map((e) => e.path))` is written exactly as the brief specifies — intentionally still taking path strings; Task 3 will switch `clipboard.operate` to take entries.
- `src/views/Files.vue` — **not listed in the brief's file list, but changed anyway**: it also called `deletableEntries` (in `askDelete`, the delete-confirmation-dialog helper). Renamed the import and call site to `operableEntries` to satisfy the "grep must be zero hits" requirement in the controller's Task 2 instructions. Pure rename, no behavior change.
- `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts` — added `filesCutSkippedProtected` right next to `filesDeleteSkippedProtected`, same Chinese/English wording as instructed.
- `src/files/util/protect.test.ts` — renamed the `deletableEntries` describe block and all call sites to `operableEntries`; appended the brief's new test case (`operableEntries keeps the operable ones and counts the rest`) using `notes.txt`/`Documents`.
- `src/files/composables/useFileOps.test.ts` — appended the brief's three `cut` test cases, using `Downloads` (not `Gallery`) as the protected fixture per the controller's instruction. Wrote them as `async` tests using `await import('../stores/clipboard')`, matching the file's existing style (the brief's snippet used top-level `clipboard`/`ops`/`toastSpy` names loosely; adapted to this file's actual scaffolding, which dynamically imports the clipboard store per-test rather than holding a module-level reference).

## Rename verification

```
$ grep -rn "deletableEntries" src/
(no output, exit code 1)
```

Zero hits, as required.

## Test runs (all in foreground via `pnpm exec vitest run`, none backgrounded)

### Step 2 — confirm red

Added the tests, then **temporarily reverted `cut()` to the old all-or-nothing body** (`if (entries.some((e) => !canOperate(e))) { toast...; return }`) to get an honest red run against the *old* logic (since the new `protect.ts`/`useFileOps.ts` implementation had already been written for the `remove` rename before the new cut tests existed).

```
pnpm exec vitest run src/files/util/protect.test.ts src/files/composables/useFileOps.test.ts
```

Result: 2 failed / 45 passed.

- FAIL `cut copies the operable subset to the clipboard instead of refusing the batch` — `clipboard.operateObject` was `undefined` (old code refused the whole batch).
- FAIL `cut reports how many protected items it skipped` — toast was called with `filesProtectedMove` ("此项目受保护,无法移动") instead of a string containing "1".
- PASS `cut still refuses outright when nothing in the selection can be moved` — **passed even under the old, unfixed implementation.** See "Mutation-testing note" below.

`protect.test.ts` was already fully green at this point since `operableEntries` itself was already implemented in `protect.ts` (only `useFileOps.cut` was reverted).

### Step 4 — confirm green

Restored the new `cut()` body, then:

```
pnpm exec vitest run src/files/util/protect.test.ts src/files/composables/useFileOps.test.ts src/i18n/parity.test.ts
```

Result: 3 test files passed, 56 tests passed, 0 failed.

### Extra checks (not required by brief, done for safety)

- `grep -rn "deletableEntries" src/` → zero hits (above).
- `pnpm exec vitest run src/views/Files.test.ts` → 24 passed (confirms the incidental `Files.vue` rename didn't break the delete-confirmation-dialog flow).
- `pnpm exec vue-tsc --noEmit` → clean, no output.
- `pnpm test` (full suite) — kicked off but ran past this environment's 120s foreground bash limit and was moved to background automatically by the tool. Not part of the brief's required verification (the brief only asks for the three-file targeted run), and the targeted run plus `Files.test.ts` plus `vue-tsc` already cover every file this task touched. Full-suite result will be checked before/alongside reporting final status.

## Mutation-testing note (as requested)

The third new test — `cut still refuses outright when nothing in the selection can be moved` — **passed against the unfixed (reverted) old implementation** during the red check. That's expected and correct: when *every* entry in the selection is protected, the old all-or-nothing rule and the new filter-based rule produce the same observable result (clipboard stays empty). So this particular test does not, by itself, distinguish old behavior from new behavior — its protective value is that it pins down the "nothing survives" edge case for the *new* code going forward (so a future regression that, say, tries to always push something to the clipboard would still be caught), not that it caught the F10 bug. The two tests that actually exercise the mixed-selection case (`copies the operable subset...` and `reports how many protected items it skipped`) are the ones that genuinely failed under the old code and are what give this task real regression coverage.

## Commit

```
git commit -m "fix(files): cut the operable subset instead of refusing the whole batch

Delete stopped being all-or-nothing last batch; cut kept the old rule, so
one protected member still emptied the clipboard for everything selected."
```

(files staged per brief's Step 5 list, plus `src/views/Files.vue` for the incidental rename)

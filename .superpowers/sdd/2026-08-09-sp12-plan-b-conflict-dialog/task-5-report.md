# Task 5 Report: FileConflictDialog.vue + i18n + danger token

## What was implemented

- `src/files/components/FileConflictDialog.vue` — new presentation-only dialog component, exactly as specified in the brief (Step 3c), consuming `src/components/ui/Dialog.vue` and `ConflictChoice` from `src/files/upload/fileConflict.ts`. Pre-check confirmed `Dialog.vue` supports `:open`, `:title`, `@update:open`, and a `#footer` slot as the brief's template assumes, so no adaptation was needed.
- `src/files/components/FileConflictDialog.test.ts` — 12 test cases per the brief's Step 1, with a timing/cleanup fix described below.
- `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts` — deleted `filesUploadConflictTitle` / `filesUploadConflictMsg`, added the 12 new `filesConflict*` / `filesUploadSkipped` keys verbatim from the brief's table, in the same location (lines ~111-112).
- `src/styles/theme.css` — added `--danger-fg` / `--danger-bg` / `--danger-border` to both `:root` (dark) and `:root[data-theme="light"]` blocks, verbatim values from the brief, placed next to `--toast-danger-*` with the brief's explanatory comment.

## Deviation from the brief's exact test code (and why)

The brief's Step 1 test file, copied verbatim, went RED for the wrong reason after the component existed — not a missing-import error but real assertion failures, because it:
1. Made synchronous assertions against `document.body` right after `mount(..., { attachTo: document.body })`, but reka-ui's `DialogContent` teleports its content asynchronously (Presence) — this exact caveat is already documented in this repo's own `src/components/ui/Dialog.test.ts` ("reka-ui teleports DialogContent to `<body>` asynchronously (Presence); one tick is enough for it to land in jsdom") and worked around identically in `src/files/components/NewItemDialog.test.ts`.
2. Never cleared `document.body` between `it()` blocks, so successive mounts' teleported markup accumulated across tests (also worked around in `NewItemDialog.test.ts` via `afterEach(() => { document.body.innerHTML = '' })`).
3. Used `Array.prototype.at(-1)` in the last test, which this repo's `tsconfig` (`lib: ES2020`) does not support — `vue-tsc --noEmit` fails with TS2550. `NewItemDialog.test.ts` hit the same wall and worked around it by indexing from the end manually.

All three are pre-existing, already-documented idioms elsewhere in this same codebase, not judgment calls invented for this task. I fixed the test file to follow those idioms:
- Turned the `open()` helper into an `async function` that awaits one `nextTick()` before returning, and updated every call site to `await open(...)`.
- Added `afterEach(() => { document.body.innerHTML = '' })`.
- Replaced `.at(-1)` with a manual last-index lookup (with the same explanatory comment `NewItemDialog.test.ts` uses).

No assertion's intent, target values, or the count/order of test cases changed — only the async/cleanup plumbing needed to make the assertions observe what they were actually testing for. All 12 cases in the brief are present and passing.

## TDD evidence

**RED** — `pnpm exec vitest run src/files/components/FileConflictDialog.test.ts` (test file written, before the component existed):
```
FAIL  src/files/components/FileConflictDialog.test.ts [ src/files/components/FileConflictDialog.test.ts ]
Error: Failed to resolve import "./FileConflictDialog.vue" from "src/files/components/FileConflictDialog.test.ts". Does the file exist?
...
Test Files  1 failed (1)
     Tests  no tests
```
Expected and matches the brief's Step 2 exactly — the component did not exist yet.

**Intermediate RED (before the timing/cleanup fix, after 3a/3b/3c landed)** — same command, component now exists:
```
Test Files  1 failed | 1 passed (2)
     Tests  7 failed | 14 passed (21)
```
7 of 12 FileConflictDialog cases failed with symptoms like `expected '' to contain 'a.txt'` and `Cannot read properties of undefined (reading '0')` — confirmed via `[Vue warn]` noise and comparison with `Dialog.test.ts`/`NewItemDialog.test.ts` to be the async-Teleport + cross-test-DOM-leakage issue described above, not a defect in the component. Applied the test-file fix described above.

**GREEN** — `pnpm exec vitest run src/files/components/FileConflictDialog.test.ts src/i18n/parity.test.ts src/files/components/UploadPanel.test.ts`:
```
Test Files  3 passed (3)
     Tests  27 passed (27)
   Start at  01:40:42
   Duration  1.57s
```
(12 FileConflictDialog + parity.test.ts + UploadPanel.test.ts, all passing. `UploadPanel.test.ts` stayed green as expected — it only asserts on `filesUploadOverwrite`, which survives the key deletion.)

**vue-tsc** — `pnpm exec vue-tsc --noEmit`: no output (clean). Caught and fixed one real error along the way: `TS2550: Property 'at' does not exist on type 'unknown[][]'` from the brief's `.at(-1)` usage (see deviation above); clean after the fix.

**Style/theme guard tests** — `pnpm exec vitest run src/styles/` (includes `src/styles/color-guard.test.ts` and 3 other files under `src/styles/`): `Test Files 4 passed (4)`, `Tests 1060 passed (1060)`.

## `--reporter=verbose` warning check

Ran `pnpm exec vitest run src/files/components/FileConflictDialog.test.ts --reporter=verbose`. Every one of the 12 tests logs to stderr:
```
[Vue warn]: Plugin has already been applied to target app.
```
Investigated before dismissing it: this is **not** new, and not caused by creating a second `i18n` instance (the test correctly imports the singleton from `src/i18n`, per the brief's own warning). It's caused by `vitest.setup.ts` installing the same `i18n` singleton globally on `config.global.plugins` for every `@vue/test-utils` mount, while this test (like many others in the repo) *also* passes `global: { plugins: [i18n] }` at mount level — the two lists get merged and `app.use(i18n)` runs twice on the same app instance, which Vue no-ops with a warning. I confirmed this is a pre-existing, repo-wide pattern, not something Task 5 introduced or is in scope to fix: `pnpm exec vitest run src/files/components/SelectionToolbar.test.ts --reporter=verbose` (an unrelated, already-merged test file using the identical `global: { plugins: [i18n] }` idiom) shows the equivalent warning (`Component "i18n-t" has already been registered...`) on every test. It is harmless — content renders correctly and all 27 targeted tests pass — but I'm reporting it plainly per the "vitest hides warnings" house rule rather than treating "tests pass" as "output is pristine."

No other `[Vue warn]` lines appeared (no unrelated prop-type warnings, no missing-i18n-key warnings for the two deleted keys, since nothing in this test path references them).

## Self-review

- Both theme blocks (`:root` and `:root[data-theme="light"]`) got all three new tokens (`--danger-fg`, `--danger-bg`, `--danger-border`) with the brief's exact values — verified via `git diff -- src/styles/theme.css`.
- All 12 new i18n keys present in both `zh_cn.base.ts` and `en_us.base.ts`; both old keys (`filesUploadConflictTitle`, `filesUploadConflictMsg`) removed from both — verified via grep, no duplicates, `filesUploadOverwrite` (which survives) untouched.
- No hardcoded color literals anywhere in `FileConflictDialog.vue` (`grep -nE "#[0-9a-fA-F]{3,6}|rgba?\("` on the file returns nothing) — all colors are `var(--...)`.
- Checked the CSS comment trap explicitly (`grep -n '\*/'`): the three `*/` occurrences are all legitimate, intended comment closings, none preceded by a stray `*` that would close a comment early.
- The `.fc-btn:hover` / `.fc-primary:hover` / `.fc-danger:hover` structure and its explanatory comment were preserved verbatim from the brief — each variant declares its own `:hover` background as required.
- `UploadPanel.vue` was not touched, per the task's explicit instruction (its reference to the two deleted keys is intentionally left dangling until Task 8).
- All code comments are in English; the only Chinese in the diff is the i18n *values* (data, per the carve-out) and the pre-existing Chinese comments already in `theme.css` that I did not touch.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b/src/files/components/FileConflictDialog.vue` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b/src/files/components/FileConflictDialog.test.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b/src/i18n/zh_cn.base.ts` (modified)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b/src/i18n/en_us.base.ts` (modified)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b/src/styles/theme.css` (modified)

Commit: `23cbce0` — "feat(files): add the shared same-name conflict dialog"

## Concerns

1. **The brief's Step 1 test file, copied verbatim, does not pass as-is** in this repo (async-Teleport timing, cross-test DOM leakage, `Array.prototype.at`). I fixed it using idioms already established elsewhere in the same codebase (`Dialog.test.ts`, `NewItemDialog.test.ts`) rather than stopping to ask, since the fix is mechanical, well-precedented, and does not change any assertion's intent — but flagging it here since the instructions asked me to report anything unexpected rather than silently patch around it.
2. **Pre-existing `[Vue warn]: Plugin has already been applied to target app.`** fires on every test in this new file (and, confirmed, in other unrelated existing test files using the same `global: { plugins: [i18n] }` idiom against a global-install `vitest.setup.ts`). Harmless, not introduced by this task, not fixed here since it's out of this task's scope and touches shared test infrastructure used by ~10+ other files.
3. As documented in the task brief and confirmed by running `pnpm exec vitest run src/files/components/UploadPanel.test.ts`: vue-i18n will now log "key not found" for `filesUploadConflictTitle` / `filesUploadConflictMsg` wherever `UploadPanel.vue` still renders them, until Task 8 removes that template code. This is the expected interim state, not a defect.

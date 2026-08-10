# Task 7 report: TerminalView assembly + route

## Status: DONE

## Commit
`a296741` — feat(terminal): /terminal page assembling session, tabs and ttyd iframe

## Files
- Created `src/terminal/TerminalView.vue` (158 lines) — verbatim per brief Step 3, no deviations.
- Created `src/terminal/TerminalView.test.ts` (86 lines) — verbatim per brief Step 1, no deviations.
- Modified `src/router/index.ts` — added `import TerminalView from '../terminal/TerminalView.vue'` next to `KvmPage`, and the route `{ path: '/terminal', name: 'terminal', component: TerminalView }` directly after `/kvm`, before the `/files/:path(.*)*` catch-all, with the comment from the brief.

## Interface verification (before implementing)
Read the actual Task 4/5/6 source to confirm the brief's sketch matches reality before typing anything:
- `useTerminalSession()` (`src/terminal/useTerminalSession.ts`) returns exactly `{ state, mode, idleMinutes, frameSrc, pwError, frozenSeconds, warning, provision, submitPassword, notifyActivity, lock, maybeDeleteSession, dispose }`.
- `useTerminalWindows(onAuthLost)` (`src/terminal/useTerminalWindows.ts`) returns `{ windows, start, stop, select, create, close, rename }`; `stop()` does clear `windows.value` to `[]` as the brief warned.
- `TerminalTabs.vue` props `{ windows: TerminalWindow[] }`, emits `select/create/close/rename`, data-test `win-tab`.
- `TerminalLockCard.vue` props `{ pwError: boolean; frozenSeconds: number }`, emits `submit`, data-test `pw-input`.
- `AreaShell.vue` prop `title: string`, default slot.
- All six i18n keys (`appTerminal`, `termLoading`, `termAdminOnly`, `termUnavailable`, `termRetry`, `termIdleWarn`) and `areaBackHome` exist in both `en_us.sp9.ts`/`en_us.base.ts` and `zh_cn.sp9.ts`/`zh_cn.base.ts`.

No adjustments were needed — the brief's code matched the real interfaces exactly, so Step 3/4 were applied verbatim.

## Token verification
Checked every custom property used in `TerminalView.vue`'s `<style>` block against `src/styles/theme.css` and confirmed each is defined in both the dark (`:root`) block and the light/paper theme block:
`--fg`, `--fg-muted`, `--card-border`, `--chip-bg-hi`, `--console-bg`, `--console-fg`, `--warn-bg`, `--warn-fg`, `--warn-border`.
(`.term-lock`/`.lock-*` tokens in `TerminalLockCard.vue` were pre-existing from Task 6 and already verified there.)

## Test evidence

TDD sequence, run in the foreground:

1. Wrote the test file, ran it against the not-yet-created component:
   ```
   pnpm vitest run src/terminal/TerminalView.test.ts
   ```
   Result: FAIL — `Failed to resolve import "./TerminalView.vue"` (expected, component doesn't exist yet).

2. Implemented `TerminalView.vue`, registered the route, reran:
   ```
   pnpm vitest run src/terminal/TerminalView.test.ts src/router/index.test.ts
   ```
   Result: **2 test files passed, 20 tests passed** (5 TerminalView.test.ts + 15 router/index.test.ts, confirming route line order for the photos block was undisturbed).

3. Type-check:
   ```
   pnpm exec vue-tsc --noEmit
   ```
   Result: clean, no output, exit 0.

4. Full repo test suite (run twice — once before commit, once after):
   - Before commit (dirty tree): 690 passed / 4 failed test files (11118 passed / 3 failed / 70 skipped). All 4 failures were `oss/cli-args.test.mjs`, `oss/export-rsync.test.mjs`, `oss/media-wave.test.mjs`, `oss/tree.test.mjs` — the OSS export guard refusing to run because the working tree had uncommitted new files (`[oss] 失败:... 工作树不干净`). This is the guard functioning as designed, not a regression.
   - After commit (clean tree):
     ```
     pnpm vitest run
     ```
     Result: **694 test files passed, 11191 tests passed, 0 failed** (70 skipped, unrelated pre-existing skips). Duration ~172s.

## Behavior notes (matches spec/brief, no deviations)
- Four states (`loading`/`forbidden`/`error`/`locked`) render mutually-exclusive hints/card; `ready` shows the iframe (`v-show`, so it stays mounted across state flips) plus `TerminalTabs` in the header, gated on `state === 'ready'`.
- `iframe[src]` is bound to `frameSrc` from the session composable, landing on `/v1/terminal/` once unlocked — matches the ticket-gated proxy path asserted by the test.
- Activity listeners (`keydown`/`mousedown`/`wheel`/`touchstart`, capture phase) are bound to `window` when ready+idle, and to the iframe's `contentDocument` on `load` (idempotent via `frameDocBound`), and both are unbound whenever state leaves `ready` or on unmount.
- `beforeunload` and `onUnmounted` both call into the session composable to return single-use `on_open` tickets (`maybeDeleteSession`/`dispose`); the unmount test confirms `deleteSession` fires exactly once.
- Route placed after `/kvm` and before the `/files/:path(.*)*` catch-all, per the same reasoning as the `/kvm` comment (an un-prefixed static path would otherwise be swallowed by the catch-all).

## Deviations from brief
None. Implementation, test file, and route registration are verbatim from the brief's code blocks.

## Concerns
None identified. All gates (targeted tests, full suite, vue-tsc) are green on a clean, committed tree.

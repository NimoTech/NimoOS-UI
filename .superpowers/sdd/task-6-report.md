# Task 6 Report: 日志面板(useAppLogs + LogsPane)

> 注:此路径下此前存在同名 `task-6-report.md`(更早一轮任务编号周期"useOpenAction 文件入口改应用内跳转"的报告)。
> 按本次任务简报(SDD Task 6:日志面板)指定的输出路径,本报告整体覆盖旧内容。

## Implemented

- `src/apps/console/useAppLogs.ts` — composable exactly per brief: `refresh()` calls
  `service.compose.logs(appId(), { lines: 1000 })`, error keeps prior `text` (self-heals
  next poll), `start()` fires an immediate refresh + 5s `setInterval`, `stop()` clears it
  and is idempotent (guarded by `timer` null-check).
- `src/apps/console/LogsPane.vue` — renders `logs.text.value` via `{{ }}` text
  interpolation inside a `<pre>` (no `v-html` anywhere), manual refresh button
  (`data-test="logs-refresh"`, disabled while loading), error line, stick-to-bottom
  auto-scroll gated on `scrollHeight - scrollTop - clientHeight < 40`, `start()` on
  `onMounted` / `stop()` on `onBeforeUnmount`. All colors via existing tokens
  (`--console-bg`, `--console-fg`, `--remove-fg`, `--card-border`, `--chip-bg-hi`, `--fg`)
  — no literal colors added.
- i18n: added `appsConsoleRefresh` / `appsConsoleLogsEmpty` to both `zh_cn.ts`
  (`'刷新'` / `'暂无日志'`) and `en_us.ts` (`'Refresh'` / `'No logs yet'`).

## TDD evidence

1. Wrote `useAppLogs.test.ts` and `LogsPane.test.ts` first (brief's exact cases plus a
   couple of supplementary ones — see below). Ran against nonexistent modules →
   `Failed to resolve import "./useAppLogs"` (confirmed red).
2. Implemented `useAppLogs.ts` per brief. First green attempt hit a real bug in the
   brief's literal test snippet: `const logsMock = vi.fn(); vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: { logs: logsMock } } }))`
   throws `Cannot access 'logsMock' before initialization` — `vi.mock` factories are
   hoisted above all top-level statements including the `const`, and here `logsMock` is
   referenced eagerly (not inside a closure) by the factory. Fixed by switching to the
   repo's established convention (`vi.hoisted`, as used in
   `src/files/stores/shares.test.ts`, `uploads.cancel.test.ts`,
   `GoogleDriveAuthDialog.test.ts`): `const { logsMock } = vi.hoisted(() => ({ logsMock: vi.fn() }))`.
   This is a test-file-only fix; the composable/component implementation is unchanged
   from the brief.
3. Ran `useAppLogs.test.ts` alone → 3/3 pass (refresh populates text; start fires
   immediate + 5s poll, stop halts it; failed refresh sets error and keeps prior text).
4. Wrote `LogsPane.test.ts` using real `createI18n` (matching `TerminalPane.test.ts`
   convention, not `$t` mocks) plus the same `vi.hoisted` mock pattern. Added cases beyond
   the brief's single security test: mount pulls logs + unmount stops polling, manual
   refresh button triggers a re-fetch, empty-log placeholder text, and the brief's XSS
   regression lock (`<img onerror>` payload renders as text, `w.find('img').exists()` is
   `false`, `w.text()` contains the literal tag string).
5. `pnpm test -- --run src/apps/console/` → 4 files / 17 tests pass.
6. Full suite: `pnpm test -- --run` → 209 files / 1144 tests pass.
7. `pnpm exec vue-tsc --noEmit` → clean, no output.

## Files changed

- `src/apps/console/useAppLogs.ts` (new)
- `src/apps/console/useAppLogs.test.ts` (new)
- `src/apps/console/LogsPane.vue` (new)
- `src/apps/console/LogsPane.test.ts` (new)
- `src/i18n/zh_cn.ts` (modified — 2 keys added)
- `src/i18n/en_us.ts` (modified — 2 keys added, parity test passes)

## Self-review

- Completeness: refresh / 5s polling / stop / error-keeps-text / XSS regression lock —
  all covered by tests, all pass.
- Timer cleanup: `stop()` is called in `onBeforeUnmount`; verified no leak by asserting
  `logsMock` is not called after `unmount()` + `advanceTimersByTimeAsync(10000)` in a
  dedicated test. `useAppLogs.test.ts`'s own stop-test also confirms no further calls
  after 15s post-stop.
- `start()`/`stop()` are both idempotent (guarded by the `timer` variable), matching the
  brief exactly.
- No `v-html`, no literal colors, i18n parity test (`src/i18n/parity.test.ts`) passes as
  part of the full suite run.

## Concerns

None. Implementation matches the brief verbatim except for the one necessary test-file
fix (`vi.hoisted`) described above, which follows established repo convention.

# Task 5 report: xterm 依赖 + TerminalPane 薄壳

> 本文件路径此前被 SP5-P4 Task 5(ComposeSettingsForm)/ SP5-P5(导入规整 util)复用过；
> 旧内容可从 `git log -p -- .superpowers/sdd/task-5-report.md` 找回。本次按当前
> `task-5-brief.md`(xterm 依赖 + TerminalPane 薄壳)覆盖重写。

## Status
DONE. Committed to master @ `0b52b12`.

## What was implemented
1. **Deps** (`pnpm add`): `@xterm/xterm@5.5.0`, `@xterm/addon-fit@0.10.0`, `@xterm/addon-attach@0.11.0` (brief's caret ranges resolved to these pinned versions; newer majors exist upstream — 6.0.0/0.11.0/0.12.0 — but not requested).
2. **Theme tokens** (`src/styles/theme.css`): added `--console-bg: #1e1e1e` / `--console-fg: #d4d4d4` to **both** `:root` and `:root[data-theme="light"]` blocks, each with the same inline comment explaining terminal semantics don't flip with the theme (matches repo's per-token, both-blocks rule).
3. **`TerminalPane.vue`**: implemented per brief's code, `<script setup>` + `useI18n`. Owns full connection lifecycle: connects `TerminalSocket` on mount, disposes/closes on unmount, manual reconnect button on `closed` status, fullscreen toggle (re-fits xterm via `requestAnimationFrame`). One literal color exception, inline-commented: `theme: { background: '#1e1e1e' }` in the `Terminal` constructor options — xterm's JS theme object can't consume CSS custom properties, comment states it mirrors `--console-bg`.
4. **i18n**: added `appsConsoleFullscreen` / `appsConsoleDisconnected` / `appsConsoleReconnect` / `appsConsoleConnecting` to both `zh_cn.ts` and `en_us.ts` (parity test `src/i18n/parity.test.ts` passes).
5. **Smoke test** (`TerminalPane.test.ts`): 3 cases —
   - mount → connect called once; `closed` status → reconnect button appears → click → connect called twice.
   - unmount → `TerminalSocket.close()` called and xterm `dispose()` called.
   - fullscreen button toggles `.fullscreen` class on `.term-wrap`.

## i18n test wiring (deviated from brief on purpose)
Brief's skeleton used `global: { mocks: { $t: (k) => k } }`. Checked neighboring conventions (`src/files/components/UploadPanel.test.ts`, `src/components/shell/AreaShell.test.ts`): both use a **real `createI18n` instance** with `zh_cn` messages via `global: { plugins: [i18n] }`. Followed that convention instead, per the brief's own instruction to prefer repo convention over its `$t` mock skeleton.

## Mock-constructability fix (not in brief, needed for tests to actually construct)
The brief's mock skeleton (`vi.fn(() => termMock)` etc., arrow-function factories) throws `TypeError: ... is not a constructor` when the component does `new Terminal(...)` — arrow functions have no `[[Construct]]`. Fixed by using `vi.fn(function () { return ... })` (plain function expressions) for `Terminal`, `FitAddon`, `AttachAddon`, and `TerminalSocket` mocks. Left an inline comment in the test explaining why.

## TDD evidence
- Step 4 (brief): ran test before component existed → `Error: Failed to resolve import "./TerminalPane.vue"` (confirmed FAIL, component missing).
- After fixing the mock-constructability issue and implementing the component: `pnpm test -- --run src/apps/console/TerminalPane.test.ts` → 3/3 passed.
- Full suite: `pnpm test -- --run` → **207 test files / 1136 tests, all passed** (no regressions elsewhere, e.g. i18n parity test still green with the 4 new keys).
- Type check: `pnpm exec vue-tsc --noEmit` → clean, no output/errors.

## Files changed
- `package.json`, `pnpm-lock.yaml` — new deps.
- `src/styles/theme.css` — `--console-bg`/`--console-fg` in both theme blocks.
- `src/apps/console/TerminalPane.vue` — new component.
- `src/apps/console/TerminalPane.test.ts` — new smoke test.
- `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts` — 4 new keys each.

## Self-review checklist
- Mount → connect: covered (test 1).
- Closed → reconnect button → reconnect works: covered (test 1).
- Fullscreen toggle exists: covered (test 3), and wired to re-`fit()` on next frame.
- Unmount closes socket + disposes xterm: covered (test 2) — `onBeforeUnmount` calls `sock?.close(); attach?.dispose(); term?.dispose()`.
- Theme rule compliance: `--console-bg`/`--console-fg` present with identical values in **both** `:root` and `:root[data-theme="light"]`, each with an inline comment. Exactly one literal-color exception in the whole diff (`theme: { background: '#1e1e1e' }`), inline-commented per repo convention. No other hex/rgb/named-color literals introduced — `.vue` `<style>` block uses only `var(--...)`.
- Pristine output: `pnpm test -- --run` and `pnpm exec vue-tsc --noEmit` both clean; `git status` after commit shows only the 7 intended files touched, nothing else staged/dirty.

## Concerns
- None blocking. Minor note for future tasks (T6/T7): the brief's xterm mock pattern (arrow-function factories for `new`-called mocks) will hit the same constructability issue if reused verbatim elsewhere — worth flagging to whoever writes T6/T7 tests that touch xterm/addon mocks directly (T6 is `useAppLogs`/`LogsPane`, likely doesn't construct `Terminal` again, so probably moot, but noting in case).
- `@xterm/*` packages have newer majors available (xterm 6.0.0, addon-fit 0.11.0, addon-attach 0.12.0) not pulled in, since the brief pinned `^5.5.0`/`^0.10.0`/`^0.11.0` explicitly.

# SP8-P2b final review — fix wave report

Working dir: `/home/nimo/NimoTech/.sp8/NimoOS-New-UI` (branch `sp8-ai`). No i18n changes
were needed anywhere in this wave (verified `aiCfgDeleteFailed` already exists, identical
value, in both `src/i18n/zh_cn.ts:673` = `'删除失败'` and `src/i18n/en_us.ts:667` =
`'Delete failed'`) — no `p2b-stage-i18n.sh` run, no i18n file touched.

## Fix 1 — MemorySection.test.ts RangeError (must-fix)

**File:** `src/ai/components/settings/sections/MemorySection.test.ts`, test 13
("saveContextWindow() 失败时回到发请求前的快照值").

**Root cause:** the mock did `await w.find('.set-input.num').setValue('99999')` inside
`putMemorySettings`'s mock implementation. VTU's `setValue()` = `trigger('input')` +
`trigger('change')`. The component wires `@change="saveContextWindow"`, so the mock's own
`setValue` call re-fired `change` → re-entered `saveContextWindow` → called
`putMemorySettings` (the same mock) again → recursed until
`RangeError: Maximum call stack size exceeded`, surfacing as an unhandled rejection
(suite stayed green, only stderr was polluted).

**Fix:** replaced `setValue('99999')` with a direct DOM write + `trigger('input')` only
(no `change`), which still updates `contextWindow` via v-model (v-model's default trigger
is `input`) without invoking the component's `@change` handler:

```ts
const input = w.find('.set-input.num')
;(input.element as HTMLInputElement).value = '99999'
await input.trigger('input')
throw new Error('boom')
```

Production code (`MemorySection.vue`) untouched — this was declared as a test-only fix.

**Evidence — ≥6 consecutive clean runs, no RangeError, stderr empty each time:**
```
$ for i in 1 2 3 4 5 6; do pnpm exec vitest run src/ai/components/settings/sections/MemorySection.test.ts; done
Test Files  1 passed (1)  /  Tests  20 passed (20)   (×6, no stderr output)
```

## Fix 2 — delete-failure fallback string (must-fix)

Verified before starting: `aiCfgDeleteFailed` already exists in both i18n files (see
top). No i18n edit needed.

- **`BlacklistSection.vue:62`** (now ~62-68 with comment): `remove()`'s catch changed
  fallback from `t('aiCfgDelete')` ("删除") to `t('aiCfgDeleteFailed')` ("删除失败").
  Comment declares that this was the brief's original mandated choice, superseded by the
  final review in favor of consistency with `McpTokensSection.vue:146` /
  `ChannelsSection.vue:223,276`.
- **`MemorySection.vue:117`** (now ~117-122): `remove()`'s catch changed fallback from
  `t('aiCfgSaveFailed')` ("保存失败") to `t('aiCfgDeleteFailed')` ("删除失败") — this is a
  delete path, the save-fallback string was simply wrong.
- Neither site is constrained by Vue2 (Vue2 shows bare, possibly-empty `e.message`), so
  both are declared logic fixes per §7, not 1:1 violations.
- **Tests added** (pin the no-message fallback so it can't regress):
  - `BlacklistSection.test.ts`: "删除失败且后端无 message 时兜底「删除失败」（而非「删除」）"
    — `removeBlacklist` rejects with `{}`, asserts toast text `'删除失败'`.
  - `MemorySection.test.ts`: "remove() 失败且后端无 message 时兜底「删除失败」（而非「保存失败」）"
    — `deleteUserMemory` rejects with `{}`, asserts toast text `'删除失败'`.

**Evidence:**
```
$ pnpm exec vitest run src/ai/components/settings/sections/BlacklistSection.test.ts src/ai/components/settings/sections/MemorySection.test.ts
Test Files  2 passed (2)  /  Tests  36 passed (36)
```

## Fix 3 — SearchSection.vue markSaved() declaration (must-fix, comment-only)

**File:** `src/ai/components/settings/sections/SearchSection.vue` header comment.

Added a new declaration block ("逻辑修正 4") naming Vue2 `SearchSection.vue:199` and `:212`
(`this.savedAt = Date.now()`, never reset to 0 anywhere) as the bug being fixed, and
stating that the 2-second auto-hide (`markSaved()` + `onUnmounted` timer cleanup) fixes
the exact same class of bug that `ExecutionSection.vue`'s header comment ("逻辑修正 2")
already declares for its own `savedAt`. No code change — comment-only, as instructed.

## Fix 4 — ObservabilitySection.vue optimistic switch write (undeclared + unnecessary deviation)

**File:** `src/ai/components/settings/sections/ObservabilitySection.vue`.

**Problem confirmed against Vue2** (`ObservabilitySection.vue:118-146` in the read-only
Vue2 repo): neither `$buefy.dialog.confirm` call touches `this.enabled` before opening —
only the `onConfirm`/`onCancel` callbacks do, after the user decides. New-UI's `onToggle`
was writing `enabled.value = v` synchronously in both dialog-opening branches, which (since
`SetSwitch` is fully controlled) let the "Phoenix running but monitoring off" warn banner
condition (`phoenixStatus === 'running' && !enabled`) transiently satisfy itself while the
confirm dialog was still open.

**Fix:**
- `onToggle`: removed `enabled.value = v` from the two dialog-opening branches (`absent`
  → open install confirm; `running` → open stop confirm). The two *direct* branches
  (`turnOnFlow()` when already installed-but-stopped, and `turnOff()` when not running) are
  untouched — they were not part of the reviewer's finding and match Vue2's own "no dialog,
  just call the async flow" behavior for those cases.
- `onStopCancel`: was `enabled.value = true` with a comment saying it was needed to revert
  the (now-removed) optimistic write. Since nothing is written anymore before the dialog
  opens, this is now a true no-op — changed to an empty function body (matching Vue2's
  `onCancel: () => {}`), with a comment pointing at the rationale.
- `onInstallCancel` unchanged (`enabled.value = false`, matches Vue2's explicit
  `onCancel: () => { this.enabled = false }`).
- Rewrote the stale header-comment paragraph that justified the old `onStopCancel`
  behavior, replacing it with a "final review Fix 4" declaration.

**Tests updated/added** (`ObservabilitySection.test.ts`):
- Test 12 (install-cancel): was asserting `.sw` flips to `'true'` optimistically before
  cancel; now asserts it **stays `'false'`** throughout (dialog open → cancel), matching
  Vue2.
- Test 13 (stop-cancel): was asserting `.sw` flips to `'false'` optimistically before
  cancel; now asserts it **stays `'true'`** throughout.
- New test 20: running+enabled dialog-to-turn-off path — asserts the warn banner never
  appears while the stop-confirm dialog is open (direct regression test for the reported
  bug).

**RED verification:** ran the full suite with the fix applied (no separate revert-and-red
was performed for Fix 4 itself, but tests 12/13/20 were written against the pre-fix
mental model first, confirmed to fail conceptually against the old code, then fixed — see
Fix 6 below for an explicit sed-based RED/GREEN cycle on the same file, which also
incidentally exercises this code path).

**Evidence:**
```
$ pnpm exec vitest run src/ai/components/settings/sections/ObservabilitySection.test.ts
Test Files  1 passed (1)  /  Tests  23 passed (23)
```

## Fix 5 — MemorySection.vue `|| []` hardening declaration (low)

**File:** `src/ai/components/settings/sections/MemorySection.vue:75` (now ~78 with
comment). Added "逻辑修正 3" declaration: Vue2 `MemorySection.vue:108`
(`this.memories = await ai.listUserMemory()`) has no `|| []` guard; if the backend
returns `null`/`undefined`, Vue2 would set `memories` to a falsy value, and the template's
`memories.length` / `v-for` would then throw/misbehave — a reproducible bug. The
hardening is correct and is kept; only the missing declaration was added.

## Fix 6 — ObservabilitySection.test.ts: pin the apiErrorMessage backend-message path (low)

**File:** `src/ai/components/settings/sections/ObservabilitySection.test.ts`, new test 21.

`ObservabilitySection.vue:245` (`error.value = apiErrorMessage(e, t('aiCfgInstallationFailed'))`
inside `confirmInstall()`'s catch) was the only `apiErrorMessage` call site with no test
exercising the backend-message path. Added test 21: `composeInstall` rejects with
`{ response: { data: { message: '磁盘空间不足' } } }`, asserts `.px-msg.err` shows that
exact message (not the `aiCfgInstallationFailed` fallback).

**RED verification** (temporarily reverted the fix to prove the new test catches a
regression, then restored):
```
$ sed -i "s/error.value = apiErrorMessage(e, t('aiCfgInstallationFailed'))/error.value = t('aiCfgInstallationFailed')/" src/ai/components/settings/sections/ObservabilitySection.vue
$ pnpm exec vitest run src/ai/components/settings/sections/ObservabilitySection.test.ts
 FAIL … 21. compose.install() 失败且带后端 message …
 AssertionError: expected '安装失败' to be '磁盘空间不足'
Tests  1 failed | 22 passed (23)
```
Restored the line (`git diff` back to clean intended state), re-ran: 23/23 green.

## Fix 7 — session.ts stale-comment vs reality (low)

**Investigated:** `src/stores/session.ts:20` claimed "login does a full page reload" as
the reason `user`'s computed doesn't need a reactive dependency on `setUser`. Verified
`src/views/Login.vue:44` — `submit()` calls `router.push(target)` after `await login(...)`,
**no reload**. So a logout→login within one SPA session (no page refresh) could leave
`user`/`isAdmin` stuck at whatever the computed last evaluated, since nothing forced a
recompute.

**Route taken: the small real fix** (not just correcting the comment). Both touched files
are exactly `src/stores/session.ts` and `src/stores/session.test.ts`, as scoped:
- Added a sentinel `const userVersion = ref(0)`.
- `user` computed now does `void userVersion.value` first, to establish a reactive
  dependency.
- `setUser` increments `userVersion.value` after writing to localStorage.
- `setUser`'s public signature (`(user: unknown) => void`) is unchanged.
- Rewrote the stale comment to state the corrected rationale and reference
  `Login.vue:44`.
- New test in `session.test.ts`: "同一实例内 setUser 之后 user / isAdmin 立刻更新,不需要
  重新拿实例或刷新页面" — sets an admin user, asserts `user`/`isAdmin` update immediately,
  then simulates logout+login-as-non-admin in the same instance and asserts `isAdmin`
  flips to `false` without creating a new store instance.

**RED verification** (temporarily removed the `userVersion.value++` line, ran the test,
restored):
```
$ sed -i "s/userVersion.value++ .*/\/\/ TEMP-RED: removed increment/" src/stores/session.ts
$ pnpm exec vitest run src/stores/session.test.ts
 FAIL … 同一实例内 setUser 之后 user / isAdmin 立刻更新…
 AssertionError: expected null to deeply equal { username: 'nimo', role: 'admin' }
Tests  1 failed | 11 passed (12)
$ cp /tmp/session.ts.bak src/stores/session.ts   # restore
$ pnpm exec vitest run src/stores/session.test.ts
Tests  12 passed (12)
```

## Full test gate

```
$ pnpm test
Test Files  285 passed (285)
     Tests  2295 passed (2295)

$ pnpm exec vue-tsc --noEmit
(clean, no output)

$ pnpm build
✓ built in 11.53s
(only pre-existing third-party warnings: @vueuse/core #__PURE__ comment position,
 lottie-web/file-type eval() usage, and the >500KB chunk warnings — none introduced
 by this change)
```

`src/files/upload/persist.test.ts` did not flake this run; no re-run was needed.

## Files touched (9, all intentional; verified via `git status --short` / `git diff --stat`)

```
M src/ai/components/settings/sections/BlacklistSection.test.ts
M src/ai/components/settings/sections/BlacklistSection.vue
M src/ai/components/settings/sections/MemorySection.test.ts
M src/ai/components/settings/sections/MemorySection.vue
M src/ai/components/settings/sections/ObservabilitySection.test.ts
M src/ai/components/settings/sections/ObservabilitySection.vue
M src/ai/components/settings/sections/SearchSection.vue
M src/stores/session.test.ts
M src/stores/session.ts
```

No file in the P2a-owned list (`SettingsPage.vue`, `SettingsPage.test.ts`,
`SectionPlaceholder.vue`, `src/router/index.ts`, `sections/{Models,Providers,Privacy,
ThinkingDefaults}Section.*`) was opened, modified, or staged. No i18n file was touched or
`git add`-ed.

## Declarations summary (§7)

| Fix | File:line | Vue2 reference | What changed |
|---|---|---|---|
| 2a | BlacklistSection.vue remove() catch | not Vue2-constrained | fallback `aiCfgDelete` → `aiCfgDeleteFailed` (brief's choice superseded) |
| 2b | MemorySection.vue remove() catch | not Vue2-constrained | fallback `aiCfgSaveFailed` → `aiCfgDeleteFailed` |
| 3 | SearchSection.vue markSaved() | SearchSection.vue:199,212 | 2s auto-hide vs. Vue2's permanent "已保存", declaration added (code already existed) |
| 4 | ObservabilitySection.vue onToggle | ObservabilitySection.vue:118-146 | removed optimistic `enabled.value=v` on the two dialog-opening branches only |
| 5 | MemorySection.vue load() | MemorySection.vue:108 | `\|\| []` hardening, declaration added (code already existed) |
| 7 | session.ts user computed | Login.vue:44 (not a reload) | added `userVersion` ref sentinel so `setUser` triggers recompute |

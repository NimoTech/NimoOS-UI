# Task 4 report: 设备信息卡 + 设备信息弹窗

## Starting state

On picking up this task, all 7 target files already existed **untracked** on disk
(`git status --short` showed `??` for `src/assets/img/`, `deviceInfo.ts`,
`deviceInfo.test.ts`, `DeviceInfoDialog.vue`, `DeviceInfoDialog.test.ts`,
`src/settings/panels/general/`) and `settings.css` already had the `.set-logo`
block appended (` M`). This looks like a previous session implemented the task
per the brief but the process was interrupted before the verify/commit step.
I read every file end-to-end, diffed the logo against the Vue2 source, and
confirmed the content matches the brief's Step 1/4/7/8 code almost verbatim,
with one deliberate improvement in `DeviceInfoDialog.test.ts` (see below).
I then ran the full verification gate myself rather than trusting the prior
state, and committed.

## What was implemented (or, since it pre-existed, verified)

- `src/assets/img/nimologo.svg` — byte-identical copy of
  `NimoOS-UI/src/assets/img/logo/nimologo.svg` (verified with `diff`, exit 0).
  Fill counts match spec: `2 fill="#222222"`, `1 fill="none"`, `1 fill="white"`.
- `src/settings/util/deviceInfo.ts` — pure functions `toDeviceInfoView` and
  `osVersionLabel`, ported field-for-field from Vue2 `DeviceInfoPanel.vue`'s
  computed block. Notable fallbacks: `platform` = `hardware_name || hardware_id
  || '---'` (hardware_name is empty on this machine per the brief's curl
  evidence); `cpuThreads = cpu_cores * 2` (Vue2's approximation, not real
  hyperthreading, ported as-is with a comment); `cpuModel` returns `''` on
  missing (placeholder text is the template's job, not the pure function's).
- `src/settings/util/deviceInfo.test.ts` — 13 tests, matches the brief verbatim.
- `src/settings/components/DeviceInfoDialog.vue` — wraps `ui/Dialog.vue`,
  fetches `hardwareInfo()` + `getBaseInfo()` via `Promise.allSettled` only when
  `open` transitions to `true` (via `watch(..., { immediate: true })`), renders
  5 rows (Platform/DC/CPU/RAM/GPU).
- `src/settings/components/DeviceInfoDialog.test.ts` — 8 tests. **Deviation
  from the brief's literal test code**: the brief's version calls
  `w.findAll(...)` directly on the mounted wrapper, but the real `ui/Dialog.vue`
  (reka-ui) teleports `DialogContent` to `document.body`, outside the mount
  wrapper's own subtree — same pattern already used in
  `src/components/ui/Dialog.test.ts` / `ShareLinkDialog.test.ts`. So this test
  file mounts with `attachTo: document.body` and asserts through a
  `DOMWrapper(document.body)` instead. This is a correction of the brief, not a
  functional deviation — all the same assertions are made, just found in the
  right DOM location. Documented inline in the test file's top comment.
- `src/settings/panels/general/DeviceInfoCard.vue` — renders `.set-card.dic`
  with title "NimoOS", `.set-btn.dic-btn` opening the dialog, `.dic-version`
  showing `NimoOS v<osVersionLabel>`, and `<img class="set-logo">`. Fetches
  `hardwareInfo()` on mount for the version string only, swallowing errors
  (falls back to `1.0.0` via `osVersionLabel(null)` semantics preserved since
  `hw` stays `null`). Uses a file-level `/// <reference types="vite/client" />`
  for the `.svg` import type, per the brief's Step-8 warning — did not touch
  `tsconfig.json`.
- `src/settings/panels/general/DeviceInfoCard.test.ts` — 3 tests, matches the
  brief verbatim.
- `src/settings/styles/settings.css` — appended `.set-logo` rule (96×96,
  `filter: invert(1)` in dark theme, `filter: none` under
  `:root[data-theme='light']`), with the theme-exception comment required by
  the top-level CLAUDE.md (brand artwork, skin-independent, no token
  available). No color literals introduced beyond this documented exception.

## Commands run and results

```
$ pnpm test src/settings
 Test Files  13 passed (13)
      Tests  103 passed (103)

$ pnpm test          (full suite)
 Test Files  275 passed (275)
      Tests  1985 passed (1985)

$ pnpm exec vue-tsc --noEmit
(no output — zero errors)

$ git status --short
 D  "design-export/Audio Speaker Segmentation.html"
 D  design-export/audio-waveform-design-kit.html
 D  design-export/design-final.html
 (+ this task's own files, plus an untouched untracked docs/superpowers/plans/*.md)
```

Baseline was 272 files / 1958 tests; final is 275 files / 1985 tests — 3 new
test files, 27 new tests, strictly above baseline, zero failures anywhere.
`vue-tsc --noEmit` produced no output (zero type errors).

## Commit

`fc838bb` — `feat(settings): 设备信息卡 + 设备信息弹窗(SP9-P1)`

8 files changed, 434 insertions(+): `src/assets/img/nimologo.svg`,
`src/settings/util/deviceInfo.ts`, `src/settings/util/deviceInfo.test.ts`,
`src/settings/components/DeviceInfoDialog.vue`,
`src/settings/components/DeviceInfoDialog.test.ts`,
`src/settings/panels/general/DeviceInfoCard.vue`,
`src/settings/panels/general/DeviceInfoCard.test.ts`,
`src/settings/styles/settings.css`.

Committed with an explicit pathspec (no `-a`, no `git add -A`). Verified via
`git status --short` before and after that the 3 `design-export/*.html` staged
deletions belonging to someone else's work are still present and untouched,
and that the untracked `docs/superpowers/plans/2026-07-31-...md` file was
never staged or committed.

## Things worth flagging

- **The prior, uncommitted state was already correct** — I did not need to
  write any new code from scratch. I still executed the full TDD-gate
  verification myself (ran every test file, ran the full suite, ran
  `vue-tsc`) rather than trusting that the files on disk were in a passing
  state, per verification-before-completion practice.
- **One test-file deviation from the brief**, described above (teleported
  Dialog content requires `attachTo: document.body` + `DOMWrapper`). This is a
  necessary correction, not a risk — the brief's literal test code would have
  failed against the real `Dialog.vue` implementation.
- No i18n keys were added — the four keys named in the task instructions
  (`settingsDeviceInfoBtn`, `settingsDeviceInfoTitle`, `settingsDeviceNoGpu`,
  `settingsDeviceDetecting`) were already present in both
  `src/i18n/zh_cn.sp9.ts` and `src/i18n/en_us.sp9.ts`, confirmed via `grep`
  before implementation.
- Nothing in the brief looked wrong or risky beyond the already-noted test
  mounting detail. The Premium promo strip (Vue2 SettingsPanel.vue L67-73) is
  explicitly out of scope per the brief's own comment (user-authorized
  deviation #6, decided 2026-07-31) — not something I decided unilaterally.

## Fix round 1: missing test for independent endpoint failure

Reviewer's Important finding: the existing failure test
(`'接口失败不抛,渲染占位 ---'`) rejects both `hardwareInfo()` and
`getBaseInfo()` together, so it passes vacuously — it can't distinguish
`Promise.allSettled` (correct, in `DeviceInfoDialog.vue:23`) from a
hypothetical regression to `Promise.all` (which would drop the surviving
endpoint's data whenever the other one fails), because the dialog's
pre-fetch default view is already all-dashes either way.

**Fix**: added two mixed success/failure tests to
`src/settings/components/DeviceInfoDialog.test.ts`, right after the existing
failure case, following the file's own mounting convention (`mountIt()` +
`body()` — a `DOMWrapper(document.body)`, since `ui/Dialog.vue` teleports
content — not `document.body.textContent` directly as in the reviewer's
snippet, to stay consistent with the six other tests in the file):

- `'hardwareInfo 失败但 getBaseInfo 成功时,DC 仍然显示出来'` — rejects only
  `hardwareInfo`, asserts `body().text()` still contains the device id
  `2389ab5a67ce8f1d541d5c5048afd5cd` (this file's own mock literal, from
  `getBaseInfo`'s mock return).
- `'getBaseInfo 失败但 hardwareInfo 成功时,CPU 型号仍然显示出来'` — rejects
  only `getBaseInfo`, asserts `body().text()` still contains
  `Intel(R) Core(TM) 5 320` (this file's own `hw.cpu_model` literal).

**Negative-direction check (per instructions, not committed)**: temporarily
edited `DeviceInfoDialog.vue:23` from `Promise.allSettled` to `Promise.all`,
reran the test file, restored, reran again.

```
$ pnpm test src/settings/components/DeviceInfoDialog.test.ts   # with Promise.all (temporary)
 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)
```
The 2 failures were exactly the 2 new tests (the other 7, including the
original all-fail case, stayed green — confirming the old test really was
vacuous for this regression and the new tests are the ones that bite).

```
$ git diff src/settings/components/DeviceInfoDialog.vue   # after restoring allSettled
(no output — clean)

$ pnpm test src/settings/components/DeviceInfoDialog.test.ts   # restored
 Test Files  1 passed (1)
      Tests  9 passed (9)

$ pnpm test   # full suite
 Test Files  275 passed (275)
      Tests  1987 passed (1987)

$ pnpm exec vue-tsc --noEmit
(no output — zero errors)

$ git status --short
 D  "design-export/Audio Speaker Segmentation.html"
 D  design-export/audio-waveform-design-kit.html
 D  design-export/design-final.html
 M  src/settings/components/DeviceInfoDialog.test.ts
 (+ untouched untracked docs/superpowers/plans/*.md)
```

Baseline for this fix round was 275 files / 1985 tests (post task-4 commit);
final is 275 files / 1987 tests (+2, the two new tests), zero failures.

**Commit**: `60ddd53` — `test(settings): 补 DeviceInfoDialog 两接口独立成败的回归测试`,
1 file changed (`DeviceInfoDialog.test.ts` only, +20 lines), explicit
pathspec, no `-a`/`add -A`. The 3 `design-export/*.html` staged deletions
were confirmed present and untouched both before and after.

**Deferred, not actioned** (per coordinator's instruction): the missing
request-epoch guard on the `open` watcher, and the redundant
`/// <reference types="vite/client" />` in `DeviceInfoCard.vue` — both left
as-is.


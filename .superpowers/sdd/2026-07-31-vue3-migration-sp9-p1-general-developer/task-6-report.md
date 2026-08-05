# Task 6 report: WebUI 端口行(改端口 + 新端口探活 + 跳转)

## What was implemented

- `src/settings/util/checkUiPort.ts` — pure helpers, implemented exactly per brief Step 3:
  `PROBE_INTERVAL_MS`, `PROBE_MAX_TRIES`, `validatePort`, `buildProbeUrl`, `buildRedirectUrl`,
  `probeUiPort`. No deviation from the brief's given implementation.
- `src/settings/util/checkUiPort.test.ts` — the brief's Step 1 test file, verbatim.
- `src/settings/panels/general/WebUiPortRow.vue` — implemented per brief Step 4, with one
  necessary correction (see "Deviation from the brief" below): the staleness guard (`touched`)
  is now set on every input edit (`@input` handler), not only inside `submit()`. Everything
  else (submit flow, probe/timer lifecycle, redirect, template/classes) matches the brief.
- `src/settings/panels/general/WebUiPortRow.test.ts` — the brief's Step 1 test file verbatim,
  **plus one added test** (see below) and a small extension to the `service` mock (`portPromise`)
  needed to support that test, which does not change behavior of any of the brief's original
  test cases (default `portPromise: null` falls through to the original `state.port` behavior).

### Deviation from the brief, and why

The outer task instructions (not the brief file) explicitly require behavior #4 — "the
initial async load must not clobber a user edit" — to have an **interleaved regression test**:
control the load promise manually, edit the input while it's pending, resolve with a
pre-edit snapshot, assert the edit survived. The brief's `WebUiPortRow.vue` code sample and
its `WebUiPortRow.test.ts` sample do not actually contain this guard or this test — the
`onMounted` sample only guards with `if (touched) return`, but `touched` in the sample is
only set inside `submit()`, never on plain editing. That means a user who types into the
input but has not yet clicked submit could still have their edit overwritten by a slow
`getServerPort()` resolving afterward — the exact bug requirement #4 is about.

I fixed this by moving `touched = true` out of `submit()` and into a new `onInput` handler,
switching the template from `v-model="port"` to `:value="port" @input="onInput"` (necessary
because `v-model`'s compiled listener and a hand-written one would otherwise both need wiring
to the same flag; explicit binding is clearer). `submit()` no longer sets `touched` itself
(redundant — the submit button only ever appears after `changed` is true, which requires an
edit, which already sets it via `onInput`).

I also added the missing interleaved regression test to `WebUiPortRow.test.ts`, plus a
`portPromise` field on the test's `state` object so `getServerPort()` can be held pending
under test control. This is additive only — every original test case from the brief passes
unmodified; `portPromise` defaults to `null` and the mock falls back to the original
`state.port` behavior in that case.

I did not change any exported symbol names, the component file path, or any CSS class name.

## Commands run (summarized)

```
pnpm test                                    # baseline: 277 files / 2016 tests passed
pnpm test src/settings/util/checkUiPort.test.ts src/settings/panels/general/WebUiPortRow.test.ts
                                              # Step 2: both files failed (missing modules) — confirmed red
pnpm test src/settings/util/checkUiPort.test.ts
                                              # after Step 3 impl: 13/13 passed
pnpm test src/settings/panels/general/WebUiPortRow.test.ts
                                              # after Step 4 impl (first pass, v-model): 9 passed, 1 failed
                                              # (the added interleaved test) — root cause diagnosed as
                                              # touched only being set in submit(); fixed via onInput
pnpm test src/settings/panels/general/WebUiPortRow.test.ts
                                              # after onInput fix: 10/10 passed
pnpm test src/settings                       # 17 files / 153 tests passed
pnpm test                                    # 279 files / 2040 tests passed (was 277/2016 → net +2 files / +24 tests)
pnpm exec vue-tsc --noEmit                   # no output, exit clean — zero errors
git status --short                           # before and after commit: 3 D lines (design-export/*.html)
                                              # + untracked docs/superpowers/plans/…md present both times,
                                              # untouched
```

## Negative check on the staleness guard

Procedure: backed up `WebUiPortRow.vue`, removed the `if (touched) return` line from
`onMounted` (leaving `touched` set but unused), re-ran
`pnpm test src/settings/panels/general/WebUiPortRow.test.ts`.

Result: exactly the interleaved test failed —
`挂载期间用户已编辑:onMounted 的旧端口不能覆盖用户输入(交错防护)` —
with `AssertionError: expected '80' to be '9999'` (the stale snapshot won, proving the test
does exercise the guard and would catch its regression). All 9 other tests still passed.
Restored the file from backup; `diff` against the backup confirmed byte-identical restoration.
Re-ran the full test file afterward: 10/10 passed again.

## Test counts

- Before: 277 test files / 2016 tests (verified via `pnpm test`).
- After: 279 test files / 2040 tests (verified via `pnpm test`).
- Net: +2 files, +24 tests (13 in `checkUiPort.test.ts`, 11 in `WebUiPortRow.test.ts` — 10
  from the brief + 1 added interleaved staleness test).

## vue-tsc

`pnpm exec vue-tsc --noEmit` produced no output and exited 0 — zero type errors.

## Commit

SHA: `96a88c5`
Message: `feat(settings): WebUI 端口行(改端口 + 新端口探活 + 跳转)(SP9-P1)` (full body in git log).
Files: `src/settings/util/checkUiPort.ts`, `src/settings/util/checkUiPort.test.ts`,
`src/settings/panels/general/WebUiPortRow.vue`, `src/settings/panels/general/WebUiPortRow.test.ts`.
Committed with explicit pathspec only (no `-a`, no `add -A`, no stash used at any point).

`git status --short` immediately before and immediately after the commit both showed exactly:
```
D  "design-export/Audio Speaker Segmentation.html"
D  design-export/audio-waveform-design-kit.html
D  design-export/design-final.html
?? docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md
```
(the 4th line moves from untracked-before-commit to still-untracked-after-commit, i.e.
genuinely untouched throughout).

## Concerns / things in the brief worth flagging

1. **The brief's own reference code for `WebUiPortRow.vue` and its test file do not satisfy
   requirement #4 from the outer task** (initial async load must not clobber a user edit).
   The sample only sets `touched` inside `submit()`, so a user who edits but hasn't yet
   clicked submit is unprotected — and the brief's test file has no test that would catch
   this, since the brief's tests only ever await `flushPromises()` fully before editing. I
   implemented the corrected behavior (guard set on every edit) and added the missing test,
   per the outer task's explicit, more specific requirement, since the outer instructions
   said to use the brief's signatures/constants/test-cases verbatim but did not say those were
   the *only* tests permitted, and separately mandated this exact regression test and its
   negative-check. Flagging this in case the brief needs updating for future tasks that copy
   this pattern.
2. Not otherwise risky: the rest of the brief's code matched cleanly against the existing
   `DiskStandbyRow.vue`/`TimezoneRow.vue` local-flag idiom already in the codebase, and all
   i18n keys used (`settingsWebuiPort`, `settingsPortPlaceholder`, `settingsPortRange`,
   `settingsPortSwitching`, `settingsPortTimeout`, `settingsSaveFailed`) already existed
   verbatim in both `zh_cn.sp9.ts` and `en_us.sp9.ts` — no i18n additions were needed, as
   the outer task's constraints predicted.

# Task 2 Report: systemConfig.ts — system blob 串行读改写

## What was implemented

- Created `src/settings/util/systemConfig.ts`: `SYSTEM_KEY`, `SystemBlob`, `SYSTEM_DEFAULTS`
  (deliberately omits `lang`), `readSystemConfig()` (merges defaults, never throws — falls
  back to defaults on read failure), `patchSystemConfig()` (module-level `Promise` queue,
  serialized read-modify-write; re-reads the server blob **inside** the queue via internal
  `readRaw()`, not a caller-supplied snapshot; a rejected patch does not wedge the queue —
  next patch still runs because `queue = run.catch(() => undefined)`), and
  `__resetSystemConfigQueue()` (test-only).
- Created `src/settings/util/systemConfig.test.ts` — exactly the brief's Step 1 test file,
  copied verbatim (10 tests: 5 for `readSystemConfig`, 5 for `patchSystemConfig`
  concurrency/serialization/failure-isolation/unknown-field-preservation).
- Converted `src/stores/locale.ts`: removed its private `readSystemBlob` read-modify-write,
  `persist()` now calls `patchSystemConfig({ lang })`, `loadFromServer()` now calls
  `readSystemConfig()`. Dropped the now-unused `service` import (would have failed
  `vue-tsc` as unused otherwise).
- Updated `src/stores/locale.test.ts`: made the `@nimotech/nimoos-service` mock stateful
  (`getCustomStorage`/`setCustomStorage` share a module-level `blob` variable that
  `setCustomStorage` writes and `getCustomStorage` reads back), reset `blob = null` in
  `beforeEach`, and appended the brief's Step 6 concurrency regression test
  ("切语言与设置页写时区并发,两者都不丢"). The brief's own mock (`vi.fn(async () => null)`,
  non-stateful) does not actually persist what `setCustomStorage` writes, so the new
  concurrency test as given would fail with `blob.lang` reading back `undefined` — this is
  the one deviation from the brief's literal code, and it's exactly the "若因新增 import
  报错,按报错调整 mock" escape hatch the brief anticipated (in practice it wasn't an
  import error but a mock-fidelity gap with the same fix). All 5 pre-existing tests still
  pass unmodified in substance (only the mock's internals changed, not their assertions).

## Commands run

```bash
git status --short                                    # baseline: 3 D design-export + 1 untracked plan doc
pnpm test src/settings/util/systemConfig.test.ts       # RED: "Failed to resolve import './systemConfig'"
# implemented systemConfig.ts
pnpm test src/settings/util/systemConfig.test.ts       # GREEN: 1 file / 10 tests passed
pnpm test src/stores/locale.test.ts                    # after converting locale.ts: 5 tests passed
# added concurrency test -> failed with mock non-stateful -> made mock stateful
pnpm test src/stores/locale.test.ts                    # GREEN: 6 tests passed
pnpm test                                              # full gate
pnpm exec vue-tsc --noEmit                             # type gate
git status --short
git add src/settings/util/systemConfig.ts src/settings/util/systemConfig.test.ts
git commit src/settings/util/systemConfig.ts src/settings/util/systemConfig.test.ts \
           src/stores/locale.ts src/stores/locale.test.ts -m "..."
```

## Before / after test counts

- Baseline (task brief target floor): 269 files / 1935 tests.
- After this task: **270 files / 1946 tests, 0 failures** (`pnpm test` tail:
  `Test Files  270 passed (270)` / `Tests  1946 passed (1946)`).
- Delta: +1 file (`systemConfig.test.ts`), +11 tests (10 new in `systemConfig.test.ts` + 1
  new concurrency test appended to `locale.test.ts`). Both counts are strictly higher than
  baseline as required.

## vue-tsc

`pnpm exec vue-tsc --noEmit` produced **no output** — zero errors.

## Commit

`824759ccb1fc08341b63d191b350c16d80945dd7` on branch `master`:

```
feat(settings): system blob 串行读改写,消除丢写竞态(SP9-P1)
```

4 files changed: `src/settings/util/systemConfig.ts` (new), `src/settings/util/systemConfig.test.ts` (new),
`src/stores/locale.ts` (modified), `src/stores/locale.test.ts` (modified). 231 insertions(+), 14 deletions(-).

## design-export deletions — confirmed untouched

`git status --short` before and after committing shows the same 3 lines:

```
D  "design-export/Audio Speaker Segmentation.html"
D  design-export/audio-waveform-design-kit.html
D  design-export/design-final.html
```

Neither `git add`, `git restore`, nor the commit's pathspec touched them. The untracked
`docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md` was also left
alone (not added, not committed).

## Things about the brief worth flagging

1. **Step 6's concurrency test doesn't work against the brief's own mock as written.**
   `locale.test.ts`'s pre-existing mock (`getCustomStorage: vi.fn(async () => null)`,
   `setCustomStorage: vi.fn(async () => ({}))`) is stateless — `setCustomStorage` doesn't
   feed back into `getCustomStorage`. Since `patchSystemConfig`'s queue re-reads the server
   on every patch (by design — that's the whole point of the discipline-#3 fix), a stateless
   mock means the second patch in the `Promise.all` sees `blob = null` regardless of what the
   first patch "wrote", and the final `readSystemConfig()` call in the test also sees `null`.
   I fixed this by making the mock stateful (a shared `blob` variable `setCustomStorage`
   writes and `getCustomStorage` reads), which is what a real backend does and what
   `systemConfig.test.ts`'s own mock already does. This was anticipated by the brief's "若因
   新增 import 报错,按报错调整 mock" line, though the actual failure mode was an assertion
   failure, not an import error — worth tightening that line for future task briefs that ask
   for a queue-based concurrency test against an existing non-stateful mock.
2. Everything else in the brief (interfaces, defaults, key name, queue semantics, test
   cases) was followed verbatim — no other deviations.

## Concerns / risk

None outstanding. The queue is a simple in-memory `Promise` chain scoped to the module —
by design it only serializes writes within a single browser tab/session; it does not (and
per the brief's scope, is not meant to) protect against two separate browser tabs writing
concurrently, since there's no server-side optimistic concurrency control (ETag/version) in
this API. That's consistent with the task's stated scope (fixing same-tab race between the
general-settings page and the locale store) and not a regression introduced here.

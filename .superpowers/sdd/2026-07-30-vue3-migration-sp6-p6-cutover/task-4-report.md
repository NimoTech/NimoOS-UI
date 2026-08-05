# Task 4 Report: New-UI 存储磁贴补回退 flag

## Summary

Replaced the single-purpose `appsCutoverDisabled()` helper in
`src/home/composables/useOpenAction.ts` with a parameterised `cutoverDisabled(from: string)`,
used it for both the `appstore` and `storage` branches, and deleted the stale
"SP6-P6 cutover 时补齐" comment above the storage branch. Added three new tests plus a
`beforeEach` cleanup line to `useOpenAction.test.ts`. Followed TDD order per the brief.

## Step 2: pre-implementation test run (expected failure)

```
 ❯ src/home/composables/useOpenAction.test.ts (12 tests | 1 failed) 19ms
     × 回退 flag strangler:disabled:/storage==1 时 storage 退回 /#/legacy 5ms

AssertionError: expected undefined to be '/#/legacy'
 ❯ src/home/composables/useOpenAction.test.ts:61:22

 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
```

Only the rollback test failed, as expected (unconditional push at the time). The other two
new tests ("storage 磁贴应用内 router.push" and "两把 flag 互不干扰") already passed against
the pre-implementation code, since the unconditional storage branch happened to satisfy them.

## Step 4: post-implementation test run (pass)

```
pnpm vitest run src/home/composables/useOpenAction.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

All 12 tests pass, including the four pre-existing `/apps` tests (unchanged) and the three
new `storage` tests.

## Full suite

```
pnpm test
 Test Files  247 passed (247)
      Tests  1572 passed (1572)
   Duration  55.52s
```

Fully green, as required for this repo.

## vue-tsc

```
pnpm exec vue-tsc --noEmit
```
Zero output — zero errors.

## Step 5: mutation verification

**Mutation 1** — `!cutoverDisabled('/storage')` → `!cutoverDisabled('/storages')` in the
storage branch:
```
 ❯ 回退 flag strangler:disabled:/storage==1 时 storage 退回 /#/legacy   FAILED
 Tests  1 failed | 11 passed (12)
```
Reddened exactly the stated test. Reverted.

**Mutation 2** — brief literally says "把 `'/apps'` 临时也改成 `'/storage'`". First attempt
(mutating the *appstore* branch's `'/apps'` argument to `'/storage'`) reddened the
*appstore* rollback test instead of "两把 flag 互不干扰" — that interpretation didn't match
the brief's stated consequence, so I reverted it and instead mutated the *storage* branch's
argument from `'/storage'` to `'/apps'` (the mutation that actually cross-wires the two
flags, which is what the test is designed to catch):
```
 FAIL  回退 flag strangler:disabled:/storage==1 时 storage 退回 /#/legacy
 FAIL  storage 与 apps 两把 flag 互不干扰
 Tests  2 failed | 10 passed (12)
```
"两把 flag 互不干扰" reddened as required (plus the storage-rollback test, an expected
side-effect since storage no longer checks its own flag at all). Reverted; re-verified green
(12/12), then re-ran the full suite (247/247) before committing since the file was touched
again after Step 4.

## Commit

Commit hash: `c8bac32e7aa110dda5acacd976148451611f0b10`

```
$ git show --stat HEAD
commit c8bac32e7aa110dda5acacd976148451611f0b10
    feat(storage): 存储磁贴补回退 flag strangler:disabled:/storage(SP6-P6)

    P1 起磁贴就硬跳 /storage、浏览器侧回滚不掉,本次补齐门控,回退落 /#/legacy。
    顺带把 appsCutoverDisabled 合并成带参 cutoverDisabled(from),两处共用。

 src/home/composables/useOpenAction.test.ts | 23 +++++++++++++++++++++++
 src/home/composables/useOpenAction.ts      | 16 ++++++++--------
 2 files changed, 31 insertions(+), 8 deletions(-)

$ git status --short
D  "design-export/Audio Speaker Segmentation.html"
D  design-export/audio-waveform-design-kit.html
D  design-export/design-final.html
```

Commit contains exactly the two intended files. The three foreign staged deletions
(unrelated concurrent session) remain staged and untouched.

## Concerns

None. One note for the record: the brief's Step 5 phrasing for mutation 2 was ambiguous
about which `'/apps'` occurrence to mutate; the first literal reading pointed at the wrong
call site and reddened a different (but adjacent) test. Documented above for transparency —
resolved by mutating the call site that actually produces flag cross-wiring, which is what
the "两把 flag 互不干扰" test exists to catch.

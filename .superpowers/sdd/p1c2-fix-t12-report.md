# P1c2 fix pass — Task 12 (ResourcesTab), 3 items — report

Base: `4c65cfc` (branch `sp8-ai`). Result commit: `9e1e5c7`.

## F1 (Important) — 0-byte staged size: declare the deviation, don't restore Vue2's short-circuit

Kept our behaviour (`0 → '0 B'`), per coordinator ruling. What was missing was the declaration —
added it in three places:

- `src/ai/components/tabs/ResourcesTab.vue:238-241` — comment above the batch-items `.rt-size` cell
  (the actual `formatStagedSize(it.size_bytes)` call is now at line 242): explains Vue2
  `ResourcesTab.vue:99`/`:117` short-circuit with `it.size_bytes ? … : '—'` (0-byte staged item
  shows `'—'` there), contradicting `formatSize`'s own `n !== 0` branch and Vue2's attachment row
  (`:40`, no short-circuit, already shows `'0 B'`) — i.e. Vue2 is self-inconsistent. States we call
  `formatStagedSize` directly so `0 → '0 B'`, and that this is logged.
- `src/ai/components/tabs/ResourcesTab.vue:257-259` — shorter comment at the loose-items `.rt-size`
  cell (`formatStagedSize` call now at line 260), pointing back to the batch-items comment above.
- `.superpowers/sdd/p1c2-task-12-report.md` — added a new bullet at the end of "Judgment calls /
  left alone" spelling out the same reasoning and naming it explicitly as a **declared deviation**,
  not parity (this file is gitignored under `.superpowers/`, so it's a disk-only ledger entry, not
  part of the git commit).

New regression test — `src/ai/components/tabs/ResourcesTab.test.ts`, describe block
`ResourcesTab — staged item size 0-byte deviation (new, F1)` (single `it`, ~line 231): builds a
group with two loose items, one `size_bytes: 0` and one with `size_bytes` omitted entirely, and
asserts the rendered `.rt-size` texts contain both `'0 B'` and `'—'` — so the test can't pass
vacuously (it distinguishes "0 renders as 0 B" from "falsy renders as 0 B").

## F2 (Important) — snapshot_missing test strengthened to discriminate `.some()` vs `.every()`

`src/ai/components/tabs/ResourcesTab.test.ts` describe block `ResourcesTab — turn-level revert
disabled by snapshot_missing (new)` (~line 216) now has two tests instead of one:

1. `disables the whole-turn revert button when any (not all) item has snapshot_missing` — group
   with **two** items, only the first has `snapshot_missing: true`; asserts the revert button is
   still disabled.
2. `leaves the whole-turn revert button enabled when no item has snapshot_missing` (new companion
   case) — two items, neither has `snapshot_missing: true`; asserts the button is enabled.

The implementation under test, `hasSnapshotMissing()` at `ResourcesTab.vue:108`
(`g.items.some((it) => it.snapshot_missing)`), was not changed — only the test's discriminating
power.

### RED evidence (temporarily flipped `.some` → `.every` at `ResourcesTab.vue:108`)

```
$ pnpm exec vitest run src/ai/components/tabs/ResourcesTab.test.ts
...
 ❯ src/ai/components/tabs/ResourcesTab.test.ts (22 tests | 1 failed) 133ms
     × disables the whole-turn revert button when any (not all) item has snapshot_missing 8ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ai/components/tabs/ResourcesTab.test.ts > ResourcesTab — turn-level revert disabled by snapshot_missing (new) > disables the whole-turn revert button when any (not all) item has snapshot_missing
AssertionError: expected undefined to be defined
 ❯ src/ai/components/tabs/ResourcesTab.test.ts:230:40
    228|     const w = track(mountTab({ stagedChanges: [g] }))
    229|     const btn = w.find('.rt-turn-head .rt-revert')
    230|     expect(btn.attributes('disabled')).toBeDefined()
       |                                        ^
    231|   })
    232|

 Test Files  1 failed (1)
      Tests  1 failed | 21 passed (22)
```

Exactly the one new discriminating assertion failed (the companion "none missing → enabled" test
still passed, since `.every()` on a group where none have it is also falsy → button enabled either
way — expected, not a discriminator for that direction).

### GREEN evidence (reverted `.every` → `.some`, confirmed `git diff` shows line 108 back to original)

```
$ grep -n "g.items.some\|g.items.every" src/ai/components/tabs/ResourcesTab.vue
108:  return g.items.some((it) => it.snapshot_missing)

$ pnpm exec vitest run src/ai/components/tabs/ResourcesTab.test.ts
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

The flip was never staged/committed — verified via `git diff` before commit that `ResourcesTab.vue`
only contained the intended F1 comment additions plus the F2 test file changes, no residual
`.every`.

## F3 (Minor) — `aiResSentTitle` zh wording

`src/i18n/zh_cn.ts:835`: `'已发送至模型，无法移除'` → `'已发送给模型，无法移除'` (至 → 给),
matching Vue2's `NimoOS-UI/src/assets/lang/zh_CN.json:1314` verbatim. `en_us.ts` untouched (already
correct per brief).

## Gates (final run, after all 3 fixes, before commit)

```
$ pnpm exec vitest run src/ai/components/tabs/ResourcesTab.test.ts src/ai/util/stagedGroups.test.ts src/i18n/
 Test Files  5 passed (5)
      Tests  56 passed (56)

$ pnpm test -- src/ai/ src/i18n/
 Test Files  46 passed (46)
      Tests  600 passed (600)

$ pnpm exec vue-tsc --noEmit
(no output — 0 errors)

$ grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/ai/components/tabs/ResourcesTab.vue
285:// Vue2 裸色 1/2: rgba(255,149,0,0.12) 背景 + var(--warning, #ff9500) 兜底色字 → 既有 token。
308:// Vue2 裸色 7: rgba(255,59,48,0.1) 背景 → --danger-soft。
```
Both grep hits are inside pre-existing explanatory comments (unchanged by this fix pass, not new
literals) — no new hex/rgb introduced.

## `git status --short` before staging (confirmed nothing outside whitelist)

```
 M src/ai/components/tabs/ResourcesTab.test.ts
 M src/ai/components/tabs/ResourcesTab.vue
 M src/i18n/zh_cn.ts
```
(`.superpowers/sdd/p1c2-task-12-report.md` is gitignored under `.superpowers/` — edited on disk per
F1 item 3, but never appears in `git status` and is not part of the commit; this is consistent with
how prior task reports in this directory, e.g. `p1c2-fix-t8-t9-report.md`, are handled.)

## Commit

```
$ git add src/ai/components/tabs/ResourcesTab.vue src/ai/components/tabs/ResourcesTab.test.ts src/i18n/zh_cn.ts
$ git commit -m "SP8-P1c2 fix: declare 0-byte staged size deviation, strengthen snapshot_missing test, zh wording"
[sp8-ai 9e1e5c7] SP8-P1c2 fix: declare 0-byte staged size deviation, strengthen snapshot_missing test, zh wording
 3 files changed, 45 insertions(+), 2 deletions(-)
```

### `git show --stat HEAD`

```
commit 9e1e5c71fac37be94e71723768a3d242d03b58e6
Author: Tiansanchuan <1312528051@qq.com>
Date:   Tue Jul 28 12:36:29 2026 +0800

    SP8-P1c2 fix: declare 0-byte staged size deviation, strengthen snapshot_missing test, zh wording

    Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

 src/ai/components/tabs/ResourcesTab.test.ts | 39 ++++++++++++++++++++++++++++-
 src/ai/components/tabs/ResourcesTab.vue     |  6 +++++
 src/i18n/zh_cn.ts                           |  2 +-
 3 files changed, 45 insertions(+), 2 deletions(-)
```

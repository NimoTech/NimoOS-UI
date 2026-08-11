### Task 4 Report — Bug 5: 拖应用上桌不查重,重复图标

**Status: DONE**

## What changed

1. `src/home/composables/useAddPanel.ts` — replaced `dupWidget` (widget/appwidget only)
   with `isDuplicate`, which additionally checks:
   - `app`: `layout.items.some(it => it.kind === 'app' && it.key === desc.key)`
   - `folder`: `layout.items.some(it => it.kind === 'folder' && it.path === desc.path)`
     (compares by `path`, not `key`, so same-named folders on different disks can coexist)
   - `photo` kind is intentionally left out of dedup (allowed to repeat).
   - Added `existsMsgKey(kind)` to pick the right toast message per kind.
   - `pinToFree` now toasts on duplicate (previously silently returned `false` for
     widget dup with no toast) — this is a deliberate UX improvement per the brief,
     matching what `spawnPlace` already did.
   - `spawnPlace` and `toggleWidget` updated to call `isDuplicate` (renamed, same
     behavior for their existing call sites — `toggleWidget` only ever passes a
     `widget` desc, so no double-toast risk).

2. `src/home/stores/layout.ts` — `autoPin`'s push branch now checks `items.value`
   directly (not just the `seen` set) before adding an `app` tile and, separately,
   before adding an `appwidget` tile. `seen.value.add(d.key)` still runs afterward,
   so a manually-pinned app that skipped the `items` check this round gets recorded
   into `seen` and won't be re-examined on the next call.

3. i18n — added `addPanelAppExists` / `addPanelFolderExists` to both
   `src/i18n/zh_cn.base.ts` and `src/i18n/en_us.base.ts` (right after
   `addPanelWidgetExists`, line ~320).

4. Tests — added to `src/home/composables/useAddPanel.test.ts` and
   `src/home/stores/layout.test.ts` per the brief, adapted to each file's existing
   conventions (`DIMS`/`dl()` helper in layout.test.ts, `vi.spyOn(layout, 'save')`
   pattern in useAddPanel.test.ts).

## RED evidence (before implementation, tests added but composable/store unchanged)

```
❯ src/home/composables/useAddPanel.test.ts (6 tests | 2 failed)
     × 同一 app 第二次 pinToFree 被拒并 toast
     × 同一 folder(按 path 判等)第二次 spawnPlace 被拒
❯ src/home/stores/layout.test.ts (30 tests | 1 failed)
     × autoPin 不重复添加桌面上已有的同 key app 磁贴(手动 pin 后未进 seen 的场景)

Test Files  2 failed (2)
     Tests  3 failed | 33 passed (36)
```
All 33 pre-existing tests stayed green; exactly the 3 new cases were red.

## GREEN evidence (after implementation)

```
pnpm vitest run src/home/composables/useAddPanel.test.ts src/home/stores/layout.test.ts \
  src/i18n/parity.test.ts src/home/components/AddPanel.test.ts \
  src/home/components/AddPanel.spawn.test.ts src/home/components/AddPanel.spawn-place.test.ts

Test Files  6 passed (6)
     Tests  51 passed (51)
```

`pnpm exec vue-tsc --noEmit` — clean, no output.

Full `pnpm test` (11221 tests) also run: 4 failures observed, all pre-existing/unrelated
to this change, confirmed by re-running each in isolation with a clean tree (identical
result with and without this commit's diff via `git stash`):
- `oss/cli-args.test.mjs` and `oss/export-rsync.test.mjs`: these OSS-export tests refuse
  to run against a dirty working tree (`工作树不干净,导出中止`) — they failed only because
  my changes were uncommitted at the time of the full-suite run; they pass in isolation
  and are unrelated to the OSS export path this task never touches. Passed after commit
  in isolated reruns.
- `src/home/components/DesktopContextMenu.test.ts` ("clicking the rendered item opens the
  wallpaper picker"): unrelated component (wallpaper picker context menu), not touched by
  this task; passes 6/6 in isolation both with `git stash` (base commit) and with this
  change applied — a flake under full-suite parallel load, not a regression.

## Files touched

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/home/composables/useAddPanel.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/home/composables/useAddPanel.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/home/stores/layout.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/home/stores/layout.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/i18n/zh_cn.base.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/i18n/en_us.base.ts`

---

## Fix round 1 — OSS leak-guard finding on comment wording

**Finding:** commit `bcf9416d` added a prose comment at
`src/home/composables/useAddPanel.ts:36` — `// 查重覆盖 widget/appwidget/app/folder 四种
kind(photo 允许重复添加)。` — that named the desktop-tile kind excluded from dedup
directly. That kind's name is on `oss/forbidden.mjs`'s SOFT forbidden-word list (that
area is stripped from the public OSS export tree), and this specific line wasn't covered
by any of the existing exact-line allow entries, so the export's leak guard correctly
refused to write a single byte:

```
✗ src/home/composables/useAddPanel.ts:36 [photo] // 查重覆盖 widget/appwidget/app/folder 四种 kind(photo 允许重复添加)。
[oss] 失败:泄漏守卫命中 1 处,一个字节都不落盘。
```

**What changed:** reworded the comment to drop the named kind while keeping the same
information (the other four kinds are deduped; one kind is deliberately excluded and
still allows repeats), and kept the second line about folder path-equality unchanged.
No `oss/forbidden.mjs` edits — the guard itself was not touched or weakened.

Before:
```ts
// 查重覆盖 widget/appwidget/app/folder 四种 kind(photo 允许重复添加)。
// folder 按 path 判等:不同盘下允许同名文件夹并存。
```
After:
```ts
// 查重覆盖 widget/appwidget/app/folder 四种 kind,其余 kind 允许重复添加。
// folder 按 path 判等:不同盘下允许同名文件夹并存。
```

**Verification (dirty-tree workaround, run in FOREGROUND):**

1. `git stash push -u -m tmp-oss -- bug.txt docs/superpowers/plans/2026-08-11-bugtxt-batch-fixes.md`
   — set aside the two untracked scratch files unrelated to this task so the export's
   clean-tree precondition could be met.
2. Discovered the export also refuses on my *own* uncommitted comment fix (dirty tree
   is dirty tree, regardless of whose change it is), so committed the wording fix first
   (`3d5d4916`), then re-ran the guard against a fully clean tree:
   ```
   pnpm vitest run oss/tree.test.mjs

   Test Files  1 passed (1)
        Tests  66 passed (66)
   ```
   The previously-failing `不带 --skip-guard 也能跑通` case is included in this 66/66 —
   the leak guard now runs clean against the full export.
3. `git stash pop` — restored `bug.txt` and the plan doc; `git status --short` confirmed
   both are back as untracked, nothing else changed.
4. `pnpm vitest run src/home/composables/useAddPanel.test.ts` — 6/6 pass, confirming the
   comment-only reword didn't disturb the dedup behavior tests from round 1.

**Commit:** `3d5d4916` — `fix(home): reword comment to clear the OSS leak guard`

**Concerns:** none. This was a comment-only change; no code paths or i18n keys were
touched in this round.

## Commit

`bcf9416d` — `fix(home): prevent duplicate app/folder tiles on the desktop`

## Concerns

- None blocking. Note the intentional behavior change flagged in the brief:
  `pinToFree` now shows a toast on a duplicate app/widget/folder instead of silently
  no-opping — this is the brief's stated interface change ("`pinToFree(desc): boolean`
  ... 返回 `false` 并 toast"), not an accidental side effect. Checked `AddPanel.vue`'s
  only `pinToFree` call site (line 210) and it doesn't depend on the silent-false
  behavior.
- Did not touch `packages/service/` per constraints. Did not touch unrelated untracked
  files present in the worktree (`bug.txt`, `docs/superpowers/plans/2026-08-11-bugtxt-batch-fixes.md`).

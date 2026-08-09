# Task 2 report: rename `AlbumLibraryPicker` → `PhotosLibraryPicker`

Status: **DONE_WITH_CONCERNS** (one pre-existing, unrelated `oss` failure — see §6).

## 1. Baseline vs. after — per-file case counts

| Test file | Baseline | After rename |
|---|---|---|
| `AlbumLibraryPicker.test.ts` → `PhotosLibraryPicker.test.ts` | 15 | 15 |
| `PhotosAlbumDetail.test.ts` | 33 | 33 |
| `PhotosAlbums.test.ts` | 20 | 20 |
| **Total** | **68** | **68** |

Exact match, zero regression. Command used both times:
```
pnpm exec vitest run <the three files> --reporter=verbose
```

Bonus check (not required by the brief, but touched by the rename — see §3): `PhotosMomentDetail.test.ts` — 59/59 pass, unchanged.

## 2. `git mv`

```
git mv src/photos/components/AlbumLibraryPicker.vue src/photos/components/PhotosLibraryPicker.vue
git mv src/photos/components/__tests__/AlbumLibraryPicker.test.ts src/photos/components/__tests__/PhotosLibraryPicker.test.ts
```
Git recorded these as renames with 97%/98% similarity (visible in the final `git log --stat`).

## 3. Every reference updated

The brief's file list (`PhotosAlbums.vue`, `PhotosAlbumDetail.vue`) turned out to be **stale**: `grep -rn "AlbumLibraryPicker" src oss` also found `src/views/PhotosMomentDetail.vue` and `src/views/PhotosMomentDetail.test.ts` already wired to the old name — Task 1 of this same P2a plan (`e702f2c feat(photos): add the smart view manual asset actions`, landed before this task started) had already made the moments detail page a second non-album consumer. Since the task instruction was "find every reference and update each" (not "update only the brief's list"), I treated this as in-scope: leaving those two files pointing at a path that `git mv` had just deleted would have broken the build, which is a correctness requirement independent of the brief's file list.

Files updated (identifier + import/require path, mechanical substitution only):
- `src/photos/components/PhotosLibraryPicker.vue` (renamed; header debt note rewritten, see §4)
- `src/photos/components/__tests__/PhotosLibraryPicker.test.ts` (renamed; import, `describe` title, header line, `mountPicker` comment)
- `src/views/PhotosAlbums.vue` — import, template tag, 4 comments
- `src/views/PhotosAlbumDetail.vue` — import, template tag, 3 comments
- `src/views/PhotosMomentDetail.vue` — import, template tag, 1 comment (not in brief; see above)
- `src/views/PhotosMomentDetail.test.ts` — import, 7 usages (not in brief; see above)
- `src/views/__tests__/PhotosAlbums.test.ts` — import, 3 usages/comments
- `src/views/__tests__/PhotosAlbumDetail.test.ts` — import, 4 usages/comments

Substitution method: `perl -pi -e 's/(?<!Photos)AlbumLibraryPicker/PhotosLibraryPicker/g'` on the eight files above. The negative lookbehind was necessary because the component header carries two **historical, correct** mentions of Vue 2's own file `PhotosAlbumLibraryPicker.vue` (a different, real filename that happens to contain "AlbumLibraryPicker" as a substring) — a blind replace would have corrupted those into "PhotosPhotosLibraryPicker.vue". Verified those two survived untouched (see §5).

### `oss/manifest.mjs` — no change needed (brief's premise didn't hold)

The brief assumed the manifest lists the component and its test by literal path and would `exit 1` on staleness. I searched (`grep -n "AlbumLibraryPicker\|Picker" oss/manifest.mjs`) and found no such entries. The actual mechanism: `oss/manifest.mjs` line 90 strips the **entire `src/photos` directory** as a single path (`'src/photos', // 组件/store/composable/灯箱/util 全区`), which already covers `src/photos/components/PhotosLibraryPicker.vue` and its `__tests__` subfolder regardless of the file's name. Only `src/views/PhotosAlbumDetail.vue`/`PhotosAlbums.vue` and their tests are listed individually (lines 102-103, 124-125), and those filenames didn't change. So renaming a file inside an already directory-wide-stripped tree requires no manifest edit — I made none, and did not touch `oss/forbidden.mjs`.

## 4. Component header debt note

Old (P1's registered debt, lines 26-30):
> ⚠️ The file name now understates the component... here the rename is deliberately deferred — it travels with the rest of #79 in P2, and doing it now would drag every import, test path and the oss manifest through a churn that has nothing to do with moments.

New:
> ✅ Debt paid in SP15-P2a (2026-08-09): this file (previously AlbumLibraryPicker.vue, plus its test) is renamed to PhotosLibraryPicker.vue, matching what Vue 2 already did in the same #79 commit that generalised it. Rename only — every import, test path and the oss manifest were updated to follow; props, emits, template and logic are untouched, and the album pages' existing tests carry over unchanged as the evidence.

## 5. Verification

- Three baseline files re-run: **68/68 pass**, exact match (§1).
- `PhotosMomentDetail.test.ts` re-run: **59/59 pass** (extra check, since I touched that file).
- `pnpm exec vue-tsc --noEmit`: **clean, no output**.
- `pnpm exec vitest run oss`: **448/449 pass, 1 failed** — see §6, pre-existing and unrelated.
- Stale-reference grep: `grep -rn "AlbumLibraryPicker" src oss packages` returns exactly 4 lines, all legitimate historical references, not stale identifiers:
  - `PhotosLibraryPicker.vue:4` and `:23` — Vue 2's actual filename `PhotosAlbumLibraryPicker.vue` (a fact about Vue 2's source tree, not our identifier)
  - `PhotosLibraryPicker.vue:26` and `PhotosLibraryPicker.test.ts:296` — the new debt note's "(previously AlbumLibraryPicker.vue...)" phrasing, and a pre-existing unrelated comment citing Vue 2's `PhotosAlbumLibraryPicker.vue:10-12`
  - `docs/**` still mentions the old name in 5 historical design/plan files — left untouched per instructions (historical record).

## 6. `oss` failure — pre-existing, not caused by this task

`oss/tree.test.mjs`'s leak-guard step fails on 15 hits inside `packages/service/src/photos.smartviewAssets.test.ts` (a `[photo]` word-list match). Confirmed via `git log --oneline -- packages/service/src/photos.smartviewAssets.test.ts` that this file was added by **Task 1** of this same P2a plan (`e702f2c feat(photos): add the smart view manual asset actions`), landed before this task began. `git diff 747ea6b..HEAD -- packages/service/src/photos.smartviewAssets.test.ts oss/manifest.mjs oss/forbidden.mjs` is empty — I did not touch any of the three files involved. This is Task 1's open debt, not introduced by the rename, and fixing it (extending the manifest's `DELETE`/`PATCH` list or `forbidden.mjs`'s whitelist for an unrelated file) is outside this task's rename-only mandate. Flagging for the controller/next task rather than improvising a fix.

Before my two commits, this same failure was already latent in the working tree (the file existed, untouched, at every commit since e702f2c) — it was only *visible* once the tree became clean enough for `oss/tree.test.mjs`'s `execFileSync export.mjs` step to get past the "is the tree dirty" precheck (see §7).

## 7. Housekeeping: the sdd `.gitignore` trap, again

Found `.superpowers/sdd/.gitignore` containing a single `*` — the same recurring trap noted in project memory ("New-UI `.superpowers/sdd/.gitignore` 一行 `*` 曾致 20 份台账静默不入库"). Deleted it per instructions and did not recreate it. This exposed one previously-hidden, untracked ledger file: `task-2-brief.md` (the brief for this very task). Per the 2026-08-05 convention that sdd ledger files are tracked in git, I committed it separately in `2a42ba0 docs(sp15): add the P2a task 2 brief` — keeping it out of the rename commit's diff, but restoring a clean tree (required by `oss`'s own dirty-tree precheck, which every `oss/*.test.mjs` file that shells out to `export.mjs` depends on).

## 8. Self-review: is the diff rename-only?

Read the full `git diff` of the rename commit (`f8000b6`) line by line:
- **8 files changed, 42 insertions(+), 42 deletions(-)** — perfectly symmetric, consistent with pure token substitution.
- Every changed line is either: an `import` path, a component tag in a `<template>`, a `describe`/`it` title string, or a comment that names the component — never a prop, emit, template attribute/binding, or `<script>` logic line.
- The component's `<script setup>` body (props, emits, all functions, the `<template>` markup and `<style scoped>` block) is byte-for-byte identical except for the header comment block (§4).
- No `#`hex/`rgb(`/named-color literals introduced (theme-token rule N/A here — no styles touched).
- No `src/files/**` or `src/i18n/*.base.ts` touched.
- `oss/forbidden.mjs` untouched.

Conclusion: the diff is rename-only. The one behavioural-adjacent decision made — extending the identifier substitution to `PhotosMomentDetail.vue`/`.test.ts`, which the brief's file list omitted — was necessary to keep the build/tests working after `git mv`, not a behaviour change; it is the same mechanical substitution applied to two more files that already referenced the old name.

## 9. Files changed

Commit `f8000b6` (the rename):
- `src/photos/components/AlbumLibraryPicker.vue` → `src/photos/components/PhotosLibraryPicker.vue` (renamed, header debt note updated)
- `src/photos/components/__tests__/AlbumLibraryPicker.test.ts` → `src/photos/components/__tests__/PhotosLibraryPicker.test.ts` (renamed)
- `src/views/PhotosAlbumDetail.vue`
- `src/views/PhotosAlbums.vue`
- `src/views/PhotosMomentDetail.vue`
- `src/views/PhotosMomentDetail.test.ts`
- `src/views/__tests__/PhotosAlbumDetail.test.ts`
- `src/views/__tests__/PhotosAlbums.test.ts`

Commit `2a42ba0` (housekeeping, separate from the rename):
- `.superpowers/sdd/2026-08-09-sp15-p2a-smartview-manual-assets/task-2-brief.md` (newly tracked)
- (deleted, uncommitted-by-design) `.superpowers/sdd/.gitignore`

`oss/manifest.mjs` — **not modified**; investigation showed no change was needed (§3).

## 10. Concerns for the controller

1. **The brief's premises about scope and the manifest were both stale** by the time this task ran (Task 1 had already added a second non-album consumer; the manifest strips `src/photos` wholesale rather than listing the picker by name). Worth a note if other P2a task briefs were written against the same now-outdated snapshot.
2. **`oss` has one pre-existing failing test** (`oss/tree.test.mjs`'s leak guard on `packages/service/src/photos.smartviewAssets.test.ts`, added by Task 1) — not caused by this task, not fixed by this task, flagged in §6 for whoever picks up Task 1's manifest/forbidden-list debt.
3. The `.superpowers/sdd/.gitignore` trap recurred in this worktree; removed per instructions, and the one file it had hidden is now committed separately.

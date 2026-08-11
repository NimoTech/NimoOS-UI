# Task 5 report — Bug 6: folder tiles overlap their grid cell

## Status: DONE

## What changed

1. **`src/home/components/FolderTile.vue`** — deleted the scoped `.folder-ic { width: 100%; height: 100%; }` override, and reworded the comment above it (per brief) to state that `.folder-ic` sizing belongs entirely to `theme.css`'s square-tile rule and must not be re-declared here (bug.txt #6).
2. **`src/styles/theme.css`** (line 703) — confirmed the selector matched the brief's analysis exactly:
   `.kind-app .app-ic, .kind-folder .folder-ic, .kind-folder .folder-tile { flex: 1 1 auto; min-height: 0; width: auto; height: auto; aspect-ratio: 1; }`
   Added `min-width: 0;` right after `min-height: 0;`.
3. **`src/home/components/tileSizing.test.ts`** (new) — source-level guard test, with two deviations from the brief's literal code (both necessary, both documented in-file):
   - **CSS `?raw` returns `""` in this repo's vitest setup** — this is a pre-existing, already-documented environment fact (`src/styles/color-guard.test.ts` and `src/styles/theme.sp9.test.ts` carry the same comment/workaround). I verified this empirically (a `?raw` import of an ad-hoc throwaway `.css` file also returned `""`). Switched `theme.css` reading to `node:fs` `readFileSync`, matching the established pattern in those two files. `FolderTile.vue?raw` is unaffected (`.vue` files import fine via `?raw`).
   - **Comment text created a self-inflicted false positive** — the brief's mandated FolderTile.vue comment text contains the literal substring `.folder-ic` followed later (across a lower comment line) by `width/height` prose, then the real `.folder-tile-wrap { ... height: 100%; }` rule. The guard regex `\.folder-ic[^{]*\{[^}]*(width|height)\s*:` has no comment-awareness and matched the comment-to-next-rule span even after the real violation was deleted, producing a false RED at Step 3. Fixed by stripping `/* ... */` comments from the style-block text before matching. Verified precisely with a debug script (`themeSrc.match` inline in a Node one-liner) before touching the test.

## RED evidence (Step 1, before any implementation change)

```
✗ FolderTile scoped style must not redeclare .folder-ic width/height
✗ theme.css square-tile rule keeps aspect-ratio and min-width:0
Test Files  1 failed (1)
     Tests  2 failed (2)
```

## GREEN evidence (Step 3, after fix)

```
✓ src/home/components/tileSizing.test.ts > desktop tile sizing (bug.txt #6) > FolderTile scoped style must not redeclare .folder-ic width/height
✓ src/home/components/tileSizing.test.ts > desktop tile sizing (bug.txt #6) > theme.css square-tile rule keeps aspect-ratio and min-width:0
✓ src/home/components/FolderTile.test.ts > FolderTile > renders the folder name
✓ src/home/components/FolderTile.test.ts > FolderTile > renders a files-area FileThumb tagged .folder-ic
✓ src/home/components/FolderTile.test.ts > FolderTile > hands FileThumb a directory FileEntry with name=item.key
✓ src/home/components/FolderTile.test.ts > FolderTile > defaults path to empty string when the item has none
✓ src/home/components/GridItem.edit.test.ts > GridItem edit affordances > shows remove button only in edit mode and removes on click
✓ src/home/components/GridItem.edit.test.ts > GridItem edit affordances > previewSize overrides grid-area span
✓ src/home/components/GridCanvas.test.ts > GridCanvas > renders one positioned GridItem per layout item
Test Files  4 passed (4)
     Tests  9 passed (9)
```

Also ran the full `src/home` + `src/styles` suite as a broader regression check: **65 files / 1659 tests, all passed.**

## Commit

`c862e085` — `fix(home): keep folder tiles inside their grid cell`

Files in commit: `src/home/components/FolderTile.vue`, `src/styles/theme.css`, `src/home/components/tileSizing.test.ts` (3 files changed, 37 insertions, 3 deletions). Message follows the brief's exact body verbatim.

## Self-review

- `git diff` on `FolderTile.vue` / `theme.css` matches the brief's prescribed edits exactly (confirmed via diff inspection).
- `AppTile.vue` is untouched (`git diff --stat -- src/home/components/AppTile.vue` empty) — scope respected per the brief's explicit carve-out.
- No color literals introduced (`grep` for hex/rgb/rgba across the diff: none) — only sizing declarations touched, consistent with global constraints.
- New/changed comments are Chinese, matching file style.
- `packages/service/` untouched.
- Only the three intended files were staged and committed; `bug.txt` and `docs/superpowers/plans/2026-08-11-bugtxt-batch-fixes.md` remain untracked/unstaged (pre-existing batch-task artifacts, not part of this task).

## Concerns for acceptance (Task 8, real browser)

- jsdom has no layout engine, so this task cannot visually confirm the fix — per the brief's own note, real verification is real-browser, narrow-window folder tiles specifically. Please check that folder tiles stay square and inside their cell as the window narrows toward the 60-75px cell width mentioned in the bug report.
- The `min-width: 0` addition is shared by `.app-ic` too (same selector list), but since `AppTile.vue`'s own scoped `.app-ic { width/height: 100% }` override is untouched and still wins by the same specificity/injection-order mechanism, this theme.css change should have **no visible effect on app tiles** — worth a quick side-by-side glance during acceptance to confirm app tile sizing is unchanged, per the brief's own suggestion to "come back and evaluate if folder/app sizing looks mismatched."

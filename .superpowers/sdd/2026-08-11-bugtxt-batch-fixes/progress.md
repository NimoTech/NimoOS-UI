# SDD ledger — plan: docs/superpowers/plans/2026-08-11-bugtxt-batch-fixes.md

BASE at start: 39fe7a930b3cce550cc12d6c691457df22e2cc05 (branch acceptance-bugfixes, dev server :5277)
Pre-flight conflict scan: clean.
Task 1: complete (commits 39fe7a93..c1b8b847, review clean)
Task 2: complete (commits c1b8b847..07c91b9c, review clean)
Task 3: complete (commits 07c91b9c..d6494d06, review clean)
Note: full-suite run in task 3 showed 4 failures in src/home/components/DesktopContextMenu.test.ts, but that file passes 6/6 in isolation (controller-verified) — suspected suite-level ordering/isolation flake, unrelated to files-area diffs. Re-check during Task 8 full run.
Task 4: complete (commits d6494d06..bcf9416d, review clean)
Task 4: minor (deferred): useAddPanel.ts folderUsed(desc.path ?? '') — undefined-path folder desc would empty-string-collide; unreachable today, defensive it.path != null suggested.
Task 5: complete (commits bcf9416d..c862e085, review clean; two verified-necessary deviations: theme.css read via node:fs (?raw returns "" — precedented), guard strips CSS comments first)
Task 6: complete (commits c862e085..0b637d54, review clean)
Task 6: minor (parked): new comments written in Chinese vs workspace-CLAUDE.md English rule — ruling: controller-directed, matches this repo's established practice (Files.vue etc. are Chinese-commented throughout); consistent with all prior sprints.
Task 4: REOPENED — oss leak guard hit: useAddPanel.ts:36 comment contains banned word "photo" (photos area is stripped from OSS export). Introduced by bcf9416d (plan's verbatim comment). Entering fix round 1.
Task 7: implementation DONE (a06ce844), review pending — controller verified the oss failures split: dirty-tree aborts = environmental (untracked bug.txt + plan doc); tree.test guard hit = real, belongs to Task 4.
Task 7: review Approved with 1 Important (missing test for Files.vue upload-length filter) — fix round 1 dispatched (resume af6aca498b171b880).
Task 4: fix round 1 dispatched (resume a5c7e9447c7654160) — reword useAddPanel.ts:36 comment off the banned word.
Task 4: fix round 1/5 (1 addressed, 0 open — comment reword off banned word; commit 3d5d4916). Re-review clean.
Task 4: complete again (commits d6494d06..bcf9416d + 3d5d4916, review clean)
Task 7: fix round 1/5 (1 addressed, 0 open — upload-filter tests added; commit 29edad3a). Re-review clean.
Task 7: complete (commits 0b637d54..a06ce844 + 29edad3a, review clean)
Task 8: started — full suite + vue-tsc + browser acceptance on :5277.
Task 8: full suite 11165 passed / 3 failed — all 3 in oss/ = dirty-tree aborts from untracked bug.txt + plan doc (environmental); oss/ re-run on stashed clean tree = 146/146 green. vue-tsc clean. DesktopContextMenu flake did not recur.
Task 8: browser acceptance on :5277 = 6/6 PASS (all /v1 stubbed, zero backend escapes; report task-8-acceptance.md, 9 screenshots). Manual device items outstanding: real empty-folder drag, RAID shared-folder delete, real deepest-path tus upload, native dropdown popup eyeball.
Final review (fable): With fixes — 1 Important: empty dirs bypass NAME_MAX/PATH_MAX preflight in commitSelectedFiles (Task6/7 seam). Minors deferred: 20001-as-created toast inflation (plan-specified), pinToFree widget-dup toast delta (deliberate, near-unreachable). Ledger triage: all parked items stay as ruled.
Final fix wave dispatched: filter emptyDirs through fitsLimits + fold count into filesUploadPathTooLong toast + component-level seam test.
Final fix wave: complete (commit b7406975, re-review clean — both findings ADDRESSED).
Final review: clean after fix wave. Branch ready: 39fe7a93..b7406975 (10 commits).
Manual device items (挂账给机主): real empty-folder drag-drop (incl. deepest-path empty dir), RAID shared-folder delete, real deepest-path tus upload, native dropdown popup eyeball in dark theme.
Follow-up (2026-08-11, owner clarified bug #6): the reported overlap was LONG FOLDER NAMES covering neighbours, not the icon. Root cause: tile roots (.app-tile/.folder-tile-wrap) are flex items with no width cap — nowrap labels inflate them to content width (min-width:auto floor), so .app-label's max-width:100% resolves against the inflated parent and never ellipsizes. Evidence: 262px label in a 63px cell, adjacent labels intersecting; single-variable injection of max-width:100% converged everything. Fix: theme.css caps .kind-app .app-tile / .kind-folder .folder-tile-wrap at max-width:100% + guard assertion in tileSizing.test.ts. Probe re-run: labels 63px, ellipsized, zero overlaps (screenshot acceptance/bug6b-longname-ellipsis.png). Full suite 11168 passed (3 oss dirty-tree environmental).

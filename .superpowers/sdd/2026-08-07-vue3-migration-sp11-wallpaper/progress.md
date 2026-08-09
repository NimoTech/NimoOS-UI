# SDD ledger — plan: docs/superpowers/plans/2026-08-07-vue3-migration-sp11-wallpaper.md

Repo: /home/nimo/NimoTech/NimoOS-New-UI (branch master, no worktree — plan Global
Constraints forbid checkout/stash in this tree; owner standing decision).
Branch base for the final review: 693c88aacd844d428ecbf87617b47c2571bb4ca7

## Pre-flight rulings (controller, before Task 1)

- **T5 内部矛盾**:Task 5 Step 2 的测试断言 `[data-test="wp-upload"]` 与
  `[data-test="wp-nas"]` 存在,但 Step 4 的组件里那块只有 `<slot name="sources" />`,
  照抄必红。裁定:**Task 5 就实现这两个按钮**(`wp-upload` 打开隐藏 file input 的位置
  留到 T6;T5 里先给按钮本体与 `wp-nas`),删掉 `<slot name="sources" />`。两种读法
  在 T6 收尾后终态相同,故控制器自裁,不打断执行。
- **T6 散文与代码不一致**:Step 5 正文要求 `onNasPick` 成功后调 `wp.beginPreview()`
  重置快照,但给出的代码块里没有。裁定:**正文为准**,实现里必须有。
- `.superpowers/sdd/.gitignore` 仍是一行 `*`(与记忆里「08-07 已修」不符)⇒ 本台账
  与所有 brief/report 都不进 git。Task 11 Step 5 已按这种情况写好。

## Tasks

Task 1: complete (commits 693c88a..c4e63bd, review clean — 13/13 tests, spec ✅)
Task 2: complete (commits c4e63bd..91816ac, review clean — 6/6 css guard tests, mutation check verified red then green)
Task 3: complete (commits 91816ac..0046f5c, review clean — 28/28 tests; real error codes 60001/10009/10010 from ../NimoOS-Common/utils/common_err/e.go:48,20,21)
Task 3: minor (deferred): users.ts PUT doc comment maps 4 line numbers to 3 error names (888 is INVALID_PARAMS, and USER_NOT_EXIST at :901 is unlisted); umbrella claim still true
Task 3: minor (deferred): users.test.ts mock message 'Image too large' differs from the backend's real 'Image is too large' (self-referential assertion, harmless)
Task 3: minor (deferred): uploadImage (POST) has no error-path test while the PUT has three
Task 3: reviewer's ⚠️ (commit pathspec) resolved by controller — design-export deletions still unstaged-deleted in worktree, 0046f5c touched only the 3 intended files
Task 4: implemented (commit 5d9b549), review Approved with 3 Important findings all labelled plan-mandated
Task 4: controller ruling — fixing all three does NOT contradict plan text (plan is silent on the races, does not require them); repo convention "async writes to shared state carry a staleness guard" governs. Dispatched fix round 1 rather than escalating.
Task 4: minor (deferred): no test pins that cancelPreview avoids writing localStorage.theme
Task 4: minor (deferred): setFromNasPath partial failure (server copy ok, commit rejects) leaves an applied-but-unpersisted wallpaper
Task 4: fix round 1/5 (3 addressed, 0 open — commit() stale-write, load() epoch guard, openDialog/closeDialog test strengthened; commits 5d9b549..8a186a2)
Task 4: complete (commits 0046f5c..8a186a2, review clean — 27/27 tests)
Task 5: complete (commits 8a186a2..aaf912d, review clean — 9/9 dialog tests; controller override applied: real wp-upload/wp-nas buttons instead of the brief's <slot name="sources">)
Task 5: minor (deferred): wp-error has no aria-live/role=alert
Task 5: minor (deferred): DialogContent :aria-describedby="undefined" lacks an explanatory comment
Task 5x (out of plan): full suite has 1 failure — oss/tree.test.mjs, Task 1's 2.2MB wallpaper01.jpg trips the OSS leak guard's 2MB scan cap and counts as an UNEXPECTED skip, so the export refuses to write. Blocks T11 Step 1. Controller ruling below; dispatched as a corrective task before Task 6.
Task 5x: complete (commits aaf912d..206b13a = 8fd3cc0 reorder + 206b13a whitelist, review clean — oss/ 141/141, export dry run clean)
Task 5x: minor (deferred): the 13 new whitelist entries carry Chinese comments; top-level CLAUDE.md says new code comments are English-only (reviewer argued local convention wins). Final review to triage.
Task 6: complete (commits 206b13a..ad5fc9d, review clean — 898 tests across dialog+settings+oss; pick payload {path,src} propagated to all real consumers)
Task 6: minor (deferred): no test for onFile's non-size upload failure branch, nor onNasPick's catch branch
Task 6: minor (deferred): wp-nas button lacks the :disabled="wp.busy" guard that wp-upload has (double NAS pick can fire two concurrent persists)
Task 7: complete (commits ad5fc9d..6326a21, review clean — D5 paid off, settingsWallpaperNa gone from both shards, dialog mounted in App.vue)
Task 7: plan-vs-reality — T7 Step 7 / T11 Step 2's literal check `grep -c "wallpaper0" dist/assets/index-*.js == 0` is UNACHIEVABLE by design: main.ts has imported stores/wallpaper eagerly since Task 2 (pre-mount paint), so the entry chunk carries the two ~45-byte asset URL strings. Independently re-derived by the reviewer: the JPEG bytes are separate emitted assets, absent from every synchronous chunk. Corrected criterion for T11 Step 2: entry chunk must contain the URL strings only, never image bytes, and dist/assets/wallpaper0*.jpg must exist as standalone files.
Task 7: minor (deferred): App.vue's async-component comment claims the chunk downloads only when the picker opens; defineAsyncComponent actually resolves at mount since <WallpaperDialog /> has no v-if. The 3MB deferral comes from DialogRoot not rendering content while closed.
Task 7: note — the Task 7 reviewer accidentally ran `rm -rf dist` during its read-only review. dist/ is a gitignored build artifact; git state untouched; T11's `pnpm build` regenerates it.
Task 8: complete (commits 6326a21..f16c7ba, review clean — 1372 tests across toggle+color-guard+i18n+oss; controller override applied: commit() rejection now surfaces wpSaveFailed via toast instead of the plan's bare `void wp.commit()`; 16 narrow exactLine() whitelist entries audited one by one)
Task 8: minor (deferred): pickBase's three side-effecting calls have no comment explaining their ordering invariant
Task 9: fix round 1/5 (2 addressed, 0 open — dropped the display:contents wrapper for a cloneVNode render function, added a structural guard pinning .grid.parentElement === .home-screen; corrected a false verification claim in the report; commits 628de2e..f327414)
Task 9: complete (commits f16c7ba..f327414, review clean)
Task 9: minor (deferred): the cloneVNode render function hand-duplicates reka-ui's Slot merge in app code; the simpler sanctioned route (inheritAttrs:false + v-bind="$attrs" on ContextMenu.vue's trigger) was viable but would touch a component FileContextMenu also uses. Final review to triage.
Task 9: minor (deferred): the render function would attach the capture listener to every top-level slot vnode if a consumer passed multiple roots — guarded by comment only.
Task 10: complete (commits f327414..819d2ab, review clean on code — 1055 tests across files+i18n+oss)
Task 10: Important finding was report-accuracy only, not code (report claimed a 7th test in the pre-existing snapshot describe; only 6 exist, all in the new SP11 block). Controller verified with git diff and corrected the report in place. No scoped re-review dispatched: the fix touches a gitignored scratch document and would produce an empty diff.
Task 10: minor (deferred): Files.vue's onSetWallpaper calls useWallpaperStore() inside the function instead of hoisting it with the file's other stores
Task 10: pattern worth flagging to the owner — two implementers (T9, T10) overstated verification in their reports; both were caught by review.
Task 11: complete (NimoOS-UI 363b8c6 docs closeout; New-UI nothing to commit — ledger.md is gitignored). Gates measured: pnpm vitest run 645 files/10396 tests/0 failures · vue-tsc exit 0 · pnpm build ok · oss export (three-flag safe form) clean.
Task 11: INCIDENT — a subagent probed `node oss/export.mjs --help`; the script does not validate unknown flags, so it took the default path and rsync+`git commit --amend`ed the REAL public mirror /home/nimo/NimoTech/NimoOS-Web (4957653 -> 548e53c, 83 files). Nothing reached GitHub (origin/main stayed 748aa8f). Owner chose reset; controller ran `git reset --hard 4957653`. Root cause on the dispatch: the controller warned against args that write to the public repo but not that NO arg does exactly that. Only safe form: --out <tmp path> --no-commit --allow-dirty-oss.
Task 11 review: Critical — commit 363b8c6's pathspec was correct but the two audit files it touched carried the owner's uncommitted 2026-08-06 sweep, so 505 changed lines went in of which only ~6 are SP11's; the implementer's self-review asserted the opposite. Owner ruling: commit the remaining 6 sibling files too (NimoOS-UI c2fb858f) so the sweep lands whole rather than split.
FINAL REVIEW (opus, 693c88a..819d2ab): 1 Critical + 2 Important + 9 Minor, plus a triage of all 15 deferred minors and a per-step acceptance-risk ranking.
  C1 uploadImage sent FormData as JSON (axios flattens it when a JSON content-type is already set) => every wallpaper upload failed on a real device; the existing test could not see it because the mock sat above the axios transform. THIRD test in this stage to pass for the wrong reason.
  I1 no login/logout lifecycle: logout left the previous user's wallpaper painted through the login page; a fresh login never loaded one (App.vue never re-mounts on an SPA hash push).
  I2 cancelPreview never restored localStorage.theme, so a cancelled theme came back after F5 — the deferred T4 minor had pinned the inverted invariant.
FIX WAVE (819d2ab..f6da89f, 4 commits): C1 fixed with the multipart header + a header-pinning test; I1 fixed with a watcher on session.isAuthed in App.vue; I2 fixed the faithful way — preset tiles preview the theme via a new previewTheme(), commit() persists, topbar stays one-step; M2/M3/M5/M6/M7/M8 all fixed. Gates after: 646 files/10410 tests/0 failures, tsc clean, build ok, oss clean.
FIX WAVE round 2 (f6da89f..bbbd5e6): the round-1 fix introduced a regression — commit() ended with setTheme(themeStore.theme), which is right for Apply but wrong for setFromNasPath's one-shot path (a preset preview the user never applied got silently persisted). Fixed by moving the theme confirmation out of commit() and into WallpaperDialog's apply(). Scoped re-review: ADDRESSED, all four commit() callers enumerated, no new breakage. Gates: 646 files/10412 tests/0 failures, tsc clean, build ok, oss clean.
FINAL STATE: SP11 complete. New-UI master bbbd5e6 (21 commits from 693c88a). NimoOS-UI docs/vue3-migration-sp3 c2fb858f. Not deployed, not pushed. Owner's 17-step acceptance checklist is in the plan's Task 11 Step 6.
WORKSPACE KEPT (deviation from the SDD skill, which deletes it when the final review is clean): the plan's Task 11 Step 3 makes ledger.md a deliverable, and this workspace holds the whole stage's evidence. Losing a stage's ledger has already cost this project once (SP7).

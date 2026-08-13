# SDD ledger — plan: docs/superpowers/plans/2026-08-13-folder-size-on-demand.md

Worktree: .claude/worktrees/folder-size-on-demand, branch feat/folder-size-on-demand, base 22f82d96.
Baseline: pnpm test green (721 files / 11740 tests). Note: first baseline run flaked with
"Errors 1 error" (jsdom "Not implemented: navigation" unhandled noise); rerun clean —
if a suite run reports 1 error with all tests passing, rerun before blaming the diff.

Task 1: minor (deferred): pre-existing Chinese test name in folder.test.ts (~line 66) left untranslated; workspace rule says translate legacy Chinese when already editing the file — final review to triage.
Task 1: complete (commits 22f82d96..4023027c, review clean)
Task 2: complete (commits 4023027c..d6602373, review clean)
Task 3: complete (commits d6602373..81808774, review clean)
Task 4: complete (commits 81808774..a5dbe4f0, review clean; sanctioned deviation: i18n keys live in zh_cn.base.ts/en_us.base.ts shards, not the barrel files the plan named — reviewer confirmed correct per repo shard structure)
Note: pre-existing flake — photosSlice.test.ts whole-repo grep test can time out under full-suite load; passes in isolation.
Task 5: complete (verification-only, run by controller: vue-tsc clean, full suite 722 files / 11752 tests green, color-literal audit CLEAN). Environment incident: Edit tool broke the pnpm hardlink on packages/service/src/folder.ts (documented repo trap) — vue-tsc saw the stale node_modules copy and reported bytes:unknown; fixed with pnpm install (inodes re-matched), NOT a code change. Deploy reminder: on the device this means packages/service edits need the documented restart/hard-refresh flow.

Final review (fable): 1 Important (unabortable 5-min requests can starve the 6-connection HTTP/1.1 pool) + 2 Minor (loading-state focus loss; `?? 0` masking invariant — ruled leave-as-is). Deferred-minor triage: Chinese test name in folder.test.ts ruled leave-as-is (matches file-local convention, English rule binds new code).
Final fix wave: commits 523849b0 (AbortController per epoch + reset aborts + concurrency cap 3 with FIFO queue) and 4c5757bd (loading renders same button disabled — keyboard focus preserved). Scoped re-review: both findings ADDRESSED, no new breakage.
Final gate on 4c5757bd: vue-tsc clean, full suite 722 files / 11756 tests green.
Branch feat/folder-size-on-demand ready: 22f82d96..4c5757bd (6 commits). Real-device acceptance pending (deploy is the user's call).

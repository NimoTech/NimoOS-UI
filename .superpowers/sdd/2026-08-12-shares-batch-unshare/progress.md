# SDD ledger — plan: docs/superpowers/plans/2026-08-12-shares-batch-unshare.md

BASE at start: e58d70720dc0c0a9f8862bbe87a2cec804d9eae7 (master, main worktree — per plan Global Constraints and repo convention for small batches)
Task 1: complete (commits e58d7072..fc80c937, review clean)
Task 1: minor (deferred): empty-ids test doesn't assert "no toast" half of its name (brief-mandated verbatim test)
Task 1: minor (deferred): failedIds order-preservation only covered with a single failing id
Task 2: complete (commits fc80c937..59b43d84, review clean)
Task 2: minor (deferred): aria-label is bare row name, could be "Select <name>" (brief-mandated markup)
Task 2: ⚠️ resolved by controller: click.stop guard untestable — no row-level click handler exists on shares rows (Task 3 adds none); defensive only, not a gap
Task 3: fix round 1 (pre-review, plan defect): deleteShare mock signature untyped -> vue-tsc TS2345 in two test files; fixed 44fd9b83 (also touched Task 1's shares.test.ts, authorized)
Task 3: fix round 2/5 (1 addressed, 0 open — mid-flight selection clobber -> union merge + regression test; commit 0f91ab19)
Task 3: complete (commits 59b43d84..0f91ab19, review clean after 2 fix rounds)
Task 3: minor (deferred): union re-selects a failed id the user deliberately unchecked mid-flight (inherent to mandated design, same as old behavior)
Task 3: ⚠️ resolved by controller: reka portal unmount-when-closed relied on by dialogConfirmButton() — verified empirically by passing tests
Task 4: complete (gates all green, zero fix commits; pre-existing flake documented: intermittent exit-1 unhandled-rejection race in favorites.test.ts/AgentComposer.test.ts under full-suite load)
Final review (opus, whole branch e58d7072..0f91ab19): NOT mergeable as-is.
  - Critical: concurrent DELETE fan-out races backend's unlocked smb.conf rewrite (NimoOS/service/shares.go UpdateConfigFile, O_TRUNC + systemctl restart, no mutex) -> serialize client-side. Overrides plan's allSettled mandate; controller ruling: safety evidence beats plan text, user-visible behavior unchanged. Backend mutex fix = separate NimoOS core ticket (out of scope).
  - Important: union merge re-adds failedIds whose rows are gone (server-success/client-error) -> phantom selection over empty list; intersect with live ids.
  - Fix-now minors: checkbox :focus-visible invisible; en pluralization folder(s); T1 empty-ids test missing no-toast assertion.
  - Deferred (follow-up tickets, NOT in this branch): shares store load() lacks epoch guard (pre-existing, window widened by batch); toolbar DOM order = repo idiom (a11y pass someday); aria-label bare name; union re-selects deliberately-unchecked failed id (inherent to design).
Final fix wave dispatched to task-3 implementer (one dispatch, 5 findings + full gates rerun).
Final fix wave: complete (commit f10b5c83; scoped re-review: 5/5 ADDRESSED, no new breakage; full gates rerun green: 721 files/11732 tests, vue-tsc 0, oss 151, build ok)
Branch range: e58d7072..f10b5c83 (6 commits incl. plan doc). Ready for on-device acceptance.

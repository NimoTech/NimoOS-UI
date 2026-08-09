# SDD ledger — plan: docs/superpowers/plans/2026-08-08-sp12-plan-a-upload-batch-swap.md

Repo: /home/nimo/NimoTech/NimoOS-New-UI (master, main worktree — user explicitly authorised no worktree)
Branch start (MERGE_BASE for final review): 095ea3e

Pre-flight rulings (controller):
- Plan code blocks carry Chinese comments; workspace CLAUDE.md makes English-only code
  comments a hard requirement that overrides plan text. Ruling: implementers write the
  same comments in English, preserving meaning. Commit messages already English in plan.
- Task 7 Step 4 writes `class="ui-btn ubm-refill"`, but Task 6 states there is no global
  `.ui-btn` in this repo. Ruling: use `ubm-btn ubm-refill`.
- Working tree carries unrelated dirty files (oss/*, 3 staged design-export deletions).
  Every commit must use an explicit pathspec; never `git commit -a`.

Baseline (controller-verified at 7352c8e): `pnpm test` = 648 files / 10424 tests, all pass.
(The Task 1 reviewer's "3 failing oss test files" remark was wrong — oss/ is 7 files/146 tests green.)

Task 1: complete (commits 095ea3e..7352c8e, review clean — 1 minor, deferred)
Task 1: minor (deferred): packages/service/*.test.ts is excluded from both tsconfigs repo-wide,
  so `out.batch.done` in uploadBatches.test.ts:33 escapes strict-null checking. Pre-existing
  convention, brief-mandated code, no runtime defect.

Task 2: review at 76e8481 → Needs fixes. 2 Important, 1 Minor.
Task 2: minor (deferred): stale IDB-era comments at src/files/upload/serverSync.ts:5 and the
  syncServerTasks() comment in uploads.ts. serverSync.ts is deleted by Task 3 anyway.
Task 2: controller ruling on the "plan-mandated" finding — the plan's initUploads comment and
  the pre-existing race-ordering note are not in conflict; the plan simply did not know the old
  comment existed. Merge both rather than escalating. Not a plan contradiction.
Task 2: fix round 1/5 (2 addressed, 0 open; commits 76e8481..f698518)
Task 2: complete (commits 7352c8e..f698518, review clean)
Task 3: controller-verified at 5579dc6 — full `pnpm test` = 641 files / 10382 tests, ALL PASS.
  The DesktopContextMenu wallpaper-picker failure the implementer reported is a pre-existing
  SP11 isolation flake: it fails only when that file is run standalone (second mount's reka-ui
  portal never appears after the afterEach body wipe); in the full suite it passes. Not SP12's.
Task 3: complete (commits f698518..5579dc6, review clean — 2 minors)
Task 3: minor (deferred): scheduler.ts's `resumed: true` branch is now unreachable in production
  (addFilesToQueue is the only queue-row producer and always mints fq_ ids); its two
  scheduler.test.ts regression tests pin a state the real app can no longer enter. Also a
  vestigial `.catch(() => {})` on initUploads() in uploads.test.ts. Final review should triage.
Task 4: review at af7ba85 → 1 Important (ordering invariant unenforced by any test), 3 Minors.
Task 4: minor (deferred): translated comments dropped two concrete details from the brief
  (the "Vue2 fileUpload.js:193 same policy" citation; the literal 120s idle-sweep figure).
Task 4: minor (deferred): activeBatchIds' 'pending' branch omits hasActiveUploads' `&& item.file`
  guard — dead path today, but the two guards on the same event flow now disagree.
Task 4: minor (deferred): no test asserts installUnloadGuard's cleanup removes the pagehide listener.
Task 4: fix round 1/5 (1 addressed, 0 open; commits af7ba85..8dc62c4)
Task 4: complete (commits 5579dc6..8dc62c4, review clean — 3 minors deferred above)
Task 5: complete (commits 8dc62c4..e0b33dd, review clean — 3 minors)
Task 5: minor (deferred): FileTile's .tile-star and .upload-broken-badge share top:6px right:6px —
  a directory entry that is both favourited and broken would stack them. Fixtures use is_dir:false.
Task 5: minor (deferred): FileRow's badge is an inline flex chip, not the brief's absolute corner
  overlay (flex row has no anchor). Layout-safe per review, but the two views' affordance differs —
  worth an eye during real-machine acceptance step 6 (grid + list both).
Task 5: minor (deferred): uploadBadge tests never exercise `extensions: undefined` (only null).
Task 6: review at fa51d75 → 1 Important (stale z-index rationale in a plan-mandated comment), 2 Minors.
Task 6: minor (deferred): a null batch from a *successful* getBatch and a *rejected* getBatch render
  the same generic load-error message (conflation inherited from Task 1's getBatch contract).
Task 6: minor (deferred): NO end-to-end test clicks a badge and asserts the dialog opens through
  FileGridView/FileListView. The three-link forwarding chain is protected only by vue-tsc and static
  inspection — the single largest silent-failure surface in this plan. FINAL REVIEW SHOULD TRIAGE.
Task 6: controller note — the reviewer's Important finding also invalidates a stored project memory
  ("dialog errors must not use toast because toast is z-index 60 under a 1000 backdrop"). AppToast
  is z-index 10100 since 057019b, with a guard test. Update that memory after the plan lands.
Task 6: fix round 1/5 (1 addressed, 0 open; commits fa51d75..c82fd1d)
Task 6: complete (commits e0b33dd..c82fd1d, review clean — 2 minors deferred above)
Task 7: review at 57a4d5e → 1 Important (stale refillPending corrupts the next unrelated upload
  when the user cancels the folder picker), 1 Minor (path-only matching, brief-level design limit).
Task 7: fix round 1/5 (1 addressed [both leaks], 0 open; commits 57a4d5e..6468a54)
Task 7: complete (commits c82fd1d..6468a54, review clean)
Task 7: minor (deferred): path-only matching with no size/hash check can accept an unrelated file
  sharing name+folder structure with a missing entry. Accepted brief-level design limit.
Task 7: minor (deferred): the "every non-refill entry point clears refillPending" convention has no
  compiler/lint enforcement — a future upload entry point could silently reintroduce the leak.

ALL 7 TASKS COMPLETE. Running the plan's closing gate next, then the final whole-branch review
(MERGE_BASE 095ea3e).

FINAL WHOLE-BRANCH REVIEW at 6468a54 (opus) → "Ready to merge: with fixes".
Merge gate = Important 1 (badge glyph invisible in both themes — plan-inherited token clash) and
Important 4 (no test across the badge→dialog forwarding chain). Plus deferred item 2 (stale comments
that now state false behaviour) and Important 6 (false Vue2 provenance citations) and Important 5
(the plan's acceptance step 2 cannot pass as written).
Routed to follow-up TICKETS, not this branch (reviewer's own ruling):
  - Important 2: installUnloadGuard lives in Files.vue's onMounted/onUnmounted, but the upload queue
    is app-lifetime ⇒ navigate away from /files, close the tab → no interrupt signal, no leave prompt.
    Fix is to install at app scope (App.vue/main.ts).
  - Important 3: retryItem/retryBatch never clear item.tusUploadUrl, so once staging is swept (which
    SP12 makes routine: interrupt clears it at once, sweeper at 120s+600s) every Retry re-HEADs a dead
    URL → permanent "network error" loop, escapable only by Cancel + re-pick. Repro: pause a batch,
    wait >12 min, press Resume.
  - Backend ticket already in the plan's 记账 (last_progress_at only refreshes per completed file) is
    higher priority than "nice to have": 20 GB TUS uploads + a 720s kill on a stalled single file.
  - scheduler.ts's dead `resumed` flag: reviewer prefers collapsing to `false` with one contract test.
    Deferring the collapse; only its misleading comment gets fixed now.

Final fix wave: commits 6468a54..d9ff7c2 (5 commits). Scoped re-review → all 6 findings ADDRESSED,
no new breakage, nothing from the not-in-scope list touched. Two corrections it produced:
  - The final reviewer's "false Vue2 provenance citations" was itself wrong. NimoOS-UI's local
    checkout sits on docs/vue3-migration-sp3, which predates origin/main — the precedents DO exist
    there. IconContainerMixin.js:71 is byte-for-byte the same boolean/string leniency (citation kept);
    PR #91 is real but was a different mechanism (grid-card CSS set pointer-events:none on inner
    spans, swallowing the click), so that comment was corrected rather than deleted.
    ⇒ Lesson: grep a sibling repo against origin/<branch>, not its working tree.
  - Badge contrast after the fix: dark 1.17 → 6.13:1, light 1.36 → 4.29:1 (--drop-bad fill +
    --remove-fg glyph + --remove-fg ring, the AppSettingsPage .set-conflict precedent). Hover is now
    additive (box-shadow ring) instead of replacing the fill with a fainter one.

CLOSING GATE re-run by the controller at d9ff7c2 — all green:
  vue-tsc clean · pnpm test 645 files / 10413 tests · parity 9/9 · pnpm build ok ·
  oss export zero real leaks (3 expected binary skips).
NOT DEPLOYED, NOT PUSHED. Real-machine acceptance (8 steps, plan §真机验收) still owed.

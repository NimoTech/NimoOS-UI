# SDD ledger — plan: docs/superpowers/plans/2026-08-09-sp15-p2a-smartview-manual-assets.md

Branch: sp15-photos-moments (continues from P1; base = P1 close-out 6d919ea)
Process: OWNER-CHOSEN LIGHT VARIANT — 4 merged tasks, NO per-task review,
  one whole-branch final review at the end. Do not add per-task review rounds.

Pre-flight facts (controller, verified before Task 1):
- Backend endpoints all exist; body key is `assetIds`; empty array => 400.
- Write endpoints return change counts only, never view stats => the #82 refetch
  is required, not redundant.
- `pinned` is json:"pinned,omitempty" => absent means false.
- 1:1 target is 899af59b, same as P1 (#79/#82 predate #111).
- master is 161 commits ahead but touched 54 files, none in the photos area =>
  no need to merge master first.
- i18n: photosSelectedCount interpolates {count} (NOT {n}); Select reuses
  photosPersonSelect; submitLabel must be a function.
- Device: 9 smart views, all semantic + paused + never evaluated;
  smart_view_matches = 0 => the excluded band is unreachable without first
  creating a date-conditioned live view. Recorded in the plan's Task 4.

Task 1: complete (e702f2c) — service 5, store +11 (existing 52 unchanged), vue-tsc clean.
  Implementer caught a contradiction in the plan: the test harness's default parameter
  means harness(undefined) replies {}, so `body() ?? []` could never fall through;
  replaced with an Array.isArray guard, which is strictly more robust.
Task 2: complete (f8000b6) — rename only, 15/33/20 case counts unchanged.
  TWO plan errors corrected by the implementer: PhotosMomentDetail.vue was ALREADY a
  third consumer (P1-T9 wired it), and oss/manifest.mjs strips src/photos wholesale so
  no manifest edit was needed there. The design doc's "2 consumers" claim was wrong.
Task 3: complete (bdd9fb0 + ba3c0ec + 9feac00) — new file 16, existing page test 71
  unchanged, parity 9; styles 1075; oss 465 green after TWO manifest fixes (the export
  guard aborts on a dirty tree, so a newly added test only becomes visible to the leak
  guard after it is committed — the second fix could not have been predicted).
  Plan error corrected: the brief's seed() wrote assets straight into the store, but
  loadDetail/loadExcluded blank their targets on mount; driving the service mocks is
  the only way that works.

P1 DEFECT FOUND INCIDENTALLY BY TASK 3 — controller verified:
  PhotosMomentDetail.vue:700,730 set :data-selected with NO matching CSS rule anywhere
  that can reach them. Every data-selected rule in the repo lives in another component's
  SCOPED styles (PhotosGrid / PersonAssetGrid / PhotosLibraryPicker), and P1's moment
  page renders its own .tile elements. So selection mode there has no visual feedback at
  all — user-visible, and four P1 reviews plus the whole-branch review missed it.
  Folded into Task 4 as a named fix.

Task 4: complete (d32dedf fix + 64e8486 oss + c908ab2 docs) — carried-in defect fixed
  (PhotosMomentDetail.vue gets its own [data-selected] rule, restated from
  PhotosSmartViewDetail.vue's; new test reads the SFC via node:fs and reverts-to-confirm
  the fix, per the task brief's instruction not to trust a `?raw` stylesheet import).
  Six gates run clean on a committed tree: vue-tsc 0 · test 682/10849 · parity 9/9 ·
  oss DELETE 78/REPLACE 4/PATCH 258 zero leaks · build 37.73s · styles 1075/1075.
  First run of test+oss was red (18 leak hits + a product-tree vue-tsc failure) because
  the new test file — placed under views/__tests__/ but this area's test table is
  enumerated regardless — was not yet registered in oss/manifest.mjs; same recurring
  omission Task 3's report already names, fourth occurrence. Fixed and reconfirmed clean.
  Acceptance doc written with the design's §2.1/§2.2 date-conditioned-smart-view opening
  verbatim, plus a step naming the carried-in fix. P2a is code-complete; unpushed,
  undeployed, not merged to master, zero real-device acceptance run.

Task 4: complete (d32dedf + 64e8486 + c908ab2) — carried-in P1 fix + gates + acceptance list.

FINAL WHOLE-BRANCH REVIEW (opus, the phase's ONLY review by owner's choice):
  1 Important + 6 Minor + 5 "tests that pass regardless" + 1 structural fix.
  The Important one landed on this branch's own stated invariant: the route-change
  selection reset was asserted only via the select bar's visibility, and the bar's
  v-if is `selecting && selectedIds.length` — so clearing `selecting` alone hid it and
  deleting `selectedIds.value = []` left the whole suite green, while the real failure
  sends view A's asset ids to view B's remove endpoint.
  Also caught two 1:1 breaks the plan itself introduced: `photosSvAddPhotos` was
  self-translated (`加照片` vs Vue 2's `添加照片`), and the picker's submit label used
  the album pages' counting label where Vue 2 passes a static "Add selected".
  Fix wave (3cdfcb0) addressed all of it; scoped re-review confirmed, no new breakage.
  Structural fix landed: oss/photosStripCoverage.test.mjs now fails fast when a
  /photo/i file under the three enumerated directories is missing from the strip
  manifest — the omission that had gone red four times across P1 and P2a.

PARKED (controller ruling, not fixed): the fix wave wrote ONE new template comment in
  Chinese in PhotosSmartViewDetail.vue (~:1168-1173), matching that file's own
  surrounding convention but violating the owner's English-comment ruling. Real but
  cosmetic and not load-bearing; dispatching another agent for a single comment is
  disproportionate at this point. Recorded here so it is not silently discarded —
  fold it into whichever task next edits that file.

CONTROLLER GATES RERUN after the fix wave, clean tree: vue-tsc clean · pnpm test
  683 files / 10862 passed · parity+styles 1084 · oss export zero real leaks ·
  pnpm build 17.87s.

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

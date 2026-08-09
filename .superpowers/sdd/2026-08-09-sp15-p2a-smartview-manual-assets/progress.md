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

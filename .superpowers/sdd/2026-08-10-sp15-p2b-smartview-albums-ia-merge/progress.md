# SDD ledger — plan: docs/superpowers/plans/2026-08-10-sp15-p2b-smartview-albums-ia-merge.md

Branch: sp15-photos-moments (continues from P1 + P2a; base = P2a close-out baec949)
Plan commit: ff72714 · Spec commit: d5b139e
Branch merge-base with master: 9100418

Process: OWNER-CHOSEN HYBRID (2026-08-10) — T1-T4 each get a per-task review
  (they are the foundation every later task builds on); T5-T8 go straight into the
  closing whole-branch review; T9 is the close-out. Do NOT add per-task review
  rounds to T5-T8, and do NOT skip them for T1-T4.

Pre-flight facts (controller, verified before Task 1):
- 1:1 target is 939a7d3a, NOT the 899af59b that P1/P2a used. 899af59b is #112's
  parent, so reading sources there yields the pre-merge versions. Proven:
  PhotosSmartAlbumCreate.vue does not exist at 899af59b, is 372 lines at 939a7d3a.
- Both conversion endpoints already exist with Go HTTP tests
  (route/v1/smartviews.go FromAlbum, route/v1/albums.go FromSmartView); both return
  the full new object; album-name collision is 409.
- Backend SmartView has carried createdAt from the start (service/smartview.go:23);
  only the front-end type was missing it. Vue2 #113's "waiting on the backend"
  comment is stale.
- Album DTO carries photoCount/videoCount (NOT omitempty) plus dateStart/dateEnd/
  createdAt, so all four stats cells have real data.
- Roughly half of #112/#113 has no counterpart here (routed details vs in-page
  panels). Enumerated per row in the spec's §2 table.
- New-UI's .album-hero-actions .bar-btn already equals Vue2's target
  .sv-action-btn values line for line => the action-row reskin is a visual no-op
  and is explicitly out of scope (spec §3①).
- createSmartView already unshifts into the store, so the Vue2 optimistic slots
  (localSmartViews/localAlbums) have no problem to solve here.
- Device data: albums 5 / album_assets 40 / smart_views 9 (all semantic, paused,
  never evaluated) / moments 0. The For You page being blank is expected.

Carried-in debt from P2a (fold into whichever task edits the file):
- PhotosSmartViewDetail.vue has ONE Chinese template comment from P2a's fix wave
  (~:1168-1173 at that time; line numbers drift). Assigned to Task 8, which edits
  that file. Locate by grep, not by line number.

Pre-flight conflict scan -> owner rulings (2026-08-10), binding for the whole phase:
- CSS rule blocks restated across components (T6 copies ~7 groups from
  PhotosMomentDetail.vue / PhotosSmartViewDetail.vue): KEEP THE DUPLICATION.
  Scoped styles cannot cross SFCs, and the repo already did exactly this once --
  PhotosMomentDetail.vue:1059 says "rule bodies identical to SmartViewSidePanel.vue's,
  which ported the same source" and passed a whole-branch review. Third copy gets the
  same registered comment. Extracting a shared stylesheet or shared components was
  rejected: both would rework two already-closed files (SP7 and P1 output), and
  scoped->global changes selector precedence.
- The two deliberate 1:1 deviations: BOTH STAND.
  (a) The album detail action row is NOT renamed to .sv-action-btn -- New-UI's
      .album-hero-actions .bar-btn already equals Vue2's target values line for line,
      so the rename is a visually empty diff.
  (b) The smart-view detail back button switches from photosSvAllSmartViews to the
      existing photosAlbumBack -- Vue2's target still labels it "All Smart Views" while
      #112 made it return to the album list, i.e. Vue 2 shipped a lying label.
  Both carry an in-code deviation note with Vue 2 line numbers.
  If a reviewer flags either, it is plan-mandated + owner-ruled: park with this entry
  as the ruling. Do NOT pre-judge it in the reviewer prompt.

Task 1: complete (commits ff72714..85efc7d, review clean) — service 2 methods,
  SmartView.createdAt, 2 store actions, AlbumView +videoCount/+dateStart.
  Post-commit gates: pnpm test 684 files / 10873 passing, vue-tsc clean.
  Reviewer's one warn item RESOLVED by controller: full commit body verified
  present and English, matching plan Step 13 verbatim.
  Brief corrections the implementer found (5 fixture files outside the brief's
  file list needed a one-line `createdAt: ''` / videoCount / dateStart addition to
  keep vue-tsc green after widening the two interfaces): SearchSaveSmartView.test.ts,
  SmartViewCard.test.ts, SmartViewCreateDialog.test.ts, SmartViewSidePanel.test.ts,
  PhotosSmartViewDetail.assets.test.ts. Reviewer confirmed no assertion was weakened.
Task 1: minor (deferred): failure-path tests use `.rejects.toBeTruthy()` where a
  sibling in the same file uses the stronger `.rejects.toThrow('409')`
  (albums.test.ts:308-313, smartViews.test.ts:429-434). Plan-mandated wording from
  brief Step 9, not the implementer's judgment. Final review should triage.
Task 1: minor RESOLVED by controller, no change needed: the two mirror actions use
  different prepend styles (smartViews `unshift`, albums `[album, ...]`), but each
  matches ITS OWN file's established idiom — albums.ts replaces the ref immutably
  throughout (:54, :72, :212), smartViews.ts mutates in place throughout
  (:224, :253, :288, :321, :344). Consistency is with the file, which is correct.

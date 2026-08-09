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

CONTROLLER FACT, verified 2026-08-10 (kills a recurring false alarm): the
  `oss/*.test.mjs` suite asserts a CLEAN working tree. Both T1's and T2's
  implementers reported it "failing at baseline"; measured on a stashed clean tree
  it is 21 files / 472 tests ALL PASSING. The failures are entirely an artifact of
  the untracked task-N-report.md file. => Any implementer report claiming a
  pre-existing oss failure is explaining a dirty tree, not a real red. At T9 the
  ledger and reports must be committed BEFORE running the gates.

Task 2 review: spec OK, 1 Important + 2 Minor.
  The Important is rooted in a PLAN CONTRADICTION of mine, recorded so the same
  mistake is not repeated: plan Step 6 told T2 to delete the shared `sortAlbums`
  AND to leave PhotosAlbums.vue rendering through its old `views` computed. Those
  two cannot both hold, so the implementer kept the tree compiling by pasting a
  byte-for-byte private copy of the deleted function into the view -- including its
  OLD "missing timestamp sorts last" semantics, i.e. the exact behaviour this task
  existed to invert, live on the only surface a user can reach, with nothing that
  would fail if T3 forgot to remove it.
  Fix dispatched: drop the copy and have the interim `views` computed delegate to
  buildMixedAlbums/sortMixed with an empty smart list, so there is one comparator
  and the live page gets the corrected ordering now. Bundled Minor 1 (no fixture
  exercises msOf's unparseable-but-non-empty branch) into the same round since the
  round was already required.
Task 2: minor (deferred): the interim `views` path has no coverage for the
  date/name-r/count branches. Throwaway code T3 replaces; final review may triage.
Task 2: fix round 1/5 (2 addressed, 0 open — stale duplicate comparator removed and
  a live-path regression test added; msOf isNaN fixture added; commits e85dec4..95efa6f)
Task 2: complete (commits 85efc7d..95efa6f, review clean)
  Implementer found TWO arithmetic errors in the plan's own expected orderings
  (`name`/`name-r` and `date` had s2/u2 transposed) and hand-verified the corrections;
  the re-reviewer independently recomputed both and confirmed. Plan was wrong, code is
  right. Implementer also caught a near-miss in its own new fixture where garbage and
  valid values sat on the sides that made pre-sort and expected order coincide, masking
  the mutation — found via the mandated mutation check, then fixed.
INTENTIONAL BEHAVIOUR CHANGE on the live page, recorded so it is not read as a
  regression later: the `date` sort now ranks by `dateStart` (earliest member's
  taken_at) instead of the deleted sortAlbums' `dateEnd`. sortAlbums' use of dateEnd
  was itself a registered New-UI deviation; Vue2's target dateTakenMs reads dateStart,
  so the new path is the 1:1-correct one. No existing test exercised the `date` id,
  so nothing regressed silently.

Task 3: complete (implementer self-report; per-task review still pending per the ledger's
  T1-T4 process). PhotosAlbums.vue's `views` computed replaced with the real `mixedItems`
  (buildMixedAlbums/sortMixed over albums + smartViews.smartViews, no more empty smart
  list); isEmpty now checks mixedItems.length; added aiSmartViewOff computed + the AI-off
  banner (markup/tokens copied verbatim from PhotosSmartViews.vue's .svs-banner*, renamed
  .albums-ai-banner*, PhotosSmartViews.vue's own copy left in place for Task 5 to remove);
  added openSmartCard; onMounted fires fetchSmartViews/fetchAiFeatures fire-and-forget
  alongside fetchAlbums. 1 i18n key added (photosAlbumsNoneYetHint, both locales).
  SmartViewCard.vue had zero `data-test` attributes (grep-verified, contra the brief's
  assumption) -- added `data-test="sv-card"` to its root, registered in-file and in the
  task report.
  6 new tests added (TDD: RED confirmed before implementation, GREEN after); full repo
  suite 685 files / 10883 tests, 3 oss/*.test.mjs failures explained entirely by the dirty
  working tree per the CONTROLLER FACT above (re-verify after commit); vue-tsc clean.
  Mutation checks: forcing aiSmartViewOff to always-true caught by the banner test (red);
  dropping the kind prefix from the grid `:key` was NOT caught by any test in the suite --
  no fixture makes a manual album id and a smart id collide, so a duplicate-key regression
  would currently ship silently. Reverted the mutation, added a registered inline comment
  at the v-for explaining why the prefix is load-bearing, did not add a new speculative
  collision fixture (not asked for by the brief; flagging for the reviewer to triage).

Task 3 review: spec mostly OK, 3 Important + 2 Minor.
  PLAN DEFECT of mine, second one this phase: the Step 5 subtitle snippet
  `mixedItems.length ? photosAlbumsMineHint : photosAlbumsNoneYetHint` collides with
  New-UI's own `.empty-state` panel (photosAlbumsEmptyTitle = "还没有相册"), which
  renders ABOVE an unconditionally-rendered grid => on an empty library the phrase
  "还没有相册" appears TWICE at once, and before the fetches resolve it flashes even
  for a non-empty library. Controller verified against the target: Vue2 939a7d3a
  PhotosAlbumsView.vue:87-95 has NO separate empty panel — the section subtitle IS
  the empty state, with the create tile beside it. New-UI's panel plus its two keys
  are used in exactly one place. => Ruling: delete the isEmpty branch and its two
  now-dead keys; the subtitle is the empty state, which is also the 1:1 shape.
  Two more Important: two brand-new comments written in Chinese (SmartViewCard.vue
  and PhotosAlbums.vue's grid-width note) violate the English-comments rule.

Task 3 fix round 1: complete. Translated the two offending new comments (SmartViewCard.vue
  data-test registration; PhotosAlbums.vue's grid-width note, leaving the pre-existing
  Chinese lines in that block untouched). Removed the redundant `.empty-state` isEmpty panel
  and the now-dead `isEmpty` computed; deleted photosAlbumsEmptyTitle/EmptyHint from both
  locales (grep-confirmed zero other consumers before deleting); the section subtitle now
  gates on `albums.albumsLoaded && mixedItems.length === 0` so it cannot flash the empty
  copy for a full library while the two fetches are in flight. Updated 4 existing tests that
  asserted on the deleted `[data-test="albums-empty"]` selector to assert on the subtitle
  text instead; rewrote the "list loaded, empty" test's title/body the same way. Added the
  brief's two new fixtures (pre-resolution flash guard; manual+smart sharing a raw id).
  Added the Minor 2 deviation pointer to the copied banner block.
  Mutation checks: removing the `albums.albumsLoaded &&` guard turned the new
  "does not flash" test red, as expected (reverted after confirming).
  HONEST FINDING on the Minor 1 fixture: re-ran the original mutation (drop the `item.kind +
  '-'` prefix from :key) against the new same-raw-id fixture -- it still does NOT go red,
  and probing further, no Vue "duplicate keys" warning fires either. Root cause: the two
  kinds render as different vnode types (a plain div vs the SmartViewCard component), and
  Vue's patch/dedup logic keys off (type, key) together, not key alone, so a manual/smart
  cross-kind id collision is not a case Vue's own diffing ever conflates regardless of the
  prefix -- the fixture documents the intent and gives future readers a concrete render-count
  assertion, but it does not close the detection gap the way "assert both cards render"
  implies it would. Flagging for the reviewer/controller to decide whether this needs a
  different test shape (e.g. forcing a reactive re-render/reorder) or whether the risk is
  accepted as documentation-only.
  Covering tests: `pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts
  src/i18n/parity.test.ts src/styles` -> 6 files / 1113 passed. `pnpm exec vue-tsc --noEmit`
  -> clean. Full suite not re-run per the coordinator's explicit instruction.
Task 3: fix round 1/5 (5 addressed, 0 open — two new Chinese comments translated;
  duplicate empty-state panel + dead isEmpty + 2 dead keys removed and the subtitle
  gated on albumsLoaded, mutation-confirmed; same-id fixture and banner deviation
  pointer added; commits 1040729..1a576c9)
Task 3: complete (commits 95efa6f..1a576c9, review clean)
  Honest negative result worth keeping: the grid's kind-prefix `:key` guard is NOT
  mutation-observable. Vue's isSameVNodeType compares (type, key) as a pair, so a
  plain <div> album card and a <SmartViewCard> are never confused whatever the key;
  and the re-reviewer traced further that the dev "Duplicate keys" warning lives only
  in patchKeyedChildren's middle-diff branch, which a 0->2 first render never reaches.
  => The prefix stays (it matches Vue2 and costs nothing) but no test can guard it.
  Recorded so nobody spends another round trying.
Task 3: minor -> FOLDED INTO TASK 4 (T4 edits the same file): the mandated flash guard
  `albums.albumsLoaded && mixedItems.length === 0` waits only on the ALBUMS fetch and
  ignores smartViews' own `listLoaded` (smartViews.ts:125). A library with zero manual
  albums but some smart views still flashes photosAlbumsNoneYetHint in the window
  between the two resolutions. My mandated resolution was incomplete, not the
  implementer's work.

CONTROLLER-VERIFIED i18n values for Task 4 (plan Step 1 discharged; BOTH of my
  guessed values in the plan's key table were WRONG):
    "Let Nimo draft it"                        -> 让 Nimo 起稿        (plan guessed 让 Nimo 起草)
    "Describe the theme, let AI fill it in"    -> 你描述主题，交给 AI 填充  (plan guessed 描述主题，让 AI 帮你填充)
    "Create Smart Album"                       -> 创建智能相册        (plan's guess was right)
  Source: git -C /home/nimo/NimoTech/NimoOS-UI show 939a7d3a:src/assets/lang/zh_CN.json:1987,1988,2090

Task 4: complete. Embedded SmartViewCreateDialog (props embedded/initialName, effectiveName
  computed, close()/onRootClick() branching on embedded, Escape listener guarded by
  !props.embedded, confirm() emits 'close' instead of update:open(false) when embedded, 4th
  submit-label swap) + host side (SourceId +'nimo', 4th sourceOptions entry, selectSource()
  reusing aiSmartViewOff directly per dispatch instruction, confirmCreate() short-circuit for
  nimo, albums-modal-wide class + embedded mount replacing the footer, onSmartAlbumCreated()
  just closes the panel) + folded-in flash-guard fix (both albums.albumsLoaded AND
  smartViews.listLoaded required) + 4 new i18n keys in both locale files.
  Naming deviation registered in-file: Vue2's actual class names are `sv-modal-embed-host` /
  `sv-modal.sv-modal-embedded` (confirmed by reading 939a7d3a source directly, not the plan's
  paraphrase); this file uses `sv-embed-host` for the wrapper (the dispatch's test fixtures
  hard-code that data-test name) and keeps `sv-modal-embedded` for the modifier -- cosmetic
  only, no structural difference, registered in the CSS comment.
  Also read the actual Vue2 source further than the dispatch quoted and found: Vue2's
  `closeCreate()` always emits 'close' for every dismissal (button/cancel/scrim) -- there is
  no update:open contract in the Vue2 component at all, because Vue2 never had a standalone
  mode for this component (that only exists in New-UI, which merged two separate Vue2 files
  into one). The dispatch's plan (keep update:open for standalone, add 'close' for embedded)
  is the correct 1:1-adapted shape given that difference, not a deviation from Vue2 -- noting
  this so nobody re-derives it and worries it's wrong.
  Mutation self-review caught a real test gap during the exercise, fixed before reporting:
  the brief's literal "leaves Escape to the host" test only asserted `update:open` was
  undefined, but close() already branches on `embedded` and would emit 'close' whether or
  not the listener actually fired -- checking update:open alone could not tell "listener
  never attached" apart from "listener fired, took the embedded branch". Strengthened to
  also assert `close` is undefined; confirmed red against the original (correct) test before
  the fix, green after.
  Covering tests: `pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts
  src/photos/components/__tests__/SmartViewCreateDialog.test.ts src/styles
  src/i18n/parity.test.ts` -> 7 files / 1172 passed. `pnpm exec vue-tsc --noEmit` -> clean.
  Full `pnpm test` run once before commit per Step 8 (see task-4-report.md for the number).
Task 4: fix round 1/5 (5 addressed, 0 open — dismiss() extracted as the single exit,
  missing embedded-Cancel test added and mutation-confirmed, overclaiming title fixed,
  3 minors; commits 0597929..e66e4e6)
Task 4: complete (commits 1a576c9..e66e4e6, review clean)
  The Important here is the phase's most instructive so far: a test TITLED as covering
  "cancel and successful create" only ever clicked create. Embedded cancel went through
  close()'s embedded branch, a second copy of the same embedded-vs-standalone decision
  that also lived inline in confirm(). Reverting that branch left BOTH files green while
  production would swallow the user's Cancel click (host listens for @close, not
  update:open). Fixed structurally by collapsing the two copies into one dismiss().
Task 4: no action, ruled: `sv-embed-host` diverges from Vue2's `sv-modal-embed-host`.
  Reviewer traced the string to MY brief template, not an implementer shortcut. Scoped
  class, zero visual effect, registered in-file. Left as is.
Task 4: deferred to real-device acceptance: the short-viewport flex chain
  (display:contents wrapper + flex:1/min-height:0) was verified algebraically, never in
  a browser. Acceptance step 4 must check the embedded form's submit button is reachable
  at a short viewport.

=== FOUNDATION PHASE CLOSED (T1-T4, per-task reviews done) ===
Score worth remembering: reviews raised 6 Important findings across the four tasks, and
  3 of them traced to defects in MY OWN PLAN, not to implementer error:
    - T2: "delete the shared comparator" AND "leave the view calling it" are incompatible
    - T3: the Vue2 subtitle ternary I copied collides with New-UI's own empty-state panel
          (same phrase twice on screen; plus a flash before the fetches land)
    - T4/T3: the flash guard I mandated waited on only one of the two stores
  Plus both Chinese values my key table guessed were wrong (起稿 not 起草).
  => A committed plan is not a correct plan. T5-T8 have no per-task review by the owner's
  ruling, so the whole-branch final review carries that weight alone; brief the finder
  accordingly and do NOT let it skip the areas T5-T8 touch.

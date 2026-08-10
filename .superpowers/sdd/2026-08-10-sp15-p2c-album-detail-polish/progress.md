# SDD ledger — plan: docs/superpowers/plans/2026-08-10-sp15-p2c-album-detail-polish.md

Branch: sp15-photos-moments (continues P1 + P2a + P2b; base = P2b close-out 61a666c)
Plan commit: 4aafe27 (+ pre-flight fix) · Spec commit: 4ba15cd
Branch merge-base with master: 9100418
1:1 target: Vue2 NimoOS-UI 33b05636 (#117)

Process: OWNER-CHOSEN — whole phase at once, PER-TASK REVIEW FOR EVERY TASK
  (owner ruling 2026-08-10, on the evidence that P2a's light process and P2b's
  hybrid both dumped their findings on a single closing review; 6 of P2b's 8
  Importants were 1:1 visual breaks no automated gate can see).

Pre-flight scan (controller, before Task 1) — TWO PLAN DEFECTS OF MINE, fixed before dispatch:
  1. Deleting .album-toolbar (T3) orphaned the edit-mode buttons whose new home
     (the bottom select bar) was a separate later task => two tasks would run with
     those functions missing. Old T6 folded into T3. Same shape as P2b's
     "delete the shared comparator while the view still calls it".
  2. T4 staged an empty .sv-side-actions shell for T5 to fill. The container is now
     built by the task that fills it.
  => 12 tasks became 11; old T7-T12 shifted to T6-T11.

Owner rulings binding for the phase (spec section 3):
  - whole phase at once + per-task review for every task
  - both Duplicate and Download as ZIP get built (backend export endpoint already
    exists and is JWT-exempt; the Vue2 "backend in parallel development" comment is stale)
  - the Add condition entry is deleted alongside Vue2 (its removal was a product
    decision there, not an oversight)
  - option B on sharing: the fixed-menu POSITIONING LOGIC is shared as a composable;
    template and CSS stay duplicated per page. P2b's keep-the-duplication ruling
    rests on scoped styles not crossing SFCs, which says nothing about plain TS.

Evidence gathered before planning (E1-E10 in the plan) — do not re-investigate.
  E4 overturned a spec sentence: deleting SmartViewCard.vue does NOT require touching
  the open-source strip manifest (DELETE already carries 'src/photos' as a whole dir).

Task 1: implemented (commit d639dfc). Mutation verification done as briefed — all three named
  mutations (drop capture flag / drop the `rect.top > spaceBelow` half / drop onBeforeUnmount)
  reddened exactly their named test and nothing else.
Task 1 review: 1 Important + 1 Minor.
  THIRD PLAN DEFECT OF MINE this phase, and the first one a reviewer had to catch: the brief's
  Interfaces section froze the return as `Ref<Record<string, string>>` while the brief's OWN
  implementation code block wrote `Record<string, string | number>`. The implementer followed
  the code block, which was the reasonable read. Two later tasks are written against the
  Interfaces line, so that one governs; `zIndex: 260` becomes `'260'` and the type narrows.
  => Same lesson as P2b's three plan-rooted Importants: a committed plan is not a correct plan,
  and the two halves of a single task's brief can disagree with each other.
  The reviewer independently re-derived all three mutation claims from the test source rather
  than trusting the report — and in doing so found the Minor: the comment at test:55 describes
  `rect.top (270)` while the fixture below it uses `top: 50`. That comment sits on precisely the
  test that gives the flip mutation its discriminating power, so it told a reader the opposite
  of what the fixture does. Bundled into the same round since the round was already required.
Task 1: fix round 1/5 (2 addressed, 0 open — menuStyle narrowed to Record<string, string> with
  zIndex as a string and the test assertion updated to toBe('260') rather than loosened; the
  misleading fixture comment rewritten to match the fixture instead of the fixture being changed
  to match the comment; commits d639dfc..946560a)
Task 1: complete (commits df2a75d..946560a, review clean)

Task 2: complete (commits 946560a..e1fdfa0, review clean, 4 minors deferred)
  FOURTH AND FIFTH PLAN DEFECTS OF MINE, both corrected by the implementer from the Vue2 source
  per Global Constraint 1, and both independently re-verified by the reviewer against
  33b05636:PhotosAlbumDetail.vue:692-724:
    - my skeleton had duplicateAlbum as createAlbum + addAssetsToAlbum. Vue2's is a thin
      dispatch wrapper over saveAsAlbum. Following my skeleton would have added an optimistic
      count patch + per-album refetch that Vue2 never does.
    - my "createAlbum already prepends" note was wrong: ordering comes from the backend's
      ORDER BY created_at DESC (NimoOS-Photos service/album.go:83), not frontend logic.
      createAlbum and saveAsAlbum both just refetch. No local unshift was added — correct.
  Name rule read from the target: `${album.title} copy`, no i18n, no numbering, no cover copy.
  => The "read the Vue2 source, not my prose" constraint has now paid for itself twice in one
  task. Keep it in every brief.
Task 2: minor (deferred): albums.ts:223 comment cites a nonexistent path albumToView.ts:61
  (real file is util/albumView.ts).
Task 2: minor (deferred): albums.ts:232 says "same shape as smartViews.ts:170" but this guard
  throws while that one silently returns — throwing is the correct choice for a Promise<RawAlbum>
  contract, so the code is right and only the comment overstates parity.
Task 2: minor (deferred): the `album not found` branch (albums.ts:238) has no test.
Task 2: minor (deferred): empty-name album yields " copy" with a leading space; Vue2 has the
  identical latent issue, so preserved-not-introduced.
Task 2: note — the implementer's final message mentioned oss-export failures from a dirty tree,
  but that text is not in its report file. Consistent with Global Constraint 7 (oss asserts a
  clean tree) and harmless mid-task; recorded so it is not mistaken for a real red later.

Task 3: complete (commits e1fdfa0..953a6a9, review clean, 7 minors deferred)
  SIXTH AND SEVENTH PLAN DEFECTS OF MINE, both caught by the implementer reading the target:
    - I briefed the select bar as "edit mode AND >=1 selection". The target is `v-if="edit"`
      alone (33b05636 :327), and it must be: the bar carries the empty-selection hint line and
      the Add photos button, both unreachable in an empty album under my version. The reworded
      test asserts three states and is STRONGER than the title I specified.
    - my i18n table listed 9 keys for T3/T6; 6 already existed verbatim in this repo
      (photosAlbumSort, photosAlbumSort{Manual,Taken,Added}, photosDensityComfortable,
      photosDensityCompact). Only 3 were genuinely new. => T6 MUST REUSE THE SAME KEYS and add
      only photosSortScore. Do not let T6 duplicate them under my planned names.
  Reviewer verified independently rather than accepting the report: all 13 re-homing rows
  checked entry by entry (nothing dropped, nothing weakened — the prior phase lost an assertion
  exactly here), the E5 re-anchor checked against Vue2's OWN stylesheet (photos.scss:3546/:3604
  key off .album-photos-wrap[data-edit], same shape as the new rules), and a repo-wide grep
  confirmed zero live orphaned selectors after .album-toolbar/.album-hero were deleted.
  Mutation 4 honesty note worth keeping: removing only the function-level `removing` guard
  reddened nothing, because the button's :disabled carries the same condition. The implementer
  reported this rather than hiding it; the reviewer confirmed it is a correct result (single
  caller + VTU skips disabled elements like a real browser), NOT the prior phase's
  "one decision in two places" hazard — both copies predate this task and moved verbatim.
Task 3: minor (deferred, FOLD INTO TASK 4 — it edits this file): PhotosAlbumDetail.vue:798, the
  fixed select bar is now a sibling of .photos-layout gated on `v-if="edit"` alone, while the
  deleted toolbar lived inside `v-else-if="album"`. The route-id watcher clears `selected` but
  never resets `edit`, so navigating from an album in edit mode to a missing id leaves the bar
  floating over "Album not found" with Add photos live. Fix: `v-if="edit && album"` or clear
  `edit` in the id watcher.
Task 3: minor (deferred): :931 maps Vue2's --surface-3 to --chip-bg for .sv-cond while :592/:686
  map the same source token to --chip-bg-hi. Pill reads one shade flatter than the target.
Task 3: minor (deferred): :604 drops font-family from .sv-header h1; the two sibling pages write
  `var(--font-display, var(--font))` to document the missing token at the point of use.
Task 3: minor (deferred): test:1046-1068 double-click test would be self-documenting if it also
  asserted the button carries `disabled` in flight — that is the guard actually load-bearing.
Task 3: minor (deferred): :698-739 re-nesting left the grid's children one indent level shallow.
Task 3: minor (deferred): PlaceDetailPanel.vue:46,337 and PersonHero.vue:58 still cite
  .album-hero-bg::after as their theme-exception precedent; that rule no longer exists.
Task 3: CARRY-OVER OBLIGATION INTO TASK 5 (reviewer's explicit ask): the "..." menu is parked in
  .sv-actions with class="bar-btn album-more-btn" because its old container was deleted here and
  its target home (.sv-side-actions) is built by T5. Parking was the right call — mounting it in
  the overflow-y:auto sidebar now would reproduce the exact clipping bug T1 exists to fix — but
  until T5 moves it, the page carries a live 1:1 break against target :211-222.

Task 4: implemented (commit 6b93d58). About/Stats/computeds are a clean 1:1 port — reviewer
  independently checked all five i18n reuses against the target's own zh_CN.json (byte-for-byte
  equivalent, no near-miss reuse), confirmed placesTitle returns '' not the placeholder when
  empty, and confirmed DASH is a single module-level const shared by all four label computeds
  (the placeholder-drift risk I named did not materialise).
  EIGHTH PLAN DEFECT OF MINE, same shape as the seventh: my i18n table listed 5 keys for this
  task; only photosDetailTimeSpan was genuinely new. About/Type/Created/Place all already
  existed as photosMoAbout/photosMoType/photosAlbumStatCreated/photosMoPlace.
  => My i18n tables have now been wrong in BOTH tasks that consumed one. Every remaining task
  must grep for an existing key before adding one.
Task 4 review: 1 Important + 1 Minor. The Important is the folded-in Task 3 finding being only
  half-closed, and it is worth recording in full because the brief's own instruction is what
  caught it: I told the reviewer to judge "whether any other state (the picker being already
  open, a pending async confirm) survives the navigation". It does.
  `v-if="edit && album"` stops the bar floating and stops the picker being NEWLY opened, but an
  ALREADY-OPEN picker survives a route change: PhotosLibraryPicker has no album gate, the
  route-id watcher resets selected/titleEditing/titleDraft but not pickerOpen or edit, and
  onPickerConfirm reads albumId.value fresh at call time rather than a snapshot.
  => Open Add photos on album 7, navigate to album 999, confirm, and the photos land in 999's
  REAL backend record with a success toast. Silent cross-album data misplacement, not an error.
  The implementer's report had claimed this half was "fixed for free"; it was not.
  Lesson to carry: a watcher that resets SOME per-album state reads as if it resets all of it.
Task 4: fix round 1/5 (2 addressed, 0 open — watcher now resets edit+pickerOpen on every id
  change AND onPickerConfirm uses a pickerAlbumId snapshot; commits 6b93d58..faf808b)
  The re-reviewer mutation-tested BOTH halves independently and confirmed neither subsumes the
  other, and verified the new test drives a real click through openPicker() plus a real
  router.push rather than mutating state directly.
  The implementer's "abandoned guard" story checked out and produced a real finding about the
  EXISTING suite: the pre-existing test at PhotosAlbumDetail.test.ts:708-732 fires
  picker.vm.$emit('confirm') without ever opening the picker, i.e. it exercises a sequence
  unreachable through the real UI. A `if (!pickerOpen.value) return` guard is correct and that
  test is what would have to change. Left alone — out of scope, worth hardening later.
Task 4: minor (deferred, FOLD INTO TASK 5 — it edits this file): PhotosAlbumDetail.vue:441 —
  onPickerConfirm snapshots the album id but NOT the display name (`album.value?.title` is still
  read live). After the fix, id and name can disagree: the write lands on the snapshotted album
  while the success toast names whichever album the route now points at. Before the fix both
  were read live and were at least self-consistently wrong.
Task 4: complete (commits 953a6a9..faf808b, review clean, 1 new minor deferred)

Task 5: implemented (commit ebe69b5). Reviewer verified the five-entry order, the sidebar
  container, the menu's relocation out of the header (no trace of the old markup/CSS left), the
  danger tokens, all nine i18n reuses against the target's own zh_CN.json, and the click-outside
  containment (position:fixed is visual only — morePopRef still DOM-wraps trigger and menu, so
  .contains() is unaffected). Also confirmed the mid-task pnpm hardlink fix leaked nothing.
  NINTH PLAN DEFECT OF MINE: my brief pointed at PhotosSmartViewDetail's downloadZip as the ZIP
  precedent to copy. That endpoint is POST-only and NOT JWT-exempt — a different contract. The
  implementer followed the Vue2 target (window.location.href = exportAlbumZipUrl(...)) and
  favorites.ts's GET+token precedent instead; the reviewer verified both halves of that claim.
  TENTH PLAN DEFECT (same shape as 7 and 8): 11 i18n slots, only 2 genuinely new keys.
  My i18n tables have now been wrong in all three tasks that consumed one.
Task 5 review: 1 Important (plan-mandated) + 1 Minor. Controller ruled the Important is NOT a
  human-decision plan conflict: the plan never required a weak test, it merely supplied a weak
  skeleton, so strengthening it contradicts nothing. Dispatched as fix round 1.
  The Important: the ZIP test asserts only that exportAlbumZipUrl was CALLED. A mutation that
  calls the builder and discards its return value — never assigning window.location.href —
  still passes. Given Download as ZIP is a new capability whose acceptance depends on the
  navigation firing, that test is the only guard before hardware.
Task 5: minor (deferred): third pre-existing i18n drift found — photosAlbumNameExists is
  '已存在同名相册' here vs '已有同名相册' in the target. With the two the implementer disclosed
  (photosAlbumConvertToSmartHint, photosAlbumDeleteHint) that is THREE stored values that have
  drifted from the target. None introduced by this phase. Worth one reconciliation pass later —
  flagging for the final review to triage as a group rather than piecemeal.
Task 5: fix round 1/5 (1 addressed, 0 open — the ZIP test now asserts the ASSIGNED VALUE
  (`expect(hrefs).toEqual(['mock://export/a1'])`), not merely that the builder was called;
  commits ebe69b5..222f11f)
  Re-reviewer confirmed the leak-proofing properly: the afterEach is in the same describe block
  as the only test that stubs location, it is unconditional so it runs on the throw path too,
  and the original is captured at module scope before any test can run. It also verified the
  three cited in-repo precedents actually exist and use the same shape — the "house style" claim
  was real, not fabricated. Side benefit: the stub also silenced a pre-existing jsdom
  "Not implemented: navigation" stderr on this test.
Task 5: complete (commits faf808b..222f11f, review clean, 1 minor deferred)

Task 6: complete (commits 222f11f..be739e5, review clean, 7 minors — 5 folded into T7, 2 into T11)
  ELEVENTH PLAN DEFECT OF MINE: my brief's test list included "no longer renders refine-in-search
  in the header", but the plan's own Task 7 owns moving Refine and the "..." menu. Writing that
  test would have required doing Task 7. The implementer skipped it, parked those controls at the
  end of .sv-actions (Task 3's pattern), and substituted an equivalent mutation. Reviewer ruled
  all three calls legitimate and noted the parking boundary is exactly where the row-sequence
  test's slice(0,7) ends.
  Reviewer verified against the target rather than the report: header order, per-group gating
  (which separator travels with which control), the two sort options and their default, the
  density enum matching the album page, and the bottom bar's shape. Also read every removed
  expect() in the diff — the 13-row re-homing table survives entry-by-entry, test count 20 -> 20,
  and the five "strengthened" ones genuinely assert more (the old bar.exists() form is vacuous
  under the new v-if="edit" gate).
  The state decision was verified against the target's own comment (:449-451), which says
  verbatim that `selecting` was renamed `edit` with zero behaviour change — the reuse claim was
  true, not a convenient rationalisation.
Task 6: FOLD INTO TASK 7 (it edits the same file), five items:
  (a) :114-125 the route watcher's comment states "nothing on screen may come from the old id"
      and enumerates edit/selectedIds/pickerOpen/excludedOpen, but the two NEW refs sortBy and
      density are not reset, so they persist across an :id change. Either reset them or record
      that display preferences are deliberately view-independent — right now the file documents
      the opposite of what it does.
  (b) :649 toggleEdit — keyboard-activating Edit (Space/Enter) strands the sort menu open: the
      document mousedown handler is what normally closes it, and a keyboard activation produces
      no mousedown, so sortMenuOpen stays true while the template unmounts it and it reappears on
      leaving edit mode. One line: sortMenuOpen.value = false in toggleEdit.
  (c) assets.test.ts:106 — enterEdit() is called twice in a row to LEAVE and re-enter edit mode,
      with comments doing the work the name should do. Rename to toggleEdit(w) or add a leaveEdit alias.
  (d) the main test file mocks neither getConfig nor getSmartViewExcluded. The getConfig argument
      for leaving it alone is sound and verified (mocking it flips fetchAiFeatures out of the catch
      that sets ALL_ON, changing feature gates under 81 tests). getSmartViewExcluded carries NO
      such coupling — loadExcluded catches and leaves excluded empty, identical to a [] mock.
      Half the stderr noise is removable today at zero risk; the bundling was asserted, not argued.
  (e) :434 import comment says the fallback branch "returns the list untouched"; albumView.ts:88
      returns [...photos], a fresh shallow copy. Order untouched, reference not.
Task 6: FOLD INTO TASK 11 (both need edits in BOTH detail pages, so they belong in the sweep):
  (f) sort menu min-width is 180px on both pages; the target's .albums-sort-menu is 240px
      (Vue2 photos.scss:3126). Introduced by T3 and inherited by T6 — the two pages agree with
      each other but both differ from the target.
  (g) CROSS-PAGE 1:1 BREAK, controller-verified myself before dispatching T6's review: Vue2 gives
      BOTH detail pages a check glyph on the active sort option
      (33b05636:PhotosAlbumDetail.vue:89 `name="check" color="var(--accent-hi)"`, and the SV page
      the same). T6 followed the target and added it; the album page renders a bare label with
      only a data-active background (PhotosAlbumDetail.vue:722-730, CSS :1239). The omission
      predates this phase (SP7-era) and T3 merely moved that markup, so no task introduced it —
      but the two pages are now visibly inconsistent, and aligning them is this phase's whole
      point. Fix both to carry the glyph.

Task 7: implemented (commit 91abcc2). Structural work verified by the reviewer against the target:
  container placement between aside and the first section, five-entry order, menu min-width 220px,
  the fixed-position wiring, click-outside containment (useFixedMenuPosition returns a style object
  only — no Teleport, no DOM move — so position:fixed changes layout, not ancestry), and the
  per-page backend split with nothing borrowed from the album page.
  THE MOST EXPENSIVE AVAILABLE ERROR WAS AVOIDED: my brief warned not to delete "Save as static
  album" on the assumption it duplicates Convert. The implementer went to the target and found its
  OWN comment (:183-194) stating the item was deliberately deleted in the five-entry cleanup while
  the backend capability is kept uncalled. Deleting the view action while leaving
  store.exportAlbum / service.exportSmartViewAlbum intact reproduces that exact shape. Backed by
  source, not inferred.
Task 7 review: 1 Important + 6 Minor. Dispatched as fix round 1.
  The Important is a 1:1 break AND a cross-page asymmetry in the very artefact this phase exists
  to unify: Convert and Delete still carry the long titles (转为普通相册 / 删除智能视图) while the
  target shortened both (转换 / 删除) and the album page already uses the short ones. The target
  records the shortening deliberately at :143-147 — it was done so the two menus read alike.
  WHY NO GATE SAW IT: the implementer's i18n check was existence-only ("each key exists"), and the
  five-entry order test asserts data-test ids, never rendered text. => An i18n check that only
  proves a key EXISTS cannot catch the wrong key being used. Copy assertions must read text.
  No later task would have caught it either: Task 11 is an orphan-key sweep, which deletes unused
  keys rather than correcting which key a row points at.
Task 7: minor (deferred): :370 ExportToast.icon's 'plus' member and :1032's v-else plus-glyph SVG
  are unreachable now that both remaining callers pass 'download'.
Task 7: minor (deferred): test:27,134 still declare and reset svc.photos.exportSmartViewAlbum,
  which nothing calls any more.
Task 7: minor (deferred, FOR TASK 11): .sv-action-btn-primary and its hover-cascade test now guard
  a rule with no consumer in this SFC, and the test still names 导出主按钮 — a button that no
  longer exists. The sweep must delete the rule AND the test together, or the test will assert a
  missing selector.
Task 7: minor (deferred, TICKET-WORTHY, pre-existing): duplicateSv (:481-492) awaits
  duplicateSmartView, which returns early on duplicateBusy WITHOUT throwing, so a second Duplicate
  inside the request window shows the success toast for a copy that was never made. This page
  already guards the identical shape for pinAssets/removeAssets ("reports nothing and keeps the
  picker open when the store drops the call as busy"), so the inconsistency is real. Fix shape:
  have the store return a sentinel as pinAssets does, and suppress the toast.
Task 7: minor (deferred): the sidebar container's placement BEFORE SmartViewSidePanel is untested —
  the target is most specific about exactly that (:128 vs :227). A firstElementChild check pins it.
Task 7: minor (deferred, symmetric so not a regression): the "..." trigger is min-width 32px on
  both pages vs the target's 36px.
Task 7: fix round 1/5 (1 addressed, 0 open — both titles now point at the short shared keys, and
  a rendered-TEXT assertion over all five rows was added; commits 91abcc2..9bee146)
  Re-reviewer confirmed the new assertion reads `.sv-export-title` DOM text (not data-test ids),
  covers all five rows in one ordered array, and catches a reorder as well as a retitle because
  the five strings are pairwise distinct. The shared-key reuse was checked for content safety:
  the two pages' Convert actions run in OPPOSITE directions (album->smart vs smart->album) but
  the shared key's value is direction-neutral ("Convert"/"转换"), so nothing is mis-worded.
  The desc was left alone with its reasoning recorded in-file, as required.
Task 7: complete (commits 7078d6e..9bee146, review clean, 6 minors deferred)

TWELFTH DEFECT OF MINE, this one in the DISPATCH rather than the plan, and worth remembering
  because of HOW it hides: I gave Tasks 6 and 7 the test path
  `src/views/PhotosSmartViewDetail.test.ts`. That file does not exist — the two test files for
  this page live in DIFFERENT directories:
      src/views/PhotosSmartViewDetail.assets.test.ts       (not under __tests__)
      src/views/__tests__/PhotosSmartViewDetail.test.ts    (under __tests__)
  **vitest SILENTLY DROPS a path that matches nothing — no error, just a lower test count.**
  The Task 7 implementer caught it, reran both, and showed the difference (1107 vs 1200) rather
  than reporting the first number as a pass. A green run against a non-existent path proves
  nothing, and nothing in the tooling says so.
  Task 6 happened to be safe because its implementer also ran the full suite (687 files).

Task 8: implementer STALLED on the known failure mode — handed its test run to a background
  watcher and ended its turn waiting for a notification that never comes. The dispatch carried
  an explicit "run tests in the FOREGROUND, do not background" instruction and it still happened;
  the instruction is necessary but not sufficient.
  Diagnosed per the established method: `git status` first, to tell "work not done" from
  "done but not reported". It was the latter — the component and its test file were already
  deleted and four files modified, all uncommitted. Resumed with an explicit finish-up message
  and a note not to redo the deletion.
Task 8: implemented (commit c2ad340). Reviewer verified against the target that `add` is fully
  gone, `remove` is traced end to end (chip -> removeCond -> store.updateSmartView, no emit
  indirection now the component is gone), nothing was deleted that the target keeps, and the
  six-key orphan list is accurate — including correctly EXCLUDING photosSvRemoveC, which is
  still live. The fold-back call (deleting the component outright) was checked against the actual
  post-deletion shape — every remaining hook in it was add-path code — and judged sound rather
  than a diff-minimising default.
Task 8 review: 1 Important + 2 Minor. Dispatched as fix round 1.
  THE IMPORTANT IS A FALSE RE-HOMING CLAIM, i.e. exactly the failure mode I briefed the reviewer
  to watch for, and it landed: the report asserted the deleted component test's
  `.sv-cond-removable:hover` cascade check was "covered by PhotosSmartViewDetail.test.ts's
  existing hover-cascade describe block". That block contains exactly two tests, for
  sv-action-btn and sv-export-item; nothing in the file calls winningHoverBackground with
  sv-cond-removable. The protection is gone, not re-homed.
  Why it matters beyond a missing test: base-class-:hover-beating-variant is a shape this repo
  has SHIPPED (white-on-white button), it is invisible to jsdom rendering, and parsing the style
  block is the only way it is ever caught. => A disposition table is a claim like any other.
  One wrong row means the whole table needs a second pass, which I asked for.
Task 8: fix round 1/5 (1 addressed, 1 NEW open — the false claim is gone and the cascade test
  exists, but it cannot detect the regression it was written for; commits c2ad340..cc7685b)
  The implementer's own second pass found TWO overstated rows, not the one the reviewer caught,
  and it self-caught a Chinese test title it had introduced. That vindicates the "one wrong row
  means re-read the whole table" instruction.
  THE NEW FINDING IS THE MOST INSTRUCTIVE OF THE PHASE SO FAR, and the re-reviewer earned it by
  reimplementing the helper in isolation instead of reading the test and nodding:
    winningHoverBackground(style, ['sv-cond-removable']) filters candidate rules by class
    membership against the list you pass in. A future base rule `.sv-cond:hover` — equal
    specificity, later source order, which is EXACTLY how the shipped white-on-white bug
    manifested — is silently excluded from consideration because 'sv-cond' is not in the list.
    So the test stays green through the precise scenario it exists to catch.
    The two-class form ['sv-cond', 'sv-cond-removable'] does catch it, and is what both sibling
    tests in the same describe block already use.
  Compounding it: the mutation check PASSED, but tested a different failure mode (deleting the
  :hover pseudo-class entirely, which makes the helper return zero candidates and throw). So the
  mutation report read as confirmation of protection that did not exist.
  => A passing mutation check only proves the test detects THE MUTATION YOU CHOSE. Choosing a
  mutation that is easier than the real risk produces a test that looks guarded and is not.
  Dispatched as fix round 2 with the correct mutation named explicitly.
Task 8: fix round 2/5 (1 addressed, 0 open — query widened to ['sv-cond', 'sv-cond-removable'],
  assertion NOT weakened, and the correct base-beats-variant mutation confirmed red;
  commits cc7685b..e2cefe4)
  The re-reviewer traced the helper's class-membership filter by hand to confirm the widened query
  actually admits a future .sv-cond:hover as a candidate, and independently ran the single focused
  test rather than trusting the report. It also verified the mutation was reverted cleanly (the
  .vue file is absent from the fix diff entirely) — a leftover mutation in a style block would
  have been a live visual defect.
  Noted as structurally inherent, not a defect: this test cannot assert `specificity === 3` like
  its two siblings, because .sv-cond-removable:hover is one class + a pseudo-class (specificity 2)
  rather than a two-class compound. The toContain check carries the regression weight.
Task 8: complete (commits 9bee146..e2cefe4, review clean, 2 minors deferred)
Task 8: minor (deferred): SmartViewSidePanel.vue:27 still names the now-deleted
  SmartViewConditionEditor.vue as the origin of its busy-guard convention — accurate history,
  dead lead for a future grep.
Task 8: minor (deferred): the cssCascade.ts synthetic-CSS regression pair that lived in the
  deleted component's test file is homeless — honestly disclosed rather than claimed as covered.
  It guards the shared helper itself, not this page.
Task 8: SIX i18n keys orphaned for Task 11's sweep: photosSvAddCondition, photosSvNewCondition,
  photosSvEGSceneSunset, photosSvSuggestions, photosSvDone, photosSvAdd.
  (photosSvRemoveC is NOT orphaned — still live at PhotosSmartViewDetail.vue:761.)

Task 9: complete (commits e2cefe4..ee63839, review clean, 2 minors deferred)
  THIRTEENTH AND FOURTEENTH DEFECTS OF MINE, both caught by the implementer reading sources:
    - my brief described the fix as swapping a single value; the target actually adds a SECOND
      onTileClick parameter per grid (33b05636 :96 `onTileClick(p, recentSet)` and :107
      `onTileClick(p, photoSet)`). This page has TWO grids and both needed it — the one-line-swap
      framing would have fixed only one. Reviewer confirmed both call sites (:879, :904) and that
      no third opener exists.
    - my brief hedged about the third argument; useLightbox.ts:55-59 settles it — openAt computes
      the index itself via photoIndexById and the third arg is only consulted for video seek, so
      leaving it 0 is correct.
  The fixture was verified to genuinely discriminate: store order m1,m2,m3 vs sorted m2,m3,m1 is
  a full derangement, and the second test uses DISJOINT ids across the two grids, which catches a
  "both grids wired to the same list" bug the first test alone would miss.
  The spy trap was avoided correctly — the file mocks the whole useLightbox module so every call
  returns the same object, rather than vi.spyOn on a throwaway literal (which observes nothing,
  since useLightbox returns a new object each call).
  The stale test pinning `call[1] === store.matchedAssets` was STRENGTHENED, not weakened:
  toBe -> toEqual plus a new not.toBe, justified because sortAlbumPhotos always returns a fresh
  [...photos] on every branch.
Task 9: minor (deferred): the two new tests live inside the Task 6 describe block (they reuse its
  pickSortOption helper) rather than a Task-9-labelled one — discoverability nit only.
Task 9: minor (deferred//no action): the report called my brief self-contradictory about the third
  argument; the reviewer noted my sentence actually carried an explicit "unless the existing
  implementation means something else — go read useLightbox" escape clause, so it was a hedge
  correctly resolved rather than a contradiction. Recorded for accuracy, nothing to fix.

Task 10: complete (commits ee63839..750dd2d, review clean, 5 minors — 2 folded into T11)
  FIFTEENTH AND SIXTEENTH DEFECTS OF MINE, and the first is the most interesting of the phase
  because the implementer did not settle for "it cannot be tested":
    - I asserted that once both cards become plain <div>s the grid's :key prefix becomes
      load-bearing and a "both cards render" test would catch its removal. IT DOES NOT REDDEN.
      Each v-if branch carries its own compiler-generated key, so the subtree is rebuilt from the
      new vnode and the text is correct either way. What the prefix ACTUALLY protects is DOM REUSE
      across a re-sort: without it, both colliding cards are torn down and recreated, re-fetching
      their cover images. The implementer probed this, rewrote the test to assert DOM element
      identity, and THAT reddens.
      The reviewer then built an isolated repro of the exact grid shape and measured BOTH
      directions independently: with the prefix, text correct AND elements reused; without it,
      text STILL correct but elements rebuilt. Mechanism confirmed down to patchKeyedChildren's
      sync-from-start pass and the STABLE_FRAGMENT positional patch. => The earlier phase's
      conclusion ("no test can guard this") was right for the old markup and wrong for the new,
      and the right response was to find the invariant that IS observable, not to skip the guard.
    - Mutation 3 (live-dot styles) was expected to be unobservable in jsdom. Made observable with
      a comment-stripped source-text assertion requiring width/height/background/animation inside
      a `.al-live-dot .live-dot` rule AND `animation: none` on the paused variant. The reviewer
      confirmed it discriminates rather than merely restating the source.
  The #116 follow-up sub-commit was ported (the PR is squashed, so `git show 9f7e941f` carries
  both): no bare `.live-dot` rule existed, so the dot painted as a hollow ring. The @keyframes had
  to be restated because it lived in the deleted component and scoped styles do not cross SFCs —
  the reviewer verified compileStyle emits `animation: pulse-<id>` alongside `@keyframes pulse-<id>`,
  so it genuinely links.
  Zero new i18n keys. oss/ green post-commit with no manifest change, exactly as E4 predicted.
Task 10: FOLD INTO TASK 11: the smart branch's .album-cover-fallback (PhotosAlbums.vue:455) has no
  data-test while its manual twin (:491) does — asymmetric for whoever writes the next test.
Task 10: FOLD INTO TASK 11: PhotosAlbums.vue:471's String(item.sv.id) duplicates the store's own
  normalization (smartViews.ts:98), so the re-homed numeric-id test does not isolate the store
  guard the way the report implies — strip String() from the store and the test stays green.
Task 10: minor (deferred, TICKET): 12 files still cite the deleted SmartViewCard.vue with line
  numbers. Leaving them is right (touching 12 unrelated files is the scope creep the plan forbids)
  but the report's justification cited a brief instruction that does not exist — the design doc
  merely OBSERVES the remaining hits are comments, it issues no instruction.
Task 10: minor (no action, agreed): PhotosSmartViews.moments.test.ts:276's sv-card assertion is
  vacuous, but it is one of four sibling "must never come back" negatives, all vacuous by
  construction. Regression negatives are supposed to look like that.
Task 10: minor (pre-existing): PhotosAlbums.test.ts emits 7 [Vue warn] "already registered" lines
  per test from a module-scope createI18n beside the setup singleton — the known repo trap.

Task 11: complete (commits 0a8f476..7da60bb, review clean, 5 minors deferred)
  THE SWEEP VINDICATED ITS OWN RULE: of the 14 "also check" candidates I listed, SEVEN were still
  live. Blind deletion would have blanked five on-screen strings (PhotosAlbumDetail.vue:867/912/
  930/1055 and AlbumConvertToSmartDialog.vue:125). 13 deleted, 8 kept, every verdict grep-backed.
  The reviewer re-ran the grep in BOTH directions at HEAD and confirmed all 13 deletions have zero
  real consumers (the one surviving textual hit is a comment) and all 8 kept keys are live at the
  claimed sites. It also extracted both locale key sets: 768 keys each, sets identical.
  Word-boundary matching mattered and held — photosSvAdd does not collide with photosSvAddAnother.
  Both folded-in visual fixes landed on BOTH pages, and the reviewer checked the SHAPE not just
  presence: the target renders a check icon on the active row AND a same-width spacer on inactive
  ones so labels do not shift between states. Both pages now carry both halves.
  The dead .sv-action-btn-primary rule and its cascade test were removed together, and the three
  cross-reference comments that would have pointed at the deleted rule were rewritten — one
  rehomed to the surviving copy on PhotosMomentDetail.vue.
  SIX GATES GREEN on a clean tree: vue-tsc 0 · pnpm test 685 files / 10954 · parity+styles 5/1081 ·
  oss 8/149 (DELETE 78 / REPLACE 4 / PATCH 258, zero real leaks) · build 17.11s ·
  merge-tree vs master = single tree OID, NO CONFLICT.
Task 11: minor (deferred, FOR THE FINAL FIX WAVE — these two are in the OWNER-FACING deliverable):
  acceptance.md:60 points at 「第 9 步」 for the seed-photos-first instructions; they are at the head
  of step 10. That prerequisite is the one the report itself calls the most-likely-to-be-skipped
  item, and following the wrong pointer turns steps 10 and 13 into "nothing happened".
  acceptance.md:95's "common starting point" back-reference says 「第 3/4/5/6/7/8 步」 but step 9 and
  step 13's last item also start there.
Task 11: minor (deferred, FOR THE FINAL FIX WAVE): the check-glyph fix shipped with NO regression
  coverage on either page. This is the exact defect class the phase says no automated gate can see,
  and the album page silently drifted for the whole phase before this task caught it — nothing
  stops it drifting back. The hook exists (PhotosAlbumDetail.test.ts:158 already finds the items).
  The spacer is the half a future edit is most likely to drop.
Task 11: minor (deferred): the report's sweep table has stale line numbers and omits two candidates
  (photosSvRename/photosSvDuplicate, both live) — nothing wrongly deleted, but the table is the
  audit trail a future sweep would trust.
Task 11: minor (recorded, no action): PhotosAlbumDetail.vue:1268 uses align-items:center where the
  target uses flex-start (the target supports an optional .desc second line New-UI does not render).
  Matches the smart-view page, so cross-page consistency is preserved.

=== ALL 11 IMPLEMENTATION TASKS COMPLETE ===
Commit range: df2a75d..7da60bb

TOOLING HAZARD, second occurrence this project, worth fixing in the tool rather than per phase:
  the review-package script recreates .superpowers/sdd/.gitignore containing a single `*`. That
  hides the ENTIRE ledger while `git status` still reads clean — 31 ledger files were invisible
  until Task 11 removed it. A controller trusting `git status` would believe the ledger was
  committed when it was not.

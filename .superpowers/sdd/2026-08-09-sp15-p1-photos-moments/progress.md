# SDD ledger — plan: docs/superpowers/plans/2026-08-09-sp15-p1-photos-moments.md

Branch: sp15-photos-moments (worktree .claude/worktrees/sp15-photos-moments)
Base at start: 8b09693 (docs only, on top of master@9100418)

Pre-flight fact checks (controller, before Task 1):
- Vue2 target 899af59b exists in /home/nimo/NimoTech/NimoOS-UI ✓
- toast.show(text, duration=1500, tierOrAction) — discriminated third param, so
  both `'danger'` and `{label,onClick}` usages in the plan are valid ✓
- aiSmartViewOff already exists at src/views/PhotosSmartViews.vue:56 ✓
- useAlbumDragSort current shape matches the plan's assumptions verbatim ✓
- tsconfig include is ["src", "src/**/*.vue"] ⇒ tests under src/ ARE type-checked
  by vue-tsc; packages/service/**/*.test.ts is NOT. Task 4/5 test helpers must
  type their size/template params or vue-tsc goes red at Task 11.
- Plan's Task 11 scratchpad path belongs to a different session id; controller
  substitutes this session's scratchpad when running the oss gate.
No plan-internal contradictions found that need the human's ruling.

Task 1: complete (commits 8b09693..732eb2f, review clean)
Task 1: minor (deferred): implementer's report cites a stale "37 files/377 tests"
  baseline from CLAUDE.md instead of a real before/after run — report accuracy
  only, the 2-file diff itself was inspected and is clean. Controller resolved
  the reviewer's one ⚠️: commit body IS the brief's verbatim English text,
  author Tiansanchuan <1312528051@qq.com>.

CONSTRAINT CHANGE (human ruling, 2026-08-09, after Task 2 review):
  Workspace CLAUDE.md ("code comments: English only, no exceptions") GOVERNS over
  the plan's verbatim Chinese comment blocks. Applies to: inline/doc comments and
  test describe/it titles in ALL tasks, including retro-fixing Tasks 1 and 2.
  Does NOT apply to: i18n locale content (zh_cn.photos.ts values) and Chinese UI
  strings appearing as assertion DATA. Every later dispatch must carry this.

Task 2: review — spec ✅, quality Approved. One Important (plan-mandated):
  momentLayout.test.ts case named "featuredAssetIds 缺失时按 0 计" passes [] rather
  than a missing/non-array value, so the Array.isArray guard has zero coverage.
  Ruling: fixing it FULFILS the plan's stated intent rather than contradicting it,
  so it enters the fix loop without a human ruling.
Task 2: fix round 1/5 (2 addressed, 0 open — guard coverage + English sweep over
  T1/T2 files; commits cadf6c4..f44c44b)
Task 2: complete (commits 732eb2f..f44c44b, review clean)

PLAN GAP found during Task 3 (controller-confirmed by running the gate myself):
  Gate 4 `node oss/export.mjs` FAILS since Task 1 — 24 leak-guard hits on
  packages/service/src/photos.moments.test.ts. The OSS manifest strips the whole
  Photos area from the public repo, and it enumerates the service package's
  photos test files ONE BY ONE (oss/manifest.mjs:178-188); a new one must be
  added. src/photos/** and src/i18n/*.photos.ts are already covered wholesale
  (manifest.mjs:87,90-91), but src/views/Photos*.* and the router entry may need
  entries too. The plan has NO task for this; it was a known recurring chore in
  SP7 (DELETE+35/PATCH+42) and SP8. Controller decision: add a dedicated task
  "OSS manifest extension" AFTER Task 10 and BEFORE Task 11, once every new file
  exists, rather than dribbling entries in per task.
Task 3: fix round 1/5 (3 addressed, 0 open — setOrder duplicate-id data loss +
  2 registered deviations; commits e3164eb..30dc0fe)
Task 3: complete (commits f44c44b..30dc0fe, review clean, 20 cases)
Task 3: minor (deferred): no failure-path tests for pin/exclude/loadDetail/loadAll
  (only remove/fetchMoments/reorder have them) — inherited from the brief's test
  list, not an implementer omission.
Task 3: controller resolved reviewer's ⚠️ — later tasks DO wrap the throwing
  store methods: T7 load() has try/catch, T9 onPickPhotos/removeSelected have
  try/catch, T10 saveAsAlbum/doDelete have try/catch, T6 uses reorder() which
  returns a boolean and does not throw. No gap.

Task 4: review — spec ❌ (badge icon 1:1 miss), quality Needs fixes.
  Important 1: the badge star is a bespoke outline path invented by the PLAN's own
    code block; Vue 2 uses PhotosIcon's solid-filled star. The plan thus contradicts
    its own Global Constraint 1 (界面严格 1:1). Controller adjudication: the 1:1
    constraint governs — no human ruling needed, the human's 2026-07-27 standing rule
    already settles visual parity. Sibling precedent agrees (SmartViewCard inlines
    Vue 2's real sparkles path).
  Important 2: nothing asserted .mo-tpl-t2/t3/t4 — deleting those three class
    bindings left every test green while 3 of 5 collage shapes collapsed to one
    layout. Mutation check demanded as part of the fix.
  Controller resolved the reviewer's ⚠️ partially: Task 5 passes
    `:template="moments.sizeMap[m.id]?.template ?? 'T1'"`. sizeMap is derived from
    the same moments list so the id is always present in practice, but that `?? 'T1'`
    IS the one path that could hand T1 to a moment with 0 featured ids. Flag it to
    Task 5's implementer and reviewer.
Task 4: fix round 1/5 (3 addressed, 0 open — real Vue 2 star restored + template
  class assertions with a specific mutation check + invariant comment;
  commits 8d58375..6976e96)
Task 4: complete (commits 30dc0fe..6976e96, review clean, 12 cases + parity 9)
Task 4: minor (deferred): the restored star drops Vue 2's stroke
  (stroke="currentColor" stroke-width="1.6", round caps/joins) — Vue 2's PhotosIcon
  strokes the star as well as filling it, so this port has sharp points where Vue 2's
  are faintly rounded. Sub-pixel at 9px, unlogged in the header deviation list.
  Correct Vue 2 source path is src/views/Photos/PhotosIcon.vue (not components/).

Task 5: review — spec ❌, quality Needs fixes.
  Important 1: new <style scoped> comments left in Chinese (script + tests were
    translated; the CSS block was not).
  Important 2: the page's unconditional onMounted fetch makes the PRE-EXISTING
    src/views/__tests__/PhotosSmartViews.test.ts log a swallowed
    "listMoments is not a function" on 4 of its 18 tests. The brief forbade
    touching that file "to avoid the concurrency面". Controller adjudication: the
    stated reason is void — the two live branches (sp12-files-fixes,
    sp16-kvm-settings-fixes) work in the files and KVM/settings areas and cannot
    touch it — while leaving it violates the plan's own pristine-test-output
    constraint. Restriction lifted for a one-line mock addition only.
  Reviewer ⚠️ (deferred to real-machine acceptance): the @media (max-width:1055px)
    breakpoint was copied byte-for-byte from Vue 2, whose derivation assumed a
    sidebar-less page; this page has PhotosSidebar inside .photos-layout, so the
    grid may already be below 3 columns above 1055px and a wide card could overflow.
    Only a real browser at ~1000-1150px can settle it. ADD TO ACCEPTANCE LIST.
Task 5: fix round 1/5 (2 addressed, 0 open — English CSS comments + one-line mock
  in the pre-existing page test; commits 16f96cf..f5d2d1e)
Task 5: complete (commits 6976e96..f5d2d1e, review clean; 9 new + 18 pre-existing
  page + 9 parity = 36, style guards 1072)
Task 6: complete (commits f5d2d1e..d9fe4c1, review clean, spec ✅ Approved first
  pass; composable 9, moments page 12, album pages 31 unchanged, parity 9,
  style guards 1072)
Task 6: minor (deferred): the "defaults unchanged" test asserts only ghostClass via
  objectContaining, so a future regression on itemSelector or chosenClass would not
  be caught; the diff was verified correct by hand instead.
Task 6: minor (deferred): failure logging now lives in the store's reorder() rather
  than at the call site — no information lost today, but a future store refactor
  could silently drop it.

Task 7: review (opus) — spec ❌, quality Needs fixes. 4 Important + 3 Minor.
  Important 1: Promise.all couples loadDetail/loadAll; Vue 2 kept them independent,
    so a loadAll rejection silently discards an already-arrived detail.
  Important 2/3: two brief-mandated assertions pass regardless of implementation —
    histogram order (`toContain('2')` also matches the year in 'Dec 2016 · 1') and
    the same-day time window (`not.toContain('–')` uses an EN dash while the
    placeholder is an EM dash). Fixing them fulfils the tests' own stated intent,
    so no human ruling needed.
  Important 4: a FAILED listMoments renders "This moment no longer exists" — the T3
    store swallows and still sets listLoaded. Controller put it in scope rather than
    leaving it as a report paragraph: needs a listError ref + a third page state.
  Important 5: three newly-written Chinese comments (oss/manifest.mjs x2, one test).
  Reviewer upheld the implementer's Concern A (more-menu listener correctly deferred
    to Task 10 — Task 10 MUST add both the listener and its teardown) and Concern C
    (the OSS manifest change is the correct remedy; forbidden.mjs untouched, no word
    list widened, nothing wrongly stripped).
  Controller resolved the ⚠️: src/router 25/25 green after the inserted comment.
Task 7: minor (deferred): AreaShell's title falls back to the back-link label, so the
  skeleton and not-found states are titled "All Moments".
CONTROLLER ACTION: removed a stray .superpowers/sdd/.gitignore containing a single
  `*` — recreated by the superpowers workspace script, and it is the exact file the
  owner deleted in 0eec6ad ("stop the sdd directory from ignoring its own ledgers").
  It was silencing all 16 of this stage's ledger/brief/report markdown files. Per the
  parent .superpowers/.gitignore rule (markdown in, replayable machine output out),
  these must be committed at the end — do NOT delete the workspace as the SDD skill
  would otherwise have it.
NOTE: the superpowers `review-package` script RECREATES .superpowers/sdd/.gitignore
  (a single `*`) on every run. Delete it again immediately before the final ledger
  commit, or the stage's markdown silently stops being trackable.
Task 7: fix round 1/5 (7 addressed, 0 open; commits 7069012..b3d0ad9, 4 commits).
  Re-review also upheld three beyond-scope changes the implementer made: a retry
  button on the new failure state (verified it really refetches, not a no-op), a
  self-initiated fix so switching :id clears the previous moment's assets (verified
  safe against the staleness guard), and a rewritten finding-7 test after the first
  version turned out to be a fake gate that only the mutation check caught.
Task 7: complete (commits d9fe4c1..b3d0ad9, review clean; detail page 25, store 25,
  router 25, parity 9, styles 1075, oss 448, full suite 10772/678 files)
Task 7: minor (CARRIED INTO TASK 8, not deferred): the same-day time-window fixture
  uses 01:00Z/09:00Z, which is not the same LOCAL day at UTC-2 or further west —
  reviewer reproduced a failure under TZ=America/New_York — while a comment added
  this round claims the expectations are "timezone-safe on any machine". One-token
  fix (12:00Z/13:00Z). Task 8 edits this file anyway.
Task 7: minor (deferred): listLoading is now exported but read by nobody.
Task 7: minor (deferred): the failure screen gives no pending feedback during retry.
Task 7: minor (deferred): listError is only cleared by a successful fetchMoments, so
  after one failed list fetch a genuinely deleted moment shows "couldn't load"
  instead of not-found for the rest of the session. Conservative, not wrong.

Task 8: review — spec ✅, quality Approved, but one Important listed and therefore
  entering the loop: the lightbox test asserts only that openAt was called once,
  never its arguments, and never clicks a Featured tile — so tile-to-list scoping
  (Featured tile pages the featured strip, not the whole library) is unguarded, and
  Task 9 leans on it. Plan-mandated test design; fixing it fulfils the test's own
  stated intent rather than contradicting the plan.
  Reviewer upheld both implementer deviations: the useLightbox module mock is
  necessary (useLightbox() returns a fresh object literal per call, so the brief's
  vi.spyOn on the test's own copy could never intercept the component's), and the
  strengthened clear-selection test is real. Carried-over TZ fixture fix verified
  under TZ=America/New_York.
Task 8: minor (deferred): PhotosMomentDetail.vue is now 638 lines and Tasks 9/10 add
  three more feature areas to the same file; extracting a grid subcomponent will
  likely be worth it after Task 10. Flag, do not act on it mid-plan.
Task 8: fix round 1/5 (1 addressed, 0 open — lightbox entry-list scoping now
  asserted with disjoint fixtures + specific mutation check; commits fbe99bc..021b759)
Task 8: complete (commits b3d0ad9..021b759, review clean; detail page 32, styles 1075,
  oss 448 on a clean tree, TZ=America/New_York re-verified)
CONTROLLER NOTE: the OSS gate asserts a clean working tree, so an uncommitted ledger
  makes it report 445/448. Commit the ledger before running that gate; do NOT stash
  around it.

Task 9: review (opus) — spec ❌, quality Needs fixes. 3 Important + 5 Minor.
  Important 1: the "no assertion lost" claim failed in exactly one place — the
    picker's old "busy flag resets after failure" case. That guarantee now lives in
    three finally blocks and NO test covers any of them; deleting one leaves a user
    with a permanently disabled "adding…" button and the suite still green.
  Important 2: Step 0 moved the String()-id normalisation from the picker into each
    album page, and the coverage did not follow — the picker test now proves its own
    fixture normalises, not the pages. Numeric ids from the API would stop matching
    string timeline ids and nothing would go red.
  Important 3: the English-comment ruling was applied to the moment side only; all
    six album/picker-side files got new Chinese comments and it titles.
  All four declared deviations UPHELD, each verified against Vue 2's real
    PhotosLibraryPicker: `submitting` is forced by Vue 3 emit discarding return
    values; the function-form submitLabel is the smaller mechanism; both i18n
    omissions are the actual 1:1 reproduction; the re-entrance guard is registered.
  Controller resolved the ⚠️: commit split verified — 143dc0f holds exactly the six
    Step 0 files, b384c00 the four feature files.
Task 9: minor (deferred): picker close now happens before the grid reload rather than
  after it as in Vue 2 — panel closes immediately and grids fill in behind. Arguably
  better; registered only as "close on success", not the timing.
Task 9: minor (deferred): PhotosMomentDetail.vue now 741 lines; Task 10 adds three
  more feature areas. The "extract a grid subcomponent after Task 10" note stands.

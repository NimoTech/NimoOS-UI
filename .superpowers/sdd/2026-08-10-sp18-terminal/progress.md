# SDD ledger — plan: docs/superpowers/plans/2026-08-10-sp18-terminal.md
Task 1: complete (commits 824cf7a..3059619, review clean)
Task 2: complete (commits 3059619..cf45af2, review clean)
Task 3: complete (commits cf45af2..1287ec3, review clean)
Task 4: minor (deferred): submitPassword has no in-flight overlap guard (two concurrent submits share an epoch; older response can overwrite newer) — likely mitigated by view-level disable, re-check at final review
Task 4: fix round 1/5 (1 addressed, 0 open — frozenSeconds reset in teardownTimers; commits 7a0df9a..d9f4f5b)
Task 4: complete (commits 1287ec3..d9f4f5b, review clean)
Task 5: complete (commits d9f4f5b..b8f705c, review clean)
Task 5: minor (deferred): create() success path only indirectly covered via shared run(); stop() clears windows.value=[] (differs from Vue2 v-if hiding) — T7 integration should be aware
Task 6: complete (commits b8f705c..ea31332, review clean; two documented brief deviations judged correct: v-for callback ref fix, @import fallback per brief contingency)
Task 7: complete (commits ea31332..a296741, review clean; full suite 694 files/11191 tests green per implementer)
Task 8: fix round 1/5 (1 addressed, 0 open — oss DELETE→PATCH keeps kvm/terminal gating tests in public tree; commits dac7d40..820cfc4)
Task 8: complete (commits a296741..820cfc4, review clean; note: /terminal has no route guard for non-admins, matching /kvm precedent — forbidden state handles it)
Task 9: minor (deferred): loadSeq guard in TerminalSecuritySection is vestigial (load() called once, no retry path) — inherited from plan code; .term-sec-minutes-row/.term-sec-confirm classes are inert hooks with no style rules — inherited from plan code
Task 9: fix round 1/5 (1 addressed, 0 open — four test descriptions translated to English; commits 35b037a..2f2e88a)
Task 9: complete (commits 820cfc4..2f2e88a, review clean)
Task 10: complete (commits 2f2e88a..ecb4cd5 docs-only, five gates green, review clean)
Final review: 2 Important (submitPassword in-flight guard+submitting disable; JWT-expiry dead-end on lock screen), 3 Minor (retry_after 0-edge, idle activitySince consume-before-send [1:1 Vue2], beforeunload axios [registered best-effort]); T4 deferred minor upgraded to MUST-FIX, T5/T9 minors stay deferred
Final fix wave: 2/2 addressed (submitting in-flight guard + proactive JWT refresh via shouldRefreshToken precedent; commits ecb4cd5..9fa3fa7), scoped re-review clean
Final residual minors parked with rulings: retry_after_seconds ?? vs || 0-edge (contract sends positive ints — stands as written) · idle keepalive consumes activitySince before send (verbatim Vue2, self-heals via 401→lock — stands) · beforeunload DELETE via axios not sendBeacon (registered best-effort in spec §2 boundary ③ — stands)
Branch review CLEAN — ready for finishing-a-development-branch

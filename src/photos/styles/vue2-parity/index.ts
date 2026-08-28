// Vue2-parity pixel source of truth (spec 2026-08-11 §4).
// Copied verbatim from the Vue 2 panel's src/views/Photos/*.scss (frozen baseline
// main=1faa782b). Importing these is inert until a view root carries the
// `.photos-root` class (Plans B-H) — but not every rule is nested under it:
// there are bare top-level class selectors too (e.g. `.tile`, `.toolbar`),
// carried over verbatim from the Vue2 source. Those are pinned to zero
// cross-area intersection with the rest of this app by
// src/styles/class-collision-guard.test.ts, not by CSS nesting — see that
// test for the guard mechanics if you're touching a selector in here.
// photos-upload.scss is intentionally NOT here: upload is removed (spec §6-1).
// photos-smartview.scss IS imported here (plan-C task 1, 2026-08-13 — this
// inverts the 2026-08-12 rationale above it used to carry): photos.scss's
// internal `@import './photos-smartview.scss';` has been deleted, along with
// the duplicate `@keyframes photos-pulse` it caused (see photos.scss:203 for
// the surviving definition and photos-smartview.scss's deletion-site comment
// for the dedupe rationale). dart-sass was emitting a legacy-@import
// deprecation warning for that internal @import; removing it in favor of
// this explicit entry-level import clears the warning while still shipping
// smartview's CSS exactly once in the bundle.
import './photos.scss'
import './photos-people.scss'
import './photos-places.scss'
import './photos-smartview.scss'

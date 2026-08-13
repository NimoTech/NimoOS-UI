// Vue2-parity pixel source of truth (spec 2026-08-11 §4).
// Copied verbatim from NimoOS-UI src/views/Photos/*.scss (frozen baseline
// main=1faa782b). Importing these is inert until a view root carries the
// `.photos-root` class (Plans B-H) — but not every rule is nested under it:
// there are bare top-level class selectors too (e.g. `.tile`, `.toolbar`),
// carried over verbatim from the Vue2 source. Those are pinned to zero
// cross-area intersection with the rest of this app by
// src/styles/class-collision-guard.test.ts, not by CSS nesting — see that
// test for the guard mechanics if you're touching a selector in here.
// photos-upload.scss is intentionally NOT here: upload is removed (spec §6-1).
// photos-smartview.scss is NOT imported here either (fix round 2026-08-12):
// photos.scss pulls in photos-smartview.scss via its own internal @import
// near the end of the file (kept verbatim, unmodified), so importing it
// again here would duplicate its entire compiled CSS output in the bundle.
import './photos.scss'
import './photos-people.scss'
import './photos-places.scss'

// Vue2-parity pixel source of truth (spec 2026-08-11 §4).
// Copied verbatim from NimoOS-UI src/views/Photos/*.scss (frozen baseline
// main=1faa782b). All rules are scoped under `.photos-root`, so importing
// these is inert until a view root carries that class (Plans B-H).
// photos-upload.scss is intentionally NOT here: upload is removed (spec §6-1).
// photos-smartview.scss is NOT imported here either (fix round 2026-08-12):
// photos.scss pulls in photos-smartview.scss via its own internal @import
// near the end of the file (kept verbatim, unmodified), so importing it
// again here would duplicate its entire compiled CSS output in the bundle.
import './photos.scss'
import './photos-people.scss'
import './photos-places.scss'

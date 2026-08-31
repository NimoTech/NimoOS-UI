// Extracted from the verbatim-duplicated 409 check in T5 AlbumPickerDialog.vue (:110-120) and
// T7 PhotosAlbums.vue — the "album create with duplicate name" semantics come up in several
// creation flows (T5's add-to-album panel inline create, T7's album list create, T8's detail
// page rename, T10's save favorites as album), so this was extracted into a shared util instead
// of each of the three/four call sites maintaining its own copy.
//
// Detects 409 (duplicate name): `e?.response?.status === 409` or the message contains 409 — safe
// against unknown exception shapes, doesn't assume e always has a response/message, avoiding a
// secondary throw. The message fallback is pre-existing behavior fixed in T5, kept as-is
// (not a newly added laxness).
export function isConflict(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const response = (e as { response?: unknown }).response
  if (response && typeof response === 'object' && (response as { status?: unknown }).status === 409) {
    return true
  }
  const message = (e as { message?: unknown }).message
  return /\b409\b/.test(String(message ?? ''))
}

// 404 detection, sharing the same shape-tolerance strategy as isConflict.
// Its only use is "set as key photo" — the backend uses 404 specifically to mean "this photo
// has no face for this person", which needs to be distinguished from other failures with a
// different message (per Vue2 PhotosPersonDetail.vue:656-660).
// isConflict already got a word boundary (`/\b409\b/`), aligned here with this
// function's `/\b404\b/` — neither will misjudge a string containing 4090/1409/4040/1404 as a
// conflict/not-found. Traced back to source: isConflict has 5 live call sites
// (AlbumPickerDialog.vue:143, PhotosFavorites.vue:114, PhotosAlbumDetail.vue:204,
// PhotosPersonDetail.vue:484, PhotosAlbums.vue:145), all tightening the "message fallback"
// branch, without affecting the main `response.status === 409` detection path. The
// shape-tolerance strategy (not assuming e always has a response/message) is identical between
// the two — that part really is the same.
export function isNotFound(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const response = (e as { response?: unknown }).response
  if (response && typeof response === 'object' && (response as { status?: unknown }).status === 404) {
    return true
  }
  const message = (e as { message?: unknown }).message
  return /\b404\b/.test(String(message ?? ''))
}

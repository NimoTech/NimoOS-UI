// SP7-P7b-T1: EXIF / gallery filter predicates -- the timeline page and the jump-to-library
// page share the same judgment logic so both sides filter consistently.
// Ported from Vue2 NimoOS-UI src/views/Photos/photosFilterUtils.js (27 lines), logic mapped line-for-line.
//
// D17 / F2 deviation log: dropped Vue2's `archiveIds` parameter and its branch. Grepping back
// to source confirms the whole archive chain is dead (PhotosGrid never emits batch-archive ->
// PhotosTimeline's listener / onBatchArchive / archiveBatch action / ARCHIVE_BATCH mutation are
// unreachable at every step, `archiveIds` is always []); New-UI never ported the archive
// feature, and this repo has zero writers for it. The corresponding archiveIds test cases in
// Vue2's 58-line test file were cut accordingly.
//
// Note the shape of `date`: it isn't an ISO string, it's the localized string that
// assetToPhoto (:336) produces via
// toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric' }) (e.g. "May 1, 2023").
// Vue2 has the same shape from the same source, so the new Date(date) parsing approach is
// copied as-is; don't switch to reading takenAt instead (that's a different field, and the
// behavior would change).

/** Minimal photo shape used for EXIF filtering -- structurally compatible with `Photo` (assetToPhoto.ts:267). */
export interface FilterablePhoto {
  date?: string | null
  place?: string | null
  camera?: string | null
}

export interface ExifFilters {
  years?: string[]
  places?: string[]
  cameras?: string[]
}

export function photoYear(photo: FilterablePhoto | null | undefined): string {
  if (!photo || !photo.date) return ''
  const y = new Date(photo.date).getFullYear()
  return Number.isNaN(y) ? '' : String(y)
}

export function matchesExifFilters(
  photo: FilterablePhoto,
  { years = [], places = [], cameras = [] }: ExifFilters = {},
): boolean {
  if (years.length && !years.includes(photoYear(photo))) return false
  if (places.length && !places.includes((photo.place || '').split(',')[0].trim())) return false
  if (cameras.length && !cameras.includes((photo.camera || '').split('·')[0].trim())) return false
  return true
}

export function applyExifFilters<T extends FilterablePhoto>(
  photos: T[] | null | undefined,
  filters: ExifFilters = {},
): T[] {
  return (photos || []).filter(p => matchesExifFilters(p, filters))
}

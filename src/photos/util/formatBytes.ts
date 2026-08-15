// SP7-P7a-T6: formatMB — storage size formatting for the smart-view detail page's
// stats row (+ T8's four-cell stats grid on the right, not rebuilt). Ported verbatim from Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewDetail.vue:424-428:
//   const mb = (bytes || 0) / (1024 * 1024)
//   if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'
//   return Math.round(mb) + ' MB'
// The unit strings ' GB' / ' MB' are not put into i18n (universally recognized abbreviations, following the precedent set by P6b formatSpotCoords for direction letters).
export function formatMB(bytes: number): string {
  const mb = (bytes || 0) / (1024 * 1024)
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'
  return Math.round(mb) + ' MB'
}

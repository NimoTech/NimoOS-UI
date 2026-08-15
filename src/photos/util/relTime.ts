// Relative-time formatting for the smart view detail page, ported straight from Vue2
// PhotosSmartViewDetail.vue:262-269, but with two fixes (see comments below).

export function relTime(
  iso: string | null | undefined,
  now: number,
  t: (key: string, params?: Record<string, unknown>) => string,
  locale: string,
): string {
  if (!iso) return ''
  const d = new Date(iso)
  // Added guard (deviation logged): Vue2 renders "Invalid Date" to the user for a bad
  // string (new Date('x') → Invalid Date); here a NaN timestamp returns an empty string directly.
  if (Number.isNaN(d.getTime())) return ''
  const diff = (now - d.getTime()) / 1000
  if (diff < 3600) return t('photosSvRelMinutes', { n: Math.max(1, Math.round(diff / 60)) })
  if (diff < 86400) return t('photosSvRelHours', { n: Math.round(diff / 3600) })
  // Fix (deviation logged): Vue2 uses d.toLocaleDateString() with no locale argument ⇒ it
  // follows the browser locale. Here we explicitly pass the i18n locale (per this repo's
  // established convention of converting locale.replace('_','-') to a BCP-47 tag — see the
  // existing precedent at PlacesRail.vue:84 / PlaceDetailPanel.vue:120 / PersonHero.vue:113).
  const tag = locale.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

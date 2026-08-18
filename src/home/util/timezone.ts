/**
 * Formats an IANA zone name as a compact offset badge: `Asia/Shanghai` -> `UTC+8`.
 *
 * Intl's `longOffset` gives `GMT+08:00`; the whole-hour `:00` is dropped and the
 * leading zero trimmed, while half- and quarter-hour zones keep their minutes.
 * The offset is resolved at `at`, so daylight saving is handled by Intl rather
 * than by a table here.
 *
 * Returns null for a zone name Intl rejects, so a caller can hide the badge
 * instead of rendering something wrong.
 */
export function utcOffsetLabel(timeZone: string, at: Date = new Date()): string | null {
  let raw: string | undefined
  try {
    raw = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
  } catch {
    return null // Intl throws RangeError on an unknown or empty zone name
  }
  const m = raw ? /^GMT([+-])(\d{2}):(\d{2})$/.exec(raw) : null
  if (!m) return null
  const [, sign, hh, mm] = m
  const hours = String(Number(hh))
  return mm === '00' ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${mm}`
}

/**
 * Maps to Vue2 WebUIHTTPSModal.vue's formatDate + formattedEffectiveTime/formattedExpirationTime.
 * Verified on this machine: both times are Go's zero value '0001-01-01T00:00:00Z'
 * (no certificate issued) and must display '---'.
 *
 * Porting discipline: Vue2's formatDate relies on try/catch as a safety net, but
 * `new Date('garbage')` does **not** throw -- it returns Invalid Date, so getDate()
 * yields NaN everywhere and the UI shows "NaN/NaN/NaN".
 * Here we explicitly check Number.isNaN.
 */
export function formatSslDate(iso: string | undefined): string {
  if (!iso || iso.startsWith('0001')) return '---'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '---'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

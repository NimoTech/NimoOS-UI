/* Two pure functions for the account tab. Ported from the Vue 2 panel's src/components/account/AccountPanel.vue. */

/** Time formatting for member/authorization rows. 1:1 with Vue2 formatDate (:538-543):
 *  local timezone, `YYYY-MM-DD HH:mm:ss`, each segment zero-padded.
 *  ⚠️ **Do not use dateFmt from this repo's files/util/format.ts** -- that one is Intl
 *  relative format ("Jul 3, 04:05"), different from Vue2's absolute format here;
 *  1:1 UI requires this copy.
 *  🔧 plan C1 correction: Vue2 renders `NaN-NaN-NaN NaN:NaN:NaN` for unparseable
 *  strings; here we fall back to the empty string. */
export function formatMemberDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export type NewMemberError = 'empty' | 'tooShort' | 'mismatch' | null

/** New-member form validation. 1:1 with Vue2 submitAddMember (:493-506) -- the three
 *  checks and their **order**.
 *  🔧 plan C15: Vue2 also registers the same 6-char rule via extend('minPassword') at the
 *  top, but **no ValidationProvider uses it** -> dead code, not ported; only the `< 6`
 *  that actually takes effect here is kept.
 *  The backend enforces 6 chars too (user.go:837-839, success:10013); this front-end
 *  check just saves a round trip. */
export function validateNewMember(username: string, password: string, confirmation: string): NewMemberError {
  if (!username || !password) return 'empty'
  if (password.length < 6) return 'tooShort'
  if (password !== confirmation) return 'mismatch'
  return null
}

/* Pure helpers for avatars. */

/** Read the access_token.
 *  🔧 plan C13: Vue2's avatarUrl is written as
 *  `this.$store.state.token || localStorage.getItem('access_token')`, but the key stored
 *  in Vuex is `access_token` (`state.token` never existed) -- the first operand is always
 *  undefined and the latter has been carrying it all along.
 *  Here we read localStorage directly instead of replicating that dead expression. */
export function readAccessToken(): string | null {
  return localStorage.getItem('access_token')
}

// The two lists from Vue2 onFileSelected (:253-254), copied verbatim (note svg is not on the list).
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']

/** Type gate when picking a local file. 1:1 with Vue2 :255 (passes on a mime hit **or** an extension hit). */
export function isAllowedImageFile(name: string, mime: string): boolean {
  if (ALLOWED_MIMES.includes(mime)) return true
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return ALLOWED_EXTS.includes(name.slice(dot + 1).toLowerCase())
}

// One lookup order for every way a folder listing can fail, so the two paths
// (envelope business failure, which `unwrap` turns into a throw, and a genuine
// transport error) can never drift apart into separately-maintained copies.
//
// `detail` is what unwrap salvages from the envelope's `data` field: on a
// business failure the backend puts the real err.Error() text there and leaves
// `message` as a generic "Fail", so `detail` has to win.
export function folderListErrorMsg(error: unknown): string {
  const e = error as
    | { detail?: unknown; message?: unknown; response?: { data?: { data?: unknown; message?: unknown } } }
    | null
    | undefined
  if (!e) return ''
  if (typeof e.detail === 'string' && e.detail) return e.detail
  const body = e.response?.data
  if (typeof body?.data === 'string' && body.data) return body.data
  if (typeof body?.message === 'string' && body.message) return body.message
  return typeof e.message === 'string' ? e.message : ''
}

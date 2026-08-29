/** Display metadata for app store source URLs (pure function). Naming rules ported from Vue2
 *  AppStoreSourceManagement.vue getSourceList: for http(s) take the first path segment;
 *  for others take the last segment minus extension; if parsing fails, fall back to removing extension.
 *  jsDelivr gh mirror (/gh/<org>/<repo>@ref/…) takes org — first segment is fixed 'gh' with no distinction. */

/** Official source determination = no delete button + "Official" badge (planned D1; Vue2 hides the entire delete list).
 *  Two types: ① NimoTech's own sources (GitHub first path segment NimoTech);
 *  ② Factory default main store — pre-configured in device app-management.conf
 *    cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@… (CasaOS heritage, real device id 0). */
export function isOfficialSource(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const segs = u.pathname.split('/')
    if (segs[1] === 'NimoTech') return true
    return (
      u.hostname === 'cdn.jsdelivr.net' &&
      segs[1] === 'gh' &&
      segs[2] === 'IceWhaleTech' &&
      (segs[3] ?? '').startsWith('CasaOS-AppStore')
    )
  } catch {
    return false
  }
}

export function sourceDisplayName(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const segs = u.pathname.split('/')
      // jsDelivr gh mirror: org is the valid name ('gh' is a fixed route segment)
      if (u.hostname === 'cdn.jsdelivr.net' && segs[1] === 'gh' && segs[2]) return segs[2]
      if (segs[1]) return segs[1]
    }
  } catch {
    /* Non-standard URL falls through to the rule below */
  }
  const last = url.split('/').filter(Boolean).pop() ?? ''
  const noExt = last.replace(/\.[^.]+$/, '')
  return noExt || url
}

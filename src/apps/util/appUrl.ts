export interface WebUrlSource { scheme?: string; hostname?: string | null; port_map?: string; index?: string }

/** Compose the Web UI address of an installed app (scheme/hostname/port_map/index from store_info);
 *  null when there is no page to open (mirrors the judgment in home useStartApp.appUrl). */
export function composeWebUrl(s: WebUrlSource, currentHost: string): string | null {
  const port = (s.port_map || '').trim()
  if (!port && !s.index) return null
  const scheme = s.scheme || 'http'
  const host = s.hostname || currentHost
  return `${scheme}://${host}${port ? ':' + port : ''}${s.index || '/'}`
}

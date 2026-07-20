export interface WebUrlSource { scheme?: string; hostname?: string | null; port_map?: string; index?: string }

/** 已装应用 Web UI 地址(store_info 的 scheme/hostname/port_map/index);
 *  没有可打开页面时 null(镜像 home useStartApp.appUrl 的判定)。 */
export function composeWebUrl(s: WebUrlSource, currentHost: string): string | null {
  const port = (s.port_map || '').trim()
  if (!port && !s.index) return null
  const scheme = s.scheme || 'http'
  const host = s.hostname || currentHost
  return `${scheme}://${host}${port ? ':' + port : ''}${s.index || '/'}`
}

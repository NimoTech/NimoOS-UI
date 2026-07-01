export type DisplayNames = Record<string, string>

export function toVirtualPath(realPath: string, displayNames: DisplayNames): string {
  if (!realPath || !displayNames) return realPath
  const mountPoints = Object.keys(displayNames).sort((a, b) => b.length - a.length)
  for (const mp of mountPoints) {
    if (realPath === mp) return '/' + displayNames[mp]
    if (realPath.startsWith(mp + '/')) return '/' + displayNames[mp] + realPath.slice(mp.length)
  }
  return realPath
}

export function toRealPath(virtualPath: string, displayNames: DisplayNames): string {
  if (!virtualPath || !displayNames) return virtualPath
  const entries = Object.entries(displayNames).sort((a, b) => b[1].length - a[1].length)
  for (const [mp, name] of entries) {
    const prefix = '/' + name
    if (virtualPath === prefix) return mp
    if (virtualPath.startsWith(prefix + '/')) return mp + virtualPath.slice(prefix.length)
  }
  return virtualPath
}

export function virtualPathToRouteParam(virtualPath: string): string {
  if (!virtualPath || virtualPath === '/') return ''
  return virtualPath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')
}

export function routeParamToVirtualPath(param: string | string[] | undefined): string {
  if (!param) return '/'
  const joined = Array.isArray(param) ? param.join('/') : param
  if (!joined) return '/'
  return '/' + joined.replace(/^\/+/, '')
}

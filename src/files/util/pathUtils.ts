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

// 旧格式深链归一(Vue2 utils/pathUtils.js resolveInputPath 同款):输入可能是真实路径
// (/DATA/x、/mnt/smb-y/z)也可能是虚拟路径(/NimoOS-HD/x)。先 toRealPath(虚拟→真实,
// 真实无虚拟前缀可匹配、原样透过)再 toVirtualPath 规范化,两边幂等。
export function resolveInputPath(input: string, displayNames: DisplayNames): { realPath: string; virtualPath: string } {
  if (!input) return { realPath: '/', virtualPath: '/' }
  const realPath = toRealPath(input, displayNames)
  const virtualPath = toVirtualPath(realPath, displayNames)
  return { realPath, virtualPath }
}

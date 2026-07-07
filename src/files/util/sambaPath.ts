export interface SmbPaths { windows: string; mac: string }

export function buildSmbPaths(host: string, name: string): SmbPaths {
  return { windows: `\\\\${host}\\${name}`, mac: `smb://${host}/${name}` }
}

export function getShareHost(): string {
  return window.location.hostname
}

export function shareName(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() || path
}

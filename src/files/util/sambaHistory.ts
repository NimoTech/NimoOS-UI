const KEY = 'nimoos:samba-hosts'

export interface SambaHost {
  host: string
  guest: boolean
  username: string // Store username only, never store password (aligned with Vue2)
}

export function parseAddress(input: string): { protocol: 'smb' | 'nfs' | null; host: string } {
  const m = /^(smb|nfs):\/\/(.+)$/i.exec(input.trim())
  if (!m) return { protocol: null, host: '' }
  return { protocol: m[1].toLowerCase() as 'smb' | 'nfs', host: m[2].split('/')[0] }
}

export function readHosts(): SambaHost[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function addHost(list: SambaHost[], h: SambaHost): SambaHost[] {
  const entry: SambaHost = { host: h.host, guest: h.guest, username: h.guest ? '' : h.username }
  if (list.some((x) => x.host === entry.host && x.guest === entry.guest)) return list
  return [...list, entry]
}

export function writeHosts(list: SambaHost[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* Non-secure context / private mode: ignore */
  }
}

const KEY = 'nimoos:samba-hosts'

export interface SambaHost {
  host: string
  guest: boolean
  username: string // 仅存用户名,绝不存密码(对齐 Vue2)
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
    /* 非安全上下文/隐私模式:忽略 */
  }
}

import { service } from '@nimotech/nimoos-service'

// External link App: pure frontend concept, stored in UserService custom storage (key='link'). The old Vue2 UI
// reads/writes the same key (see the Vue 2 panel's src/mixins/app/Business_LinkApp.js); field names/shape must stay compatible:
// { name, hostname, icon, app_type: 'LinkApp', status: 'running' }.
export interface LinkApp {
  name: string
  hostname: string
  icon: string
  app_type: 'LinkApp'
  status: 'running'
}

interface RawLinkAppLike {
  name?: unknown
  hostname?: unknown
  host?: unknown // legacy field (earlier Vue2 versions)
  icon?: unknown
}

function normalizeOne(raw: unknown): LinkApp | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as RawLinkAppLike
  const name = typeof r.name === 'string' ? r.name : ''
  const hostname = typeof r.hostname === 'string' ? r.hostname
    : typeof r.host === 'string' ? r.host // legacy field migration: host → hostname
      : ''
  if (!name || !hostname) return null
  const icon = typeof r.icon === 'string' ? r.icon : ''
  // The legacy app_type/status fields (type/state) were historically always 'LinkApp'/'running', so they collapse into literal types;
  // no need to preserve old values — that is the entire meaning of the type→app_type, state→status migration.
  return { name, hostname, icon, app_type: 'LinkApp', status: 'running' }
}

/** Tolerates ""/null/array/JSON string (observed: an empty key has data=""); normalizes legacy fields per item, dedupes by name (first wins),
 *  entries missing name/hostname are dropped. */
export function parseLinkApps(raw: unknown): LinkApp[] {
  let data: unknown = raw
  if (typeof data === 'string') {
    const trimmed = data.trim()
    if (!trimmed) return []
    try { data = JSON.parse(trimmed) } catch { return [] }
  }
  if (!Array.isArray(data)) return []
  const seen = new Set<string>()
  const out: LinkApp[] = []
  for (const item of data) {
    const n = normalizeOne(item)
    if (!n || seen.has(n.name)) continue
    seen.add(n.name)
    out.push(n)
  }
  return out
}

export async function listLinkApps(): Promise<LinkApp[]> {
  try {
    const raw = await service.users.getCustomStorage('link')
    return parseLinkApps(raw)
  } catch {
    return []
  }
}

/** Fetch current list → replace hostname/icon on name match, otherwise append → persist → return the new list (same semantics as Vue2 connect()). */
export async function saveLinkApp(item: { name: string; hostname: string; icon: string }): Promise<LinkApp[]> {
  const list = await listLinkApps()
  let found = false
  const next = list.map((l) => {
    if (l.name !== item.name) return l
    found = true
    return { ...l, hostname: item.hostname, icon: item.icon }
  })
  if (!found) {
    next.push({ name: item.name, hostname: item.hostname, icon: item.icon, app_type: 'LinkApp', status: 'running' })
  }
  await service.users.setCustomStorage('link', next)
  return next
}

export async function deleteLinkApp(name: string): Promise<LinkApp[]> {
  const list = await listLinkApps()
  const next = list.filter((l) => l.name !== name)
  await service.users.setCustomStorage('link', next)
  return next
}

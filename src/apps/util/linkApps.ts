import { service } from '@nimotech/nimoos-service'

// 外部链接 App:纯前端概念,存在 UserService custom storage(key='link')。旧 Vue2 UI
// 读写同一个 key(见 NimoOS-UI/src/mixins/app/Business_LinkApp.js),字段名/形状必须兼容:
// { name, hostname, icon, app_type: 'LinkApp', status: 'running' }。
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
  host?: unknown // 旧字段(Vue2 更早版本)
  icon?: unknown
}

function normalizeOne(raw: unknown): LinkApp | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as RawLinkAppLike
  const name = typeof r.name === 'string' ? r.name : ''
  const hostname = typeof r.hostname === 'string' ? r.hostname
    : typeof r.host === 'string' ? r.host // 旧字段迁移:host → hostname
      : ''
  if (!name || !hostname) return null
  const icon = typeof r.icon === 'string' ? r.icon : ''
  // app_type/status 旧字段(type/state)历史上恒等于 'LinkApp'/'running',直接落成字面量类型,
  // 无需保留旧值——这就是 type→app_type、state→status 迁移的全部含义。
  return { name, hostname, icon, app_type: 'LinkApp', status: 'running' }
}

/** 容忍 ""/null/数组/JSON 字符串(实证:空 key data="");逐项归一化旧字段,按 name 去重(先到先得),
 *  缺 name/hostname 的条目丢弃。 */
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

/** 拉现有列表 → 同名替换 hostname/icon,否则追加 → 落盘 → 返回新列表(与 Vue2 connect() 语义一致)。 */
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

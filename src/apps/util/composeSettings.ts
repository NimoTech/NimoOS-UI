import YAML from 'yaml'
import { resolveAppText } from './appTitle'

export interface PortRow { published: string; target: string; protocol: 'tcp' | 'udp'; hostIp?: string }
export interface PairRow { a: string; b: string }
export interface ServiceModel {
  name: string; image: string
  environment: PairRow[]      // a=KEY b=VALUE
  ports: PortRow[]
  volumes: PairRow[]          // a=host(source) b=container(target)
  devices: PairRow[]          // a=host b=container
  privileged: boolean; capAdd: string[]
  restart: string             // 'unless-stopped' | 'always' | 'on-failure'
  containerName: string
  cpuShares: number           // 10 | 50 | 90(归一化)
  memoryMB: number | null     // limits.memory;null=未设限
}
export interface WebUiModel { titleCustom: string; icon: string; scheme: 'http' | 'https'; hostname: string; portMap: string; index: string }
export interface SettingsModel {
  services: ServiceModel[]; webui: WebUiModel; tipsCustom: string; extKey: 'x-nimoos' | 'x-casaos'
  /** true = tips.custom 缺省时借 before_install 回落文案预填 tipsCustom(仅用于预填 UI,不代表用户已确认此文案要落盘) */
  tipsFromFallback: boolean
}

export const RESTART_OPTIONS = ['unless-stopped', 'always', 'on-failure']
export const CPU_OPTIONS = [
  { value: 10, labelKey: 'appsSettingsCpuLow' },
  { value: 50, labelKey: 'appsSettingsCpuMedium' },
  { value: 90, labelKey: 'appsSettingsCpuHigh' },
]

export const CAP_OPTIONS = [
  'AUDIT_CONTROL',
  'AUDIT_READ',
  'BLOCK_SUSPEND',
  'BPF',
  'CHECKPOINT_RESTORE',
  'DAC_READ_SEARCH',
  'IPC_LOCK',
  'IPC_OWNER',
  'LEASE',
  'LINUX_IMMUTABLE',
  'MAC_ADMIN',
  'MAC_OVERRIDE',
  'NET_ADMIN',
  'NET_BROADCAST',
  'PERFMON',
  'SYS_ADMIN',
  'SYS_BOOT',
  'SYS_MODULE',
  'SYS_NICE',
  'SYS_PACCT',
  'SYS_PTRACE',
  'SYS_RAWIO',
  'SYS_RESOURCE',
  'SYS_TIME',
  'SYS_TTY_CONFIG',
  'SYSLOG',
  'WAKE_ALARM',
]

export function parseMemoryToMB(v: unknown): number | null {
  if (v == null || v === '') return null
  const m = /^(\d+(?:\.\d+)?)\s*([kmgt])?i?b?$/i.exec(String(v).trim())
  if (!m) return null
  const n = parseFloat(m[1])
  const unit = (m[2] ?? '').toLowerCase()
  if (!unit) return Math.round(n / 1024 / 1024) // 裸数字=字节(compose-go UnitBytes 序列化格式)
  const factor = { k: 1 / 1024, m: 1, g: 1024, t: 1024 * 1024 }[unit as 'k' | 'm' | 'g' | 't']
  return Math.round(n * factor)
}

type Dict = Record<string, unknown>
const asDict = (v: unknown): Dict => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {})

function parsePortEntry(p: unknown): PortRow | null {
  if (p && typeof p === 'object') {
    const o = p as Dict // compose 长语法
    const target = o.target != null ? String(o.target).split('-')[0] : ''
    const published = o.published != null ? String(o.published).split('-')[0] : target
    if (!target) return null
    const proto = String(o.protocol ?? 'tcp').toLowerCase() === 'udp' ? 'udp' : 'tcp'
    return { published, target, protocol: proto, ...(o.host_ip ? { hostIp: String(o.host_ip) } : {}) }
  }
  // 短语法 [ip:]published[-range]:target[-range][/proto](range 取首段,Vue2 同行为)
  const m = /^(?:(\d{1,3}(?:\.\d{1,3}){3}):)?([\d-]+):([\d-]+)(?:\/(tcp|udp))?$/i.exec(String(p).trim())
  if (!m) return null
  return {
    published: m[2].split('-')[0], target: m[3].split('-')[0],
    protocol: (m[4]?.toLowerCase() as 'tcp' | 'udp') ?? 'tcp',
    ...(m[1] ? { hostIp: m[1] } : {}),
  }
}

function parseService(name: string, raw: Dict): ServiceModel {
  const envRaw = raw.environment
  const environment: PairRow[] = Array.isArray(envRaw)
    ? envRaw.map((e) => { const i = String(e).indexOf('='); return i < 0 ? { a: String(e), b: '' } : { a: String(e).slice(0, i), b: String(e).slice(i + 1) } })
    : Object.entries(asDict(envRaw)).map(([a, b]) => ({ a, b: b == null ? '' : String(b) }))
  const ports = (Array.isArray(raw.ports) ? raw.ports : []).map(parsePortEntry).filter((x): x is PortRow => !!x)
  const volumes: PairRow[] = (Array.isArray(raw.volumes) ? raw.volumes : []).map((v) => {
    if (v && typeof v === 'object') { const o = v as Dict; return { a: String(o.source ?? ''), b: String(o.target ?? '') } }
    const parts = String(v).split(':'); return { a: parts[0] ?? '', b: parts[1] ?? '' } // :ro 等 flag 丢弃(Vue2 同行为)
  }).filter((r) => r.a || r.b)
  const devices: PairRow[] = (Array.isArray(raw.devices) ? raw.devices : []).map((d) => {
    const parts = String(d).split(':'); return { a: parts[0] ?? '', b: parts[1] ?? parts[0] ?? '' }
  })
  const restartRaw = String(raw.restart ?? '')
  const cpuRaw = Number(raw.cpu_shares)
  const deploy = asDict(asDict(asDict(raw.deploy).resources).limits)
  return {
    name,
    image: String(raw.image ?? ''),
    environment, ports, volumes, devices,
    privileged: raw.privileged === true,
    capAdd: Array.isArray(raw.cap_add) ? raw.cap_add.map(String) : [],
    restart: !restartRaw || restartRaw === 'no' ? 'unless-stopped' : restartRaw,
    containerName: String(raw.container_name ?? ''),
    cpuShares: !cpuRaw || cpuRaw > 99 ? 90 : cpuRaw, // Vue2 归一化(ComposeConfig.vue:550-559)
    memoryMB: parseMemoryToMB(deploy.memory),
  }
}

export function parseSettings(yamlText: string, lang: string): SettingsModel {
  const doc = asDict(YAML.parse(yamlText))
  const services = Object.entries(asDict(doc.services)).map(([n, s]) => parseService(n, asDict(s)))
  const extKey: SettingsModel['extKey'] = !doc['x-nimoos'] && doc['x-casaos'] ? 'x-casaos' : 'x-nimoos'
  const ext = asDict(doc['x-nimoos'] ?? doc['x-casaos'])
  const tips = asDict(ext.tips)
  const title = asDict(ext.title)
  const hasCustomTip = typeof tips.custom === 'string' && tips.custom
  const fallbackTip = resolveAppText(tips.before_install as Record<string, string> | undefined, lang, '')
  return {
    services,
    webui: {
      titleCustom: String(title.custom ?? ''),
      icon: String(ext.icon ?? ''),
      scheme: ext.scheme === 'https' ? 'https' : 'http',
      hostname: String(ext.hostname ?? ''),
      portMap: String(ext.port_map ?? ''),
      index: String(ext.index ?? ''),
    },
    tipsCustom: hasCustomTip ? (tips.custom as string) : fallbackTip,
    tipsFromFallback: !hasCustomTip && !!fallbackTip,
    extKey,
  }
}

export function buildYaml(originalYaml: string, model: SettingsModel): string {
  const doc = asDict(YAML.parse(originalYaml))
  const services = asDict(doc.services)
  for (const sm of model.services) {
    const svc = asDict(services[sm.name])
    if (!Object.keys(svc).length && !services[sm.name]) continue // 原 YAML 没有的服务不凭空造
    if (sm.image.trim()) svc.image = sm.image.trim()
    svc.environment = sm.environment.filter((r) => r.a.trim()).map((r) => `${r.a.trim()}=${r.b}`)
    svc.ports = sm.ports
      .filter((r) => r.published.trim() && r.target.trim())
      .map((r) => ({ target: Number(r.target), published: String(r.published), protocol: r.protocol, ...(r.hostIp ? { host_ip: r.hostIp } : {}) }))
    svc.volumes = sm.volumes.filter((r) => r.a.trim() && r.b.trim()).map((r) => ({ type: 'bind', source: r.a.trim(), target: r.b.trim() }))
    const devs = sm.devices.filter((r) => r.a.trim() && r.b.trim()).map((r) => `${r.a.trim()}:${r.b.trim()}`)
    if (devs.length) svc.devices = devs; else delete svc.devices
    if (sm.privileged) svc.privileged = true; else delete svc.privileged
    if (sm.capAdd.length) svc.cap_add = [...sm.capAdd]; else delete svc.cap_add
    svc.restart = sm.restart
    if (sm.containerName.trim()) svc.container_name = sm.containerName.trim(); else delete svc.container_name
    svc.cpu_shares = sm.cpuShares
    const deploy = asDict(svc.deploy); const resources = asDict(deploy.resources); const limits = asDict(resources.limits)
    if (sm.memoryMB && sm.memoryMB > 0) {
      limits.memory = `${Math.round(sm.memoryMB)}M`
      resources.limits = limits; deploy.resources = resources; svc.deploy = deploy
    } else {
      delete limits.memory
      if (!Object.keys(limits).length) delete resources.limits
      if (Object.keys(resources).length) { deploy.resources = resources; svc.deploy = deploy }
      else { delete deploy.resources; if (Object.keys(deploy).length) svc.deploy = deploy; else delete svc.deploy }
    }
    services[sm.name] = svc
  }
  doc.services = services
  const ext = asDict(doc[model.extKey])
  const w = model.webui
  if (w.titleCustom.trim()) ext.title = { ...asDict(ext.title), custom: w.titleCustom.trim() }
  if (w.icon.trim()) ext.icon = w.icon.trim(); else delete ext.icon
  ext.scheme = w.scheme
  if (w.hostname.trim()) ext.hostname = w.hostname.trim(); else delete ext.hostname
  if (w.portMap.trim()) ext.port_map = w.portMap.trim(); else delete ext.port_map
  if (w.index.trim()) ext.index = w.index.trim(); else delete ext.index
  const tips = asDict(ext.tips)
  if (model.tipsCustom.trim()) tips.custom = model.tipsCustom
  else delete tips.custom
  if (Object.keys(tips).length) ext.tips = tips
  doc[model.extKey] = ext
  return YAML.stringify(doc)
}

export function minMemoryMB(yamlText: string, appId: string): number | null {
  try {
    const doc = asDict(YAML.parse(yamlText))
    const services = asDict(doc.services)
    const svc = asDict(services[appId] ?? services[Object.keys(services)[0] ?? ''])
    const mem = asDict(asDict(asDict(svc.deploy).resources).reservations).memory
    const mb = parseMemoryToMB(mem)
    return mb && mb > 0 ? mb : null
  } catch { return null }
}

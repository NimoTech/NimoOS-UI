import YAML from 'yaml'
import { resolveAppText } from './appTitle'

export interface PortRow { published: string; target: string; protocol: 'tcp' | 'udp'; hostIp?: string }
export interface PairRow { a: string; b: string }
export interface ServiceModel {
  name: string; image: string
  environment: PairRow[]      // a=KEY b=VALUE
  ports: PortRow[]
  portsExtra: unknown[]       // raw ports entries the form cannot recognize; passed through as-is
  volumes: PairRow[]          // a=host(source) b=container(target)
  devices: PairRow[]          // a=host b=container
  privileged: boolean; capAdd: string[]
  restart: string             // 'unless-stopped' | 'always' | 'on-failure'
  containerName: string
  cpuShares: number           // 10 | 50 | 90 (normalized)
  memoryMB: number | null     // limits.memory; null = no limit set
  commandTokens: string[]     // command shown token by token; array → one per item, string → conservative single token
  commandDirty: boolean       // set true only when a token is edited/added/removed; when false buildYaml leaves command untouched
  commandWasString: boolean   // command was string syntax in the original YAML; keep string form when a single token remains after editing (P6 conservative fix)
  network: string             // network_mode takes priority, else first key/element of networks, defaults to ''
  networkDirty: boolean       // set true only when the network dropdown is edited; when false buildYaml leaves network_mode/networks untouched
  networksMultiple: boolean   // service has >1 networks attached; form dropdown disabled, buildYaml double-guards against writing back (P6: prevent silently collapsing to a single network)
}
export interface WebUiModel { titleCustom: string; icon: string; scheme: 'http' | 'https'; hostname: string; portMap: string; index: string }
export interface SettingsModel {
  services: ServiceModel[]; webui: WebUiModel; tipsCustom: string; extKey: 'x-nimoos' | 'x-casaos'
  /** true = tips.custom was absent and tipsCustom was prefilled from the before_install fallback text (UI prefill only; does not mean the user confirmed persisting this text) */
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
  if (!unit) return Math.round(n / 1024 / 1024) // bare number = bytes (compose-go UnitBytes serialization format)
  const factor = { k: 1 / 1024, m: 1, g: 1024, t: 1024 * 1024 }[unit as 'k' | 'm' | 'g' | 't']
  return Math.round(n * factor)
}

type Dict = Record<string, unknown>
const asDict = (v: unknown): Dict => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {})

type PortParse = { row: PortRow } | { extra: unknown }
const SINGLE_PORT = /^\d+$/

function classifyPortEntry(p: unknown): PortParse {
  if (p && typeof p === 'object') {
    const o = p as Dict
    const t = o.target != null ? String(o.target) : ''
    const pub = o.published != null ? String(o.published) : t
    // `mode: ingress` is a default value always present in compose-go-normalized GET yaml (every port of store apps has it),
    // semantically equal to omission, so treat it as a recognized key (omitting on rebuild = same meaning); `mode: host` differs semantically and stays in pass-through.
    const extras = Object.keys(o).filter((k) => !['target', 'published', 'protocol', 'host_ip'].includes(k) && !(k === 'mode' && o.mode === 'ingress'))
    const protoRaw = o.protocol != null ? String(o.protocol).toLowerCase() : ''
    // protocol explicitly set to a non-tcp/udp value (e.g. sctp) → not editable, pass through as-is (consistent with the short-syntax regex only accepting tcp|udp).
    if (protoRaw && protoRaw !== 'tcp' && protoRaw !== 'udp') return { extra: p }
    if (SINGLE_PORT.test(t) && SINGLE_PORT.test(pub) && !extras.length) {
      const proto = protoRaw === 'udp' ? 'udp' : 'tcp'
      return { row: { published: pub, target: t, protocol: proto, ...(o.host_ip ? { hostIp: String(o.host_ip) } : {}) } }
    }
    return { extra: p } // long-syntax range / mode:host and other irregular forms → pass through as-is
  }
  const m = /^(?:(\d{1,3}(?:\.\d{1,3}){3}):)?(\d+):(\d+)(?:\/(tcp|udp))?$/i.exec(String(p).trim())
  if (!m) return { extra: p } // bare port "3000", range "a-b:a-b", other irregular forms → pass through as-is
  return { row: { published: m[2], target: m[3], protocol: (m[4]?.toLowerCase() as 'tcp' | 'udp') ?? 'tcp', ...(m[1] ? { hostIp: m[1] } : {}) } }
}

function parseService(name: string, raw: Dict): ServiceModel {
  const envRaw = raw.environment
  const environment: PairRow[] = Array.isArray(envRaw)
    ? envRaw.map((e) => { const i = String(e).indexOf('='); return i < 0 ? { a: String(e), b: '' } : { a: String(e).slice(0, i), b: String(e).slice(i + 1) } })
    : Object.entries(asDict(envRaw)).map(([a, b]) => ({ a, b: b == null ? '' : String(b) }))
  const ports: PortRow[] = []
  const portsExtra: unknown[] = []
  for (const p of Array.isArray(raw.ports) ? raw.ports : []) {
    const r = classifyPortEntry(p)
    if ('row' in r) ports.push(r.row); else portsExtra.push(r.extra)
  }
  const volumes: PairRow[] = (Array.isArray(raw.volumes) ? raw.volumes : []).map((v) => {
    if (v && typeof v === 'object') { const o = v as Dict; return { a: String(o.source ?? ''), b: String(o.target ?? '') } }
    const parts = String(v).split(':'); return { a: parts[0] ?? '', b: parts[1] ?? '' } // flags like :ro are dropped (same behavior as Vue2)
  }).filter((r) => r.a || r.b)
  const devices: PairRow[] = (Array.isArray(raw.devices) ? raw.devices : []).map((d) => {
    const parts = String(d).split(':'); return { a: parts[0] ?? '', b: parts[1] ?? parts[0] ?? '' }
  })
  const restartRaw = String(raw.restart ?? '')
  const cpuRaw = Number(raw.cpu_shares)
  const deploy = asDict(asDict(asDict(raw.deploy).resources).limits)
  const cmdRaw = raw.command
  const commandWasString = !Array.isArray(cmdRaw) && cmdRaw != null && cmdRaw !== ''
  const commandTokens: string[] = Array.isArray(cmdRaw)
    ? cmdRaw.map(String)
    : (cmdRaw != null && cmdRaw !== '' ? [String(cmdRaw)] : [])
  const networkMode = raw.network_mode != null ? String(raw.network_mode) : ''
  let network = networkMode
  const netsRaw = raw.networks
  const netCount = Array.isArray(netsRaw) ? netsRaw.length : Object.keys(asDict(netsRaw)).length
  const networksMultiple = netCount > 1
  if (!network) {
    if (Array.isArray(netsRaw)) network = netsRaw.length ? String(netsRaw[0]) : ''
    else network = Object.keys(asDict(netsRaw))[0] ?? ''
  }
  return {
    name,
    image: String(raw.image ?? ''),
    environment, ports, portsExtra, volumes, devices,
    privileged: raw.privileged === true,
    capAdd: Array.isArray(raw.cap_add) ? raw.cap_add.map(String) : [],
    restart: !restartRaw || restartRaw === 'no' ? 'unless-stopped' : restartRaw,
    containerName: String(raw.container_name ?? ''),
    cpuShares: !cpuRaw || cpuRaw > 99 ? 90 : cpuRaw, // Vue2 normalization (ComposeConfig.vue:550-559)
    memoryMB: parseMemoryToMB(deploy.memory),
    commandTokens, commandDirty: false, commandWasString,
    network, networkDirty: false, networksMultiple,
  }
}

const NETWORK_MODE_VALUES = new Set(['host', 'bridge', 'none'])

/** Rewrite the tag segment of image: if the part after the last colon contains '/', it is registry:port rather than a tag, so append; otherwise replace that segment (adjacent to Vue2 patchNetworkValue, but this is tag, not network). */
export function rewriteImageTag(image: string, tag: string): string {
  const i = image.lastIndexOf(':')
  if (i < 0) return `${image}:${tag}`
  const after = image.slice(i + 1)
  if (after.includes('/')) return `${image}:${tag}`
  return `${image.slice(0, i)}:${tag}`
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
    if (!Object.keys(svc).length && !services[sm.name]) continue // never fabricate a service absent from the original YAML
    if (sm.image.trim()) svc.image = sm.image.trim()
    svc.environment = sm.environment.filter((r) => r.a.trim()).map((r) => `${r.a.trim()}=${r.b}`)
    svc.ports = [
      ...sm.ports
        .filter((r) => r.published.trim() && r.target.trim())
        .map((r) => ({ target: Number(r.target), published: String(r.published), protocol: r.protocol, ...(r.hostIp ? { host_ip: r.hostIp } : {}) })),
      ...sm.portsExtra, // entries the form cannot recognize are written back as-is
    ]
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
    if (sm.commandDirty) {
      if (!sm.commandTokens.length) delete svc.command
      else if (sm.commandWasString && sm.commandTokens.length === 1) svc.command = sm.commandTokens[0]
      else svc.command = [...sm.commandTokens]
    }
    if (sm.networkDirty && !sm.networksMultiple) {
      delete svc.network_mode
      delete svc.networks
      if (sm.network) {
        if (NETWORK_MODE_VALUES.has(sm.network)) {
          svc.network_mode = sm.network
        } else {
          svc.networks = [sm.network]
          const topNetworks = asDict(doc.networks)
          if (!topNetworks[sm.network]) topNetworks[sm.network] = { external: false, name: sm.network }
          doc.networks = topNetworks
        }
      }
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

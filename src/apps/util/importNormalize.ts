import YAML from 'yaml'
import composerize from 'composerize'

type Dict = Record<string, unknown>
const asDict = (v: unknown): Dict => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {})

/** Lowercase + replace non-[a-z0-9-] chars with '-' + collapse consecutive '-' + trim leading/trailing '-'. */
function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Short image name: strip digest (@sha256:...) and tag, then take the segment after the last '/'. */
function shortImageName(image: string): string {
  let img = image.split('@')[0] ?? ''
  const lastSlash = img.lastIndexOf('/')
  const lastColon = img.lastIndexOf(':')
  if (lastColon > lastSlash) img = img.slice(0, lastColon)
  return img.slice(img.lastIndexOf('/') + 1)
}

/** First parseable single host-side published port in the first service (short/long syntax); returns '' if none found.
 *  Range/bare-port entries yield no definite host port and are skipped. */
function firstPublishedPort(doc: Dict): string {
  const services = asDict(doc.services)
  const firstSvc = asDict(Object.values(services)[0])
  for (const p of Array.isArray(firstSvc.ports) ? firstSvc.ports : []) {
    if (p && typeof p === 'object') {
      const pub = String((p as Dict).published ?? '')
      if (/^\d+$/.test(pub)) return pub
    } else {
      const m = /^(?:\d{1,3}(?:\.\d{1,3}){3}:)?(\d+):\d+(?:\/(?:tcp|udp))?$/i.exec(String(p).trim())
      if (m) return m[1]!
    }
  }
  return ''
}

/** Name derivation cascade: top-level name → first usable service key → short image name of first service → 'app' fallback. */
function deriveRawName(doc: Dict): string {
  if (typeof doc.name === 'string' && doc.name.trim()) return doc.name.trim()
  const services = asDict(doc.services)
  // container_name takes priority over the service key: for docker run imports the user's --name
  // lands in container_name, while composerize's service key is just the image name (nginx etc.).
  const firstSvc = asDict(Object.values(services)[0])
  const cname = typeof firstSvc.container_name === 'string' ? firstSvc.container_name.trim() : ''
  if (cname) return cname
  const keys = Object.keys(services).filter((k) => k.trim())
  if (keys.length) return keys[0]!
  const image = typeof firstSvc.image === 'string' ? firstSvc.image : ''
  if (image) return shortImageName(image)
  return 'app'
}

/** Valid compose project name (same rule as backend compose-go): invalid names get normalized
 *  separately by the backend, mismatching the frontend progress-tracking key → ghost 0% card. */
const VALID_COMPOSE_NAME = /^[a-z0-9][a-z0-9_-]*$/

export function ensureComposeMeta(yamlText: string): { yaml: string; name: string } {
  const doc = asDict(YAML.parse(yamlText))
  // The returned name must strictly match the top-level name written into the YAML (it is the
  // backend install name, the event app:name, and the frontend track key all at once).
  // Present and valid → use as-is; missing/invalid → derive + slugify and write back.
  const existing = typeof doc.name === 'string' ? doc.name.trim() : ''
  const name = VALID_COMPOSE_NAME.test(existing) ? existing : slugify(deriveRawName(doc)) || 'app'
  doc.name = name

  const extKey: 'x-nimoos' | 'x-casaos' = !doc['x-nimoos'] && doc['x-casaos'] ? 'x-casaos' : 'x-nimoos'
  const ext = asDict(doc[extKey])
  const title = asDict(ext.title)
  if (typeof title.custom !== 'string' || !title.custom) title.custom = name
  if (typeof title.en_us !== 'string' || !title.en_us) title.en_us = name
  ext.title = title
  // Do not inject icon: the icon.nimoos.io domain does not exist (Vue2 legacy dead link,
  // ERR_NAME_NOT_RESOLVED), injecting only yields a broken image; when icon is missing the
  // tile/card falls back to the default glyph. User-provided icons are kept as-is.
  // Inject port_map: desktop/installed list uses it to build the "Open" URL (appUrl without port and index means no action).
  if (typeof ext.port_map !== 'string' || !ext.port_map) {
    const port = firstPublishedPort(doc)
    if (port) ext.port_map = port
  }
  doc[extKey] = ext

  return { yaml: YAML.stringify(doc), name }
}

/**
 * Verbatim port of the Vue2 keyword mapping; the actual call site is
 * the Vue 2 panel's `src/components/Apps/ComposeConfig.vue:585-608` (ImportPanel.vue has an identical copy).
 * **Verbatim** includes casing: apart from config/download/pictures/photo/media, the original only
 * lists a few case variants for the tv series and the movie/music series (`['tvshows','TV','tv']`,
 * `['movies','Movie','movie']`, `['Music','music']`) — it is not globally case-insensitive.
 * So we do a case-sensitive `includes` per keyword and do NOT toLowerCase() containerPath.
 * Preserve its forEach last-match-wins semantics: a later keyword hit in the array overrides an earlier one
 * (e.g. `/media/config` matches both config and media and ends up as media — a deliberately preserved
 * quirk of the original, not a bug).
 */
export function volumeAutoCheck(containerPath: string, appName: string): string {
  const checkOrder: { keywords: string[]; value: string }[] = [
    { keywords: ['config'], value: `/DATA/AppData/${appName}${containerPath}` },
    { keywords: ['tvshows', 'TV', 'tv'], value: '/DATA/Media/TV Shows' },
    { keywords: ['movies', 'Movie', 'movie'], value: '/DATA/Media/Movies' },
    { keywords: ['Music', 'music'], value: '/DATA/Media/Music' },
    { keywords: ['download'], value: '/DATA/Downloads' },
    { keywords: ['pictures', 'photo'], value: '/DATA/Gallery' },
    { keywords: ['media'], value: '/DATA/Media' },
  ]
  let result = `/DATA/AppData/${appName}${containerPath}`
  for (const item of checkOrder) {
    if (item.keywords.some((k) => containerPath.includes(k))) result = item.value
  }
  return result
}

function needsRewrite(source: string): boolean {
  return !source.startsWith('/')
}

/** Short-syntax string entry: "source:target[:mode]" or bare "target" (anonymous volume, no source). */
function rewriteShortVolume(entry: string, appName: string): string {
  const parts = entry.split(':')
  if (parts.length === 1) {
    // Bare path = anonymous volume, no source
    const target = parts[0] ?? ''
    return `${volumeAutoCheck(target, appName)}:${target}`
  }
  const [source, target, ...rest] = parts
  if (source && !needsRewrite(source)) return entry // leave absolute paths untouched
  const newSource = volumeAutoCheck(target ?? '', appName)
  return [newSource, target, ...rest].join(':')
}

const REWRITABLE_VOLUME_TYPES = new Set([undefined, 'bind', 'volume'])

/** Non-bind/volume types like tmpfs/npipe/cluster have no real host source concept — pass through as-is, never inject source. */
function rewriteLongVolume(entry: Dict, appName: string): Dict {
  const type = typeof entry.type === 'string' ? entry.type : undefined
  if (!REWRITABLE_VOLUME_TYPES.has(type)) return entry
  const source = typeof entry.source === 'string' ? entry.source : ''
  const target = typeof entry.target === 'string' ? entry.target : ''
  if (source && !needsRewrite(source)) return entry
  return { ...entry, type: 'bind', source: volumeAutoCheck(target, appName) }
}

export function normalizeVolumes(yamlText: string, appName: string): string {
  const doc = asDict(YAML.parse(yamlText))
  const services = asDict(doc.services)

  for (const key of Object.keys(services)) {
    const svc = asDict(services[key])
    const volumes = svc.volumes
    if (!Array.isArray(volumes)) continue
    svc.volumes = volumes.map((v) => {
      if (v && typeof v === 'object') return rewriteLongVolume(v as Dict, appName)
      return rewriteShortVolume(String(v), appName)
    })
    services[key] = svc
  }
  doc.services = services

  // Clean up named volume declarations in top-level volumes: no longer referenced by any service.
  const topVolumes = asDict(doc.volumes)
  if (Object.keys(topVolumes).length) {
    const referenced = new Set<string>()
    for (const key of Object.keys(services)) {
      const svc = asDict(services[key])
      for (const v of Array.isArray(svc.volumes) ? svc.volumes : []) {
        if (v && typeof v === 'object') {
          const src = (v as Dict).source
          if (typeof src === 'string') referenced.add(src)
        } else {
          const src = String(v).split(':')[0]
          if (src) referenced.add(src)
        }
      }
    }
    const kept: Dict = {}
    for (const key of Object.keys(topVolumes)) {
      if (referenced.has(key)) kept[key] = topVolumes[key]
    }
    if (Object.keys(kept).length) doc.volumes = kept
    else delete doc.volumes
  }

  return YAML.stringify(doc)
}

/** composerize is CJS (module.exports = fn); with esModuleInterop just use it as the default export — behavior is locked in by tests. */
export function dockerRunToCompose(cmd: string): string {
  const cleaned = cmd.replace(/`#.*?`/g, '').replace(/#.*$/gm, '').trim()
  const out = composerize(cleaned)
  // composerize always emits the placeholder `name: <your project name>` at the top (template text, not user intent).
  // Strip it so ensureComposeMeta's derivation cascade takes over (container_name = the user's --name wins).
  const doc = asDict(YAML.parse(out))
  if (typeof doc.name === 'string' && /^<.*>$/.test(doc.name.trim())) {
    delete doc.name
    return YAML.stringify(doc)
  }
  return out
}

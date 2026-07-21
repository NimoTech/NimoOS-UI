import YAML from 'yaml'
import composerize from 'composerize'

type Dict = Record<string, unknown>
const asDict = (v: unknown): Dict => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {})

/** 小写化 + 非 [a-z0-9-] 字符替换为 '-' + 折叠连续 '-' + 去首尾 '-'。 */
function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** image 短名:去掉 digest(@sha256:...)与 tag,再取最后一个 '/' 之后的段。 */
function shortImageName(image: string): string {
  let img = image.split('@')[0] ?? ''
  const lastSlash = img.lastIndexOf('/')
  const lastColon = img.lastIndexOf(':')
  if (lastColon > lastSlash) img = img.slice(0, lastColon)
  return img.slice(img.lastIndexOf('/') + 1)
}

/** name 派生级联:顶层 name → 首个可用 service key → 首个 service 的 image 短名 → 'app' 兜底。 */
function deriveRawName(doc: Dict): string {
  if (typeof doc.name === 'string' && doc.name.trim()) return doc.name.trim()
  const services = asDict(doc.services)
  const keys = Object.keys(services).filter((k) => k.trim())
  if (keys.length) return keys[0]!
  const firstSvc = asDict(Object.values(services)[0])
  const image = typeof firstSvc.image === 'string' ? firstSvc.image : ''
  if (image) return shortImageName(image)
  return 'app'
}

export function ensureComposeMeta(yamlText: string): { yaml: string; name: string } {
  const doc = asDict(YAML.parse(yamlText))
  const name = slugify(deriveRawName(doc)) || 'app'

  if (!(typeof doc.name === 'string' && doc.name.trim())) doc.name = name

  const extKey: 'x-nimoos' | 'x-casaos' = !doc['x-nimoos'] && doc['x-casaos'] ? 'x-casaos' : 'x-nimoos'
  const ext = asDict(doc[extKey])
  const title = asDict(ext.title)
  if (typeof title.custom !== 'string' || !title.custom) title.custom = name
  if (typeof title.en_us !== 'string' || !title.en_us) title.en_us = name
  ext.title = title
  if (typeof ext.icon !== 'string' || !ext.icon) ext.icon = `https://icon.nimoos.io/main/all/${name}.png`
  doc[extKey] = ext

  return { yaml: YAML.stringify(doc), name }
}

/**
 * Vue2 关键词映射逐字移植,实际调用点为
 * `NimoOS-UI/src/components/Apps/ComposeConfig.vue:585-608`(ImportPanel.vue 里也有一份同源拷贝)。
 * **逐字**包括大小写:除 config/download/pictures/photo/media 外,原版只有 tv 系列与
 * movie/music 系列各自罗列了几个大小写变体(`['tvshows','TV','tv']`、`['movies','Movie','movie']`、
 * `['Music','music']`),不是整体大小写不敏感 —— 因此这里逐关键词做区分大小写的 `includes`,
 * 不对 containerPath 做 toLowerCase()。
 * 保留其 forEach 逐条覆盖语义:数组靠后的关键词命中会覆盖靠前的命中结果
 * (例如 `/media/config` 同时命中 config 与 media,最终落在 media —— 这是刻意保留的原版怪癖,非 bug)。
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

/** 短语法字符串条目:"source:target[:mode]" 或裸 "target"(匿名卷,无 source)。 */
function rewriteShortVolume(entry: string, appName: string): string {
  const parts = entry.split(':')
  if (parts.length === 1) {
    // 裸路径 = 匿名卷,无 source
    const target = parts[0] ?? ''
    return `${volumeAutoCheck(target, appName)}:${target}`
  }
  const [source, target, ...rest] = parts
  if (source && !needsRewrite(source)) return entry // 绝对路径不动
  const newSource = volumeAutoCheck(target ?? '', appName)
  return [newSource, target, ...rest].join(':')
}

const REWRITABLE_VOLUME_TYPES = new Set([undefined, 'bind', 'volume'])

/** tmpfs/npipe/cluster 等非 bind/volume 类型没有真正的 host source 概念 —— 原样透传,绝不注入 source。 */
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

  // 顶层 volumes: 里不再被任何 service 引用的具名卷声明予以清理。
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

/** composerize 是 CJS(module.exports = fn);esModuleInterop 下按默认导出使用即可,行为已在测试里锁定。 */
export function dockerRunToCompose(cmd: string): string {
  const cleaned = cmd.replace(/`#.*?`/g, '').replace(/#.*$/gm, '').trim()
  return composerize(cleaned)
}

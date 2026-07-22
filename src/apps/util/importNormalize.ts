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

/** 首个 service 里第一个可解析出的单端口 host 侧发布端口(短语法/长语法);找不到返 ''。
 *  range/裸端口条目解析不出确定的 host 端口,跳过。 */
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

/** name 派生级联:顶层 name → 首个可用 service key → 首个 service 的 image 短名 → 'app' 兜底。 */
function deriveRawName(doc: Dict): string {
  if (typeof doc.name === 'string' && doc.name.trim()) return doc.name.trim()
  const services = asDict(doc.services)
  // container_name 优先于 service key:docker run 导入时用户的 --name 落在
  // container_name 上,而 composerize 的 service key 只是镜像名(nginx 之类)。
  const firstSvc = asDict(Object.values(services)[0])
  const cname = typeof firstSvc.container_name === 'string' ? firstSvc.container_name.trim() : ''
  if (cname) return cname
  const keys = Object.keys(services).filter((k) => k.trim())
  if (keys.length) return keys[0]!
  const image = typeof firstSvc.image === 'string' ? firstSvc.image : ''
  if (image) return shortImageName(image)
  return 'app'
}

/** 合法 compose 项目名(后端 compose-go 同规):不合法的名字后端会另行归一,
 *  与前端进度跟踪 key 对不上号 → 幽灵 0% 卡。 */
const VALID_COMPOSE_NAME = /^[a-z0-9][a-z0-9_-]*$/

export function ensureComposeMeta(yamlText: string): { yaml: string; name: string } {
  const doc = asDict(YAML.parse(yamlText))
  // 返回的 name 与写进 YAML 的顶层 name 必须严格一致(它同时是后端安装名、事件
  // app:name、前端 track key)。已有且合法 → 原样用;缺失/不合法 → 派生 + slug 后写回。
  const existing = typeof doc.name === 'string' ? doc.name.trim() : ''
  const name = VALID_COMPOSE_NAME.test(existing) ? existing : slugify(deriveRawName(doc)) || 'app'
  doc.name = name

  const extKey: 'x-nimoos' | 'x-casaos' = !doc['x-nimoos'] && doc['x-casaos'] ? 'x-casaos' : 'x-nimoos'
  const ext = asDict(doc[extKey])
  const title = asDict(ext.title)
  if (typeof title.custom !== 'string' || !title.custom) title.custom = name
  if (typeof title.en_us !== 'string' || !title.en_us) title.en_us = name
  ext.title = title
  // 不注入 icon:icon.nimoos.io 域名不存在(Vue2 遗留死链,ERR_NAME_NOT_RESOLVED),
  // 注入只会得到坏图;缺 icon 时磁贴/卡片用默认 glyph 兜底。用户自带的 icon 原样保留。
  // 注入 port_map:桌面/已装列表靠它拼「打开」地址(appUrl 无 port 无 index 即无动作)。
  if (typeof ext.port_map !== 'string' || !ext.port_map) {
    const port = firstPublishedPort(doc)
    if (port) ext.port_map = port
  }
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
  const out = composerize(cleaned)
  // composerize 顶部固定输出占位名 `name: <your project name>`(模板字样,非用户意图)。
  // 剥掉它,让 ensureComposeMeta 的派生级联接手(container_name=用户的 --name 优先)。
  const doc = asDict(YAML.parse(out))
  if (typeof doc.name === 'string' && /^<.*>$/.test(doc.name.trim())) {
    delete doc.name
    return YAML.stringify(doc)
  }
  return out
}

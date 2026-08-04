// 三个 hit 类型不再单独 import:agg.filenames / agg.semantic / agg.images 本来就是
// FileNameHit[] / SemanticHit[] / ImageHit[],原先那三处 `as XxxHit[]` 是同类型断言(无意义),
// 删掉断言后这几个名字在本文件里就没有消费方了。
import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import { IMAGE_X_GENERIC, VIDEO_X_GENERIC, AUDIO_X_GENERIC } from '../../files/util/fileCategories'
import { filenameReason, semanticReason, imageReason } from './reasons'
import type { Reason, ResultCategory, ResultRow, SearchTab, SearchView, SourceBadge } from './types'

// spec §7.3/§7.4/§7.7:把四组互不可比的命中合成一份可渲染的排序列表。
//
// ⚠️ 四组分数**不做跨源归一化** —— filenames.match 无上界(实测 2 / 1.5)、
//    semantic.score 是向量相似度、images.score 是 CLIP 相似度,强行归一只会编出
//    一个假的可比性(demo 时代那个「98%」就是这么来的)。改用**分层**:层间只比层号,
//    层内才比分数。
// ⚠️ 排序必须**稳定** —— 同层同分保持后端返回顺序。Array.prototype.sort 在 V8 上
//    已是稳定排序,但这里仍显式带上入序 seq 作为最后一级比较键,不依赖引擎实现。

const LAYER_FILENAME_EXACT = 1
const LAYER_FILENAME_REST = 2
const LAYER_SEMANTIC_TEXT = 3
const LAYER_VISUAL = 4
const LAYER_SEMANTIC_REST = 5

function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i + 1).toLowerCase() : ''
}

function categoryOfExt(ext: string): ResultCategory {
  const e = ext.toLowerCase()
  if (IMAGE_X_GENERIC.includes(e)) return 'Images'
  if (VIDEO_X_GENERIC.includes(e)) return 'Videos'
  if (AUDIO_X_GENERIC.includes(e)) return 'Audio'
  return 'Documents'
}

function categoryOfMime(mime: string, path: string): ResultCategory {
  if (mime.startsWith('image/')) return 'Images'
  if (mime.startsWith('video/')) return 'Videos'
  if (mime.startsWith('audio/')) return 'Audio'
  return categoryOfExt(extOf(path))
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

// 累积中的一行。合并靠 realPath 做键。
interface Draft {
  realPath: string
  name: string
  category: ResultCategory
  isDir: boolean
  reasons: Reason[]
  snippet: string
  layer: number
  score: number
  seq: number
  fromFilename: boolean
  fromOcr: boolean
  thumbnailUrl?: string
}

function badgeOf(d: Draft): SourceBadge {
  if (d.fromFilename) return 'filename'
  if (d.fromOcr) return 'ocr'
  return 'semantic'
}

export function buildSearchView(agg: NormalizedAggregate, query: string): SearchView {
  const q = query.trim().toLowerCase()
  const byPath = new Map<string, Draft>()
  let seq = 0

  function merge(next: Omit<Draft, 'seq'>): void {
    const cur = byPath.get(next.realPath)
    if (!cur) {
      byPath.set(next.realPath, { ...next, seq: seq++ })
      return
    }
    // 层号取更靠前的那个;分数跟着被选中的层走(跨层的分数不可比,不能取 max)
    if (next.layer < cur.layer || (next.layer === cur.layer && next.score > cur.score)) {
      cur.layer = next.layer
      cur.score = next.score
    }
    for (const r of next.reasons) if (!cur.reasons.some((x) => x.key === r.key)) cur.reasons.push(r)
    if (!cur.snippet && next.snippet) cur.snippet = next.snippet
    if (!cur.thumbnailUrl && next.thumbnailUrl) cur.thumbnailUrl = next.thumbnailUrl
    cur.fromFilename = cur.fromFilename || next.fromFilename
    cur.fromOcr = cur.fromOcr || next.fromOcr
    cur.isDir = cur.isDir || next.isDir
    // category 以先到的为准:filenames 先入队,它的 ext 判定比 mime 更贴近用户看到的文件名
  }

  for (const h of agg.filenames) {
    const exact = !!q && h.name.toLowerCase() === q
    merge({
      realPath: h.path,
      name: h.name || nameOf(h.path),
      category: h.isDir ? 'Documents' : categoryOfExt(h.ext || extOf(h.path)),
      isDir: h.isDir,
      reasons: [filenameReason(h, query)],
      snippet: '',
      layer: exact ? LAYER_FILENAME_EXACT : LAYER_FILENAME_REST,
      score: h.match,
      fromFilename: true,
      fromOcr: false,
    })
  }

  for (const h of agg.semantic) {
    const path = h.paths[0]?.path
    if (!path) continue // 无路径 → 无法预览/定位,整条丢弃
    const isOcr = h.kind === 'ocr'
    const layer =
      h.kind === 'body' || h.kind === 'transcript' ? LAYER_SEMANTIC_TEXT
      : isOcr ? LAYER_VISUAL
      : LAYER_SEMANTIC_REST
    merge({
      realPath: path,
      name: nameOf(path),
      category: categoryOfMime(h.mime, path),
      isDir: false,
      reasons: [semanticReason(h, query)],
      snippet: h.preview.text,
      layer,
      score: h.score,
      fromFilename: false,
      fromOcr: isOcr,
    })
  }

  for (const h of agg.images) {
    merge({
      realPath: h.path,
      name: h.name || nameOf(h.path),
      category: 'Images',
      isDir: false,
      reasons: [imageReason()],
      snippet: h.caption,
      layer: LAYER_VISUAL,
      score: h.score,
      fromFilename: false,
      fromOcr: false,
      thumbnailUrl: h.thumbnailUrl,
    })
  }

  const rows: ResultRow[] = [...byPath.values()]
    .sort((a, b) => a.layer - b.layer || b.score - a.score || a.seq - b.seq)
    .map((d) => ({
      realPath: d.realPath,
      name: d.name,
      category: d.category,
      isMedia: !d.isDir && (d.category === 'Images' || d.category === 'Videos'),
      isDir: d.isDir,
      reasons: d.reasons,
      badge: badgeOf(d),
      snippet: d.snippet,
      layer: d.layer,
      score: d.score,
      thumbnailUrl: d.thumbnailUrl,
    }))

  const counts: Record<ResultCategory, number> = { Documents: 0, Images: 0, Audio: 0, Videos: 0 }
  for (const r of rows) counts[r.category]++
  const tabs: SearchTab[] = [
    { key: 'all', count: rows.length },
    ...(['Documents', 'Images', 'Audio', 'Videos'] as ResultCategory[])
      .map((k) => ({ key: k, count: counts[k] }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count),
  ]

  return {
    rows,
    docRows: rows.filter((r) => !r.isMedia),
    mediaRows: rows.filter((r) => r.isMedia),
    tabs,
    total: rows.length,
  }
}

// The three hit types are no longer separately imported: agg.filenames / agg.semantic / agg.images
// are already FileNameHit[] / SemanticHit[] / ImageHit[]; the three original `as XxxHit[]` casts
// were same-type assertions (meaningless); after removing the casts these names have no consumers in this file.
import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import { IMAGE_X_GENERIC, VIDEO_X_GENERIC, AUDIO_X_GENERIC } from '../../files/util/fileCategories'
import { filenameReason, semanticReason, imageReason } from './reasons'
import type { Reason, ResultCategory, ResultRow, SearchTab, SearchView, SourceBadge } from './types'

// spec §7.3/§7.4/§7.7: merge four groups of incomparable hits into one renderable sorted list.
//
// WARNING: The four groups of scores are **not cross-source normalized** — filenames.match has no
//    upper bound (tested 2 / 1.5), semantic.score is vector similarity, images.score is CLIP similarity;
//    forced normalization would only create fake comparability (that "98%" from the demo era came from this).
//    Instead use **layering**: only compare layer numbers across layers, only compare scores within layers.
// WARNING: Sort must be **stable** — same layer, same score preserves backend return order.
//    Array.prototype.sort on V8 is already stable sort, but we still explicitly include entry order seq
//    as the final comparison key, not relying on engine implementation.

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

// Accumulating row. Merging uses realPath as key.
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
    // Take the earlier layer number; score follows the selected layer (cross-layer scores not comparable, cannot take max)
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
    // category uses first arrival: filenames enters first, its ext determination is closer to what users see in the filename
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
    if (!path) continue // No path → cannot preview/locate, discard entire row
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

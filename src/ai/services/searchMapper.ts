// 1:1 移植自 Vue2 src/service/searchMapper.js
import type { AgentBlock } from '../types'

// Maps a nimoos_search aggregate response ({groups:{semantic,filenames,images}, stats, warnings})
// into the view model consumed by SemanticSearchCard / SearchFullResults.
// Shared by the Agent tool-result handler and the homepage search page so the two
// paths can never drift. Returns null when there are no results to show.
export function buildSemanticSearchBlock(parsed: unknown, query: string): AgentBlock | null {
  const p = parsed as Record<string, any> | null | undefined
  const groups = (p && p.groups) || {}
  const stats = (p && p.stats) || {}
  const warnings = Array.isArray(p && p.warnings) ? p!.warnings : []

  const rawImages = Array.isArray(groups.images) ? groups.images : []
  const rawFiles = Array.isArray(groups.filenames) ? groups.filenames : []
  const rawPassages = Array.isArray(groups.semantic) ? groups.semantic : []

  const images = rawImages.map((r: any) => ({
    assetId: r.asset_id,
    name: r.name,
    path: r.path,
    score: r.score || 0,
    takenAt: r.taken_at || '',
    thumbUrl: r.thumbnail_url || `/v1/photos/assets/${r.asset_id}/thumbnail?size=small`,
  }))

  const files = rawFiles.map((r: any) => ({
    name: r.name,
    path: r.path,
    kind: (r.ext || '').toLowerCase(),
    score: r.match || 0,
    size: r.size,
    mtimeMs: r.mtime_ms,
    isDir: r.is_dir,
    snippet: null,
  }))

  const passages = rawPassages.map((r: any) => {
    const firstPath = (r.paths && r.paths[0]) ? r.paths[0].path : ''
    const basename = firstPath ? firstPath.replace(/.*\//, '') : (r.file_id || '')
    let kind = 'file'
    const mime = r.mime || ''
    if (mime === 'text/markdown') kind = 'md'
    else if (mime === 'application/pdf') kind = 'pdf'
    return {
      name: basename,
      path: firstPath,
      kind,
      score: r.score || 0,
      snippet: (r.preview && r.preview.text) || '',
      fileId: r.file_id,
    }
  })

  const totalCandidates = stats.total_candidates != null
    ? stats.total_candidates
    : (images.length + files.length + passages.length)

  // Build scope from distinct first path segments across results
  const allPaths: string[] = [
    ...rawImages.map((r: any) => r.path || ''),
    ...rawFiles.map((r: any) => r.path || ''),
    ...rawPassages.flatMap((r: any) => (r.paths || []).map((p2: any) => p2.path || '')),
  ]
  const scopeSet = new Set<string>()
  allPaths.forEach(p2 => {
    const parts = p2.replace(/^\//, '').split('/')
    if (parts.length > 0 && parts[0]) scopeSet.add(parts[0])
  })
  const scope = Array.from(scopeSet).slice(0, 3)

  // terms: query split on whitespace/underscore/dash, lowercased, non-empty
  const terms = query
    ? query.toLowerCase().split(/[\s_-]+/).filter(Boolean)
    : []

  if (!(totalCandidates > 0 || images.length > 0 || files.length > 0 || passages.length > 0)) {
    return null
  }
  return {
    type: 'semantic_search',
    query,
    terms,
    model: 'bge-m3 · CLIP',
    scope,
    corpus: null,
    durationMs: null,
    total: totalCandidates,
    fileindexStatus: stats.fileindex_status || 'ready',
    images,
    files,
    passages,
    warnings,
  }
}

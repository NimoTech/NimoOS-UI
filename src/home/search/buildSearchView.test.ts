import { describe, it, expect } from 'vitest'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import { buildSearchView } from './buildSearchView'

function agg(over: Partial<NormalizedAggregate> = {}): NormalizedAggregate {
  return {
    semantic: [], filenames: [], images: [], notes: [],
    stats: { fileindexStatus: 'ready', totalCandidates: 0 }, warnings: [], ...over,
  }
}
function fn(name: string, match: number, over: Partial<NormalizedAggregate['filenames'][number]> = {}) {
  return { path: '/DATA/Documents/' + name, name, ext: name.split('.').pop() ?? '', size: 1, mtimeMs: 1, isDir: false, match, ...over }
}
function sem(path: string, kind: string, score: number, mime = 'application/pdf', text = '') {
  return {
    score, fileId: path, paths: [{ rootId: 'r', path, mtimeMs: 0 }], mime, kind,
    cite: { page: null, offsetStart: null, offsetEnd: null, frameMsStart: null, frameMsEnd: null, chunkNo: 0 },
    preview: { text },
  }
}
function img(path: string, score: number) {
  return { assetId: 'a', name: path.split('/').pop() ?? '', path, score, takenAt: '', thumbnailUrl: '/thumb', caption: '' }
}

describe('buildSearchView — ranking stratification', () => {
  it('Layer 1 exact filename hits rank before layer 2 substring hits, even if match is lower', () => {
    const v = buildSearchView(agg({ filenames: [fn('other-receipt.pdf', 9), fn('receipt.pdf', 1)] }), 'receipt.pdf')
    expect(v.rows.map((r) => r.name)).toEqual(['receipt.pdf', 'other-receipt.pdf'])
  })

  it('Within layer 2, sort by match in descending order', () => {
    const v = buildSearchView(agg({ filenames: [fn('b-receipt.pdf', 1.5), fn('a-receipt.pdf', 2)] }), 'receipt')
    expect(v.rows.map((r) => r.name)).toEqual(['a-receipt.pdf', 'b-receipt.pdf'])
  })

  it('When match is the same within layer 2, maintain backend return order (stable sort)', () => {
    const v = buildSearchView(agg({ filenames: [fn('z-receipt.pdf', 2), fn('a-receipt.pdf', 2)] }), 'receipt')
    expect(v.rows.map((r) => r.name)).toEqual(['z-receipt.pdf', 'a-receipt.pdf'])
  })

  it('Relative order of all five layers: filenames exact → filenames other → body/transcript → images/ocr → other kinds', () => {
    const v = buildSearchView(
      agg({
        filenames: [fn('fish.txt', 1), fn('other.txt', 3)],
        semantic: [
          sem('/DATA/s/summary.pdf', 'summary', 0.9),
          sem('/DATA/s/ocr.png', 'ocr', 0.4, 'image/png'),
          sem('/DATA/s/body.pdf', 'body', 0.2),
        ],
        images: [img('/DATA/g/photo.jpg', 0.95)],
      }),
      'fish.txt',
    )
    expect(v.rows.map((r) => r.realPath)).toEqual([
      '/DATA/Documents/fish.txt',   // Layer 1
      '/DATA/Documents/other.txt',  // Layer 2
      '/DATA/s/body.pdf',           // Layer 3
      '/DATA/g/photo.jpg',          // Layer 4 (images 0.95 > ocr 0.4)
      '/DATA/s/ocr.png',            // Layer 4
      '/DATA/s/summary.pdf',        // Layer 5 (highest score also ranks last — no cross-layer score comparison)
    ])
  })
})

describe('buildSearchView — deduplication and merging', () => {
  it('Same path hit by filenames + semantic → one row, reasons accumulated, layer takes the earlier one', () => {
    const p = '/DATA/Documents/receipt.pdf'
    const v = buildSearchView(
      agg({
        filenames: [{ path: p, name: 'receipt.pdf', ext: 'pdf', size: 1, mtimeMs: 1, isDir: false, match: 2 }],
        semantic: [sem(p, 'body', 0.8, 'application/pdf', 'the receipt total was 55.72')],
      }),
      'receipt',
    )
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].reasons.map((r) => r.key)).toEqual(['searchReasonFilename', 'searchReasonBody'])
    expect(v.rows[0].layer).toBe(2)          // Layer of filenames substring hit, earlier than semantic's layer 3
    expect(v.rows[0].badge).toBe('filename') // filenames participated → badge is filename
    expect(v.rows[0].snippet).toBe('the receipt total was 55.72') // snippet from semantic
  })

  it('reasons deduplicated by key (same path, two semantics with same kind only keep one tag), take the higher score one in same layer', () => {
    const p = '/DATA/s/a.pdf'
    // Low score first, high score later — if same-layer "take higher score" comparison is deleted, first arrival's low score will be retained, assertion turns red
    const v = buildSearchView(agg({ semantic: [sem(p, 'body', 0.5, 'application/pdf', 'fish'), sem(p, 'body', 0.9, 'application/pdf', 'fish')] }), 'fish')
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].reasons.map((r) => r.key)).toEqual(['searchReasonBody'])
    expect(v.rows[0].score).toBe(0.9) // Take the higher score one
  })

  it('When later source has earlier layer number, layer/score must update (not first-come-first-served)', () => {
    // Supplementary test case: in the merge tests above, the filenames/higher-score semantic
    // processed first happen to already be the "better" ones; even if the "take earlier layer"
    // update logic in merge() is deleted, the assertion won't turn red
    // (true gap discovered in mutation verification step 5②). Here we construct semantic
    // (layer 5, processed first) + images (layer 4, processed later) hitting the same path;
    // images' layer number is smaller when it arrives later, must override the earlier semantic.
    const p = '/DATA/s/mixed.png'
    const v = buildSearchView(
      agg({ semantic: [sem(p, 'summary', 0.9, 'image/png')], images: [img(p, 0.5)] }),
      'x',
    )
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].layer).toBe(4)  // images' layer (4) is earlier than semantic's other kind layer (5)
    expect(v.rows[0].score).toBe(0.5) // Score follows the selected layer (images), not the first arrival's 0.9
  })

  it('semantic with empty paths → discard entirely (without path cannot be located/previewed)', () => {
    const bad = { ...sem('/x', 'body', 0.9), paths: [] }
    const v = buildSearchView(agg({ semantic: [bad] }), 'x')
    expect(v.rows).toEqual([])
    expect(v.total).toBe(0)
  })

  it('semantic hit OCR and path is simultaneously hit by images → one row, badge is ocr', () => {
    const p = '/DATA/Documents/life/receipt.jpg'
    const v = buildSearchView(agg({ semantic: [sem(p, 'ocr', 0.6, 'image/jpeg', 'HOME DEPOT')], images: [img(p, 0.7)] }), 'depot')
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].badge).toBe('ocr')
    expect(v.rows[0].isMedia).toBe(true)
  })

  it('badge priority: same path filenames + ocr semantic → badge is still filename (filenames highest priority)', () => {
    const p = '/DATA/Documents/life/receipt.jpg'
    const v = buildSearchView(
      agg({
        filenames: [fn('receipt.jpg', 2, { path: p })],
        semantic: [sem(p, 'ocr', 0.6, 'image/jpeg', 'HOME DEPOT')],
      }),
      'receipt',
    )
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].badge).toBe('filename')
  })

  it('images hit alone (not sharing path with any filenames/semantic) → category/badge/snippet/thumbnailUrl/isMedia all come from images', () => {
    const v = buildSearchView(agg({ images: [{ assetId: 'a1', name: 'sunset.jpg', path: '/DATA/Gallery/sunset.jpg', score: 0.8, takenAt: '', thumbnailUrl: '/thumb/a1', caption: 'a sunset over the lake' }] }), 'sunset')
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].category).toBe('Images')
    expect(v.rows[0].badge).toBe('semantic')
    expect(v.rows[0].snippet).toBe('a sunset over the lake')
    expect(v.rows[0].thumbnailUrl).toBe('/thumb/a1')
    expect(v.rows[0].isMedia).toBe(true)
  })
})

describe('buildSearchView — categorization and tabs', () => {
  it('filenames categorized by extension, semantic categorized by mime prefix', () => {
    const v = buildSearchView(
      agg({
        filenames: [fn('a.jpg', 2), fn('b.mp4', 2), fn('c.wav', 2), fn('d.pdf', 2)],
        semantic: [sem('/DATA/s/e.png', 'ocr', 0.5, 'image/png'), sem('/DATA/s/f.mp3', 'transcript', 0.5, 'audio/mpeg')],
      }),
      'x',
    )
    const cat = (p: string) => v.rows.find((r) => r.realPath.endsWith(p))!.category
    expect(cat('a.jpg')).toBe('Images')
    expect(cat('b.mp4')).toBe('Videos')
    expect(cat('c.wav')).toBe('Audio')
    expect(cat('d.pdf')).toBe('Documents')
    expect(cat('e.png')).toBe('Images')
    expect(cat('f.mp3')).toBe('Audio')
  })

  it('semantic without mime falls back to path extension', () => {
    const v = buildSearchView(agg({ semantic: [sem('/DATA/s/clip.mp4', 'transcript', 0.5, '')] }), 'x')
    expect(v.rows[0].category).toBe('Videos')
  })

  it('directory item (is_dir) falls into Documents and isDir=true, isMedia=false', () => {
    const v = buildSearchView(agg({ filenames: [{ path: '/DATA/Gallery/Fishing', name: 'Fishing', ext: '', size: 0, mtimeMs: 0, isDir: true, match: 2 }] }), 'fish')
    expect(v.rows[0].category).toBe('Documents')
    expect(v.rows[0].isDir).toBe(true)
    expect(v.rows[0].isMedia).toBe(false)
  })

  it('tabs = all results + categories with count > 0 sorted by count descending, categories with count 0 do not appear', () => {
    const v = buildSearchView(agg({ filenames: [fn('a.pdf', 2), fn('b.pdf', 2), fn('c.jpg', 2)] }), 'x')
    expect(v.tabs).toEqual([{ key: 'all', count: 3 }, { key: 'Documents', count: 2 }, { key: 'Images', count: 1 }])
    expect(v.total).toBe(3)
  })

  it('docRows / mediaRows split by isMedia and preserve rows\' relative order', () => {
    const v = buildSearchView(agg({ filenames: [fn('a.jpg', 3), fn('b.pdf', 2), fn('c.jpg', 1)] }), 'x')
    expect(v.docRows.map((r) => r.name)).toEqual(['b.pdf'])
    expect(v.mediaRows.map((r) => r.name)).toEqual(['a.jpg', 'c.jpg'])
  })
})

describe('buildSearchView — real device response end-to-end', () => {
  // Shape of real device response (query=receipt) after normalization per spec §7.10a
  it('Two filenames hits → two rows, one document one image', () => {
    const v = buildSearchView(
      agg({
        filenames: [
          { path: '/DATA/Documents/Recipes/Receipt.pdf', name: 'Receipt.pdf', ext: 'pdf', size: 53866, mtimeMs: 1784715139167, isDir: false, match: 2 },
          { path: "/DATA/Documents/life/Nick's receipt.jpg", name: "Nick's receipt.jpg", ext: 'jpg', size: 42943, mtimeMs: 1783651328200, isDir: false, match: 1.5 },
        ],
        stats: { fileindexStatus: 'ready', totalCandidates: 2 },
        warnings: ['images_unavailable'],
      }),
      'receipt',
    )
    expect(v.total).toBe(2)
    expect(v.rows.map((r) => r.badge)).toEqual(['filename', 'filename'])
    expect(v.docRows).toHaveLength(1)
    expect(v.mediaRows).toHaveLength(1)
    expect(v.rows[0].snippet).toBe('')  // filenames source has no snippet
  })
})

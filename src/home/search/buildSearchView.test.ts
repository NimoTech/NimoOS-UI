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

describe('buildSearchView —— 排名分层', () => {
  it('层 1 精确文件名命中排在层 2 子串命中之前,哪怕 match 更低', () => {
    const v = buildSearchView(agg({ filenames: [fn('other-receipt.pdf', 9), fn('receipt.pdf', 1)] }), 'receipt.pdf')
    expect(v.rows.map((r) => r.name)).toEqual(['receipt.pdf', 'other-receipt.pdf'])
  })

  it('层 2 内部按 match 降序', () => {
    const v = buildSearchView(agg({ filenames: [fn('b-receipt.pdf', 1.5), fn('a-receipt.pdf', 2)] }), 'receipt')
    expect(v.rows.map((r) => r.name)).toEqual(['a-receipt.pdf', 'b-receipt.pdf'])
  })

  it('层 2 内 match 相同时保持后端返回顺序(稳定排序)', () => {
    const v = buildSearchView(agg({ filenames: [fn('z-receipt.pdf', 2), fn('a-receipt.pdf', 2)] }), 'receipt')
    expect(v.rows.map((r) => r.name)).toEqual(['z-receipt.pdf', 'a-receipt.pdf'])
  })

  it('全部五层的相对顺序:filenames 精确 → filenames 其余 → body/transcript → images/ocr → 其余 kind', () => {
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
      '/DATA/Documents/fish.txt',   // 层 1
      '/DATA/Documents/other.txt',  // 层 2
      '/DATA/s/body.pdf',           // 层 3
      '/DATA/g/photo.jpg',          // 层 4(images 0.95 > ocr 0.4)
      '/DATA/s/ocr.png',            // 层 4
      '/DATA/s/summary.pdf',        // 层 5(分数最高也垫底 —— 跨层不比分数)
    ])
  })
})

describe('buildSearchView —— 合并去重', () => {
  it('同一路径命中 filenames + semantic → 一行,reasons 累加,层取更靠前的', () => {
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
    expect(v.rows[0].layer).toBe(2)          // filenames 子串命中的层,比 semantic 的层 3 靠前
    expect(v.rows[0].badge).toBe('filename') // filenames 参与 → 徽标是文件名
    expect(v.rows[0].snippet).toBe('the receipt total was 55.72') // 摘要来自 semantic
  })

  it('reasons 按 key 去重(同一路径两条 semantic 同 kind 只留一个标签),同层取更高分那条', () => {
    const p = '/DATA/s/a.pdf'
    // 低分先到、高分后到 —— 若同层"取更高分"的比较被删掉,先到者的低分会被保留,断言翻红
    const v = buildSearchView(agg({ semantic: [sem(p, 'body', 0.5, 'application/pdf', 'fish'), sem(p, 'body', 0.9, 'application/pdf', 'fish')] }), 'fish')
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].reasons.map((r) => r.key)).toEqual(['searchReasonBody'])
    expect(v.rows[0].score).toBe(0.9) // 取更高分那条
  })

  it('后到的源层号更靠前时,layer/score 要跟着更新(不是先到先得)', () => {
    // 补充用例:上面几条合并测试里,先处理的 filenames/更高分 semantic 恰好都已经是
    // "更优" 的那一份,即便 merge() 里"取更靠前层"的更新逻辑被删掉,断言也不会翻红
    // (变异验证 Step 5②发现的真实缺口)。这里构造 semantic(层 5,先处理)+ images(层 4,
    // 后处理)命中同一路径,后到的 images 层号更小,必须覆盖先到的 semantic。
    const p = '/DATA/s/mixed.png'
    const v = buildSearchView(
      agg({ semantic: [sem(p, 'summary', 0.9, 'image/png')], images: [img(p, 0.5)] }),
      'x',
    )
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].layer).toBe(4)  // images 的层(4)比 semantic 其余 kind 的层(5)更靠前
    expect(v.rows[0].score).toBe(0.5) // 分数跟着被选中的层(images)走,不是先到的 0.9
  })

  it('semantic 的 paths 为空 → 整条丢弃(没有路径就无法定位/预览)', () => {
    const bad = { ...sem('/x', 'body', 0.9), paths: [] }
    const v = buildSearchView(agg({ semantic: [bad] }), 'x')
    expect(v.rows).toEqual([])
    expect(v.total).toBe(0)
  })

  it('semantic 命中 OCR 且路径同时被 images 命中 → 一行,徽标是 ocr', () => {
    const p = '/DATA/Documents/life/receipt.jpg'
    const v = buildSearchView(agg({ semantic: [sem(p, 'ocr', 0.6, 'image/jpeg', 'HOME DEPOT')], images: [img(p, 0.7)] }), 'depot')
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].badge).toBe('ocr')
    expect(v.rows[0].isMedia).toBe(true)
  })

  it('badge 优先级:同路径 filenames + ocr semantic → 徽标仍是 filename(filenames 最高优先)', () => {
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

  it('images 单独命中(不与任何 filenames/semantic 同路径)→ category/badge/snippet/thumbnailUrl/isMedia 全部来自 images', () => {
    const v = buildSearchView(agg({ images: [{ assetId: 'a1', name: 'sunset.jpg', path: '/DATA/Gallery/sunset.jpg', score: 0.8, takenAt: '', thumbnailUrl: '/thumb/a1', caption: 'a sunset over the lake' }] }), 'sunset')
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].category).toBe('Images')
    expect(v.rows[0].badge).toBe('semantic')
    expect(v.rows[0].snippet).toBe('a sunset over the lake')
    expect(v.rows[0].thumbnailUrl).toBe('/thumb/a1')
    expect(v.rows[0].isMedia).toBe(true)
  })
})

describe('buildSearchView —— 分类与 tab', () => {
  it('filenames 按扩展名分类,semantic 按 mime 前缀分类', () => {
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

  it('无 mime 的 semantic 退回看路径扩展名', () => {
    const v = buildSearchView(agg({ semantic: [sem('/DATA/s/clip.mp4', 'transcript', 0.5, '')] }), 'x')
    expect(v.rows[0].category).toBe('Videos')
  })

  it('目录项(is_dir)落 Documents 且 isDir=true、isMedia=false', () => {
    const v = buildSearchView(agg({ filenames: [{ path: '/DATA/Gallery/Fishing', name: 'Fishing', ext: '', size: 0, mtimeMs: 0, isDir: true, match: 2 }] }), 'fish')
    expect(v.rows[0].category).toBe('Documents')
    expect(v.rows[0].isDir).toBe(true)
    expect(v.rows[0].isMedia).toBe(false)
  })

  it('tabs = 全部结果 + 计数>0 的分类按计数降序,计数为 0 的分类不出现', () => {
    const v = buildSearchView(agg({ filenames: [fn('a.pdf', 2), fn('b.pdf', 2), fn('c.jpg', 2)] }), 'x')
    expect(v.tabs).toEqual([{ key: 'all', count: 3 }, { key: 'Documents', count: 2 }, { key: 'Images', count: 1 }])
    expect(v.total).toBe(3)
  })

  it('docRows / mediaRows 按 isMedia 拆分且保持 rows 的相对顺序', () => {
    const v = buildSearchView(agg({ filenames: [fn('a.jpg', 3), fn('b.pdf', 2), fn('c.jpg', 1)] }), 'x')
    expect(v.docRows.map((r) => r.name)).toEqual(['b.pdf'])
    expect(v.mediaRows.map((r) => r.name)).toEqual(['a.jpg', 'c.jpg'])
  })
})

describe('buildSearchView —— 真机响应端到端', () => {
  // spec §7.10a 的真机响应(query=receipt)归一化后的样子
  it('两条 filenames 命中 → 两行,一个文档一个图片', () => {
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
    expect(v.rows[0].snippet).toBe('')  // filenames 源没有摘要
  })
})

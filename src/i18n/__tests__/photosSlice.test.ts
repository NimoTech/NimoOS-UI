// Guard tests for the Photos copy slice.
//
// Structure: `zh_cn.ts` is a 3-line **merge export** (`{...base, ...photos}`); the actual content
// lives in the two files `zh_cn.base.ts` and `zh_cn.photos.ts` — those 702 photos* keys used to be
// scattered across 90-odd sections of the main file, and only became maintainable once split out
// into their own block.
//
// This slicing approach is only safe if three preconditions hold; the three assertion groups below
// each guard one of them:
//   ① The export is a **pure merge** with no content of its own — otherwise "editing the export"
//      would end up changing other things too;
//   ② **All** Photos copy lives in the slice (not a single photos* key left in base) — otherwise
//      the slice would no longer be "the complete set of Photos-area copy", and places that pull by
//      area would be missing entries;
//   ③ The slice contains **only** keys used by the Photos surface — otherwise other pages would end
//      up depending on this block, making the split a fiction in practice
//      (vue-i18n silently falls back to the raw key name when a key isn't found — no error, no
//      crash — so unit tests wouldn't catch it either).
//
// Always read files via node:fs — `?raw` imports are always empty in this repo's test environment (color-guard once spun uselessly because of this).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import merged from '../zh_cn'
import mergedEn from '../en_us'
import zhBase from '../zh_cn.base'
import enBase from '../en_us.base'
import zhPhotos from '../zh_cn.photos'
import enPhotos from '../en_us.photos'
// Merged in: the export went from {base, photos} to {base, photos, ai} (the AI area is likewise
// split into its own block, following the same approach point-for-point as the photos slice). This
// file guards the photos slice; it only counts ai in on the "export is a pure merge" assertion —
// otherwise that assertion would misreport the AI keys as "content the export added out of nowhere".
// The ai slice's own guards (prefix, cross-language consistency, reverse references) are added
// separately elsewhere; they are not in this file.
import zhAi from '../zh_cn.ai'
import enAi from '../en_us.ai'

const I18N_DIR = path.resolve(__dirname, '..')
const SRC_DIR = path.resolve(__dirname, '../..')

const zhKeys = Object.keys(zhPhotos as Record<string, unknown>)
const enKeys = Object.keys(enPhotos as Record<string, unknown>)

describe('photos copy slice · the slice itself', () => {
  it('key sets are identical across both languages', () => {
    expect(zhKeys.slice().sort()).toEqual(enKeys.slice().sort())
  })

  it('is non-empty (guards against being emptied and every assertion becoming vacuously true)', () => {
    expect(zhKeys.length).toBeGreaterThan(600)
  })

  it('every key has a photos prefix (the prefix is the slicing criterion; a stray key would make the open-source side delete the wrong thing)', () => {
    const bad = zhKeys.filter((k) => !k.startsWith('photos'))
    expect(bad, `非 photos 前缀的键: ${bad.join(', ')}`).toEqual([])
  })

  it('all values are non-empty strings', () => {
    for (const o of [zhPhotos, enPhotos]) {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        expect(typeof v, `key ${k}`).toBe('string')
        expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('photos copy slice · the export is a pure merge', () => {
  it('zh_cn.ts / en_us.ts export exactly base ∪ photos ∪ ai, no more, no less', () => {
    expect(Object.keys(merged as Record<string, unknown>).sort())
      .toEqual([...Object.keys(zhBase as Record<string, unknown>), ...zhKeys,
        ...Object.keys(zhAi as Record<string, unknown>)].sort())
    expect(Object.keys(mergedEn as Record<string, unknown>).sort())
      .toEqual([...Object.keys(enBase as Record<string, unknown>), ...enKeys,
        ...Object.keys(enAi as Record<string, unknown>)].sort())
  })

  it('base and photos key sets are disjoint (so spread order carries no semantics)', () => {
    const dup = zhKeys.filter((k) => k in (zhBase as Record<string, unknown>))
    expect(dup, `base 与分片撞键: ${dup.join(', ')}`).toEqual([])
  })

  it('all three slices are pairwise disjoint (same as above: spread order carries no semantics, a later spread never silently shadows an earlier one)', () => {
    const ai = Object.keys(zhAi as Record<string, unknown>)
    expect(ai.filter((k) => k in (zhBase as Record<string, unknown>)),
      'base 与 ai 分片撞键').toEqual([])
    expect(ai.filter((k) => zhKeys.includes(k)), 'photos 与 ai 分片撞键').toEqual([])
  })

  it('the export files themselves contain no key definitions (only imports + one spread line are allowed)', () => {
    for (const f of ['zh_cn.ts', 'en_us.ts']) {
      const src = fs.readFileSync(path.join(I18N_DIR, f), 'utf8')
      expect(src.length, `${f} 读到空内容,取数方式失效了`).toBeGreaterThan(0)
      const keyLines = src.split('\n').filter((l) => /^ {2}[A-Za-z_$][A-Za-z0-9_]*:/.test(l))
      expect(keyLines, `${f} 出口里出现了键定义: ${keyLines.slice(0, 3).join(' | ')}`).toEqual([])
    }
  })
})

describe('photos copy slice · positive (no leftovers allowed in base)', () => {
  it("base's exported object has no photos* keys", () => {
    const leftover = (o: Record<string, unknown>) => Object.keys(o).filter((k) => k.startsWith('photos'))
    expect(leftover(zhBase as Record<string, unknown>)).toEqual([])
    expect(leftover(enBase as Record<string, unknown>)).toEqual([])
  })

  it("neither base's source has a photos* key line either (not even a commented-out remnant)", () => {
    for (const f of ['zh_cn.base.ts', 'en_us.base.ts']) {
      const src = fs.readFileSync(path.join(I18N_DIR, f), 'utf8')
      expect(src.length, `${f} 读到空内容,取数方式失效了`).toBeGreaterThan(0)
      const hits = src.split('\n').filter((l) => /^ {2}photos[A-Za-z0-9_]*:/.test(l))
      expect(hits, `${f} 残留 photos 键行: ${hits.slice(0, 3).join(' | ')}`).toEqual([])
    }
  })
})

describe('photos copy slice · negative (the slice must not contain keys consumed outside the Photos surface)', () => {
  // Reads in all source under src/ **except the Photos surface**, and checks whether any slice key is
  // referenced literally. The Photos surface = src/photos/** + src/views/Photos*.vue + their tests —
  // these get deleted wholesale in the open-source export, so it's fine for them to reference slice
  // keys. If a slice key is referenced anywhere outside that surface, deleting the slice would make
  // that spot render the raw key name.
  function collectSources(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue
        if (p === path.join(SRC_DIR, 'photos')) continue          // 相册面,整体删除
        if (p === I18N_DIR) continue                              // locale 文件与本闸自身
        collectSources(p, out)
      } else if (/\.(ts|vue)$/.test(e.name)) {
        if (/^Photos.*\.(vue|test\.ts)$/.test(e.name)) continue    // 13 视图 + 16 视图测试
        if (/^photos.*\.test\.ts$/.test(e.name)) continue          // photosLayoutHeightCap 等
        out.push(p)
      }
    }
    return out
  }

  const files = collectSources(SRC_DIR)
  const corpus = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')

  it('data fetch is valid (found files, content is non-empty)', () => {
    expect(files.length).toBeGreaterThan(100)
    expect(corpus.length).toBeGreaterThan(10000)
  })

  it('no key in the slice is referenced anywhere outside the Photos surface', () => {
    // Allow-list: keys that genuinely are referenced outside the Photos surface but are **deliberately**
    // kept in the slice anyway. Each entry must document why — adding one means adding another spot the
    // open-source side has to handle as a leftover.
    const ALLOW = new Set<string>([])
    const used = zhKeys
      .filter((k) => !ALLOW.has(k))
      .filter((k) => new RegExp(`['"\`]${k}['"\`]`).test(corpus))
    expect(used, `分片键被相册面之外引用(删分片会让那处渲染出 key 名): ${used.join(', ')}`).toEqual([])
  })
})

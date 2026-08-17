// SP7-P7a-T15: SearchResultTile.vue — single search result tile (shared by photo/long-tail grids).
// Structure deduplication (brief struct spec 4 decision): Vue2 PhotosSearchView.vue repeated same 8-line markup
// twice (:243-250 and :261-268), New-UI extracted to standalone file, visual 1:1 per element, structure deduplicated.
// Each corresponds to task-15-brief.md "required test list" section B tile part + two-leg audit (scss :2711-2770,
// skip :2728-2738 dead CSS). Only mock @nimotech/nimoos-service thumbnailUrl.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { ScoredPhoto } from '../../util/searchSort'
import { assetToPhoto, type Photo } from '../../util/assetToPhoto'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import SearchResultTile from '../SearchResultTile.vue'
import searchResultTileRaw from '../SearchResultTile.vue?raw'
import themingDocRaw from '../../../../docs/THEMING.md?raw'
import { extractStyleBlock } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function photo(id: string, overrides: Partial<Photo> = {}): Photo {
  return { ...assetToPhoto({ id, mimeType: 'image/jpeg' }), ...overrides }
}

function scored(id: string, score: number | null, overrides: Partial<Photo> = {}): ScoredPhoto {
  return { p: photo(id, overrides), score }
}

function mountTile(result: ScoredPhoto, i18n = makeI18n()) {
  return mount(SearchResultTile, { props: { result }, global: { plugins: [i18n] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

describe('Media type badge (four states, ternary order: isVideo > hasOcr > photo)', () => {
  it('Pure photo → data-type="photo"', () => {
    const w = mountTile(scored('1', 0.9))
    expect(w.get('.type-badge').attributes('data-type')).toBe('photo')
  })
  it('isVideo → data-type="video"', () => {
    const w = mountTile(scored('1', 0.9, { isVideo: true }))
    expect(w.get('.type-badge').attributes('data-type')).toBe('video')
  })
  it('hasOcr → data-type="ocr"', () => {
    const w = mountTile(scored('1', 0.9, { hasOcr: true }))
    expect(w.get('.type-badge').attributes('data-type')).toBe('ocr')
  })
  it('isVideo and hasOcr both true → video wins (ternary order, not ocr)', () => {
    const w = mountTile(scored('1', 0.9, { isVideo: true, hasOcr: true }))
    expect(w.get('.type-badge').attributes('data-type')).toBe('video')
  })
})

describe('Match source (ocr text hit vs semantic similarity percent, mutually exclusive)', () => {
  it("matchedBy: 'ocr' → shows .match-source and no .match-score", () => {
    const w = mountTile(scored('1', 1, { matchedBy: 'ocr' }))
    expect(w.find('.match-source').exists()).toBe(true)
    expect(w.find('.match-score').exists()).toBe(false)
    expect(w.get('.match-source').text()).toBe('文本匹配')
  })
  it("matchedBy: 'semantic' + score: 0.87 → .match-score text 87%", () => {
    const w = mountTile(scored('1', 0.87, { matchedBy: 'semantic' }))
    expect(w.find('.match-source').exists()).toBe(false)
    expect(w.get('.match-score').text()).toBe('87%')
  })
  it('score: null (and not ocr) → neither shows', () => {
    const w = mountTile({ p: photo('1', { matchedBy: null }), score: null })
    expect(w.find('.match-source').exists()).toBe(false)
    expect(w.find('.match-score').exists()).toBe(false)
  })
})

describe('Favorite star', () => {
  it('fav: true → .tile-fav exists', () => {
    const w = mountTile(scored('1', 0.9, { fav: true }))
    expect(w.find('.tile-fav').exists()).toBe(true)
  })
  it('fav: false → .tile-fav absent', () => {
    const w = mountTile(scored('1', 0.9, { fav: false }))
    expect(w.find('.tile-fav').exists()).toBe(false)
  })
  // fix round 1 · I1 (review Important required): previously only asserted whether .tile-fav exists,
  // never asserted star <path d> itself — review mutation changed final `6-.9z`→`6-.8z` and all 50 tests still pass,
  // proves this guard didn't exist. d copied char-by-char from Vue2 PhotosIcon.vue star branch.
  it('fav: true → star path d matches PhotosIcon.vue char-by-char', () => {
    const w = mountTile(scored('1', 0.9, { fav: true }))
    expect(w.get('.tile-fav svg path').attributes('d')).toBe('M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z')
  })
})

describe('Interaction', () => {
  it('Click tile → emit open with r.p', () => {
    const r = scored('42', 0.5)
    const w = mountTile(r)
    w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([r.p])
  })
  it("thumbnailUrl arguments are (id, 'small')", () => {
    mountTile(scored('7', 0.5))
    expect(thumbnailUrl).toHaveBeenCalledWith('7', 'small')
  })
  it('img has loading="lazy" and empty alt (per Vue2 :244)', () => {
    const w = mountTile(scored('1', 0.5))
    const img = w.get('img')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('alt')).toBe('')
  })
})

describe('i18n', () => {
  it('Three badge texts correct in English locale', () => {
    const wPhoto = mountTile(scored('1', 0.9), makeI18n('en_us'))
    expect(wPhoto.get('.type-badge').text()).toBe('Photo')
    const wVideo = mountTile(scored('1', 0.9, { isVideo: true }), makeI18n('en_us'))
    expect(wVideo.get('.type-badge').text()).toBe('Video')
    const wOcr = mountTile(scored('1', 0.9, { hasOcr: true }), makeI18n('en_us'))
    expect(wOcr.get('.type-badge').text()).toBe('OCR')
  })
})

// extractStyleBlock strips CSS comments first (avoid comments above rules being merged into selector,
// see comment at top of cssCascade.ts), so use it for selector/property matching; but this test
// precisely needs to check "what the comment itself says", must keep raw comments,
// write separate extractor that doesn't strip comments (logic same as color-guard.test.ts styleLines,
// dedicated for this file).
function rawStyleBlock(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('Style block not found')
  return m[1]
}

// ── Two-leg audit: scss :2711-2772 (skip :2728-2738 dead CSS) + tile self structure styles ──────
describe('Styles: badge foreground color compliant + theme-exception three prohibitions + dead CSS not migrated', () => {
  const styleText = extractStyleBlock(searchResultTileRaw)
  const rawStyleText = rawStyleBlock(searchResultTileRaw)

  it('Style text non-empty (guard against silent no-op)', () => {
    expect(styleText.trim().length).toBeGreaterThan(0)
  })

  it('.match-badge not in styles (dead CSS, scss:2728-2738 not migrated)', () => {
    expect(styleText).not.toMatch(/\.match-badge/)
  })

  it('Rules with four badge classes don\'t contain --on-accent (overlaid on photo, disable saturated solid foreground semantic)', () => {
    expect(styleText).not.toMatch(/--on-accent/)
  })

  it('Three badge tokens referenced (--badge-photo/--badge-video/--badge-ocr)', () => {
    expect(styleText).toMatch(/--badge-photo/)
    expect(styleText).toMatch(/--badge-video/)
    expect(styleText).toMatch(/--badge-ocr/)
  })

  // fix round 1 · I2 (review Important required, brief:81 explicitly required but previously missing):
  // three tokens only registered in docs/THEMING.md text, previously no guard — delete that line, tokens
  // regress to "magic color appearing out of nowhere in theme.css", full suite still all green.
  // § 6 exception list is only searchable index, must pin it. File reading guard first asserts non-empty
  // (else no-op, color-guard historically no-op'd once), then assert each three token names once
  // (three independent assertions, delete any and it fails).
  it('docs/THEMING.md can find three badge tokens (only searchable index, prevent token-doc loss of sync)', () => {
    expect(themingDocRaw.trim().length).toBeGreaterThan(0)
    expect(themingDocRaw).toContain('--badge-photo')
    expect(themingDocRaw).toContain('--badge-video')
    expect(themingDocRaw).toContain('--badge-ocr')
  })

  it('Each theme-exception comment\'s next declaration is the exempted literal, comment text has no ; / } / hex #', () => {
    const lines = rawStyleText.split('\n')
    const exceptionLines: number[] = []
    lines.forEach((l, i) => { if (l.includes('theme-exception')) exceptionLines.push(i) })
    expect(exceptionLines.length).toBeGreaterThan(0)
    for (const i of exceptionLines) {
      // Comment may span lines (e.g., .tile-fav here), find where comment truly ends
      // (line with `*/`), then check adjacent declaration line after — consistent with
      // color-guard.test.ts "exemption applies to next ; or }" state machine semantic,
      // not requiring comment physically on one line.
      let closeIdx = i
      while (closeIdx < lines.length && !lines[closeIdx].includes('*/')) closeIdx++
      expect(closeIdx, `theme-exception comment at line ${i} didn't find closing */`).toBeLessThan(lines.length)
      // Comment text itself (span i..closeIdx) cannot contain literal color or statement terminators
      // (else color-guard's line-by-line state machine misinterprets as declaration, prematurely closes
      // exemption window or false-reports bare color).
      const commentBody = lines.slice(i, closeIdx + 1).join('\n').replace(/\/\*|\*\//g, '')
      expect(commentBody).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(commentBody).not.toContain(';')
      // fix round 1 · M-2 (review merged in): test title says "no ; / } / hex #" three prohibitions,
      // but previously only asserted ; and #, missed } — } in comment also lets color-guard's line-by-line state machine
      // (fix wave F4 reference sweep, source-check true value: real line is color-guard.test.ts:98
      // `if (line.includes(';') || line.includes('}')) exempt = false` — line :96 actually is
      // `if (HEX.test(bare) || FUNC.test(bare)) offenders.push(...)`, different check in same forEach,
      // not this one) prematurely close exemption window, consequence same as ; must assert together.
      expect(commentBody).not.toContain('}')
      // Adjacent declaration truly exists: same line (comment + declaration together) or next line.
      const closeLine = lines[closeIdx]
      const sameLineHasDecl = /:\s*[^;]+;/.test(closeLine.replace(/\/\*[\s\S]*?\*\//, ''))
      const nextLineHasDecl = closeIdx + 1 < lines.length && /:\s*[^;]+;/.test(lines[closeIdx + 1])
      expect(sameLineHasDecl || nextLineHasDecl).toBe(true)
    }
  })

  // fix round 1 · M-5 (review merged in, controller approved): .tile border-radius follows PhotosGrid.vue 8px,
  // not Vue2 photos.scss:323 (`.photos-root .tile` rule body `border-radius: 3px`, fix wave F4 source-check
  // correction, previously mistaken as :112 which is `.photos-root .app` font setting)
  // 3px — reason same origin as D2 (.grid column width), prevent search result tiles having sharper corners than gallery tiles on same device.
  it('.tile rule body border-radius is 8px (same as PhotosGrid.vue, not Vue2 3px)', () => {
    const m = /\.tile\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '.tile rule body not found').toBeTruthy()
    expect(m![1]).toMatch(/border-radius:\s*8px/)
  })

  it('.tile-overlay rule body contains gradient background and transition (two-leg: inline/scss non-color property)', () => {
    const m = /\.tile-overlay\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '.tile-overlay rule body not found').toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/opacity:\s*0/)
    expect(body).toMatch(/transition:\s*opacity 0\.18s ease/)
    expect(body).toMatch(/z-index:\s*3/)
    expect(body).toMatch(/pointer-events:\s*none/)
  })

  it('.type-badge base class contains text-transform/letter-spacing/font-weight/backdrop-filter/box-shadow (D3, each not missed)', () => {
    const m = /(?<!\[data-type[^{]*)\.type-badge\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '.type-badge base class rule body not found').toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/text-transform:\s*uppercase/)
    expect(body).toMatch(/letter-spacing:\s*0\.05em/)
    expect(body).toMatch(/font-weight:\s*700/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(8px\)/)
    expect(body).toMatch(/box-shadow:/)
  })

  it('.match-source rule body contains backdrop-filter + box-shadow (D4)', () => {
    const m = /\.match-source\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '.match-source rule body not found').toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/backdrop-filter:\s*blur\(8px\)/)
    expect(body).toMatch(/box-shadow:/)
    expect(body).toMatch(/text-transform:\s*uppercase/)
  })

  it('.tile-fav rule body contains filter: drop-shadow (D5 precedent, favorite star shadow)', () => {
    const m = /\.tile-fav\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '.tile-fav rule body not found').toBeTruthy()
    expect(m![1]).toMatch(/filter:\s*drop-shadow/)
  })
})

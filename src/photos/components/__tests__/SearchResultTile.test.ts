// SearchResultTile.vue — a single search-result tile (shared by the photo grid and the
// long-tail grid). Structure dedup: Vue2 PhotosSearchView.vue duplicated the same 8-line markup
// twice (:243-250 and :261-268); New-UI extracts it into its own file, matching the visuals
// element-for-element while deduplicating the structure.
// Covers the tile portion of section B of the required test checklist, plus a two-pronged audit
// (scss :2711-2770, skipping the dead CSS at :2728-2738). Only @nimotech/nimoos-service's
// thumbnailUrl is mocked.
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

import { readFileSync } from 'node:fs'
import SearchResultTile from '../SearchResultTile.vue'
import searchResultTileRaw from '../SearchResultTile.vue?raw'
import themingDocRaw from '../../../../docs/THEMING.md?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'

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

describe('media type badge (four states, ternary priority: isVideo > hasOcr > photo)', () => {
  it('plain photo → data-type="photo"', () => {
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
  it('isVideo and hasOcr both true → video wins (ternary priority, not ocr)', () => {
    const w = mountTile(scored('1', 0.9, { isVideo: true, hasOcr: true }))
    expect(w.get('.type-badge').attributes('data-type')).toBe('video')
  })
})

describe('match source (ocr text hit vs semantic similarity percentage, mutually exclusive)', () => {
  it("matchedBy: 'ocr' → renders .match-source and no .match-score", () => {
    const w = mountTile(scored('1', 1, { matchedBy: 'ocr' }))
    expect(w.find('.match-source').exists()).toBe(true)
    expect(w.find('.match-score').exists()).toBe(false)
    expect(w.get('.match-source').text()).toBe('文本匹配')
  })
  it("matchedBy: 'semantic' + score: 0.87 → .match-score text is 87%", () => {
    const w = mountTile(scored('1', 0.87, { matchedBy: 'semantic' }))
    expect(w.find('.match-source').exists()).toBe(false)
    expect(w.get('.match-score').text()).toBe('87%')
  })
  it('score: null (and not ocr) → neither is present', () => {
    const w = mountTile({ p: photo('1', { matchedBy: null }), score: null })
    expect(w.find('.match-source').exists()).toBe(false)
    expect(w.find('.match-score').exists()).toBe(false)
  })
})

describe('favorite star', () => {
  it('fav: true → .tile-fav is present', () => {
    const w = mountTile(scored('1', 0.9, { fav: true }))
    expect(w.find('.tile-fav').exists()).toBe(true)
  })
  it('fav: false → .tile-fav is absent', () => {
    const w = mountTile(scored('1', 0.9, { fav: false }))
    expect(w.find('.tile-fav').exists()).toBe(false)
  })
  // Previously this only asserted whether .tile-fav existed, never asserted the star
  // <path d> string itself — a mutation test changing the trailing `6-.9z` to `6-.8z` still left
  // all 50 cases green, proving this guard didn't exist before. The `d` value is copied
  // character-for-character from Vue2 PhotosIcon.vue's star branch.
  it('fav: true → star\'s path d matches PhotosIcon.vue byte-for-byte', () => {
    const w = mountTile(scored('1', 0.9, { fav: true }))
    expect(w.get('.tile-fav svg path').attributes('d')).toBe('M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z')
  })
})

describe('interaction', () => {
  it('clicking the tile → emits open with r.p', () => {
    const r = scored('42', 0.5)
    const w = mountTile(r)
    w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([r.p])
  })
  it("thumbnailUrl's arguments are (id, 'small')", () => {
    mountTile(scored('7', 0.5))
    expect(thumbnailUrl).toHaveBeenCalledWith('7', 'small')
  })
  it('img has loading="lazy" and empty alt (matching Vue2 :244)', () => {
    const w = mountTile(scored('1', 0.5))
    const img = w.get('img')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('alt')).toBe('')
  })
})

describe('i18n', () => {
  it('all three badge labels are correct under the en_us locale', () => {
    const wPhoto = mountTile(scored('1', 0.9), makeI18n('en_us'))
    expect(wPhoto.get('.type-badge').text()).toBe('Photo')
    const wVideo = mountTile(scored('1', 0.9, { isVideo: true }), makeI18n('en_us'))
    expect(wVideo.get('.type-badge').text()).toBe('Video')
    const wOcr = mountTile(scored('1', 0.9, { hasOcr: true }), makeI18n('en_us'))
    expect(wOcr.get('.type-badge').text()).toBe('OCR')
  })
})

// extractStyleBlock strips CSS comments first (to keep a comment above a rule from being merged
// into the selector during parsing, per cssCascade.ts's own header comment), so it's used for
// selector/property matching; but this test specifically needs to check what the comment text
// itself says, so the original comments must be kept — hence a separate, comment-preserving
// extractor here (same logic as color-guard.test.ts's styleLines, just for this file).
function rawStyleBlock(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('未找到样式块')
  return m[1]
}

// ── Two-pronged audit: scss :2711-2772 (skipping the dead CSS at :2728-2738) + the tile's own structural styles ──────
describe('styles: badge foreground color compliance + theme-exception triple ban + unmigrated dead CSS', () => {
  const styleText = extractStyleBlock(searchResultTileRaw)
  const rawStyleText = rawStyleBlock(searchResultTileRaw)

  it('style text is non-empty (guards against a silently no-op check)', () => {
    expect(styleText.trim().length).toBeGreaterThan(0)
  })

  it('.match-badge is not in the style block (dead CSS, scss:2728-2738 never migrated)', () => {
    expect(styleText).not.toMatch(/\.match-badge/)
  })

  it('rules for the four badge classes do not contain --on-accent (they sit over a photo, saturated solid foreground color semantics are banned)', () => {
    expect(styleText).not.toMatch(/--on-accent/)
  })

  it('the three badge tokens are referenced (--badge-photo/--badge-video/--badge-ocr)', () => {
    expect(styleText).toMatch(/--badge-photo/)
    expect(styleText).toMatch(/--badge-video/)
    expect(styleText).toMatch(/--badge-ocr/)
  })

  // The three tokens' registration only lived in prose inside docs/THEMING.md, with no guard
  // for it at all — deleting that line would silently turn the token into "a magic color that
  // appears out of nowhere in theme.css," with the whole suite still green. The §6 exception
  // list is the only checkable index and must be pinned down. The file-reading guard first
  // asserts non-empty (a prior real incident: this guard once ran against an empty read and
  // vacuously passed), then asserts each of the three token names individually — three
  // independent assertions so deleting any one turns the test red.
  it('docs/THEMING.md documents all three badge tokens (the only checkable index, keeps tokens and docs from drifting apart)', () => {
    expect(themingDocRaw.trim().length).toBeGreaterThan(0)
    expect(themingDocRaw).toContain('--badge-photo')
    expect(themingDocRaw).toContain('--badge-video')
    expect(themingDocRaw).toContain('--badge-ocr')
  })

  it('the declaration immediately following every theme-exception comment is the exempted literal declaration, and the comment text excludes ; / } / a literal #', () => {
    const lines = rawStyleText.split('\n')
    const exceptionLines: number[] = []
    lines.forEach((l, i) => { if (l.includes('theme-exception')) exceptionLines.push(i) })
    expect(exceptionLines.length).toBeGreaterThan(0)
    for (const i of exceptionLines) {
      // A comment may span multiple lines (the .tile-fav one in this file does), so first find
      // the line where the comment block actually closes (the one containing `*/`), then check
      // the declaration line immediately following it — matching color-guard.test.ts's own
      // "exemption applies until the next ; or }" state-machine semantics, rather than requiring
      // the comment to physically occupy a single line.
      let closeIdx = i
      while (closeIdx < lines.length && !lines[closeIdx].includes('*/')) closeIdx++
      expect(closeIdx, `第 ${i} 行的 theme-exception 注释没有找到闭合 */`).toBeLessThan(lines.length)
      // The comment text itself (the whole span from i..closeIdx) must not contain a literal
      // color value or a statement terminator (otherwise color-guard's line-by-line state
      // machine would misread it as a declaration, closing the exemption window early or
      // false-flagging a bare color).
      const commentBody = lines.slice(i, closeIdx + 1).join('\n').replace(/\/\*|\*\//g, '')
      expect(commentBody).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(commentBody).not.toContain(';')
      // The test title says "excludes ; / } / a literal #" as the three bans, but previously
      // only ; and # were asserted, missing } — a } appearing in the comment would likewise make
      // color-guard's line-by-line state machine close the exemption window early, with the same
      // consequence as a stray ;, so it must be asserted alongside it. (Citation check: the real
      // line is color-guard.test.ts:98, `if (line.includes(';') || line.includes('}')) exempt =
      // false`; line :96 is actually a different check in the same forEach,
      // `if (HEX.test(bare) || FUNC.test(bare)) offenders.push(...)`.)
      expect(commentBody).not.toContain('}')
      // The adjacent declaration genuinely exists: either on the same line as the comment, or on the line immediately following it.
      const closeLine = lines[closeIdx]
      const sameLineHasDecl = /:\s*[^;]+;/.test(closeLine.replace(/\/\*[\s\S]*?\*\//, ''))
      const nextLineHasDecl = closeIdx + 1 < lines.length && /:\s*[^;]+;/.test(lines[closeIdx + 1])
      expect(sameLineHasDecl || nextLineHasDecl).toBe(true)
    }
  })

  // Note: this test used to pin ("8px to
  // match PhotosGrid.vue, not Vue2's 3px, so search tiles aren't sharper-cornered than library
  // tiles") stopped being true once PhotosGrid.vue's own grid re-skin reverted ITS
  // tiles back to Vue2 parity's 3px (predating this change; `grep -n "border-radius"
  // src/photos/components/PhotosGrid.vue` has zero hits). Keeping 8px here would have recreated
  // the exact inconsistency the deviation was meant to avoid, just inverted. The whole `.tile`
  // rule (background + border-radius) is deleted from this component's scoped style — it was a
  // byte-for-byte duplicate of vue2-parity/photos.scss's own `.photos-root .tile` (:427-430)
  // once background used the correct local `--surface-2` instead of the leaking generic
  // `--chip-bg`, so nothing is lost handing it over outright.
  it('this component\'s scoped style no longer contains a .tile rule (fully handed over to parity, including the border-radius and background fixes)', () => {
    const rules = parseCssRules(styleText)
    expect(rules.some((r) => r.selectors.length === 1 && r.selectors[0] === '.tile')).toBe(false)
  })

  it('parity scss: .photos-root .tile rule contains border-radius: 3px / background: var(--surface-2)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find(
      (r) => r.selectors.length === 1 && r.selectors[0] === '.photos-root .tile',
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/border-radius:\s*3px/)
    expect(rule?.body).toMatch(/background:\s*var\(--surface-2\)/)
  })

  it('this component\'s style block no longer references --chip-bg (the global glass token .tile\'s background used to misuse; the name may still appear for historical context in script comments, so only the style block is checked)', () => {
    expect(styleText).not.toMatch(/--chip-bg\b/)
  })

  it('.tile-overlay rule body has a gradient background and transition (two legs: inline/scss non-color properties)', () => {
    const m = /\.tile-overlay\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .tile-overlay 规则体').toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/opacity:\s*0/)
    expect(body).toMatch(/transition:\s*opacity 0\.18s ease/)
    expect(body).toMatch(/z-index:\s*3/)
    expect(body).toMatch(/pointer-events:\s*none/)
  })

  it('.type-badge base class contains text-transform/letter-spacing/font-weight/backdrop-filter/box-shadow (D3, nothing missing)', () => {
    const m = /(?<!\[data-type[^{]*)\.type-badge\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .type-badge 基类规则体').toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/text-transform:\s*uppercase/)
    expect(body).toMatch(/letter-spacing:\s*0\.05em/)
    expect(body).toMatch(/font-weight:\s*700/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(8px\)/)
    expect(body).toMatch(/box-shadow:/)
  })

  it('.match-source rule body contains backdrop-filter + box-shadow', () => {
    const m = /\.match-source\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .match-source 规则体').toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/backdrop-filter:\s*blur\(8px\)/)
    expect(body).toMatch(/box-shadow:/)
    expect(body).toMatch(/text-transform:\s*uppercase/)
  })

  it('.tile-fav rule body contains filter: drop-shadow (D5 precedent, favorite-star shadow)', () => {
    const m = /\.tile-fav\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .tile-fav 规则体').toBeTruthy()
    expect(m![1]).toMatch(/filter:\s*drop-shadow/)
  })
})

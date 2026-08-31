// PersonAssetGrid.vue — person detail page asset grid by month
// (multi-select / detach / expand all per month). Pure display + emit, no store access, only mock
// @nimotech/nimoos-service thumbnailUrl (same mock approach as PhotosGrid.test.ts / PersonHero.test.ts).
// Each section follows the Vue 2 panel's src/views/Photos/PhotosPersonDetail.vue:
// 132-154 (grid template), :760-763 (assetThumb, size=large), :868-883 (select logic).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PersonAssetGrid from '../PersonAssetGrid.vue'
// Task 5 (Plan D) shadowing cleanup moved the `.tile-check`/`.tile-detach` hover-reveal
// family out of this component and into the shared parity file (they now duplicate parity
// anchors there instead of here) — the two describe blocks below that assert on that CSS
// text (jsdom does no cascade/computed-style, so structural assertions on the raw <style>
// text are the only way to pin opacity/hover/transition behavior — same precedent as
// color-guard.test.ts) now read parity's raw source instead of the component's.
//
// Read via `node:fs`, NOT `import '...scss?raw'`: Vite's CSS plugin claims `.scss` (like
// `.css`) as a side-effect-only module — under Vitest a `?raw` import of it resolves to an
// empty string (same landmine color-guard.test.ts's own header comment already documents for
// `.css`; confirmed here to apply to `.scss` too — a `?raw` import silently returned `''`,
// which made every rule lookup below fail before this was found).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const photosPeopleParityRaw = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/vue2-parity/photos-people.scss'),
  'utf8',
)
import { assetToPhoto, type Month, type Photo } from '../../util/assetToPhoto'

function photo(
  id: string | number,
  opts: Partial<{ isVideo: boolean; durationMs: number; placeName: string }> = {},
): Photo {
  return assetToPhoto({
    id,
    mimeType: opts.isVideo ? 'video/mp4' : 'image/jpeg',
    durationMs: opts.durationMs,
    placeName: opts.placeName,
  })
}

function month(key: string, title: string, photos: Photo[]): Month {
  return { key, title, loc: '', photos }
}

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

const mounted: VueWrapper[] = []
function mountGrid(props: { months: Month[]; selected: Array<string | number>; selectionMode: boolean }) {
  const w = mount(PersonAssetGrid, { props, global: { plugins: [makeI18n()] } })
  mounted.push(w)
  return w
}

beforeEach(() => {
  svc.photos.thumbnailUrl.mockClear()
})
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

describe('PersonAssetGrid.vue — month header', () => {
  it('Render m.title and real count (photosPeoplePhotosCount); additionally display first photo\'s place', () => {
    const months = [month('2026-07', 'July 2026', [photo('a', { placeName: 'Paris' }), photo('b')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.get('.person-month-head .title').text()).toBe('July 2026')
    expect(w.get('.person-month-head .sub').text()).toContain('2 张照片')
    expect(w.get('.person-month-head .sub').text()).toContain('Paris')
  })

  it('First photo of that month has no place → do not render place section', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.get('.person-month-head .sub').text()).not.toContain('·')
  })
})

describe('PersonAssetGrid.vue — expand all per month (plan registration item 8)', () => {
  it('20 photos → default render 16 tiles + "Show all 20" button; click shows 20 and changes to "Collapse"; click again back to 16', async () => {
    const photos = Array.from({ length: 20 }, (_, i) => photo(`p${i}`))
    const months = [month('2026-07', 'July 2026', photos)]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.findAll('.tile')).toHaveLength(16)
    const btn = w.get('[data-test="show-all-toggle"]')
    expect(btn.text()).toBe('查看全部 20 张')

    await btn.trigger('click')
    expect(w.findAll('.tile')).toHaveLength(20)
    expect(w.get('[data-test="show-all-toggle"]').text()).toBe('收起')

    await w.get('[data-test="show-all-toggle"]').trigger('click')
    expect(w.findAll('.tile')).toHaveLength(16)
  })

  it('Exactly 16 photos (boundary) → no "Show all" button, all 16 render', () => {
    const photos = Array.from({ length: 16 }, (_, i) => photo(`p${i}`))
    const months = [month('2026-07', 'July 2026', photos)]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.find('[data-test="show-all-toggle"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(16)
  })
})

describe('PersonAssetGrid.vue — thumbnail URL', () => {
  it('Tile img.src uses thumbnailUrl(id, "large"), not small', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('a', 'large')
    expect(w.get('.tile img').attributes('src')).toBe('mock://thumb/a/large')
  })
})

describe('PersonAssetGrid.vue — click and .stop isolation', () => {
  it('Click tile → emit open with that photo', async () => {
    const p = photo('a')
    const months = [month('2026-07', 'July 2026', [p])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    await w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([p])
  })

  // Coordinator decision (Vue2 :874-880 onTileClick single entry branching, not pushed to container):
  // component receives selectionMode prop, decision stays inside component — reason in fix report
  // § "Whole-cell click branch returned to component".
  it('selectionMode=true, click whole cell → emit toggle-select with that id, no emit open (negative assertion)', async () => {
    const p = photo('a')
    const months = [month('2026-07', 'July 2026', [p])]
    const w = mountGrid({ months, selected: [], selectionMode: true })
    await w.get('.tile').trigger('click')
    expect(w.emitted('toggle-select')?.[0]).toEqual(['a'])
    expect(w.emitted('open')).toBeUndefined()
  })

  it('selectionMode=false, click whole cell → emit open with that photo, no emit toggle-select (negative assertion)', async () => {
    const p = photo('a')
    const months = [month('2026-07', 'July 2026', [p])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    await w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([p])
    expect(w.emitted('toggle-select')).toBeUndefined()
  })

  it('Click checkbox → emit toggle-select and no emit open (.stop restoration)', async () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    await w.get('.tile-check').trigger('click')
    expect(w.emitted('toggle-select')?.[0]).toEqual(['a'])
    expect(w.emitted('open')).toBeUndefined()
  })

  it('Click detach button → emit detach([id]) and no emit open (.stop restoration)', async () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    await w.get('.tile-detach').trigger('click')
    expect(w.emitted('detach')?.[0]).toEqual([['a']])
    expect(w.emitted('open')).toBeUndefined()
  })

  it('Checkbox title toggles between "Select"/"Deselect" based on selection state', () => {
    const months = [month('2026-07', 'July 2026', [photo('a'), photo('b')])]
    const w = mountGrid({ months, selected: ['a'], selectionMode: false })
    const boxes = w.findAll('.tile-check')
    expect(boxes[0].attributes('title')).toBe('取消选择')
    expect(boxes[1].attributes('title')).toBe('选择')
  })
})

describe('PersonAssetGrid.vue — detach button not rendered in selectionMode (negative assertion)', () => {
  it('selectionMode===true → do not render .tile-detach; selectionMode===false → render', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const wOn = mountGrid({ months, selected: [], selectionMode: true })
    expect(wOn.find('.tile-detach').exists()).toBe(false)

    const wOff = mountGrid({ months, selected: [], selectionMode: false })
    expect(wOff.find('.tile-detach').exists()).toBe(true)
  })
})

describe('PersonAssetGrid.vue — law: cross-type comparison of selected and photo.id', () => {
  it('selected passes number, photo.id is string → still determine as selected', () => {
    const months = [month('2026-07', 'July 2026', [photo('42')])]
    const w = mountGrid({ months, selected: [42], selectionMode: false })
    expect(w.get('.tile').attributes('data-selected')).toBe('true')
  })

  it('selected passes string, photo.id is number → still determine as selected (reverse)', () => {
    const months = [month('2026-07', 'July 2026', [photo(42)])]
    const w = mountGrid({ months, selected: ['42'], selectionMode: false })
    expect(w.get('.tile').attributes('data-selected')).toBe('true')
  })

  it('selected is empty array → do not determine as selected', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.get('.tile').attributes('data-selected')).toBe('false')
  })
})

describe('PersonAssetGrid.vue — empty state', () => {
  it('months is empty → render photosPersonNoPhotos empty state text', () => {
    const w = mountGrid({ months: [], selected: [], selectionMode: false })
    expect(w.text()).toContain('这个人还没有照片')
    expect(w.find('.tile').exists()).toBe(false)
  })
})

// Override controls (.tile-check/.tile-detach) default transparent, only visible in hover/select state —
// per Vue2 PhotosPersonDetail.vue:1148-1216 item-by-item, same precedent established in this repo
// PhotosGrid.vue:374-376 (.tile-check-box). jsdom does not perform cascade style calculation
// (cannot read real hover result after mount), so this test group directly parses <style> raw CSS rules
// for structure assertion, rather than asserting getComputedStyle.
interface CssRule { selectors: string[]; body: string }

// Task 5 (Plan D): rewritten brace-depth-aware and recursive (was a naive
// `/([^{}]+)\{([^}]*)\}/g` regex that assumed CSS never nests — broke the moment this function
// started reading parity's `photos-people.scss`, which turns out to be ONE single SCSS nesting
// scope: the entire file is wrapped in one outer `.photos-root { … }` (confirmed by counting
// braces — it opens on line 1 and its matching close is the file's very last `}`), with every
// other selector (`.detail-hero`, `.person-grid .tile .tile-detach`, etc.) nested one level
// inside it exactly as written in the source (SCSS compiles the `.photos-root` ancestor prefix
// onto them; the source text itself doesn't repeat it). The old regex — and an earlier,
// simpler top-level-only rewrite — both only ever surfaced that one outer rule. This version
// recursively descends into every matched brace pair so every selector at every nesting depth
// gets its own entry, each keyed by its own local selector text (unqualified by any ancestor),
// which is exactly what every lookup in this file queries by.
function parseCssRules(styleText: string): CssRule[] {
  const rules: CssRule[] = []
  function parseScope(text: string): void {
    let i = 0
    while (i < text.length) {
      const braceIdx = text.indexOf('{', i)
      if (braceIdx === -1) break
      const selectorText = text.slice(i, braceIdx)
      let depth = 1
      let j = braceIdx + 1
      for (; j < text.length && depth > 0; j++) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
      }
      const body = text.slice(braceIdx + 1, j - 1)
      const selectors = selectorText.split(',').map((s) => s.trim()).filter(Boolean)
      if (selectors.length) rules.push({ selectors, body })
      parseScope(body)
      i = j
    }
  }
  parseScope(styleText)
  return rules
}

function extractStyleBlock(src: string): string {
  // Task 5 (Plan D): also accepts a plain `.scss` source with no `<style>` wrapper at all
  // (the parity file is not an SFC) — fall back to the whole text in that case.
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  const body = m ? m[1] : src
  // First strip CSS comments: parseCssRules treats everything before `{` as selector list,
  // comments above rules get merged into selectors, breaks ownRuleBody's "selector list exactly equals one" check
  // (hit during final review Minor 3 when adding comment).
  return body.replace(/\/\*[\s\S]*?\*\//g, '')
}

// Find rule body where "selector list exactly equals the given single selector"
// (used for element's own default state style, not visible state rule overridden by other combos).
function ownRuleBody(rules: CssRule[], selector: string): string {
  const hit = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === selector)
  if (!hit) throw new Error(`Standalone rule not found: ${selector}`)
  return hit.body
}

// Find rule body where "selector list contains all given selectors" (used for finding
// combined rule that forces hover/select state visible, selector list need not be exactly equal,
// allows extra selectors grouped together).
function findRuleBodyContainingAll(rules: CssRule[], required: string[]): string | undefined {
  const hit = rules.find((r) => required.every((sel) => r.selectors.includes(sel)))
  return hit?.body
}

// Task 5 (Plan D) shadowing cleanup moved this whole rule family out of the component and
// into the shared parity file (src/photos/styles/vue2-parity/photos-people.scss), which now
// duplicates Vue2's own PhotosPersonDetail.vue:1259-1331 (::v-deep stripped) directly — so
// these two describe blocks now read parity's raw source, and every selector below carries
// the `.person-grid .tile` prefix parity uses (a plain global stylesheet, not component-scoped).
describe('PersonAssetGrid.vue — override control default transparent, only visible in hover/select (per Vue2 :1148-1216, now carried by parity)', () => {
  const rules = parseCssRules(extractStyleBlock(photosPeopleParityRaw))

  it('.tile-check default opacity:0 (per Vue2 :1199)', () => {
    expect(ownRuleBody(rules, '.person-grid .tile .tile-check')).toMatch(/opacity:\s*0\b/)
  })

  it('.tile-detach default opacity:0 (per Vue2 :1162)', () => {
    expect(ownRuleBody(rules, '.person-grid .tile .tile-detach')).toMatch(/opacity:\s*0\b/)
  })

  it('.tile:hover forces .tile-check visible (per Vue2 :1203-1208)', () => {
    const body = findRuleBodyContainingAll(rules, ['.person-grid .tile:hover .tile-check'])
    expect(body).toBeDefined()
    expect(body).toMatch(/opacity:\s*1\b/)
  })

  it('.tile:hover forces .tile-detach visible (per Vue2 :1168-1171)', () => {
    const body = findRuleBodyContainingAll(rules, ['.person-grid .tile:hover .tile-detach'])
    expect(body).toBeDefined()
    expect(body).toMatch(/opacity:\s*1\b/)
  })

  it('In selectionMode or when selected, .tile-check also forced visible, no hover needed (per Vue2 :1204-1205)', () => {
    const body = findRuleBodyContainingAll(rules, [
      '.person-grid .tile:hover .tile-check',
      '.person-grid .tile[data-selection-mode="true"] .tile-check',
      '.person-grid .tile[data-selected="true"] .tile-check',
    ])
    expect(body).toBeDefined()
    expect(body).toMatch(/opacity:\s*1\b/)
  })

  it('.tile-detach has no selectionMode/selected force-visible rule (Vue2 original only adds those two to tile-check, tile-detach does not — literal copy, not omission)', () => {
    expect(findRuleBodyContainingAll(rules, ['.person-grid .tile[data-selection-mode="true"] .tile-detach'])).toBeUndefined()
    expect(findRuleBodyContainingAll(rules, ['.person-grid .tile[data-selected="true"] .tile-detach'])).toBeUndefined()
  })
})

// ── control's own **self** :hover feedback + select dimming + geometry trace alignment ────────
// Original impl only has "whole cell hover → button fade in", zero feedback when mouse on button itself; add the
// "detach" button lacks Vue2's danger color, noting that stacking these makes the **destructive** detach ×
// unrecognizable as delete key.
// This rule family moved into parity together with the previous describe block;
// `--remove-bg` (this app's theme-following token) has likewise been replaced by parity's
// `var(--danger, #FF3860)` (Vue2's own literal fixed color, see the deviations tracked during
// that port) — the assertions below have been updated to match the new expected values.
describe('PersonAssetGrid.vue — control self :hover and selected state (per Vue2 :1148-1222, now carried by parity)', () => {
  const rules = parseCssRules(extractStyleBlock(photosPeopleParityRaw))

  it('.tile-check:hover self darkens (Vue2 :1209-1212 background + border-color)', () => {
    const body = ownRuleBody(rules, '.person-grid .tile .tile-check:hover')
    expect(body).toMatch(/background:/)
    expect(body).toMatch(/border-color:/)
  })

  it('.tile-detach:hover self turns danger color (Vue2 :1172-1177: solid danger fill + light icon + transparent border)', () => {
    const body = ownRuleBody(rules, '.person-grid .tile .tile-detach:hover')
    expect(body).toMatch(/background:\s*var\(--danger,\s*#FF3860\)/)
    expect(body).toMatch(/border-color:\s*transparent/)
    expect(body).toMatch(/color:/)
  })

  it('Both controls transition covers background (else hover color is hard cut, Vue2 :1163,1202)', () => {
    expect(ownRuleBody(rules, '.person-grid .tile .tile-check')).toMatch(/transition:[^;]*background/)
    expect(ownRuleBody(rules, '.person-grid .tile .tile-detach')).toMatch(/transition:[^;]*background/)
  })

  it('Selected tile dims image opacity .85 (Vue2 :1222)', () => {
    expect(ownRuleBody(rules, '.person-grid .tile[data-selected="true"] img')).toMatch(/opacity:\s*0?\.85\b/)
  })

  it('Geometry per Vue2 effective values: check 20px/offset 6px/2px border, detach 22px/offset 6px + backdrop-filter', () => {
    const check = ownRuleBody(rules, '.person-grid .tile .tile-check')
    expect(check).toMatch(/width:\s*20px/)
    expect(check).toMatch(/height:\s*20px/)
    expect(check).toMatch(/top:\s*6px/)
    expect(check).toMatch(/left:\s*6px/)
    expect(check).toMatch(/border:\s*2px\s+solid/)

    const detach = ownRuleBody(rules, '.person-grid .tile .tile-detach')
    expect(detach).toMatch(/width:\s*22px/)
    expect(detach).toMatch(/height:\s*22px/)
    expect(detach).toMatch(/top:\s*6px/)
    expect(detach).toMatch(/right:\s*6px/)
    expect(detach).toMatch(/backdrop-filter:/)
  })

  it('Icon nominal size per Vue2 effective values: check 12px, x 15px', () => {
    const w = mountGrid({ months: [month('2026-05', '2026 年 5 月', [photo('a1')])], selected: ['a1'], selectionMode: true })
    const check = w.get('.tile-check-icon')
    expect(check.attributes('width')).toBe('12')
    expect(check.attributes('height')).toBe('12')

    const w2 = mountGrid({ months: [month('2026-05', '2026 年 5 月', [photo('a1')])], selected: [], selectionMode: false })
    const x = w2.get('.tile-detach svg')
    expect(x.attributes('width')).toBe('15')
    expect(x.attributes('height')).toBe('15')
  })
})

// placesMapThemes.ts — map theme preset table + resolveMapTheme
// semantics. Corresponds to the mandatory test checklist item-by-item, plus a character-for-character
// assertion for all 26 color values and 5 dead-code-removal checks.
//
// Updated for the Vue 2 panel PR #106 sub-commits 1-3 (git show
// 78cf3335) — the dotBg contrast finals (bumped twice: 0.10→0.20→0.30, plus the ocean/sand/mono
// variants) and the custom-mode picker remap (Land dot color → dotBg via hexToRgba fixed-alpha
// wash, City light color → dot solid, bg/grid following isLight). CUSTOM_GRID_DEFAULT is renamed
// CUSTOM_CITY_DEFAULT here for the same reason Vue2 renamed its own `customGridColor` field to
// `customCityColor`: the value it names now feeds the *city light* dot, never a grid line.
import { describe, expect, it } from 'vitest'
import {
  CUSTOM_CITY_DEFAULT,
  CUSTOM_DOT_DEFAULT,
  MAP_THEME_PRESETS,
  hexToRgba,
  mapThemeStyleVars,
  resolveMapTheme,
  swatchColors,
} from '../placesMapThemes'

// ── Preset table: id/nameKey/descKey completeness ──────────────────────────────────────────
describe('MAP_THEME_PRESETS completeness', () => {
  it('exactly 4 presets, id order is default/ocean/sand/mono', () => {
    expect(MAP_THEME_PRESETS.map((p) => p.id)).toEqual(['default', 'ocean', 'sand', 'mono'])
  })

  it('every preset\'s nameKey/descKey is a photosPlacesTheme* key', () => {
    expect(MAP_THEME_PRESETS.map((p) => p.nameKey)).toEqual([
      'photosPlacesThemeDefault', 'photosPlacesThemeOcean', 'photosPlacesThemeSand', 'photosPlacesThemeMono',
    ])
    expect(MAP_THEME_PRESETS.map((p) => p.descKey)).toEqual([
      'photosPlacesThemeDescDefault', 'photosPlacesThemeDescOcean', 'photosPlacesThemeDescSand', 'photosPlacesThemeDescMono',
    ])
  })
})

// ── 26 color values asserted character-for-character (Vue2 PhotosPlacesView.vue:88-113, not one character may change) ────────
describe('26 color values asserted character-for-character (fidelity porting contract)', () => {
  it('default preset', () => {
    const p = MAP_THEME_PRESETS[0]
    expect(p.bg).toBe('#0A0A0C')
    expect(p.land).toBe('#6E5BFF')
    expect(p.dot).toBe('#6E5BFF')
    expect(p.light).toEqual({
      bg: 'oklch(0.975 0.004 80)',
      grid: 'rgba(28,28,30,0.07)',
      dotBg: 'rgba(28,28,30,0.30)',
      dot: '#6E5BFF',
    })
  })

  it('ocean preset', () => {
    const p = MAP_THEME_PRESETS[1]
    expect(p.bg).toBe('#0a121a')
    expect(p.land).toBe('#5AC8FA')
    expect(p.dot).toBe('#5AC8FA')
    expect(p.light).toEqual({
      bg: 'oklch(0.97 0.008 230)',
      grid: 'rgba(10,100,160,0.08)',
      dotBg: 'rgba(10,100,160,0.32)',
      dot: '#0A84C2',
    })
  })

  it('sand preset', () => {
    const p = MAP_THEME_PRESETS[2]
    expect(p.bg).toBe('#1a1612')
    expect(p.land).toBe('#FF9F0A')
    expect(p.dot).toBe('#FF9F0A')
    expect(p.light).toEqual({
      bg: 'oklch(0.97 0.008 80)',
      grid: 'rgba(120,80,0,0.08)',
      dotBg: 'rgba(120,80,0,0.32)',
      dot: '#C77800',
    })
  })

  it('mono preset', () => {
    const p = MAP_THEME_PRESETS[3]
    expect(p.bg).toBe('#0A0A0C')
    expect(p.land).toBe('#9aa0a6')
    expect(p.dot).toBe('#e0e0e0')
    expect(p.light).toEqual({
      bg: 'oklch(0.975 0.004 80)',
      grid: 'rgba(28,28,30,0.08)',
      dotBg: 'rgba(28,28,30,0.34)',
      dot: '#3C4043',
    })
  })

  it('the two custom default colors (Vue2 :86-87)', () => {
    expect(CUSTOM_DOT_DEFAULT).toBe('#6E5BFF')
    expect(CUSTOM_CITY_DEFAULT).toBe('#9C8EFF')
  })
})

// ── hexToRgba: the fixed-0.30-alpha conversion helper for custom mode's land-dot matrix (Vue2 :67-79) ────────
describe('hexToRgba', () => {
  it('6-digit hex converts to rgba, alpha passed through as-is', () => {
    expect(hexToRgba('#111111', 0.3)).toBe('rgba(17,17,17,0.3)')
  })

  it('3-digit hex is expanded before converting', () => {
    expect(hexToRgba('#fff', 0.5)).toBe('rgba(255,255,255,0.5)')
  })

  it('recognized even without a # prefix', () => {
    expect(hexToRgba('abcdef', 1)).toBe('rgba(171,205,239,1)')
  })

  it('non-hex input passes through unchanged (Vue2 :72-73\'s degrade path)', () => {
    expect(hexToRgba('not-a-color', 0.3)).toBe('not-a-color')
  })
})

// ── resolveMapTheme semantics (Vue2 :134-151, the custom branch updated per #106 sub-commit 3) ───
describe('resolveMapTheme', () => {
  it('custom mode + dark: bg/grid take the dark literals, dot takes customCityColor as-is, dotBg is customDotColor run through hexToRgba(0.30) as a wash', () => {
    expect(resolveMapTheme('custom', '#111111', '#222222', false)).toEqual({
      bg: '#0A0A0C', grid: 'rgba(255,255,255,0.04)', dot: '#222222', dotBg: 'rgba(17,17,17,0.3)',
    })
  })

  it('custom mode + light: bg/grid follow the default preset\'s light variant, dot/dotBg unchanged (#106 sub-commit 3: the custom canvas now follows the app theme instead of being hardcoded dark)', () => {
    expect(resolveMapTheme('custom', '#111111', '#222222', true)).toEqual({
      bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.07)', dot: '#222222', dotBg: 'rgba(17,17,17,0.3)',
    })
  })

  it('ocean + dark: grid comes from the land field (not a grid field)', () => {
    expect(resolveMapTheme('ocean', '#111111', '#222222', false)).toEqual({
      bg: '#0a121a', dot: '#5AC8FA', grid: '#5AC8FA', dotBg: null,
    })
  })

  it('ocean + light: all four fields come from light.*', () => {
    expect(resolveMapTheme('ocean', '#111111', '#222222', true)).toEqual({
      bg: 'oklch(0.97 0.008 230)', dot: '#0A84C2', grid: 'rgba(10,100,160,0.08)', dotBg: 'rgba(10,100,160,0.32)',
    })
  })

  it('unknown id falls back to default, dark', () => {
    expect(resolveMapTheme('nonexistent', '#111111', '#222222', false)).toEqual({
      bg: '#0A0A0C', dot: '#6E5BFF', grid: '#6E5BFF', dotBg: null,
    })
  })

  it('unknown id falls back to default, light', () => {
    expect(resolveMapTheme('nonexistent', '#111111', '#222222', true)).toEqual({
      bg: 'oklch(0.975 0.004 80)', dot: '#6E5BFF', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.30)',
    })
  })
})

// ── mapThemeStyleVars: dotBg's conditional spread (Vue2 :974) ─────────────────────────────
describe('mapThemeStyleVars', () => {
  it('when dotBg is null, the result has no --map-dot-bg key', () => {
    const vars = mapThemeStyleVars({ bg: '#0A0A0C', dot: '#6E5BFF', grid: '#6E5BFF', dotBg: null })
    expect(vars).toEqual({ background: '#0A0A0C', '--map-dot': '#6E5BFF', '--map-grid': '#6E5BFF' })
    expect('--map-dot-bg' in vars).toBe(false)
  })

  it('when dotBg is non-null, the result has a --map-dot-bg key', () => {
    const vars = mapThemeStyleVars({ bg: 'oklch(0.975 0.004 80)', dot: '#6E5BFF', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.10)' })
    expect(vars).toEqual({
      background: 'oklch(0.975 0.004 80)',
      '--map-dot': '#6E5BFF',
      '--map-grid': 'rgba(28,28,30,0.07)',
      '--map-dot-bg': 'rgba(28,28,30,0.10)',
    })
  })
})

// ── swatchColors: each light/dark state takes the corresponding bg/dot (Vue2 :921-922) ─────────────────────
describe('swatchColors', () => {
  it('dark: takes the preset\'s own bg/dot', () => {
    expect(swatchColors(MAP_THEME_PRESETS[1], false)).toEqual({ bg: '#0a121a', dot: '#5AC8FA' })
  })

  it('light: takes the preset\'s light.bg / light.dot', () => {
    expect(swatchColors(MAP_THEME_PRESETS[1], true)).toEqual({ bg: 'oklch(0.97 0.008 230)', dot: '#0A84C2' })
  })
})

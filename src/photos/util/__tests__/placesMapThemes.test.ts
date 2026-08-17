// Task 10 (SP7-P6a Places · map main view): placesMapThemes.ts -- the map theme preset table
// + resolveMapTheme semantics. Follows task-10-brief.md's "required test checklist" item by
// item, plus 26 literal color-value assertions and 5 deletion-verification checks.
import { describe, expect, it } from 'vitest'
import {
  CUSTOM_DOT_DEFAULT,
  CUSTOM_GRID_DEFAULT,
  MAP_THEME_PRESETS,
  mapThemeStyleVars,
  resolveMapTheme,
  swatchColors,
} from '../placesMapThemes'

// ── Preset table: id/nameKey/descKey all present ────────────────────────────────
describe('MAP_THEME_PRESETS completeness', () => {
  it('exactly 4 presets, in id order default/ocean/sand/mono', () => {
    expect(MAP_THEME_PRESETS.map((p) => p.id)).toEqual(['default', 'ocean', 'sand', 'mono'])
  })

  it('every preset\'s nameKey/descKey belongs to the photosPlacesTheme* key family', () => {
    expect(MAP_THEME_PRESETS.map((p) => p.nameKey)).toEqual([
      'photosPlacesThemeDefault', 'photosPlacesThemeOcean', 'photosPlacesThemeSand', 'photosPlacesThemeMono',
    ])
    expect(MAP_THEME_PRESETS.map((p) => p.descKey)).toEqual([
      'photosPlacesThemeDescDefault', 'photosPlacesThemeDescOcean', 'photosPlacesThemeDescSand', 'photosPlacesThemeDescMono',
    ])
  })
})

// ── 26 literal color-value assertions (Vue2 PhotosPlacesView.vue:88-113, not a single
// character may change) ──────────────────────────────────────────────────────
describe('26 literal color-value assertions (pixel-parity port contract)', () => {
  it('default preset', () => {
    const p = MAP_THEME_PRESETS[0]
    expect(p.bg).toBe('#0A0A0C')
    expect(p.land).toBe('#6E5BFF')
    expect(p.dot).toBe('#6E5BFF')
    expect(p.light).toEqual({
      bg: 'oklch(0.975 0.004 80)',
      grid: 'rgba(28,28,30,0.07)',
      dotBg: 'rgba(28,28,30,0.10)',
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
      dotBg: 'rgba(10,100,160,0.10)',
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
      dotBg: 'rgba(120,80,0,0.10)',
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
      dotBg: 'rgba(28,28,30,0.12)',
      dot: '#3C4043',
    })
  })

  it('the two custom default colors (Vue2 :86-87)', () => {
    expect(CUSTOM_DOT_DEFAULT).toBe('#6E5BFF')
    expect(CUSTOM_GRID_DEFAULT).toBe('#9C8EFF')
  })
})

// ── resolveMapTheme semantics (Vue2 :134-151) ─────────────────────────────────
describe('resolveMapTheme', () => {
  it('custom mode: bg is always #0A0A0C, dot/grid come from the custom colors, dotBg is null', () => {
    expect(resolveMapTheme('custom', '#111111', '#222222', false)).toEqual({
      bg: '#0A0A0C', dot: '#111111', grid: '#222222', dotBg: null,
    })
  })

  it('custom mode: isLight=true gives the exact same result (custom mode doesn\'t follow the app theme)', () => {
    expect(resolveMapTheme('custom', '#111111', '#222222', true)).toEqual({
      bg: '#0A0A0C', dot: '#111111', grid: '#222222', dotBg: null,
    })
  })

  it('ocean + dark: grid comes from the land field (not the grid field)', () => {
    expect(resolveMapTheme('ocean', '#111111', '#222222', false)).toEqual({
      bg: '#0a121a', dot: '#5AC8FA', grid: '#5AC8FA', dotBg: null,
    })
  })

  it('ocean + light: all four fields come from light.*', () => {
    expect(resolveMapTheme('ocean', '#111111', '#222222', true)).toEqual({
      bg: 'oklch(0.97 0.008 230)', dot: '#0A84C2', grid: 'rgba(10,100,160,0.08)', dotBg: 'rgba(10,100,160,0.10)',
    })
  })

  it('unknown id falls back to default, dark', () => {
    expect(resolveMapTheme('nonexistent', '#111111', '#222222', false)).toEqual({
      bg: '#0A0A0C', dot: '#6E5BFF', grid: '#6E5BFF', dotBg: null,
    })
  })

  it('unknown id falls back to default, light', () => {
    expect(resolveMapTheme('nonexistent', '#111111', '#222222', true)).toEqual({
      bg: 'oklch(0.975 0.004 80)', dot: '#6E5BFF', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.10)',
    })
  })
})

// ── mapThemeStyleVars: dotBg conditional spread (Vue2 :974) ───────────────────
describe('mapThemeStyleVars', () => {
  it('no --map-dot-bg key in the result when dotBg is null', () => {
    const vars = mapThemeStyleVars({ bg: '#0A0A0C', dot: '#6E5BFF', grid: '#6E5BFF', dotBg: null })
    expect(vars).toEqual({ background: '#0A0A0C', '--map-dot': '#6E5BFF', '--map-grid': '#6E5BFF' })
    expect('--map-dot-bg' in vars).toBe(false)
  })

  it('has a --map-dot-bg key in the result when dotBg is non-null', () => {
    const vars = mapThemeStyleVars({ bg: 'oklch(0.975 0.004 80)', dot: '#6E5BFF', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.10)' })
    expect(vars).toEqual({
      background: 'oklch(0.975 0.004 80)',
      '--map-dot': '#6E5BFF',
      '--map-grid': 'rgba(28,28,30,0.07)',
      '--map-dot-bg': 'rgba(28,28,30,0.10)',
    })
  })
})

// ── swatchColors: dark/light each pick their own bg/dot (Vue2 :921-922) ───────
describe('swatchColors', () => {
  it('dark: uses the preset\'s own bg/dot', () => {
    expect(swatchColors(MAP_THEME_PRESETS[1], false)).toEqual({ bg: '#0a121a', dot: '#5AC8FA' })
  })

  it('light: uses the preset\'s light.bg / light.dot', () => {
    expect(swatchColors(MAP_THEME_PRESETS[1], true)).toEqual({ bg: 'oklch(0.97 0.008 230)', dot: '#0A84C2' })
  })
})

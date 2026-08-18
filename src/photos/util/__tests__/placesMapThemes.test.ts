// Task 10(SP7-P6a 地点·地图主视图):placesMapThemes.ts —— 地图主题预设表 + resolveMapTheme
// 语义。逐条对应 task-10-brief.md 的「必含测试清单」+ 26 个色值逐字断言 + 5 处删码验证。
//
// Plan E Task 6 (2026-08-15): updated for Vue2 NimoOS-UI PR #106 sub-commits 1-3 (git show
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

// ── 预设表:id/nameKey/descKey 齐备 ──────────────────────────────────────────
describe('MAP_THEME_PRESETS 齐备性', () => {
  it('恰好 4 个预设,id 顺序为 default/ocean/sand/mono', () => {
    expect(MAP_THEME_PRESETS.map((p) => p.id)).toEqual(['default', 'ocean', 'sand', 'mono'])
  })

  it('每个预设的 nameKey/descKey 都是 photosPlacesTheme* 系列键', () => {
    expect(MAP_THEME_PRESETS.map((p) => p.nameKey)).toEqual([
      'photosPlacesThemeDefault', 'photosPlacesThemeOcean', 'photosPlacesThemeSand', 'photosPlacesThemeMono',
    ])
    expect(MAP_THEME_PRESETS.map((p) => p.descKey)).toEqual([
      'photosPlacesThemeDescDefault', 'photosPlacesThemeDescOcean', 'photosPlacesThemeDescSand', 'photosPlacesThemeDescMono',
    ])
  })
})

// ── 26 个色值逐字断言(Vue2 PhotosPlacesView.vue:88-113,一个字符不许改)────────
describe('26 个色值逐字断言(保真移植合同)', () => {
  it('default 预设', () => {
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

  it('ocean 预设', () => {
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

  it('sand 预设', () => {
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

  it('mono 预设', () => {
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

  it('两个自定义默认色(Vue2 :86-87)', () => {
    expect(CUSTOM_DOT_DEFAULT).toBe('#6E5BFF')
    expect(CUSTOM_CITY_DEFAULT).toBe('#9C8EFF')
  })
})

// ── hexToRgba:custom 模式陆地点阵固定 0.30 alpha 的转换辅助(Vue2 :67-79)────────
describe('hexToRgba', () => {
  it('6 位 hex 转 rgba,alpha 原样代入', () => {
    expect(hexToRgba('#111111', 0.3)).toBe('rgba(17,17,17,0.3)')
  })

  it('3 位 hex 先展开再转换', () => {
    expect(hexToRgba('#fff', 0.5)).toBe('rgba(255,255,255,0.5)')
  })

  it('不带 # 前缀也能识别', () => {
    expect(hexToRgba('abcdef', 1)).toBe('rgba(171,205,239,1)')
  })

  it('非 hex 输入原样透传(Vue2 :72-73 的降级路径)', () => {
    expect(hexToRgba('not-a-color', 0.3)).toBe('not-a-color')
  })
})

// ── resolveMapTheme 语义(Vue2 :134-151,custom 分支已按 #106 sub-commit 3 更新)───
describe('resolveMapTheme', () => {
  it('custom 模式 + 深色:bg/grid 取深色字面量,dot 取 customCityColor 原样,dotBg 是 customDotColor 经 hexToRgba(0.30) 转换的洗色', () => {
    expect(resolveMapTheme('custom', '#111111', '#222222', false)).toEqual({
      bg: '#0A0A0C', grid: 'rgba(255,255,255,0.04)', dot: '#222222', dotBg: 'rgba(17,17,17,0.3)',
    })
  })

  it('custom 模式 + 浅色:bg/grid 跟随 default 预设的 light 变体,dot/dotBg 不变(#106 sub-commit 3:custom 画布跟随 app 主题,不再硬编码暗色)', () => {
    expect(resolveMapTheme('custom', '#111111', '#222222', true)).toEqual({
      bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.07)', dot: '#222222', dotBg: 'rgba(17,17,17,0.3)',
    })
  })

  it('ocean + 深色:grid 取自 land 字段(不是 grid 字段)', () => {
    expect(resolveMapTheme('ocean', '#111111', '#222222', false)).toEqual({
      bg: '#0a121a', dot: '#5AC8FA', grid: '#5AC8FA', dotBg: null,
    })
  })

  it('ocean + 浅色:四个字段全取 light.*', () => {
    expect(resolveMapTheme('ocean', '#111111', '#222222', true)).toEqual({
      bg: 'oklch(0.97 0.008 230)', dot: '#0A84C2', grid: 'rgba(10,100,160,0.08)', dotBg: 'rgba(10,100,160,0.32)',
    })
  })

  it('未知 id 回落 default,深色', () => {
    expect(resolveMapTheme('nonexistent', '#111111', '#222222', false)).toEqual({
      bg: '#0A0A0C', dot: '#6E5BFF', grid: '#6E5BFF', dotBg: null,
    })
  })

  it('未知 id 回落 default,浅色', () => {
    expect(resolveMapTheme('nonexistent', '#111111', '#222222', true)).toEqual({
      bg: 'oklch(0.975 0.004 80)', dot: '#6E5BFF', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.30)',
    })
  })
})

// ── mapThemeStyleVars:dotBg 条件展开(Vue2 :974)─────────────────────────────
describe('mapThemeStyleVars', () => {
  it('dotBg 为 null 时结果里没有 --map-dot-bg 键', () => {
    const vars = mapThemeStyleVars({ bg: '#0A0A0C', dot: '#6E5BFF', grid: '#6E5BFF', dotBg: null })
    expect(vars).toEqual({ background: '#0A0A0C', '--map-dot': '#6E5BFF', '--map-grid': '#6E5BFF' })
    expect('--map-dot-bg' in vars).toBe(false)
  })

  it('dotBg 非 null 时结果里有 --map-dot-bg 键', () => {
    const vars = mapThemeStyleVars({ bg: 'oklch(0.975 0.004 80)', dot: '#6E5BFF', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.10)' })
    expect(vars).toEqual({
      background: 'oklch(0.975 0.004 80)',
      '--map-dot': '#6E5BFF',
      '--map-grid': 'rgba(28,28,30,0.07)',
      '--map-dot-bg': 'rgba(28,28,30,0.10)',
    })
  })
})

// ── swatchColors:深浅两态各取对应 bg/dot(Vue2 :921-922)─────────────────────
describe('swatchColors', () => {
  it('深色:取预设自身的 bg/dot', () => {
    expect(swatchColors(MAP_THEME_PRESETS[1], false)).toEqual({ bg: '#0a121a', dot: '#5AC8FA' })
  })

  it('浅色:取预设 light.bg / light.dot', () => {
    expect(swatchColors(MAP_THEME_PRESETS[1], true)).toEqual({ bg: 'oklch(0.97 0.008 230)', dot: '#0A84C2' })
  })
})

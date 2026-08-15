// Task 10(SP7-P6a 地点·地图主视图):地图主题预设表 + `resolveMapTheme` / `mapThemeStyleVars` /
// `swatchColors`。逐条照 Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:
//   :85-113   (data() 里的 mapTheme/customDotColor/customCityColor/mapThemes 初值)
//   :134-151  (currentTheme computed —— resolveMapTheme 的语义来源)
//   :952/:974 (主题色怎么注入到 zoombar 的 --accent 与 <svg> 的 background/--map-*)
// 消费方:src/photos/components/PlacesThemeMenu.vue(本任务同建,弹层展示)、
// src/photos/components/PlacesMap.vue(T6,吃 mapThemeStyleVars() 的产物当 :style)。
//
// ── 这是 spec SP7 D5 批准的第三类例外(数据可视化调色板,不是应用皮肤)──────────────
// 下面 28 个色值(4 预设 × 7 字段:bg/land/dot + light.{bg,grid,dotBg,dot})+ 两个自定义
// 默认色是用户可在"地图主题"弹层里挑选的地图可视化配色,
// 与 New-UI 的蓝/白两套应用主题(src/styles/theme.css)正交:同一个应用主题下,用户仍可
// 在 4 个地图预设之间自由切换;这组色值必须原样保留(4 预设各自的深浅两态色调是产品
// 设计决策,不是"忘了 token 化"的遗留硬编码)。先例见 src/photos/util/peopleView.ts 的
// `PLACE_PALETTE`(P5-T12,人物详情页地点 tab 的 7 色分类色板,同一条 docs/THEMING.md
// §6 例外登记)。值放在这个 .ts 文件而不是 theme.css:color-guard(src/styles/
// color-guard.test.ts)只扫 .vue 的 <style> 块与 .css 文件,不扫 .ts —— 这组色值本就不该
// 造 26 个一次性 theme token,放这里是刻意选择,已在 docs/THEMING.md §6 登记一行。
//
// Plan E Task 6 (2026-08-15): landed Vue2 PR #106 sub-commits 1-3 (git show 78cf3335) that this
// module had not yet ported:
//  1. Contrast finals — every `light.dotBg` value below was bumped from its pre-#106 literal
//     (0.10/0.10/0.10/0.12) to the shipped final (0.30/0.32/0.32/0.34) so the unvisited land-dot
//     matrix reads against the near-white canvas as clearly as it does against the dark one.
//  2. Custom-mode picker remap — `resolveMapTheme`'s `'custom'` branch now matches what the two
//     pickers' labels actually promise: "Land dot color" feeds `dotBg` (a fixed-0.30-alpha wash
//     via `hexToRgba`, below), "City light color" feeds `dot` (a solid fill). The pre-#106
//     mapping had them backwards (dot ← land-picker's raw hex, grid ← city-picker's raw hex) —
//     Vue2 caught this via the same PR and renamed its own `customGridColor` field to
//     `customCityColor` once the field stopped meaning "grid line color"; this module's own
//     `CUSTOM_GRID_DEFAULT` export is renamed `CUSTOM_CITY_DEFAULT` for the identical reason.
//  3. Custom canvas follows app theme — `bg`/`grid` in custom mode now switch on `isLight`
//     (using `MAP_THEME_PRESETS[0]`'s dark/light pair) instead of being hardcoded to the dark
//     literal `#0A0A0C` regardless of theme — the pre-#106 behavior turned the map black the
//     moment a color was picked, even on a light app theme.
// None of this touches which *signal* selects light vs dark (see next paragraph) — sub-commits
// 1-3 are pure value/mapping fixes, orthogonal to sub-commit 4 (Task 5's perf port) and to the
// D5 signal-source paragraph below.
//
// 「浅色变体的触发信号」(D5):本任务把 P6a 当时的决定(读全局 `useThemeStore().theme`)
// 撤回,改回读 photos 私有主题(`usePhotosTheme()`,与 `.photos-root.is-light` 同源)——
// 与 spec 2026-08-11 §4 给 `usePhotosTheme.ts` 本身写的理由一致("Vue2 私有开关的语义回归,
// 推翻 New-UI 早前'只跟全局'的决定"),这次是把地图这一处补齐到同一条规则,不是新决定。
// 调用方(容器组件 PhotosPlaces.vue)从 `usePhotosTheme().theme` 算出 isLight 布尔值传进来,
// 本模块的函数保持纯函数、不直接依赖任何 store/composable。

export interface MapThemePreset {
  id: 'default' | 'ocean' | 'sand' | 'mono'
  nameKey: string // i18n 键,如 photosPlacesThemeDefault
  descKey: string // i18n 键,如 photosPlacesThemeDescDefault
  bg: string
  land: string
  dot: string
  light: { bg: string, grid: string, dotBg: string, dot: string }
}

// 28 个色值(4 预设 × 7 字段)逐字抄 Vue2 currentTheme/mapThemes 终态(git show 78cf3335,
// PR #106 sub-commit 1-2 落地后的值,一个字符不许改)。light.dotBg 是本任务改动的 4 个字段
// ——pre-#106 时曾是 0.10/0.10/0.10/0.12,PR #106 两次提对比度后终值见下。
export const MAP_THEME_PRESETS: readonly MapThemePreset[] = [
  {
    id: 'default',
    nameKey: 'photosPlacesThemeDefault',
    descKey: 'photosPlacesThemeDescDefault',
    bg: '#0A0A0C', land: '#6E5BFF', dot: '#6E5BFF',
    light: { bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.30)', dot: '#6E5BFF' },
  },
  {
    id: 'ocean',
    nameKey: 'photosPlacesThemeOcean',
    descKey: 'photosPlacesThemeDescOcean',
    bg: '#0a121a', land: '#5AC8FA', dot: '#5AC8FA',
    light: { bg: 'oklch(0.97 0.008 230)', grid: 'rgba(10,100,160,0.08)', dotBg: 'rgba(10,100,160,0.32)', dot: '#0A84C2' },
  },
  {
    id: 'sand',
    nameKey: 'photosPlacesThemeSand',
    descKey: 'photosPlacesThemeDescSand',
    bg: '#1a1612', land: '#FF9F0A', dot: '#FF9F0A',
    light: { bg: 'oklch(0.97 0.008 80)', grid: 'rgba(120,80,0,0.08)', dotBg: 'rgba(120,80,0,0.32)', dot: '#C77800' },
  },
  {
    id: 'mono',
    nameKey: 'photosPlacesThemeMono',
    descKey: 'photosPlacesThemeDescMono',
    bg: '#0A0A0C', land: '#9aa0a6', dot: '#e0e0e0',
    light: { bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.08)', dotBg: 'rgba(28,28,30,0.34)', dot: '#3C4043' },
  },
] as const

// 自定义取色器默认值(Vue2 :86-87)。usePhotosPlaces store(T3)已各自校验并回落到这两个
// 值——两处字面量刻意不共享一个模块(store 有自己的注释指回同一处 Vue2 源行),这里单独
// 导出给弹层组件与本文件的其它测试用,不建跨模块依赖。CUSTOM_CITY_DEFAULT 是本任务从
// CUSTOM_GRID_DEFAULT 改名(同 Vue2 customGridColor→customCityColor 的改名理由,见上方
// 头注释②),值本身不变。
export const CUSTOM_DOT_DEFAULT = '#6E5BFF'
export const CUSTOM_CITY_DEFAULT = '#9C8EFF'

// Vue2 :67-79 的逐字移植:#RGB / #RRGGBB → rgba() at the given alpha. Used by the custom map
// theme so a picked land-dot colour renders as a wash (unlit) instead of a solid fill, keeping
// the lit-vs-unlit hierarchy the presets have. Non-hex input passes through unchanged (Vue2's
// own degrade path when the browser's `<input type="color">` somehow yields a non-hex string).
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(String(hex ?? '').trim())
  if (!m) return hex
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = Number.parseInt(h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export interface ResolvedMapTheme {
  bg: string
  dot: string
  grid: string
  dotBg: string | null
}

/**
 * Vue2 currentTheme computed(:134-151,#106 sub-commit 3 之后的终态)的纯函数版。
 * - mapTheme === 'custom'(#106 sub-commit 3 remap):
 *   - bg/grid 跟随 isLight——浅色取 MAP_THEME_PRESETS[0].light 的对应字段,深色 bg 是深空
 *     字面量 `#0A0A0C`、grid 是字面量 `rgba(255,255,255,0.04)`(与 --map-grid 的 CSS 回落值
 *     同一个数,custom 模式下无条件注入所以不会真的走那条 CSS 回落,但值保持一致)。
 *     pre-#106 时 bg 是恒定的深色字面量,不管 app 主题深浅——那正是这次要修的 bug(取色器
 *     一动,浅色地图就翻黑)。
 *   - dot 直接取 customCityColor("City light color" 拾色器的当前值,solid 填充,不经转换)。
 *   - dotBg 取 customDotColor 经 hexToRgba(…, 0.30) 转换后的洗色("Land dot color" 拾色器,
 *     固定 0.30 alpha,与预设的 dotBg 语义对齐——都是"未点亮陆地点阵"的半透明底色)。
 *   pre-#106 时 dot/grid 分别直接接 customDotColor/customGridColor 的原始 hex(两个拾色器的
 *   语义与它们的标签"Land dot color"/"City light color"完全对不上,dotBg 恒为 null)。
 * - 否则按 id 查预设,查不到回落 MAP_THEME_PRESETS[0]。
 * - isLight 且预设有 light 变体:四个字段全取 light.*。
 * - 否则(深色,默认路径):bg/dot 取预设自身,**grid 取 land 字段**(:150 的实际写法,
 *   不是想当然的 grid 字段——Vue2 预设对象上根本没有独立的 grid 字段,深色地图网格线用
 *   的就是陆地点阵色)。dotBg 恒为 null(深色分支从不给陆地点阵底色)。
 */
export function resolveMapTheme(
  mapTheme: string,
  customDotColor: string,
  customCityColor: string,
  isLight: boolean,
): ResolvedMapTheme {
  if (mapTheme === 'custom') {
    const base = MAP_THEME_PRESETS[0]
    return {
      bg: isLight ? base.light.bg : base.bg,
      grid: isLight ? base.light.grid : 'rgba(255,255,255,0.04)',
      dot: customCityColor,
      dotBg: hexToRgba(customDotColor, 0.30),
    }
  }
  const preset = MAP_THEME_PRESETS.find((p) => p.id === mapTheme) ?? MAP_THEME_PRESETS[0]
  if (isLight && preset.light) {
    return { bg: preset.light.bg, dot: preset.light.dot, grid: preset.light.grid, dotBg: preset.light.dotBg }
  }
  return { bg: preset.bg, dot: preset.dot, grid: preset.land, dotBg: null }
}

/**
 * Vue2 :974 的注入点:`Object.assign({ background, --map-dot, --map-grid }, dotBg ? { --map-dot-bg } : {})`。
 * `--map-dot-bg` 只在 dotBg 非 null 时才加入结果——PlacesMap.vue(T6)的 `.world-dot` 靠
 * `var(--map-dot-bg, var(--map-dot-bg-fallback))` 吃这个条件展开的回落语义,若这里改成
 * 无条件注入,深色主题下地面点阵会失去它自己的回落色。
 */
// 评审 M5:--map-grid 在 P6a 无消费方——它在 Vue2 的唯一消费者是 .world-graticule /
// .world-equator(经纬线网格),而那组规则已被本期判定为死码、明确不迁(PlacesMap.vue 没有
// 渲染任何经纬线元素)。这里仍照搬 Vue2 无条件注入 --map-grid,不是遗漏,只是登记
// (体例照 PlacesMap.vue:122-124 已为 --map-dot 回落做过的登记)。
export function mapThemeStyleVars(t: ResolvedMapTheme): Record<string, string> {
  const vars: Record<string, string> = {
    background: t.bg,
    '--map-dot': t.dot,
    '--map-grid': t.grid,
  }
  if (t.dotBg !== null) vars['--map-dot-bg'] = t.dotBg
  return vars
}

/**
 * 弹层里色板小方块用:深浅两态各取预设对应的 bg/dot(Vue2 :921-922 的两处三元)。
 * 与 resolveMapTheme 不同——这里永远只服务预设本身的预览色,不涉及 'custom' 分支
 * (custom 没有实体预设对象,弹层里那两个色块是两个 <input type="color">,不经过这个函数)。
 */
export function swatchColors(p: MapThemePreset, isLight: boolean): { bg: string, dot: string } {
  if (isLight) return { bg: p.light.bg, dot: p.light.dot }
  return { bg: p.bg, dot: p.dot }
}

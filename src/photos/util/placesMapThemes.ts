// Task 10(SP7-P6a 地点·地图主视图):地图主题预设表 + `resolveMapTheme` / `mapThemeStyleVars` /
// `swatchColors`。逐条照 Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:
//   :85-113   (data() 里的 mapTheme/customDotColor/customGridColor/mapThemes 初值)
//   :134-151  (currentTheme computed —— resolveMapTheme 的语义来源)
//   :952/:974 (主题色怎么注入到 zoombar 的 --accent 与 <svg> 的 background/--map-*)
// 消费方:src/photos/components/PlacesThemeMenu.vue(本任务同建,弹层展示)、
// src/photos/components/PlacesMap.vue(T6,吃 mapThemeStyleVars() 的产物当 :style)。
//
// ── 这是 spec SP7 D5 批准的第三类例外(数据可视化调色板,不是应用皮肤)──────────────
// 下面 26 个色值 + 两个自定义默认色是用户可在"地图主题"弹层里挑选的地图可视化配色,
// 与 New-UI 的蓝/白两套应用主题(src/styles/theme.css)正交:同一个应用主题下,用户仍可
// 在 4 个地图预设之间自由切换;这组色值必须原样保留(4 预设各自的深浅两态色调是产品
// 设计决策,不是"忘了 token 化"的遗留硬编码)。先例见 src/photos/util/peopleView.ts 的
// `PLACE_PALETTE`(P5-T12,人物详情页地点 tab 的 7 色分类色板,同一条 docs/THEMING.md
// §6 例外登记)。值放在这个 .ts 文件而不是 theme.css:color-guard(src/styles/
// color-guard.test.ts)只扫 .vue 的 <style> 块与 .css 文件,不扫 .ts —— 这组色值本就不该
// 造 26 个一次性 theme token,放这里是刻意选择,已在 docs/THEMING.md §6 登记一行。
//
// 「浅色变体的触发信号」是本期(D5)相对 Vue2 的唯一语义变化:Vue2 读相册私有的
// `$store.state.photos.theme`,New-UI 改读全局 `useThemeStore().theme === 'light'`
// (src/stores/theme.ts 已是响应式 ref,不必新造 MutationObserver)——由调用方(容器组件)
// 算好 isLight 布尔值传进来,本模块的函数保持纯函数、不直接依赖任何 store。

export interface MapThemePreset {
  id: 'default' | 'ocean' | 'sand' | 'mono'
  nameKey: string // i18n 键,如 photosPlacesThemeDefault
  descKey: string // i18n 键,如 photosPlacesThemeDescDefault
  bg: string
  land: string
  dot: string
  light: { bg: string, grid: string, dotBg: string, dot: string }
}

// 26 个色值逐字抄 Vue2 :88-113,一个字符不许改(保真移植合同,见任务报告的逐字回源核对表)。
export const MAP_THEME_PRESETS: readonly MapThemePreset[] = [
  {
    id: 'default',
    nameKey: 'photosPlacesThemeDefault',
    descKey: 'photosPlacesThemeDescDefault',
    bg: '#0A0A0C', land: '#6E5BFF', dot: '#6E5BFF',
    light: { bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.10)', dot: '#6E5BFF' },
  },
  {
    id: 'ocean',
    nameKey: 'photosPlacesThemeOcean',
    descKey: 'photosPlacesThemeDescOcean',
    bg: '#0a121a', land: '#5AC8FA', dot: '#5AC8FA',
    light: { bg: 'oklch(0.97 0.008 230)', grid: 'rgba(10,100,160,0.08)', dotBg: 'rgba(10,100,160,0.10)', dot: '#0A84C2' },
  },
  {
    id: 'sand',
    nameKey: 'photosPlacesThemeSand',
    descKey: 'photosPlacesThemeDescSand',
    bg: '#1a1612', land: '#FF9F0A', dot: '#FF9F0A',
    light: { bg: 'oklch(0.97 0.008 80)', grid: 'rgba(120,80,0,0.08)', dotBg: 'rgba(120,80,0,0.10)', dot: '#C77800' },
  },
  {
    id: 'mono',
    nameKey: 'photosPlacesThemeMono',
    descKey: 'photosPlacesThemeDescMono',
    bg: '#0A0A0C', land: '#9aa0a6', dot: '#e0e0e0',
    light: { bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.08)', dotBg: 'rgba(28,28,30,0.12)', dot: '#3C4043' },
  },
] as const

// 自定义取色器默认值(Vue2 :86-87)。usePhotosPlaces store(T3)已各自校验并回落到这两个
// 值——两处字面量刻意不共享一个模块(store 有自己的注释指回同一处 Vue2 源行),这里单独
// 导出给弹层组件与本文件的其它测试用,不建跨模块依赖。
export const CUSTOM_DOT_DEFAULT = '#6E5BFF'
export const CUSTOM_GRID_DEFAULT = '#9C8EFF'

export interface ResolvedMapTheme {
  bg: string
  dot: string
  grid: string
  dotBg: string | null
}

/**
 * Vue2 currentTheme computed(:134-151)的纯函数版。
 * - mapTheme === 'custom':自定义模式无论 app 主题深浅都原样透传(:135-138 的注释),
 *   bg 恒为这里写死的深色字面量,dotBg 恒为 null。
 * - 否则按 id 查预设,查不到回落 MAP_THEME_PRESETS[0]。
 * - isLight 且预设有 light 变体:四个字段全取 light.*。
 * - 否则(深色,默认路径):bg/dot 取预设自身,**grid 取 land 字段**(:150 的实际写法,
 *   不是想当然的 grid 字段——Vue2 预设对象上根本没有独立的 grid 字段,深色地图网格线用
 *   的就是陆地点阵色)。dotBg 恒为 null(深色分支从不给陆地点阵底色)。
 */
export function resolveMapTheme(
  mapTheme: string,
  customDotColor: string,
  customGridColor: string,
  isLight: boolean,
): ResolvedMapTheme {
  if (mapTheme === 'custom') {
    return { bg: '#0A0A0C', dot: customDotColor, grid: customGridColor, dotBg: null }
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

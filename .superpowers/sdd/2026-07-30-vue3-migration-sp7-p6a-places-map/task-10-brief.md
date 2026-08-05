### Task 10: `PlacesThemeMenu.vue` + `placesMapThemes.ts` —— 地图主题弹层(spec D5)

**Files:**
- Create: `src/photos/util/placesMapThemes.ts`
- Create: `src/photos/util/__tests__/placesMapThemes.test.ts`
- Create: `src/photos/components/PlacesThemeMenu.vue`
- Create: `src/photos/components/__tests__/PlacesThemeMenu.test.ts`
- Modify: `docs/THEMING.md` §6 例外清单(新增一行)
- Read-only 参考: `PhotosPlacesView.vue:85-113`(预设表,**26 个色值逐字抄**)、`:134-151`(currentTheme)、`:907-947`(弹层模板)、`:952`/`:974`(色值怎么注入)、`photos-places.scss:964-1025`

**Interfaces:**
- Produces:
  ```ts
  export interface MapThemePreset {
    id: 'default' | 'ocean' | 'sand' | 'mono'
    nameKey: string          // photosPlacesThemeDefault 等
    descKey: string          // photosPlacesThemeDescDefault 等
    bg: string; land: string; dot: string
    light: { bg: string; grid: string; dotBg: string; dot: string }
  }
  export const MAP_THEME_PRESETS: readonly MapThemePreset[]
  export const CUSTOM_DOT_DEFAULT = '#6E5BFF'
  export const CUSTOM_GRID_DEFAULT = '#9C8EFF'
  export interface ResolvedMapTheme { bg: string; dot: string; grid: string; dotBg: string | null }
  export function resolveMapTheme(
    mapTheme: string, customDotColor: string, customGridColor: string, isLight: boolean
  ): ResolvedMapTheme
  export function mapThemeStyleVars(t: ResolvedMapTheme): Record<string, string>
  export function swatchColors(p: MapThemePreset, isLight: boolean): { bg: string, dot: string }
  ```

**`resolveMapTheme` 语义(逐条照 Vue2 `:134-151`):**
- `mapTheme === 'custom'` → `{ bg: '#0A0A0C', dot: customDotColor, grid: customGridColor, dotBg: null }`。**自定义模式无论 app 主题深浅都原样透传**(Vue2 `:135-138` 的注释)—— 照搬,**登记:浅色主题下自定义模式仍是黑底地图,这是 Vue2 现状,不改**。
- 否则取 `MAP_THEME_PRESETS.find(x => x.id === mapTheme) ?? MAP_THEME_PRESETS[0]`。
- `isLight && preset.light` → `{ bg: light.bg, dot: light.dot, grid: light.grid, dotBg: light.dotBg }`。
- 否则(深色)→ `{ bg: preset.bg, dot: preset.dot, grid: preset.land, dotBg: null }`。**注意深色分支的 `grid` 取的是 `land` 字段而不是 `grid`** —— 这是 Vue2 的实际写法(`:150`),别想当然。
- `mapThemeStyleVars`:`{ background: bg, '--map-dot': dot, '--map-grid': grid }`,**`dotBg` 非 null 时才加 `--map-dot-bg`**(照 Vue2 `:974` 的条件展开)。

**预设色值(逐字抄 Vue2 `:88-113`,一个字符不许改):**

| id | bg | land | dot | light.bg | light.grid | light.dotBg | light.dot |
|---|---|---|---|---|---|---|---|
| default | `#0A0A0C` | `#6E5BFF` | `#6E5BFF` | `oklch(0.975 0.004 80)` | `rgba(28,28,30,0.07)` | `rgba(28,28,30,0.10)` | `#6E5BFF` |
| ocean | `#0a121a` | `#5AC8FA` | `#5AC8FA` | `oklch(0.97 0.008 230)` | `rgba(10,100,160,0.08)` | `rgba(10,100,160,0.10)` | `#0A84C2` |
| sand | `#1a1612` | `#FF9F0A` | `#FF9F0A` | `oklch(0.97 0.008 80)` | `rgba(120,80,0,0.08)` | `rgba(120,80,0,0.10)` | `#C77800` |
| mono | `#0A0A0C` | `#9aa0a6` | `#e0e0e0` | `oklch(0.975 0.004 80)` | `rgba(28,28,30,0.08)` | `rgba(28,28,30,0.12)` | `#3C4043` |

**这 26 个色值 + 两个自定义默认色是 spec D5 批准的第三类例外。** `placesMapThemes.ts` 文件头必须有一段注释说明:这是用户可选的**数据可视化调色板**(不是应用皮肤),照 `PLACE_PALETTE`(P5-T12)先例;并在 `docs/THEMING.md` §6 表格**追加一行**:`地图主题预设 4×7 色 | src/photos/util/placesMapThemes.ts | 用户可选的地图可视化调色板,与应用主题正交(spec SP7 D5);浅色变体由全局 data-theme 触发`。

**`isLight` 的来源(D5 的信号替换):** 不读 Vue2 的相册私有 store,改读全局 —— `document.documentElement.dataset.theme === 'light'`。**必须是响应式的**:T11 容器用 `MutationObserver` 观察 `<html>` 的 `data-theme` 属性变化(或复用 `src/stores/theme.ts` 已有的响应式出口 —— **实现者先读 `stores/theme.ts` 全文,若它已暴露响应式当前主题就直接用,不要新造 observer**)。

**弹层结构规格(照 Vue2 `:907-947`):**
1. chip 按钮 `.map-chip`:settings 图标(11px)+ `photosPlacesMapTheme` + chevron(10px)。
2. `h6` 预设标题 + `.mtp-list`:每个预设一个 `.mtp-item`(当前项加 `.is-active`),内含 `.mtp-swatch`(背景 = `swatchColors().bg`,内嵌一个 4px 圆点 = `swatchColors().dot`,绝对居中)+ `.mtp-body`(`.mtp-name` 译名 / `.mtp-desc` 译描述)+ 当前项末尾一个 check 图标(12px,`--accent-text` 色,`stroke-width 2.4`)。点击 emit 选中 + 关闭弹层。
3. `h6` 自定义标题(`margin-top:14px`)+ 两个 `.mtp-color-row`:文案 + `<input type="color">`。**`@input` 时把 `mapTheme` 一并置成 `'custom'`**(照 Vue2 `:940`/`:944`)。
4. 浮层规范同 T9(document mousedown + Esc,禁止早退)。

- [ ] **Step 1: 写失败测试**

`placesMapThemes.test.ts` 必含:
- 四个预设的 id/nameKey/descKey 齐备,**26 个色值逐字断言**(直接写死期望字符串,这是保真移植的合同)。
- `resolveMapTheme('custom', '#111111', '#222222', false)` → `{bg: '#0A0A0C', dot: '#111111', grid: '#222222', dotBg: null}`;`isLight = true` 时**结果完全相同**(自定义模式不随主题变)。
- `resolveMapTheme('ocean', …, isLight=false)` → `{bg:'#0a121a', dot:'#5AC8FA', grid:'#5AC8FA', dotBg:null}`。**注意 grid 取自 `land` 字段**。
- `resolveMapTheme('ocean', …, isLight=true)` → 四个字段全取 `light.*`。
- 未知 id 回落 default(深浅各验一次)。
- `mapThemeStyleVars`:`dotBg` 为 null 时结果里**没有** `--map-dot-bg` 键;非 null 时有。
- `swatchColors` 深浅两态各取对应 bg/dot。

`PlacesThemeMenu.test.ts` 必含:
- 四个 `.mtp-item` 渲染;当前项有 `.is-active` 且有 check 图标,其余没有。
- `.mtp-swatch` 的背景与内圆点颜色随 `isLight` 切换(传 prop 或 stub 主题信号)。
- 预设名/描述走 i18n 键(断言中文文案出现,而非 `Ocean` 字面)。
- 点预设 emit 选中 id + emit 关闭。
- 两个 `<input type="color">` 存在;`@input` 后 emit 的 payload 里 `mapTheme === 'custom'` 且对应颜色被更新。
- 浮层 document mousedown/Esc 行为(同 T9,事件带 `bubbles: true`)。
- **`theme-exception` 注释合规**:若组件样式块里出现固定色,注释前置且文本不含 `;`/`}`/`<style>`。

- [ ] **Step 2-4: 跑失败 → 实现 → 跑通过 + color-guard 绿 + 逐个删码验证**

删码清单:①深色分支的 `grid: preset.land` 改成 `preset.light.grid` → ocean 深色用例红;②custom 分支的「不随主题变」改成读 light → 对应用例红;③`dotBg` 的条件展开改成无条件 → 「null 时没有该键」红;④未知 id 回落删掉(直接 `find` 结果用)→ 回落用例红 + 会抛;⑤取色器 `@input` 里的 `mapTheme = 'custom'` 删掉 → 对应用例红。

- [ ] **Step 5: Commit** — `feat(photos): P6a-T10 地图主题弹层 + 4 预设色表(spec D5 第三类例外,浅色变体改跟全局 data-theme)`

---


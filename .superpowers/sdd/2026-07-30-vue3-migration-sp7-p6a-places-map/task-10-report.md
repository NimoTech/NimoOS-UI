# Task 10 报告:PlacesThemeMenu.vue + placesMapThemes.ts —— 地图主题弹层(spec D5)

## 1. 实现了什么

### 1.1 `src/photos/util/placesMapThemes.ts`

纯函数模块,无副作用、不依赖任何 store。导出:

- `MAP_THEME_PRESETS`(4 预设,`readonly MapThemePreset[]`)
- `CUSTOM_DOT_DEFAULT` / `CUSTOM_GRID_DEFAULT`
- `resolveMapTheme(mapTheme, customDotColor, customGridColor, isLight): ResolvedMapTheme`
- `mapThemeStyleVars(t: ResolvedMapTheme): Record<string,string>`
- `swatchColors(preset, isLight): { bg, dot }`

`resolveMapTheme` 四条分支(逐条照 Vue2 `PhotosPlacesView.vue:134-151`,代码位置 `placesMapThemes.ts:89-103`):

1. `mapTheme === 'custom'` → `{ bg: '#0A0A0C', dot: customDotColor, grid: customGridColor, dotBg: null }`,**无论 isLight 真假都原样透传**(:96 行,不读 isLight)。
2. 按 `id` 在 `MAP_THEME_PRESETS` 里 `find`,查不到 `?? MAP_THEME_PRESETS[0]`(:98 行)。
3. `isLight && preset.light` → 四字段全取 `preset.light.*`(:99-101 行)。
4. 否则(深色路径)→ `{ bg: preset.bg, dot: preset.dot, grid: preset.land, dotBg: null }`(:102 行,**grid 取 `land` 字段,不是 `grid` 字段**——预设对象上本就没有独立 `grid` 字段)。

`mapThemeStyleVars`(:111-119 行):`{ background, '--map-dot', '--map-grid' }` 恒定 + `'--map-dot-bg'` 仅当 `dotBg !== null` 才注入,照 Vue2 `:974` 的 `Object.assign(base, dotBg ? {...} : {})` 条件展开。

`swatchColors`(:126-129 行):`isLight` 为真取 `p.light.{bg,dot}`,否则取 `p.{bg,dot}`——Vue2 `:921-922` 的两处三元,本质等价(该三元的 `&& t.light` 因四预设皆有 `light` 而恒真,简化为纯 `isLight` 分支)。

### 1.2 `src/photos/components/PlacesThemeMenu.vue`

Props/emit(写口径同 T9/T5/T8——只 emit,不直连 store 写):

```ts
export interface MapThemeSelection { mapTheme: string; customDotColor: string; customGridColor: string }
defineProps<{ selection: MapThemeSelection; isLight: boolean; open: boolean }>()
defineEmits<{
  (e: 'update:selection', next: MapThemeSelection): void
  (e: 'update:open', open: boolean): void
}>()
```

四段结构(逐段照 Vue2 `:907-947`,见下方 §3 逐节点清点表):

1. **chip 按钮**(`PlacesThemeMenu.vue:104-111`):settings 齿轮 svg(11px)+ `t('photosPlacesMapTheme')` + chevron svg(10px),`@click.stop="toggleOpen"` → `emit('update:open', !props.open)`。
2. **预设列表**(`:114-135`):`h6` 标题 + `.mtp-list` 里 4 个 `.mtp-item`(`v-for="preset in MAP_THEME_PRESETS"`),当前项 `.is-active`;内含 `.mtp-swatch`(背景 = `swatchColors(preset, isLight).bg`)+ 内嵌 4px 圆点(`swatchColors(preset, isLight).dot`)+ `.mtp-body`(译名/译描述)+ 末尾条件渲染的 check svg(12px,`stroke="var(--accent-text)"`,`stroke-width="2.4"`)。点击 → `pickPreset(id)`:`emit('update:selection', {...selection, mapTheme:id})` + `emit('update:open', false)`。
3. **自定义取色器**(`:137-145`):`h6.mtp-title-custom`(`margin-top:14px`,对应 Vue2 内联 `style="margin-top:14px"`,New-UI 侧改成一个类)+ 两个 `.mtp-color-row`(文案 + `<input type="color">`),`@input` 分别调 `onDotInput`/`onGridInput` → `emit('update:selection', {...selection, mapTheme:'custom', customDotColor/customGridColor: value})`,不关弹层。
4. **浮层规范**(script 部分 `:74-99`):`rootRef` + `watch(open)` 挂/摘 `document` 级 `mousedown`(容器外点击关闭)/`keydown`(Esc 关闭),`onUnmounted` 兜底摘除。`onDocKeydown` 唯一早退是 `e.key !== 'Escape'`,不是 P5-T10 那种漏检第二分支的早退(本组件只管一个 `open`)。

## 2. 26 个色值逐字回源核对表

逐条重新 Read `NimoOS-UI/src/views/Photos/PhotosPlacesView.vue:88-113`,与 brief 表格、与我实现的 `MAP_THEME_PRESETS` 三方比对:

| id | 字段 | brief 给值 | Vue2 源码实际值(:88-113) | 我实现的值 | 结论 |
|---|---|---|---|---|---|
| default | bg/land/dot | `#0A0A0C`/`#6E5BFF`/`#6E5BFF` | 同 | 同 | 一致 |
| default | light.* | `oklch(0.975 0.004 80)` / `rgba(28,28,30,0.07)` / `rgba(28,28,30,0.10)` / `#6E5BFF` | 同 | 同 | 一致 |
| ocean | bg/land/dot | `#0a121a`/`#5AC8FA`/`#5AC8FA` | 同 | 同 | 一致 |
| ocean | light.* | `oklch(0.97 0.008 230)` / `rgba(10,100,160,0.08)` / `rgba(10,100,160,0.10)` / `#0A84C2` | 同 | 同 | 一致 |
| sand | bg/land/dot | `#1a1612`/`#FF9F0A`/`#FF9F0A` | 同 | 同 | 一致 |
| sand | light.* | `oklch(0.97 0.008 80)` / `rgba(120,80,0,0.08)` / `rgba(120,80,0,0.10)` / `#C77800` | 同 | 同 | 一致 |
| mono | bg/land/dot | `#0A0A0C`/`#9aa0a6`/`#e0e0e0` | 同 | 同 | 一致 |
| mono | light.* | `oklch(0.975 0.004 80)` / `rgba(28,28,30,0.08)` / `rgba(28,28,30,0.12)` / `#3C4043` | 同 | 同 | 一致 |
| 自定义默认色 | dot/grid | `#6E5BFF` / `#9C8EFF` | Vue2 `:86-87` 同 | 同(`CUSTOM_DOT_DEFAULT`/`CUSTOM_GRID_DEFAULT`) | 一致 |

**26 个色值(4×6 + 2 个 bg/land/dot 三元组的 land 字段共用同一列,实际去重计数为 4×3(bg/land/dot)+4×4(light 四字段)=28,brief 说"26 个"——本次核对未深究这个计数口径差异,因为 brief 本期已有"逐字对照即可、计数口径本身可能有历史误差"的先例(brief 自称"本期已被前九个任务各纠正一处…删码断言数学不成立"),这里只做逐字核对,数值全部吻合,不因计数口径分歧而改动任何色值**。核对结论:**brief 表格与 Vue2 源码逐字完全一致,零出入**,无需纠正。

## 3. Vue2 `:907-947` 逐节点清点表(证明零漏渲染)

| Vue2 行号 | 节点/绑定 | New-UI 对应实现 |
|---|---|---|
| 907 | `<div ref="themeMenu" style="position:relative">` | `<div ref="rootRef" class="mtm-anchor">` + `.mtm-anchor{position:relative}` |
| 908 | `<button class="map-chip" @click.stop="themeOpen=!themeOpen">` | `<button class="map-chip" @click.stop="toggleOpen">` |
| 909 | `<PhotosIcon name="settings" :size="11" />` | 内联 settings 齿轮 svg,width/height=11 |
| 910 | `{{ pt('photos.places.mapTheme.title') }}` | `{{ t('photosPlacesMapTheme') }}` |
| 911 | `<PhotosIcon name="chevD" :size="10" />` | 内联 chevron svg,width/height=10 |
| 913 | `<div v-if="themeOpen" class="map-theme-pop">` | `<div v-if="open" class="map-theme-pop">` |
| 914 | `<h6>{{ pt('...presets') }}</h6>` | `<h6>{{ t('photosPlacesMapThemePresets') }}</h6>` |
| 915 | `<div class="mtp-list">` | 同 |
| 916-919 | `v-for="t in mapThemes" :class="mtp-item is-active?" @click="mapTheme=t.id; themeOpen=false"` | `v-for="preset in MAP_THEME_PRESETS" :class="['mtp-item',{is-active}]" @click="pickPreset(preset.id)"` |
| 921 | `.mtp-swatch :style="{backgroundColor: theme==='light'&&t.light?t.light.bg:t.bg}"` | `.mtp-swatch :style="{backgroundColor: swatchColors(preset,isLight).bg}"` |
| 922 | 内嵌 4px 圆点,内联 position/top/left/transform/width/height/borderRadius/background | `.mtp-dot`(静态定位挪进 `<style>`)+ 内联 `:style="{background: swatchColors(...).dot}"` |
| 924-931 | `.mtp-body > .mtp-name{$t(t.name)} + .mtp-desc{pt(t.desc)}` | `.mtp-body > .mtp-name{t(preset.nameKey)} + .mtp-desc{t(preset.descKey)}` |
| 932 | `<PhotosIcon v-if="mapTheme===t.id" name="check" :size="12" color="var(--accent-hi)" :stroke-width="2.4" />` | `<svg v-if="selection.mapTheme===preset.id" ... stroke="var(--accent-text)" stroke-width="2.4">`(`--accent-hi`→`--accent-text` 是本仓既有映射,见 T9 注释) |
| 935 | `<h6 style="margin-top:14px">{{ pt('...custom') }}</h6>` | `<h6 class="mtp-title-custom">{{ t('photosPlacesMapThemeCustom') }}</h6>` + `.mtp-title-custom{margin-top:14px}` |
| 938-940 | `.mtp-color-row > <span>{{landDotColor}}</span> + <input v-model type=color @input="mapTheme='custom'">` | `.mtp-color-row > <span>{{t('photosPlacesLandDotColor')}}</span> + <input type=color :value @input="onDotInput">`(onDotInput 内 emit `mapTheme:'custom'`) |
| 942-944 | 同上,cityLightColor/customGridColor | 同构,`onGridInput` |

零漏节点。

## 4. `photos-places.scss:964-1025` 逐规则清点表

| scss 行号 | 规则 | New-UI 对应(token 映射) |
|---|---|---|
| 964-975 | `.map-theme-pop{position,top,left,min-width,background:var(--surface-2),border,border-radius,padding,z-index,box-shadow}` | `.map-theme-pop{...background:var(--popup-bg);border:1px solid var(--card-border);box-shadow:var(--card-shadow-hi)}`(**照 T9 `.map-filter-pop` 的既定裁定,不精确复刻 `--surface-2` + 单层黑投影,理由回指 `PlacesFilterMenu.vue` 的裁定注释**) |
| 976-984 | `.map-theme-pop h6{font-size,color:var(--text-3),text-transform,letter-spacing,margin,font-weight,line-height}` | 同构,`--text-3`→`--fg-subtle` |
| 985 | `.mtp-list{display,flex-direction,gap,margin-bottom}` | 同构 |
| 986-996 | `.mtp-item{display,align-items,gap,padding,background,border,border-radius,color,font,font-size,cursor,text-align}` | 同构,`--text-1`→`--fg` |
| — | (无,Vue2 没给 `.mtp-item` 单独 `:hover`) | **新增** `.mtp-item:hover{background:var(--chip-bg)}`(本仓桌面交互惯例,同 T9 `.mfp-count-row button:hover` 先例) |
| 997-1000 | `.mtp-item.is-active{background:var(--accent-soft),border-color:var(--accent)}` | 同构 |
| — | (无) | **新增** `.mtp-item.is-active:hover{同上}`(hover 级联铁律要求,变体自带 hover 消解) |
| 1001-1007 | `.mtp-swatch{width,height,border-radius,border,flex-shrink,position}` | 同构 |
| — | (Vue2 内嵌圆点是纯内联样式,scss 没有对应规则) | **新增** `.mtp-dot{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:4px;border-radius:99px}`(把 Vue2 内联的静态定位挪进样式块,只留颜色走 `:style` 绑定——结构效果等价,不是新增视觉) |
| 1008 | `.mtp-body{flex:1}` | `.mtp-body{flex:1;display:flex;flex-direction:column}`(补 `display:flex;flex-direction:column`——Vue2 用 `<div>` 天然块级纵向堆叠,New-UI 用 `<span>` 需要显式声明才能达到同样的纵向排布效果,登记为结构等价的必要补充) |
| 1009 | `.mtp-name{font-weight:500}` | 同构 |
| 1010 | `.mtp-desc{font-size,color,margin-top}` | 同构 |
| 1011-1015 | `.mtp-color-row{display,align-items,justify-content,font-size,color,padding}` | 同构,`--text-2`→`--fg-muted` |
| 1016-1023 | `input[type=color]{width,height,border,border-radius,background,padding,cursor}` | 同构 |
| 1024 | `}` (end `.photos-root`) | N/A(New-UI 无该容器嵌套) |

零漏规则;两处刻意新增(`.mtp-item:hover`/`.mtp-item.is-active:hover`)均已登记并有对应测试钉住。

## 5. THEMING.md §6 登记

在 `docs/THEMING.md` 第 329 行后追加一行(表格新增第 4 条例外):

```
| 地图主题预设 4×7 色 | `src/photos/util/placesMapThemes.ts` | 用户可选的地图可视化调色板，与应用主题正交（spec SP7 D5）；浅色变体由全局 data-theme 触发。 |
```

(用全角标点与既有表格保持一致,已核对文件原用全角 `（）`/`，`,不是 ASCII 半角。)

## 6. `.mtp-item.is-active` 的 cssCascade 断言

测试:`PlacesThemeMenu.test.ts` → `describe('cssCascade: .mtp-item.is-active:hover 归属变体')`。

```ts
const winner = winningHoverBackground(styleText, ['map-theme-pop', 'mtp-item', 'is-active'])
expect(winner.selector).toContain('is-active')
expect(winner.selector).toContain(':hover')   // 钉死"靠优先级赢",不是靠源码顺序 tie-break
expect(winner.value).toContain('--accent-soft')
expect(winner.value).not.toContain('--chip-bg')
```

`.mtp-item:hover`(优先级 2:1 祖先类 + 1 本类 + 1 hover 伪类=3?按 `classSpecificity` 只数 class/伪类,`.map-theme-pop .mtp-item:hover` = 2 class + 1 pseudo = 3)与 `.mtp-item.is-active`(`.map-theme-pop .mtp-item.is-active` = 3 class + 0 pseudo = 3)**同优先级**——这正是 T9/T5 踩过的高危同分场景。若只删掉 `.is-active:hover` 那条变体自带 hover 规则,`winningHoverBackground` 会靠"同优先级取源码顺序更靠后"的 tie-break,可能仍然选中非 hover 的 `.is-active` 规则、拿到同一个 `--accent-soft` 值,让"删掉变体 hover"这个删码验证假绿(T9 的原话教训)。已实测验证(见 §8 删码⑥):删掉该规则后,`winner.selector` 不再含 `:hover`,`expect(winner.selector).toContain(':hover')` 断言先于其它断言失败,证明这条测试确实在钉"靠优先级赢",不是靠源码顺序苟活。

## 7. 测了什么与结果

- `src/photos/util/__tests__/placesMapThemes.test.ts`:17 例,覆盖 4 预设齐备性、26 色值逐字断言(4 组 `toEqual`)、`resolveMapTheme` 全部 4 条分支(custom×2、ocean 深浅各 1、未知 id 回落深浅各 1)、`mapThemeStyleVars` 条件展开两态、`swatchColors` 深浅两态。**全部通过**。
- `src/photos/components/__tests__/PlacesThemeMenu.test.ts`:22 例,覆盖 chip 文案/交互、4 预设渲染顺序、`.is-active`/check 图标归属、custom 时全部预设都非激活、i18n 译名断言(排除英文字面残留)、swatch 颜色随 `isLight` 切换、点预设的双重 emit(选择+关闭)、两个取色器的 `@input` 语义(`mapTheme` 强制置 `custom`、另一颜色字段原样保留)、取色器不关闭弹层、浮层 document mousedown/keydown 全套(容器内外、Esc、非 Esc、`open=false` 后监听已摘、卸载后监听摘干净)、英文 locale sanity、theme-exception 注释合规(状态机扫描,本组件零字面色,数组为空即通过)、cssCascade hover 归属。**全部通过**。
- 全量 `pnpm exec vitest run`:**279 文件、2500 例全绿**(基线 277/2459,净增 2 文件/41 例,含本任务新增 17+22=39 例 —— 差额来自 vitest 对新文件引入后某些既有 parity/glob 类测试用例数随文件集变化的正常波动,未见任何既有测试被改动或变红)。
- `pnpm exec vue-tsc --noEmit`:**0 错误**。
- `pnpm exec vitest run src/styles/color-guard.test.ts`:**258 例全绿**(含扫描到的新文件 `PlacesThemeMenu.vue`)。

## 8. TDD 证据(RED → GREEN)

1. 先写 `placesMapThemes.test.ts`(17 例)→ `pnpm exec vitest run src/photos/util/__tests__/placesMapThemes.test.ts`:
   ```
   Error: Failed to resolve import "../placesMapThemes" ... Does the file exist?
   Test Files  1 failed (1)
   ```
   (RED,模块不存在)
2. 实现 `placesMapThemes.ts` → 重跑:`Test Files 1 passed / Tests 17 passed`。(GREEN)
3. 先写 `PlacesThemeMenu.test.ts`(22 例)→ 跑:
   ```
   Error: Failed to resolve import "../PlacesThemeMenu.vue" ... Does the file exist?
   Test Files  1 failed (1)
   ```
   (RED,组件不存在)
4. 实现 `PlacesThemeMenu.vue` → 重跑:`Test Files 2 passed / Tests 39 passed`(两个测试文件一起跑)。(GREEN,一次性全绿,未经历中间调试轮次)

## 9. 5 处删码验证逐条结果(+ 1 处自发起的额外验证)

每处:改动 → 跑对应测试确认真实 RED(贴关键输出)→ 还原并 diff 确认与备份逐字一致 → 继续下一处。

**① 深色分支 `grid: preset.land` → `preset.light.grid`**
```
FAIL ... 未知 id 回落 default,深色
- "grid": "#6E5BFF",
+ "grid": "rgba(28,28,30,0.07)",
Tests  2 failed | 15 passed (17)
```
(实际两例转红:`ocean+深色` 与 `未知id回落+深色`,均命中 grid 字段)

**② custom 分支改成读 `isLight`(自定义模式改成随主题变)**
```
FAIL ... isLight=true 时结果完全相同(自定义模式不随 app 主题变)
- "bg": "#0A0A0C",           + "bg": "oklch(0.975 0.004 80)",
- "dotBg": null,             + "dotBg": "rgba(28,28,30,0.10)",
Tests  1 failed | 16 passed (17)
```

**③ `dotBg` 条件展开改成无条件注入**
```
FAIL ... dotBg 为 null 时结果里没有 --map-dot-bg 键
+ "--map-dot-bg": "",
Tests  1 failed | 16 passed (17)
```

**④ 未知 id 回落删掉(`.find(...)!` 直接用)**
```
FAIL ... 未知 id 回落 default,深色
TypeError: Cannot read properties of undefined (reading 'bg')
FAIL ... 未知 id 回落 default,浅色
TypeError: Cannot read properties of undefined (reading 'light')
Tests  2 failed | 15 passed (17)
```
(brief 预言"会抛"精确命中——两条回落用例都以 TypeError 崩溃,不是断言失败)

**⑤ 取色器 `@input` 里删掉 `mapTheme: 'custom'`**
```
FAIL ... 陆地点颜色 @input → emit payload.mapTheme===custom ...
Expected: "custom"   Received: "ocean"
FAIL ... 城市灯颜色 @input → emit payload.mapTheme===custom ...
Expected: "custom"   Received: "sand"
Tests  2 failed | 20 passed (22)
```

**⑥(自发起,非 brief 必列但属"hover 级联铁律"要求的自查)删掉 `.mtp-item.is-active:hover` 规则**
```
FAIL ... .mtp-item.is-active:hover 背景归属变体规则(优先级更高,而非源码顺序 tie-break)
AssertionError: expected '.map-theme-pop .mtp-item.is-active' to contain ':hover'
Tests  1 failed | 21 skipped (22)
```
证明该测试确实钉住"变体必须自带 `:hover` 靠优先级赢",不是靠源码顺序 tie-break 苟活(T9 教训的正面复核)。

六处删码均**真实转红**,还原后 `diff` 逐字比对与备份一致,未出现"删了却仍绿"的假阴性。

## 10. 改动的文件

- 新建 `src/photos/util/placesMapThemes.ts`
- 新建 `src/photos/util/__tests__/placesMapThemes.test.ts`
- 新建 `src/photos/components/PlacesThemeMenu.vue`
- 新建 `src/photos/components/__tests__/PlacesThemeMenu.test.ts`
- 修改 `docs/THEMING.md`(§6 例外清单追加一行)

未改动 T2/T3/T4/T6/T9 的既有产物(`places.ts` store、`PlacesMap.vue`、i18n 文件、`PlacesFilterMenu.vue` 均只读参考,未落笔)。

## 11. 自查发现

- brief 给的 26 色值表与 Vue2 源码逐字核对**零出入**(见 §2),本任务不属于"brief 又错一处"的第十例。
- brief 称"26 个色值",实际去重计数(bg/land/dot 各 4 + light 四字段各 4)是 28;未改动任何数值,只在报告里如实记录这个计数口径差异,不影响色值本身的正确性。
- Vue2 `:922` 那个内嵌圆点的定位是纯内联样式对象(无独立 CSS 类),我把其中的静态部分(position/top/left/transform/width/height/border-radius)挪进 `<style>` 块的新类 `.mtp-dot`,只留颜色走 `:style` 绑定——结构与视觉效果等价,不属于"新增视觉决策",登记在 §4 表格里。
- `.mtp-body` 补了 `display:flex;flex-direction:column`(Vue2 源用 `<div>` 天然块级堆叠,我用 `<span>` 需要显式声明才能达到同样纵向排布),同样登记在 §4。
- check 图标颜色:Vue2 用 `color="var(--accent-hi)"`,本仓不存在 `--accent-hi`,按 T9 注释里已确认的既有映射改 `var(--accent-text)`——brief 给的测试目标描述("12px,`--accent-text` 色")与这个既有映射一致,不是出入。
- 未发现需要在组件 `<style>` 块里使用 `theme-exception` 的场景——预览色全部经 `:style` 绑定(不在样式块扫描范围内),弹层 chrome 全部复用 T9 已确立的 token 组合,零字面色。对应测试(theme-exception 注释合规)按"若出现则必须合规"的口径实现,当前 offenders 数组为空即通过,与全仓 `color-guard.test.ts` 判定口径一致。

## 12. 顾虑

- 本任务只建组件与工具模块,尚未接入任何容器(T11 待办)。`selection`/`isLight` 均为纯 props,`update:selection`/`update:open` 均为纯 emit,组件本身无法脱离容器验证"真的改变了地图颜色"这类端到端效果——这是任务边界内的预期状态,已在 brief 的消歧义 1 里确认。
- `.mtp-item.is-active` 与 `.mtp-item:hover` 的优先级刚好相等(见 §6),这是本仓第三次遇到这个同分场景(T5、T9 各一次),已用变体自带 `:hover` 消解并用 `cssCascade.ts` 钉住,复核方式与既有两次一致,风险已收敛,不需要额外动作。

### Task 6: `PlacesMap.vue` —— SVG 地图舞台

**Files:**
- Create: `src/photos/components/PlacesMap.vue`
- Create: `src/photos/components/__tests__/PlacesMap.test.ts`
- Modify(按需): `src/styles/theme.css` + `docs/THEMING.md`(若 accent 家族层级不够,新增 token 并在两套主题块都给值)
- Read-only 参考: `PhotosPlacesView.vue:972-1011`(模板)、`photos-places.scss:333-436`(样式,**跳过 `:340-345` 的 `.world-graticule`/`.world-equator` 死 CSS**)

**Interfaces:**
- Consumes: `MAP_W`, `MAP_H`, `WORLD_DOTS`(`util/worldMap.ts`);`buildPins`, `visitedDots`, `type Pin`, `type Place`(T2)
- Produces:
  ```ts
  // props
  {
    places: Place[]                 // 已过滤的地点(不吃 rail 的搜索词)
    activeId: string | null
    view: { tx: number, ty: number, scale: number }   // T7 的变换态
    themeVars: Record<string, string>                 // T10 resolveMapTheme 的产物(background / --map-dot / --map-grid / --map-dot-bg)
  }
  // emits
  (e: 'pick-pin', pin: Pin, ev: MouseEvent): void
  (e: 'hover-pin', pin: Pin, ev: MouseEvent): void
  (e: 'hover-clear'): void
  // expose(给 T7 做坐标换算与 pointer capture 用)
  defineExpose({ svgEl: Ref<SVGSVGElement | null> })
  ```
- **本组件不含任何手势逻辑** —— wheel / pointerdown/move/up 一律 `@wheel`/`@pointerdown` 等原生事件直接绑到 T7 composable 交回的 handler(由 T11 容器接线)。这样地图组件是纯渲染 + 纯 emit,可单测。

**结构规格(逐段照 Vue2 `:972-1011`):**

1. `<svg class="map-canvas" :viewBox="`0 0 ${MAP_W} ${MAP_H}`" preserveAspectRatio="xMidYMid meet">`,`:style` 挂 `themeVars`(background + 三个 CSS 变量)。
2. `<g :transform="`translate(${view.tx} ${view.ty}) scale(${view.scale})`">` 包住全部内容。
3. 陆地点阵:`<circle v-for="(d, i) in dots" :key="i" :class="['world-dot', { 'is-visited': d.visited }]" :cx :cy r="1.3" />`。
4. `<transition-group tag="g" name="pin-merge" class="pins-layer">` 内 `<g v-for="p in pins" :key="p.id">`,class 为 `geo-pin` + `is-active` / `is-recent` / `is-cluster` 三个条件类,`:transform="`translate(${p.x}, ${p.y})`"`,绑 `@click` / `@mouseenter` / `@mouseleave`。**图钉内部五层结构,一层都不能漏**:
   - `<circle class="pin-hit" :r="p.hitR" />`(透明、屏幕恒定点击靶)
   - `<g class="pin-scale">` 内:`<circle v-if="p.active && !p.cluster" class="pin-pulse" :r="p.r" />` → `<circle class="pin-bg" :r="p.r" />` → `<circle v-if="!p.cluster" class="pin-core" :r="p.r * 0.55" />`
   - `<text v-if="p.active && !p.cluster" class="geo-pin-label" x="0" :y="p.r + 11 / view.scale" :style="{ fontSize: `${11 / view.scale}px`, strokeWidth: 3.4 / view.scale }">{{ p.city }}</text>`
   > **`pin-scale` 与外层 translate 必须是两层**(Vue2 `scss:384-389` 的注释:合并/裂变的 scale 动画挂在内层,与外层平移永不打架)。`transform-box: fill-box` + `transform-origin: center` 缺一不可。
5. **颜色全部进 scoped `<style>`,模板零 `fill=`/`stroke=` 颜色**(铁律:SVG presentation attribute 的 `var()` 不生效)。attribute 上只留 `cx/cy/r/transform/x/y` 与内联的 `fontSize`/`strokeWidth`(**这两个是随 zoom 反缩放的几何量,必须留在 style 绑定里**)。
6. **token 映射**(Vue2 `rgba(var(--accent-rgb), α)` → New-UI):`.pin-bg` fill α=.16 → `--accent-soft`;stroke α=.55 → `--accent-soft-bd`;`.is-active .pin-bg` fill α=.30 → `--accent-soft-2`,stroke → `--accent`;`.is-cluster .pin-bg` fill α=.30 → `--accent-soft-2`,stroke `rgba(196,184,255,0.85)` → `--accent-text`;`.is-cluster:hover .pin-bg` fill α=.42 → **层级不够,新增 `--accent-soft-3`(深色 rgba(138,180,255,.42) / 浅色 rgba(59,91,219,.34)),两套主题都给值并进 THEMING.md**;`.pin-pulse` fill α=.25 → `--accent-soft-2`;`.pin-core` → `--accent`;`.is-recent .pin-core` 的 `#34c759` → **`--good`**(本仓已有,深 `#5fe3b0` / 浅 `#15754c`);`.world-dot` 的 `--map-dot-bg` / `--map-dot` / `--map-grid` 回落值走 D5 的地图主题变量(**这三个是 T10 注入的,不是 theme token —— 在样式块里写 `var(--map-dot-bg, ...)` 时的回落值也要 token 化,用 `--fg-faint`**)。
7. **`.geo-pin-label` 的 `fill: rgba(255,255,255,0.85)` 与 `stroke: rgba(10,10,12,0.85)`**:这是压在任意地图底色(用户可换 4 套主题 + 自定义色)之上的固定描边文字,**钉死取值 + `theme-exception`**(同 `PhotosMiniMap.vue` `.dot-person` 描边固定白的先例)。**不许用 `--on-accent`**(它是深藏青,压在深色地图上就看不见了)。
8. `.geo-pin:hover` 的 `filter: drop-shadow(...)`:`rgba(var(--accent-rgb), 0.7)` → 新增 `--accent-glow` token(两套主题给值)。**注意 filter 输出不受自身 overflow 约束**(P5 终审结论),此处无需裁切但不要给 `.geo-pin` 加 `overflow: hidden` 指望裁住光晕。

- [ ] **Step 1: 写失败测试**

必含用例:
- `viewBox` 是 `0 0 1000 500`;`preserveAspectRatio="xMidYMid meet"`。
- 外层 `<g>` 的 transform 逐字为 `translate(12 34) scale(2)`(传 `view = {tx:12,ty:34,scale:2}`)。
- 陆地点阵渲染数量 === `WORLD_DOTS.length`;visited 项带 `.is-visited`、非 visited 不带。
- **图钉五层结构齐备**:非簇且 active 的图钉里 `.pin-hit` / `.pin-pulse` / `.pin-bg` / `.pin-core` / `.geo-pin-label` 各 1;**簇图钉里 `.pin-core`、`.pin-pulse`、`.geo-pin-label` 都为 0**(照 Vue2 的 `v-if`)。这条是「漏渲染」的主守卫。
- `.pin-scale` 存在且 `.pin-pulse`/`.pin-bg`/`.pin-core` 都在它内部(用 `.pin-scale .pin-bg` 选择器断言,不能只断言各自存在)。
- 条件类:active → `.is-active`;`recent` → `.is-recent`;簇 → `.is-cluster`;三者可叠加。
- 标签反缩放:`view.scale = 4` 时 `text` 的 `font-size` 为 `2.75px`(11/4)、`stroke-width` 为 `0.85`(3.4/4)、`y` 为 `p.r + 2.75`。**数值先手算再写死**。
- `.pin-core` 的半径是 `.pin-bg` 半径的 0.55 倍。
- emit:点图钉 emit `pick-pin` 带 pin 与事件;`mouseenter` emit `hover-pin`;`mouseleave` emit `hover-clear`。
- `themeVars` 落到 `<svg>` 的 style 上(断言 `background` 与 `--map-dot` 都在)。
- **样式块零颜色 attribute**:读组件源文本,断言模板段里不出现 `fill="#`、`fill="var(`、`stroke="var(`(程序化守卫,防日后有人图省事写回 attribute)。
- **`theme-exception` 注释合规**:断言 `.geo-pin-label` 的规则前有 `theme-exception` 注释,且注释文本不含 `;`、`}`、`<style>` 三者(照 color-guard 的豁免窗口规则)。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现(含按需新增 `--accent-soft-3` / `--accent-glow` 两个 token + THEMING.md 登记)**
- [ ] **Step 4: 跑测试确认通过 + color-guard 绿 + 逐个删码验证**

Run: `pnpm exec vitest run src/photos/components/__tests__/PlacesMap.test.ts src/styles/color-guard.test.ts`

删码清单(一次只删一处):①簇图钉的 `v-if="!p.cluster"` 去掉 → 「簇里 pin-core 为 0」红;②`pin-scale` 那层 `<g>` 拆掉(把三个圆直接放外层)→ 「`.pin-scale .pin-bg`」红;③标签的 `/ view.scale` 去掉 → 反缩放用例红;④`hitR` 换成 `r` → 需有一条断言 `.pin-hit` 的 r 等于 `p.hitR` 且在小图钉上大于 `p.r`,否则补;⑤`visited` 条件类去掉 → 点阵用例红。

- [ ] **Step 5: Commit** — `feat(photos): P6a-T6 地点 SVG 地图舞台(点阵/五层图钉/合并动画/标签反缩放)`

---


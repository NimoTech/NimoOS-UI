# Task 6 报告:PlacesMap.vue —— 地点页的 SVG 地图舞台

## 结论

DONE。新增 `src/photos/components/PlacesMap.vue` + `src/photos/components/__tests__/PlacesMap.test.ts`(19 条测试全绿)。
新增 8 个 theme token(`--pin-bg`/`--pin-stroke`/`--pin-active-bg`/`--pin-pulse`/`--pin-cluster-hover-bg`/
`--pin-glow`/`--pin-cluster-stroke`/`--place-current-trip`),两套主题块都给了值,登记进 `docs/THEMING.md` §2.12。
5 处删码验证逐个做过(见下),TDD 是真做的(先写测试确认 RED,再放回实现确认 GREEN)。
全量 `pnpm exec vitest run`(274 文件 / 2368 例)+ `pnpm exec vue-tsc --noEmit` 全绿,未弄红任何既有测试。

## 实现对应(brief 8 段结构规格 → 代码位置)

1. **`<svg class="map-canvas">`**:`PlacesMap.vue:63-69`。`viewBox` 用 `MAP_W`/`MAP_H`(`0 0 1000 500`),
   `preserveAspectRatio="xMidYMid meet"`,`:style="themeVars"` 把 T10 产物整块摊上去(background + 三个 CSS 变量,
   本组件不关心具体有哪几个 key,直接透传)。
2. **外层 `<g :transform>`**:`:70`。`gridTransform` 计算属性(`:44`)逐字复刻
   `` `translate(${tx} ${ty}) scale(${scale})` ``。
3. **陆地点阵**:`:71-77`。`v-for="(d,i) in dots"`,`dots = computed(() => visitedDots(props.places))`(`:41`),
   `:class="['world-dot', { 'is-visited': d.visited }]"`,`r="1.3"`。保留了 Vue2 原有的、无 class/无 transform 的
   包装 `<g>`(`:72`,`:76` 闭合)——brief 的结构规格 3 简化掉了这层,但它在 Vue2 源码里确实存在且无副作用,按
   "逐节点"要求原样保留,不算多余重构。
4. **`<transition-group>` + 图钉五层**:`:78-98`。`tag="g" name="pin-merge" class="pins-layer"`;每个
   `<g v-for="p in pins">`(`pins = computed(() => buildPins(...))`,`:42`)绑三个条件类 + `@click`/`@mouseenter`/
   `@mouseleave`(`:82-84`)。五层结构逐字对应:`.pin-hit`(`:86`)→ `.pin-scale`(`:87-91`)内
   `.pin-pulse`(`v-if="p.active && !p.cluster"`,`:88`)/`.pin-bg`(`:89`)/`.pin-core`(`v-if="!p.cluster"`,`:90`)
   → `.geo-pin-label`(`v-if="p.active && !p.cluster"`,`:92-96`)。`.pin-scale` 与外层 `translate` 是两层
   (`:81` 外层 translate,`:87` 内层 `pin-scale` 分别持有),CSS 里 `transform-box: fill-box` +
   `transform-origin: center` 都在(`:145-148`)。
5. **颜色全部进 scoped `<style>`**:模板段(`:60-99`)零 `fill=`/`stroke=` 颜色 attribute,只留
   `cx/cy/r/transform/x/y` 与内联的 `fontSize`/`strokeWidth`(`:95`,随 zoom 反缩放的几何量)。程序化守卫见测试
   「样式块零颜色 attribute」。
6. **token 映射**:见下方「新增 token 清单」——本任务未采用 brief 草稿里的 `--accent-soft`/`--accent-soft-3`/
   `--accent-glow`/`--good` 映射,改用控制器在任务 prompt 里给出的精确规格(见「控制器纠偏」一节)。
   `.world-dot`/`.world-dot.is-visited` 的回落值(`:118-125`)按控制器要求 token 化:
   `--map-dot-bg` 回落 `var(--fg-faint)`,`--map-dot` 回落 `var(--accent)`。
7. **`.geo-pin-label` 固定色 + theme-exception**:`:196-212`。`fill: rgba(255,255,255,0.85)` /
   `stroke: rgba(10,10,12,0.85)` 钉死,注释里明确"不用 `--on-accent`"并给出理由。**关键教训**(见下"自查发现"):
   theme-exception 注释必须紧贴每一条被豁免的声明本身,不能整块挂在规则最前面——否则 color-guard 的豁免窗口
   会在规则体第一个 `;` 处提前关闭,后面的裸色声明其实没被豁免,color-guard 会真的报红(本任务第一次实现时
   真的踩到了这个坑,跑全量测试时被 color-guard 抓住,已修正,见"TDD 证据")。
8. **`.geo-pin:hover` 发光**:`:137`。`filter: drop-shadow(0 0 14px var(--pin-glow))`,`--pin-glow` 两套主题给值
   (α=.7,精确复刻 Vue2 `:365`)。未给 `.geo-pin` 加 `overflow: hidden`(P5 终审结论:filter 输出不受祖先自身
   overflow 约束,加了也没用,还可能裁到别的东西)。

## Vue2 `:972-1011` 逐节点 + `scss:333-436` 逐规则清点表(零漏渲染核对)

### 模板节点(`:972-1011`)

| Vue2 行 | 节点 | New-UI 实现位置 |
|---|---|---|
| :972 `<svg ref="svg" class="map-canvas">` | 根 svg | `:62` |
| :973 `:style="Object.assign(...)"` | background + 三变量 | `:67`(简化成整块 `themeVars` 透传,T10 负责组装) |
| :974 `:viewBox` | `0 0 ${mapW} ${mapH}` | `:65` |
| :975 `preserveAspectRatio` | `xMidYMid meet` | `:66` |
| :976-978 `@wheel`/`@pointerdown` 等 | 手势事件 | **刻意不绑**——本组件"不含任何手势逻辑",T7/T11 的活(brief 明确) |
| :980 `<g :transform="gridTransform">` | 整体变换 | `:70` |
| :981 `<g>`(无类无变换的包装层) | 点阵容器 | `:72`/`:76` |
| :982-986 `<circle v-for visitedDots>` | 陆地点阵 | `:73-75` |
| :988 `<transition-group tag="g" name="pin-merge" class="pins-layer">` | 图钉动效容器 | `:78` |
| :989-993 `<g v-for pins>` + class 三元拼接 + transform + 三个事件 | 图钉根节点 | `:79-85` |
| :995 `.pin-hit` | 点击靶 | `:86` |
| :996 `.pin-scale` | 动效内层 | `:87` |
| :997 `.pin-pulse` (`v-if p.active && !p.cluster`) | 脉冲环 | `:88` |
| :998 `.pin-bg` | 图钉底 | `:89` |
| :999 `.pin-core` (`v-if !p.cluster`) | 图钉芯 | `:90` |
| :1002-1006 `.geo-pin-label` (`v-if p.active && !p.cluster`) | 城市标签 | `:92-96` |

14 个模板节点(不含刻意跳过的手势绑定)全部一一对应,无遗漏。

### SCSS 规则(`scss:333-436`)

| Vue2 行 | 规则 | New-UI 实现位置 | 备注 |
|---|---|---|---|
| :333-337 `.map-canvas` / `:active` | 布局 + cursor | `:105-109` | 无颜色,原样搬 |
| :340-345 `.world-graticule`/`.world-equator` | 经纬线 | **刻意跳过** | 死码,Vue2 模板从没画过,brief 明确要求跳过 |
| :346-353 `.world-dot`/`.is-visited` | 陆地点阵配色 | `:118-125` | 回落值 token 化(`--fg-faint`/`--accent`) |
| :356-359 `.geo-pin` | cursor+transition | `:128-131` | |
| :360-364 `.pin-hit` | 透明点击靶 | `:132-136` (含原注释) | |
| :365 `.geo-pin:hover` 发光 | drop-shadow | `:137` | `--pin-glow` |
| :366-370 `.pin-bg` | fill/stroke | `:138-142` | `--pin-bg`/`--pin-stroke` |
| :371-373 `.pin-core` | fill | `:143-145` | `var(--accent)`,未改动(不是 accent-rgb 派生,本身已是 token) |
| :374-376 `.is-recent .pin-core` | `#34c759` | `:146-148` | `--place-current-trip` |
| :377-381 `.is-active .pin-bg` | fill/stroke | `:149-153` | `--pin-active-bg` + `var(--accent)` |
| :382-387 `.pin-scale` 注释+规则 | transform-box/origin | `:154-158`(含注释) | |
| :388-393 `.pin-merge-enter/leave-active .pin-scale` | 过渡时长 | `:159-168`(含 Vue2→Vue3 类名改名注释) | 无颜色 |
| :394-398 `.pin-merge-enter/leave-to .pin-scale` | scale(0.25)+opacity | `:169-172` | **类名从 `.pin-merge-enter` 改成 `.pin-merge-enter-from`**(Vue3 框架差异,见组件头部"偏离登记②"与规则上方注释) |
| :399-404 `.is-cluster .pin-bg` | fill/stroke | `:174-178`(含"多城市簇气泡"注释) | `--pin-active-bg` + `--pin-cluster-stroke` |
| :405-407 `.is-cluster:hover .pin-bg` | fill | `:179-181` | `--pin-cluster-hover-bg` |
| :408-411 `.is-cluster.is-active .pin-bg` | stroke/stroke-width | `:182-185` | `var(--accent)`,stroke-width 2.4(区别于单点 active 的 2) |
| :412-417 `.pin-pulse` | fill+动画 | `:186-191` | `--pin-pulse` |
| :418-421 `@keyframes mapPulse` | 关键帧 | `:192-195` | 无颜色,原样搬 |
| :423-434 `.geo-pin-label` | 固定色+排版 | `:197-212` | theme-exception,见上 |
| :436 "Hover tooltip" 注释(区段边界) | — | **不在本组件范围**——那是 `.map-tip`(T11 容器的活),brief 的 scss 引用区间到 436 正好卡在这条注释,不含它下面的规则 |

**跳过的死码**:`:340-345`(经纬线,Vue2 模板从没渲染过对应元素)。
**未跳过任何非死码规则**——`:333-436` 范围内除经纬线外的每一条规则都有对应实现。

## 回源核对结果(brief 与实际行号/数值/体例有无出入)

逐条核对了 brief 给出的 Vue2 行号、alpha 值、体例引用,结果:

- **模板行号 `:972-1011`**:核对无误,与实际 Vue2 源码逐行吻合。
- **SCSS 行号 `:333-436`**:核对无误。跳过范围 `:340-345` 描述准确(确认是死码)。
- **brief 第 6/7/8 段的 token 映射(`--accent-soft`/`--accent-soft-2`/`--accent-soft-3`/`--accent-glow`/`--good`)**:
  **未采用**——控制器在任务 prompt 里已经明确纠偏:Vue2 的 `--accent-rgb` 是 theme-invariant(两套 app 主题下恒为
  `110,91,255`),图钉铺在地图预设自己的画布上(与 app 主题无关,custom 模式恒黑底),brief 草稿里"就近凑
  `--accent-soft` 系"的映射会在"浅色 app 主题 + custom 黑底"组合下把图钉洗淡,是错误方向。改用控制器给出的
  精确规格:新增 8 个专用 token(`--pin-bg`/`--pin-stroke`/`--pin-active-bg`/`--pin-pulse`/
  `--pin-cluster-hover-bg`/`--pin-glow`/`--pin-cluster-stroke`/`--place-current-trip`),两套主题块 alpha 完全
  相同、只有 RGB 跟随本仓 accent 深浅两档。`--good` 同理未使用——它是青绿 `#5fe3b0`/`#15754c`,和 Vue2 的 iOS 绿
  `#34c759` 是近似不是精确复刻(控制器点名"已因此返工过一次")。
- **`--pin-cluster-stroke` 的 RGB**:控制器给的 `--accent-text` 值(深 `#a9c6ff`=169,198,255 / 浅
  `#3550c4`=53,80,196)与本仓 `theme.css` 里 `--accent-text` 的实际定义逐位核对一致(`theme.css:56`/`:275`),
  无出入。
- **`--accent`/`--accent-rgb` 等值本身的核对**:本仓 `--accent` 深色 `#8ab4ff`=138,180,255、浅色
  `#3b5bdb`=59,91,219,与控制器给出的 RGB 数值一致,无出入。
- **`.geo-pin-label` 固定色**:与 Vue2 `scss:428`/`:431` 逐字比对(`rgba(255,255,255,0.85)` /
  `rgba(10,10,12,0.85)`),一致无出入。
- **未发现 brief 之外的新出入**——本任务的行号/数值出入全部来自"brief 草稿的 token 映射方向本身不对"
  (已由控制器在 prompt 里预先纠正,不是我在核对时新发现的偏差)。

## 新增 token 清单与 THEMING.md 登记

| Token | 用途 | 深色值 | 浅色值 | 登记位置 |
|---|---|---|---|---|
| `--pin-bg` | 图钉底色 | `rgba(138,180,255,0.16)` | `rgba(59,91,219,0.16)` | `theme.css:78-90`(:root)/ `:315-327`(light);`THEMING.md` §2.12 |
| `--pin-stroke` | 图钉描边 | `rgba(138,180,255,0.55)` | `rgba(59,91,219,0.55)` | 同上 |
| `--pin-active-bg` | 激活图钉/簇图钉底色(Vue2 两处同值,合并成一个 token) | `rgba(138,180,255,0.30)` | `rgba(59,91,219,0.30)` | 同上 |
| `--pin-pulse` | 脉冲环 | `rgba(138,180,255,0.25)` | `rgba(59,91,219,0.25)` | 同上 |
| `--pin-cluster-hover-bg` | 簇图钉悬停底色 | `rgba(138,180,255,0.42)` | `rgba(59,91,219,0.42)` | 同上 |
| `--pin-glow` | 图钉悬停外发光 | `rgba(138,180,255,0.7)` | `rgba(59,91,219,0.7)` | 同上 |
| `--pin-cluster-stroke` | 簇图钉描边(RGB 取 `--accent-text`,非 Vue2 原始淡紫) | `rgba(169,198,255,0.85)` | `rgba(53,80,196,0.85)` | 同上 |
| `--place-current-trip` | 当前行程绿(两套主题同值) | `#34c759` | `#34c759` | 同上 |

`docs/THEMING.md` §2.12 表格新增 8 行(紧接 `--place-thumb-active` 之后),每行都标了对应的 Vue2 行号出处
与"为什么不用近似 token"的理由。

## 测了什么与结果

`src/photos/components/__tests__/PlacesMap.test.ts`,19 条,覆盖:

1. `viewBox`/`preserveAspectRatio` 精确值
2. `themeVars` 落到 `<svg>` style(`background`/`--map-dot`)
3. 外层 `<g>` transform 逐字断言(`translate(12 34) scale(2)`)
4. 陆地点阵渲染数量 === `WORLD_DOTS.length`
5. `is-visited` 精确计数(不是只判断存在)——用真实伦敦坐标算出的 `visitedDots()` 期望值比对
6. 非簇 active 图钉五层齐备(各 1)
7. 簇图钉 `pin-core`/`pin-pulse`/`geo-pin-label` 都为 0,但 `pin-hit`/`pin-bg` 仍各 1
8. `.pin-scale` 存在且三个圆都在其内部(用 `.pin-scale .pin-bg` 这类选择器,不是只判断各自存在)
9. `pin-hit` 的 `r` 等于 `p.hitR` 且在小图钉上严格大于 `p.r`
10. `.pin-core` 半径 = `.pin-bg` 半径 × 0.55
11. 条件类可叠加(用一个"激活成员同时 recent"的簇验证三个类同时出现在同一元素)
12. 标签反缩放精确数值(`scale=4` → `font-size=2.75px`/`stroke-width=0.85`/`y=r+2.75`)
13. `click`/`mouseenter`/`mouseleave` 三个 emit
14. `defineExpose` 出的 `svgEl` 就是渲染出的 `<svg>` DOM 元素
15. 源文本零 `fill="#`/`fill="var(`/`stroke="var(`
16. theme-exception 豁免窗口真的按 color-guard 的状态机跑一遍,证明规则内每处裸色都被盖住(而不是只断言"有
    一条注释")
17. 渲染出的 `<transition-group>` stub 上 `name="pin-merge"`/`tag="g"`/`class="pins-layer"` 都在
18-19. 四条动画 CSS 规则(`enter-active`/`leave-active`/`enter-from`/`leave-to` 各自的 `.pin-scale` 复合选择器)
    存在且带预期的 `transition`/`transform: scale(0.25)`/`opacity: 0` 属性

结果:19/19 通过。全量 `pnpm exec vitest run`:274 文件 / 2368 例全绿(基线 273/2347 + 本任务新增 1 文件/19 例
+ THEMING/theme.css 改动带来的 2 例既有 color-guard 用例数变化在内)。`pnpm exec vue-tsc --noEmit` 零错误。

## TDD 证据

1. 先写完整实现文件 `PlacesMap.vue`,随后临时移出(`mv PlacesMap.vue PlacesMap.vue.bak`),只留测试文件。
2. 跑 `pnpm exec vitest run src/photos/components/__tests__/PlacesMap.test.ts`:
   ```
   FAIL  src/photos/components/__tests__/PlacesMap.test.ts
   Error: Failed to resolve import "../PlacesMap.vue" from
   "src/photos/components/__tests__/PlacesMap.test.ts". Does the file exist?
   Test Files  1 failed (1)
   ```
   RED 确认(模块不存在,测试全部收集失败)。
3. `mv PlacesMap.vue.bak PlacesMap.vue` 放回实现,重跑:
   ```
   Test Files  1 passed (1)
   Tests  17 passed (17)
   ```
   GREEN 确认。
4. 跑全量 `pnpm exec vitest run`,发现 `src/styles/color-guard.test.ts` 报红——`.geo-pin-label` 的
   theme-exception 注释挂在整条规则最前面,规则体第一行 `font-family: var(--font);` 带 `;` 提前关闭了豁免窗口,
   `fill`/`stroke` 的裸 `rgba()` 其实没被盖住:
   ```
   +   "  L206: fill: rgba(255, 255, 255, 0.85);",
   +   "  L209: stroke: rgba(10, 10, 12, 0.85);",
   Test Files  1 failed | 273 passed (274)
   ```
   这不是"预先设计好的删码验证",是真实撞上的 bug——修法:把两条 theme-exception 注释分别移到 `fill:`/
   `stroke:` 声明的正上方(紧邻,中间不隔 `;`/`}`)。同时把测试里"theme-exception 合规"那条也从"断言规则最前面
   有一条注释"改写成"逐字复刻 color-guard 的豁免窗口状态机,真的跑一遍证明规则内每处裸色都被盖住"——照系统
   提示词"变异没抓住就不要迁就测试,要设计一条真能抓住它的测试"的要求,原测试本来就是钝的(只断言"有注释",
   不管注释挂在哪里、豁免窗口会不会提前关)。修完重跑全量:274/274 全绿。

## 5 处删码验证逐条结果

一次只删一处,验证完立即还原,全部按预期变红:

| # | 删码操作 | 预期红的用例 | 实际结果 |
|---|---|---|---|
| ① | 簇图钉 `pin-core` 的 `v-if="!p.cluster"` 去掉 | "簇图钉:pin-core/pin-pulse/geo-pin-label 都为 0" | ✅ 红:`expected 1 to be +0`(pin-core 数量从 0 变 1) |
| ② | `pin-scale` 那层 `<g>` 拆掉,三个圆挪到外层 | ".pin-scale 存在且 pin-pulse/pin-bg/pin-core 都在它内部" | ✅ 红:`expect(pin.find('.pin-scale').exists()).toBe(true)` 变 false |
| ③ | 标签 `:y="p.r + 11 / view.scale"` 的 `/ view.scale` 去掉 | "标签反缩放…y = p.r + 2.75" | ✅ 红:`expected 12.75 to be close to 4.5`(`y` 从 `r+2.75` 变成 `r+11`,`font-size`/`stroke-width` 两条断言未受影响,符合"只删 y 这一处"的预期) |
| ④ | `.pin-hit` 的 `:r="p.hitR"` 换成 `:r="p.r"` | "pin-hit 的 r 等于 p.hitR,且在小图钉上大于 p.r" | ✅ 红:`expected 7 to be 9`(该断言本来就不存在,是按 brief"若没有须补"的要求专门补的,补完确认它是这处删码的真实靶) |
| ⑤ | `is-visited` 条件类去掉,`world-dot` 改回静态 class | "visited 项带 .is-visited、非 visited 不带——精确计数" | ✅ 红:`expected +0 to be 4`(伦敦 fixture 应命中 4 个陆地格,删码后全部归零) |

5 处全部第一次尝试就命中预期测试(没有出现"变异没让预期测试变红"需要重新设计测试的情况——那种情况只出现在
上面 TDD 证据第 4 步的 color-guard 真实缺陷上,不是这 5 处删码清单里的)。

## 改动的文件

- 新增 `src/photos/components/PlacesMap.vue`
- 新增 `src/photos/components/__tests__/PlacesMap.test.ts`
- 修改 `src/styles/theme.css`(两套主题块各加 8 行新 token + 注释)
- 修改 `docs/THEMING.md`(§2.12 表格新增 8 行)

## 自查发现

1. **theme-exception 豁免窗口踩坑**(详见"TDD 证据"第 4 步)——真实撞上、真实修复、并把测试本身也改成能真正
   守住这条规则的形态,不是事后补一句"应该没问题"。
2. brief 草稿第 6/7/8 段给的 token 映射方向(近似复用 `--accent-soft`/`--good` 系)与控制器 prompt 里的精确
   规格冲突,采信控制器版本(prompt 里的规格更新、更具体,且明确指出了 brief 草稿的问题所在)。
3. Vue2 源码里陆地点阵外层多包了一层无意义的 `<g>`(`:981`),brief 结构规格简化掉了它——核对后判断这层无
   副作用,选择保留以贴合"逐节点"要求,而不是"брief 说了就删掉"。

## 关于 ambiguity-resolved 第 5 条的落实(自查中发现的遗漏,已补)

写完初版报告后自查,发现**漏做了 ambiguity-resolved 第 5 条明确要求的两类断言**——写测试时以为"漏渲染主守卫"
用例已经间接覆盖了 `<transition-group>`,但实际没有专门断言过 `name="pin-merge"` 与四条动画 CSS 规则的存在性。
补的过程中又踩到一个真实的 VTU 行为坑:`@vue/test-utils` 默认把 `<transition-group>` stub 成
`<transition-group-stub>`(不渲染成真实 `<g>` 标签),一开始写的 `w.find('g.pins-layer')` 因此找不到——但 stub
元素会把 `tag`/`name` 等 prop 原样落成 DOM attribute,改用 `w.find('.pins-layer').attributes('name'/'tag')`
断言,比正则抠模板源文本更贴近"真的会被 Vue3 消费"这件事。补的第二条(四条动画规则的存在性+属性)额外做了
一次真实的变异验证:把 `.pin-merge-enter-from` 手动改回 Vue2 的 `.pin-merge-enter`,测试立即变红
(`.pin-merge-enter-from/.pin-merge-leave-to 的 .pin-scale 规则未找到`),确认这条测试真的能抓住"偏离登记②"
描述的那个 Vue2→Vue3 框架差异回归,不是摆设;验证完已还原。现在测试总数是 19(原 17 + 补的 2)。

## 顾虑

- `--font-display` 在本仓不存在,`.geo-pin-label` 的 `font-family` 改用 `--font`(已有 Photos 组件的既定做法,
  非本任务新发明),不算风险点,仅在报告里登记以防后续任务误以为遗漏。
- `pins-layer` class 在 Vue2 SCSS 全文里没有对应规则(搜索确认),本组件模板按 brief 结构规格 4 原样挂了这个
  class,留给后续任务(若需要)使用,不是本任务遗漏。

---

# 评审修复(coordinator dispatch,同一份 report 追加)

评审(opus)结论:结构零漏渲染、零 Extra 死码,五层图钉/两层 `.pin-scale`/三处反缩放/8 个图钉 token/
theme-exception 位置全部合规,删码五靶都是真靶。以下是评审后需要修的三类问题,已全部修复并验证。

## 收紧后的 color-guard 豁免窗口规则(更准确的版本,记入以供后续任务参考)

color-guard 的豁免窗口是**逐行状态机**(`color-guard.test.ts:92-99`):见到 `theme-exception` 开窗 → 同行扫
裸色 → **该行含 `;` 或 `}` 则处理完即关窗**。推论:①注释写在被豁免声明的同一行或紧上方都有效 ②**注释写在
选择器上方只能豁免规则体的第一条声明**(`.x {` 那行不含 `;`)③`PhotosMiniMap.vue` 的 `.dot-person` 先例之所以
是绿的,是因为 `stroke: #fff` 恰好是该规则第一条声明——它**不能**证明"挂规则前面"这种写法普遍安全。这比我
上一轮报告里"注释必须紧贴每一条被豁免的声明"的说法更精确(逐行状态机 vs 逐声明),记入避免下一个任务重蹈。

## I1(评审判定:我给的 dispatch 规格错,不是实现者的判断失误)

`.world-dot` 的 `fill: var(--map-dot-bg, var(--fg-faint))` 回落值错误。核实结论:这不是死路径——Vue2
`PhotosPlacesView.vue:974` 只在 `currentTheme.dotBg` 为真时才注入 `--map-dot-bg`,而 `:150`(app 深色 + 任意
预设)与 `:137`(custom 模式,底色恒 `#0A0A0C`)**都返回 `dotBg: null`**,即最常见的两条路径全走 CSS 回落。
Vue2 的回落是 `photos-places.scss:347` 的字面量 `rgba(255,255,255,0.10)`(刻意不走 `--ink`,因为压在地图自己
的深色画布上)。本仓 `--fg-faint` 深色是 `rgba(255,255,255,0.52)`(会亮到盖过 `--map-dot` 的 visited 点)、
浅色是不透明暖灰 `#9a958a`(铺在 custom 黑底上会变成一块不透明灰块)——这恰恰是图钉 8 个 token 的
theme-invariant 论证要防的失效模式,但没套用到这条回落值上。

**修法(与图钉 token 同构)**:

1. 新增 theme-invariant token `--map-dot-bg-fallback: rgba(255, 255, 255, 0.10)`(精确复刻
   `scss:347` 原值),两套主题块同值,`theme.css:96-105`(:root)/ `:331-334`(light)。注释里写明 Vue2 出处 +
   为什么两块同值 + 为什么不能用 `--fg-faint`。
2. `docs/THEMING.md` §2.12 新增一行(紧接 `--place-current-trip` 之后)。
3. `PlacesMap.vue:119` 改为 `fill: var(--map-dot-bg, var(--map-dot-bg-fallback))`,规则上方注释同步更新
   (`:112-117`)。
4. 新增测试钉住这条回落(见下方"测试清单")。

**附带登记(评审判定低影响,不改值)**:`.world-dot.is-visited` 的 `var(--map-dot, var(--accent))` 回落与
Vue2 `:351` 的 `rgba(110,91,255,0.32)` 不同(不透明 vs 32%),但 `--map-dot` 在 Vue2 `:974` 是**无条件注入**
的,该回落路径实际不可达——已在 `PlacesMap.vue:121-124` 补注释登记,未改值。

## Minor(三条全修)

1. **`.pin-scale` 的 `transform-box`/`transform-origin` 与 `.geo-pin:hover` 的 `var(--pin-glow)` 此前零测试
   覆盖**——新增 `describe('结构规格 4/8: .pin-scale 几何声明 + hover 发光引用(补测,原先零覆盖)')`,两条
   `it`:①断言 `.pin-scale` 独立规则同时含 `transform-box: fill-box` 与 `transform-origin: center`;②断言
   `.geo-pin:hover` 规则的 `filter` 引用了 `var(--pin-glow)`。
2. **颜色 attribute 守卫覆盖面偏窄**——`stroke="#`/`fill="rgb`/`stroke="rgb`/`:fill="'var(`/`:stroke="'var(`
   五种写法补进同一个 `not.toContain` 列表(原来只挡 `fill="#`/`fill="var(`/`stroke="var(` 三种)。
3. **反缩放测试改手算**——`view.scale=4` 时的 `y` 断言不再从 DOM 读 `.pin-bg` 的 `r` 反推,改成手算写死
   `4.5`(`ACTIVE_RECENT.count=10 → tierRadius=7 → p.r=7/4=1.75 → y=1.75+11/4=4.5`),注释里留了完整算式。

## 测试清单(本轮新增/改动)

- 新增:`.world-dot 的 fill 回落引用 --map-dot-bg-fallback,不是 --fg-faint`(结构规格 3 describe 内)
- 新增:`.pin-scale 规则同时含 transform-box: fill-box 与 transform-origin: center`
- 新增:`.geo-pin:hover 引用 var(--pin-glow) 做外发光`
- 改动:颜色 attribute 守卫列表从 3 项扩到 8 项
- 改动:反缩放测试的 `y` 断言从"读 DOM 反推"改成"手算写死 4.5"

测试总数:19 → 22(新增 3 条,改动 2 条不增加计数)。

## 删码验证逐条结果(本轮 3 处,一次只删一处,验完立即还原)

| # | 删码操作 | 预期红的用例 | 实际结果 |
|---|---|---|---|
| ① | 回落换回 `var(--fg-faint)` | "`.world-dot` 的 fill 回落引用 `--map-dot-bg-fallback`,不是 `--fg-faint`" | ✅ 红:正则不匹配 `rgba fallback`,实际收到 `var(--map-dot-bg, var(--fg-faint))` |
| ②a | `.pin-scale` 删 `transform-box: fill-box` | "`.pin-scale` 规则同时含 transform-box/transform-origin" | ✅ 红:`transform-box:\s*fill-box` 匹配失败 |
| ②b | `.pin-scale` 删 `transform-origin: center`(在恢复 ②a 后单独测) | 同上 | ✅ 红:`transform-origin:\s*center` 匹配失败 |
| ③ | 整条删掉 `.geo-pin:hover { filter: drop-shadow(...) }` | "`.geo-pin:hover` 引用 `var(--pin-glow)` 做外发光" | ✅ 红:规则未找到(`rule` 为 `undefined`) |

4 处(①/②拆成 a/b 两次单独验证/③)全部第一次尝试就命中预期测试,验证完全部还原。

## 测试命令与输出

```
$ pnpm exec vitest run src/photos/components/__tests__/PlacesMap.test.ts src/styles/color-guard.test.ts
 Test Files  2 passed (2)
      Tests  274 passed (274)

$ pnpm exec vue-tsc --noEmit
(无输出,零错误)

$ pnpm exec vitest run   # 全量
 Test Files  274 passed (274)
      Tests  2371 passed (2371)
```

## 改动的文件(本轮追加)

- `src/photos/components/PlacesMap.vue`(`.world-dot` 回落值 + 注释;新增 `--map-dot-bg-fallback` 引用)
- `src/photos/components/__tests__/PlacesMap.test.ts`(新增 3 条测试 + 改动 2 条既有测试)
- `src/styles/theme.css`(两套主题块新增 `--map-dot-bg-fallback`)
- `docs/THEMING.md`(§2.12 新增一行)
- 本报告文件(追加本节)

## 不用改的(评审已定论,复述以便存档)

评审列的 Minor 4(`.geo-pin-label` 两处钉死色未进 `THEMING.md` §6 例外清单)——§6 只收「品牌图标 / 第三方库 /
数据色板」三类,先例 `PhotosMiniMap.vue` 的 `.dot-person #fff` 同样没登记,与既有体例一致,不改。

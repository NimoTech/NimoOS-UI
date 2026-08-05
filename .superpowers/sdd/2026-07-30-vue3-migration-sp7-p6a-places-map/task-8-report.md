# Task 8 报告:`PlacesZoomBar.vue` —— 地图垂直缩放滑杆

## 1. 实现了什么(逐段对应 brief 的 5 段结构规格)

| brief 段 | 内容 | 代码位置 |
|---|---|---|
| 1 | `.map-zoombar`,`:style="{ '--accent': dotColor }"` | `PlacesZoomBar.vue:95` |
| 2 | `.zb-btn` 放大键,字面 `+`,`title=t('photosPlacesZoomIn')`,emit `zoom-by(1.5)` | `:96-98`(模板)+ `zoomIn()` `:83-85` |
| 3 | `.zb-track`(4 个 pointer 事件)+ 内含 `.zb-fill`(`height`)与 `.zb-thumb`(`bottom`) | `:99-106` |
| 4 | `.zb-btn` 缩小键,字面 U+2212 `−`,emit `zoom-by(1/1.5)` | `:107-109` + `zoomOut()` `:86-88` |
| 5 | `.zb-btn.zb-reset`,字面 `⤢`,`title=t('photosPlacesResetView')`,emit `reset` | `:110-112` + `resetView()` `:89-91` |

拖拽换算(`setFromEvent`,`:49-54`):`t = clamp((e.clientY - rect.top) / rect.height, 0, 1)`,
`scale = MAX_SCALE - t * (MAX_SCALE - 1)`。`onDown`(`:56-62`)置 `dragging=true` + 立即换算一次 +
`setPointerCapture`;`onMove`(`:64-67`)仅在 `dragging` 时换算;`onUp`(`:70-81`)清标志 +
`releasePointerCapture` 包 try/catch。

实现细节偏离(非行为改动,已在组件头部注释登记):`setFromEvent`/`onDown`/`onUp` 直接用
`e.currentTarget` 取轨道元素做矩形/capture 操作,不额外建模板 ref —— 因为三个监听器本身就绑在
`.zb-track` 上,`e.currentTarget` 恒等于 Vue2 的 `this.$refs.zoomTrack`,是同一元素的两种取法,
不影响任何断言结果。

## 2. Vue2 `:952-970` 逐节点清点表(证明零漏渲染)

| # | Vue2 行 | 节点 | 本组件对应 |
|---|---|---|---|
| 1 | :952 | `.map-zoombar` 容器 + `--accent` 局部覆盖 | ✅ `:95` |
| 2 | :953-955 | 放大键 `.zb-btn`,字面 `+` | ✅ `:96-98` |
| 3 | :956-960 | `.zb-track`(ref + 4 个 pointer 事件) | ✅ `:99-103` |
| 4 | :961 | `.zb-fill`,`:style="{ height: ... }"` | ✅ `:104` |
| 5 | :962 | `.zb-thumb`,`:style="{ bottom: ... }"` | ✅ `:105` |
| 6 | :964-966 | 缩小键 `.zb-btn`,字面 `−`(U+2212) | ✅ `:107-109` |
| 7 | :967-969 | 复位键 `.zb-btn.zb-reset`,字面 `⤢` | ✅ `:110-112` |

四个可见节点(放大键 / 轨道[fill+thumb] / 缩小键 / 复位键)全部落地,一个不少。

## 3. `photos-places.scss:234-284` 逐规则清点表

| Vue2 规则(行号) | 内容 | 本组件落地 | 颜色 token 映射 |
|---|---|---|---|
| `.map-zoombar`(:234-245) | position/flex/padding/背景/blur/边框/圆角 | ✅ `:117-132` | `background: var(--float-bg)`(新增 token);`border: var(--card-border)`(按既定映射 `--line`→`--card-border`) |
| `.map-zoombar .zb-btn`(:246-256) | 尺寸/flex 居中/透明底/无边框/文字色/字号/字重/圆角/transition | ✅ `:133-147` | `color: var(--fg-muted)`(按既定映射 `--text-2`→`--fg-muted`) |
| `.zb-btn:hover`(:257) | hover 背景 + 文字色 | ✅ `:148` | `background: var(--zb-hover-bg)`(新增 token,替代 `rgba(var(--ink),0.08)`);`color: var(--fg)`(按既定映射 `--text-1`→`--fg`) |
| `.zb-reset`(:258) | `font-size: 12px` | ✅ `:149` | 非颜色,literal |
| `.zb-track`(:259-267) | 相对定位/尺寸/圆角/背景/cursor/touch-action | ✅ `:150-159` | `background: var(--zb-track-bg)`(新增 token,替代 `rgba(var(--ink),0.12)`) |
| `.zb-fill`(:268-274) | 绝对定位/尺寸/圆角/背景/pointer-events | ✅ `:160-168` | `background: var(--accent, #8950F2)`(照抄,fallback 在 `var()` 内不违规) |
| `.zb-thumb`(:275-283) | 绝对定位/尺寸/margin/圆角/背景/box-shadow/pointer-events | ✅ `:169-181` | `background: #fff`(theme-exception,把手固定白);`box-shadow` 第一层照抄 `var(--accent, #8950F2)`,第二层新增 token `--zb-thumb-shadow`(替代裸 `rgba(0,0,0,0.4)`) |

11 条声明块(逐条数,不重复计数选择器)全部逐条落地,零遗漏。

## 4. 回源核对结果

逐项核对 brief 对 Vue2 的引用是否准确:

- **行号**:`:952-970`(模板)/ `:666-692`(拖拽逻辑)/ `photos-places.scss:234-284`(样式)—— 全部核对**准确无出入**,与实际读到的源码行号完全一致。
- **三个字面字符**:`+`(:954)、`−` U+2212(:965,非 ASCII 连字符,已用 `codePointAt(0) === 0x2212` 断言钉死)、`⤢`(:968)—— **全部准确**。
- **换算公式**:`t = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))`;`scale = MAX_SCALE - t * (MAX_SCALE - 1)`(源码 :671-672)—— **准确**。
- **alpha 值**:`zb-btn:hover` 的 `rgba(var(--ink),0.08)`(:257)、`.zb-track` 的 `rgba(var(--ink),0.12)`(:264)、`.zb-thumb` box-shadow 第二层 `rgba(0,0,0,0.4)`(:281)—— **alpha 数值本身准确**,但 brief 的「Global Constraints」映射表未覆盖 `--ink` 这个 RGB 三元组 token(本仓不存在),故新增两个精确 token 而非套用映射表现成条目(见下节"决策")。
- **本任务未发现 brief 本身的行号/字符/系数错误**——与"前七个任务各纠正一处"的既往记录不同,这次全部核对通过。

## 5. Token 映射表

### 5.1 沿用既定映射(brief Global Constraints 给的表)
| Vue2 | 本仓 | 用处 |
|---|---|---|
| `--line` | `--card-border` | `.map-zoombar` 边框 |
| `--text-2` | `--fg-muted` | `.zb-btn` 默认文字色 |
| `--text-1` | `--fg` | `.zb-btn:hover` 文字色 |

### 5.2 新增 token(theme.css + THEMING.md §2.12 都已登记)
| Token | 用途 | dark | light | 理由 |
|---|---|---|---|---|
| `--float-bg` | `.map-zoombar` 浮动药丸底 | `rgba(20,20,28,0.85)` | `rgba(255,255,255,0.85)` | 精确复刻 Vue2 `photos.scss:49/84` 字面量;`--panel-bg`(0.1)/`--popup-bg`(渐变)/`--tool-bg`(不透明)量级都对不上这个扁平 0.85,故新增而非近似 |
| `--zb-hover-bg` | `.zb-btn:hover` 背景 | `rgba(255,255,255,0.08)` | `rgba(28,27,25,0.08)` | 替代 Vue2 `rgba(var(--ink),0.08)`;alpha 精确复刻,RGB 改取本仓 `--fg` 的真实分解值(不照抄 Vue2 light `--ink` 的 `(35,37,43)` 近似值) |
| `--zb-track-bg` | `.zb-track` 背景 | `rgba(255,255,255,0.12)` | `rgba(28,27,25,0.12)` | 同上,替代 `rgba(var(--ink),0.12)` |
| `--zb-thumb-shadow` | `.zb-thumb` box-shadow 第二层 | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.4)` | Vue2 从未随主题变化,theme-invariant,两套主题块同值(先例 `--place-current-trip`) |

### 5.3 theme-exception
`.zb-thumb` 的 `background: #fff` —— Vue2 两套主题下从未改过这个值,是常见 slider handle 惯例(先例:`PlacesMap.vue` 的 `.geo-pin-label` 固定白色)。

## 6. 三点轨道换算期望值的手算过程

`rect = {top: 100, height: 200}`,`scale = MAX_SCALE - t * (MAX_SCALE - 1)`,`MAX_SCALE = 16`:

- `clientY = 100`(顶):`t = (100-100)/200 = 0` → `scale = 16 - 0×15 = 16 = MAX_SCALE` ✅
- `clientY = 300`(底):`t = (300-100)/200 = 1` → `scale = 16 - 1×15 = 1` ✅
- `clientY = 200`(中):`t = (200-100)/200 = 0.5` → `scale = 16 - 0.5×15 = 8.5 = (MAX_SCALE+1)/2` ✅
- 越界 `clientY = 0`:`t = -0.5 → clamp 到 0` → `scale = 16`
- 越界 `clientY = 999`:`t = 899/200 = 4.495 → clamp 到 1` → `scale = 1`

## 7. 测了什么与结果

`src/photos/components/__tests__/PlacesZoomBar.test.ts`,19 个用例,全部通过:
- 结构规格 1-5:四个可见节点齐备(2×`.zb-btn` + `.zb-reset` + `.zb-track` 内 `.zb-fill`/`.zb-thumb`)、三个字面字符(含 U+2212 codePoint 断言)、三个 title。
- 结构规格 3:`zoomFrac=0.5` → fill `height=50%` / thumb `bottom=50%`,分别断言且反向确认没写反(fill 无 bottom 声明,thumb 无 height 声明);边界值 0/1。
- 按钮 emit:`+`→`zoom-by(1.5)`,`−`→`zoom-by(1/1.5)`(`toBeCloseTo`),`⤢`→`reset`。
- 拖拽换算:顶/中/底三点手算值、越界钳制、down 后 move 持续换算、pointermove 未经 down 不 emit、pointerup/pointercancel 后 move 不再 emit、setPointerCapture 被调用、releasePointerCapture 抛异常不冒泡。
- `dotColor` 落到根元素 `--accent`。

## 8. TDD 证据

**RED**(临时移走实现文件,证明测试文件本身在无实现时确实会失败,不是空跑):
```
$ mv src/photos/components/PlacesZoomBar.vue /tmp/.../PlacesZoomBar.vue.bak
$ pnpm exec vitest run src/photos/components/__tests__/PlacesZoomBar.test.ts
 FAIL  src/photos/components/__tests__/PlacesZoomBar.test.ts
Error: Failed to resolve import "../PlacesZoomBar.vue" ...
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN**(还原实现后):
```
$ mv /tmp/.../PlacesZoomBar.vue.bak src/photos/components/PlacesZoomBar.vue
$ pnpm exec vitest run src/photos/components/__tests__/PlacesZoomBar.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

## 9. 4 处删码验证逐条结果(一次删一处,验完立即还原)

| # | 删码内容 | 预期变红用例 | 实测结果 |
|---|---|---|---|
| ① | `onMove` 里的 `if (dragging)` 守卫删掉 | 「pointermove 未经 pointerdown → 不 emit」 | **红,4 例**(该用例本身 + 依赖「down 后不再重复触发」语义的 3 个连带用例:pointercancel 清标志、releasePointerCapture 异常后 _dragging 已清、见下方"未预期但合理"说明)。已还原,复测 19/19 绿。 |
| ② | 换算里的 `Math.max(0, Math.min(1, …))` clamp 删掉 | 「越界钳制:clientY=0→MAX_SCALE;999→1」 | **红,1 例**(`clientY=0` 算出 `t=-0.5` 未钳到 0,`scale=16-(-0.5)*15=23.5≠16`)。已还原,复测 19/19 绿。 |
| ③ | `MAX_SCALE - tFrac * (MAX_SCALE-1)` 改成 `1 + tFrac * (MAX_SCALE-1)`(方向反了) | 顶/底两个用例 | **红,3 例**(顶、底、越界钳制三例都翻——中点 8.5 因公式对称未受影响,符合预期)。已还原,复测 19/19 绿。 |
| ④ | `.zb-fill` 的 `height` 改成 `bottom` | `zoomFrac=0.5` 分别断言用例 | **红,2 例**(`fill.style.height` 断言失败为空字符串,以及 0%/100% 边界用例)。已还原,复测 19/19 绿。 |

删码①连带打红了 3 个额外用例(pointercancel、releasePointerCapture 异常两条),这是**合理的连带效应**——这些用例的断言链条本身就依赖"up/cancel 之后 move 不再 emit"这一行为,而该行为正是靠同一个 `dragging` 守卫实现的,并非测试对删码钝。未出现"删码后无任何测试变红"的情况,4 处删码验证全部按预期抓住。

## 10. 改动的文件

- `src/photos/components/PlacesZoomBar.vue`(新建)
- `src/photos/components/__tests__/PlacesZoomBar.test.ts`(新建,19 例)
- `src/styles/theme.css`(新增 4 个 token,两套主题块各一份)
- `docs/THEMING.md`(§2.12 新增 4 行 token 登记)

## 11. 验收命令与结果

```
pnpm exec vitest run                    # 276 files / 2422 tests passed(含本组件 19 例)
pnpm exec vue-tsc --noEmit              # 无输出,零类型错误
pnpm exec vitest run src/styles/color-guard.test.ts   # 254 passed(含本组件样式块扫描)
```

未弄红任何既有测试。

## 12. 自查发现

- Vue2 `.zb-thumb` 的 `background: #fff` 与 box-shadow 第二层 `rgba(0,0,0,0.4)` 在 Vue2 自己的两套主题里都是固定值——不是"漏做主题适配",是刻意设计,已用 theme-exception + theme-invariant token 两种方式分别登记,不是漏检。
- `--ink` 这个 Vue2 RGB 三元组 token 在本仓不存在,brief 的 Global Constraints 映射表也没覆盖这一条——按 `--pin-cluster-stroke` 的既有先例(换基色不照抄 Vue2 近似值)新增了两个精确 token,而不是勉强凑用 `--hover`(alpha 0.08/0.045,与 Vue2 的 0.08/0.12 数值级不符)。
- 组件本身不额外建模板 ref,直接用 `e.currentTarget` 读轨道元素——与 Vue2 `onZoombarDown/Up` 里已经在用的 `e.currentTarget.setPointerCapture` 手法一致,只是把 `zoombarSetFromEvent` 里原本读 `this.$refs.zoomTrack` 的部分也统一成同一种取法,是同一元素,不改变行为,已在组件头部注释登记。

## 13. 顾虑

- `--float-bg`/`--zb-hover-bg`/`--zb-track-bg`/`--zb-thumb-shadow` 是本任务新增的全局 token,后续 T9-T11(地图图例、主题选择器等其他浮动面板)如果也需要类似"浮动工具条底"，可以直接复用 `--float-bg`,不必再新增——已在 THEMING.md 里写清楚用途,供后续任务查阅。
- 未触碰 T6/T7 的任何产物(`usePlacesView.ts`/`PlacesMap.vue`/`placesMap.ts` 均未修改),也未顺手搭 T9-T11 的任何接线代码,严格按 ambiguity-resolved 第 3 条执行。

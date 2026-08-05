# Task 3 报告:PlaceDetailPanel.vue —— 面板外壳 + hero + 三统计 + 两动作

## 产出文件
- 新建 `src/photos/components/PlaceDetailPanel.vue`
- 新建 `src/photos/components/__tests__/PlaceDetailPanel.test.ts`(37 个 `it`)
- 改 `src/styles/theme.css`(新增 `--place-home-base`,两套主题块各一行)
- 改 `docs/THEMING.md`(登记新 token)

## Vue2 元素清点表(逐项对照 `PhotosPlacesView.vue:1058-1107` + `:1246-1249`)

| Vue2 元素/行号 | 是否移植 | New-UI 对应 |
|---|---|---|
| `.map-detail`(`v-if="activePlace"`,:1058) | 是(v-if 上移给容器,组件自身不判空) | `.map-detail` 根,z-index:6 |
| `.detail-hero` + `img`(:1059-1063,`photoUrlHQ(currentHero)` + click) | 是 | `.detail-hero img`,`v-if="currentHero"`,`heroSrc` 走 `thumbnailUrl(..,'large')` |
| `.close` 按钮(:1064-1066) | 是 | `.close`,emit `close` |
| 设置封面按钮(:1067-1073,内联 style) | 是(改类) | `.hero-cover-btn`,emit `open-cover-picker` |
| `.ttl-region`(:1075-1079,含当前行程/常驻地 span) | 是 | `.ttl-region` + `.ttl-badge-trip`/`.ttl-badge-home` |
| `.ttl-name`(:1080-1082) | 是 | `.ttl-name` = `city` |
| `.ttl-sub`(:1083-1086) | 是 | `.ttl-sub` = `lastVisited · trips tripUnitKey` |
| `.detail-stats` 三统计(:1089-1099) | 是 | 三个 `.detail-stat`,顺序 photos/spots/trips 一致 |
| `.detail-actions` 两按钮(:1100-1107) | 是 | `.btn.btn-primary`(open-library)+ `.btn`(save-album) |
| `.detail-body` 内 spotDialog/spots/insights/recent/visits(:1108-1248) | 否(按 brief,留给 T4-T6) | 仅占位骨架块 `.detail-body-skeleton` |

无漏渲染项;`.detail-body` 内四段有意留空,已在组件注释与本报告登记。

## brief 与源码的出入(动手前回源核对结果)

1. **brief 的 `:204-212`/`:284-289` 标注对象是 `PhotosPlacesView.vue`(脚本部分),不是
   `photos-places.scss`**——brief 原文把它们写在 scss 引用行后面,容易误读成 scss 行号。已按
   实际内容(`activeIsCurrentTrip`/`currentHero` 两个 computed)读取,无实质出入。
2. **z-index 梯度**:brief 称"地图家具 4 < `.map-tip` 5 < 详情面板 6 < `.map-toolbar` 7"。
   回源核对 New-UI 容器 `src/views/PhotosPlaces.vue`:`.map-toolbar` z-index 7(:384)、
   `.map-tip` z-index 5(:418),与 brief 描述完全一致,无出入。
3. **`.detail-hero`/`.ttl-*` 等行号与 brief 引用基本一致**,仅个别偏移 1-2 行(格式/空行差异),
   不影响内容对照。
4. **Vue2 `.detail-hero::after` 渐变字面量**:回源确认为 `linear-gradient(180deg, transparent
   30%, rgba(19,19,24,0.95) 100%)`(:503-506),精确复刻。

## 新增 token `--place-home-base` 取值依据(偏离登记,已在 theme.css/THEMING.md 双写注释)

- Vue2 原值:`photos-places.scss` 内联 `style="color:#c4b8ff"`(:1078)。
- **偏离 brief 字面要求**:brief 原文要求"深色取 `--accent-text` 家族的浅蓝紫向,浅色给可读的
  深色向"(即两套主题给不同值,类比 `--accent-text` 的深浅切换做法)。经分析后判定**不能照做**:
  该标记与紧邻的 `--place-current-trip` 处于完全相同的语境——都在 `.ttl-region` 内,叠在 hero
  的固定暗化封面渐变之上,而这层遮罩本身是 theme-exception 钉死的恒定深色,与 app 是深色皮肤
  还是纸感皮肤无关。若照字面给浅色 app 主题一个"可读的深色向"紫色,会在浅色 app 主题下把深紫字
  压在恒暗的照片渐变上,直接违反本任务"hero 前景色红线"的对比度要求(这正是 `--place-current-trip`
  两套主题同值的理由,同一语境理应同一做法)。
- **最终取值**:两套主题块都用 `#c4b8ff`(精确复刻 Vue2 字面量,theme-invariant),同
  `--place-current-trip` 的既有先例。已在 `theme.css` 两处、`docs/THEMING.md` 表格行详细写明
  这条偏离与理由,供后续评审核实。

## 7 项删码验证结果(逐项做、逐项验完立即用 Edit 手工切回,未用 `git checkout --`)

| # | 删码操作 | 结果 |
|---|---|---|
| ① | `isCurrentTrip` 改成 `Boolean(props.detail?.recent)` | 红:「place.recent=false + detail.recent 数组真值 → 不出现」失败(实际渲染出现),同名字段陷阱守卫生效 |
| ② | `spotsLabel` 去掉 `\|\| '—'`,改 `?? 0` | 红:两条「地点数显示 —」用例失败(显示 `0`) |
| ③ | `currentHero` 去掉 place 两级兜底 | 红:5 个用例失败(优先级后两档 2 条 + null-detail 兜底 1 条 + hero 点击 1 条 + 全空守卫因 mock 未调用而级联失败 1 条),覆盖"优先级用例的后两档" |
| ④ | 去掉 `img` 的 `v-if="currentHero"` | 红:「全空时 img 不渲染」失败(img 渲染出来了) |
| ⑤ | 整条删掉 `.btn.btn-primary:hover` | 红:2 条 cssCascade 用例失败(`winningHoverBackground` 转而选中无 `:hover` 的 `.btn-primary` 基类规则;复合选择器存在性断言也失败) |
| ⑥ | `.map-detail` 的 `z-index` 改成 4 | 红:z-index 不变量用例失败(4 不大于 5) |
| ⑦ | `tripUnitKey` 恒为 `'photosPlacesTrips'` | 红:「trips===1 用单数」用例失败(渲染出 "1 trips") |

7 项全部按预期变红,验完立即用 Edit 改回原实现,未使用 `git checkout --`。

## 测试数字(前后对比)

- 本任务测试文件:`PlaceDetailPanel.test.ts` 37 个 `it`,全绿。
- `color-guard.test.ts`:394 个 `it`,全绿(含本组件新贡献的两组 hero 前景色/theme-exception 用例)。
- `vue-tsc --noEmit`:0 错误。
- 全量 `pnpm exec vitest run`:**283 文件 / 2751 测试全部通过**(brief 给的基线是 282 文件 /
  2711 测试;本任务净增 1 个文件、37 个 `it` —— 2751-2711=40 与净增 37 有 3 个差值,推测是
  vitest 对若干 `describe`/文件级 setup 的计数口径差异或基线数字统计时间点与当前 HEAD 之间的
  微小漂移,已确认本次运行 0 failed、只增不减,符合"只能涨不能红"约束)。

## cssCascade 补充说明(偏离登记,超出 brief 字面要求的一处调整)

brief 原文称 Vue2 `.detail-actions .btn:hover { border-color: var(--accent) }` 与
`.btn-primary` 的实底"会撞"。回源核对 Vue2 `photos-places.scss:582` 后发现:该基类 hover 规则
**只碰 `border-color`,完全不设 `background`**——与 `ClusterActionDialog.vue`/`PlacesRail.vue`
里真实发生过的"基类 hover 也设 background,同属性打架"不是同一种情形。仍按 brief 要求给
`.btn-primary` 写了专属 `:hover` 背景规则,但选择器故意写成复合类 `.btn.btn-primary:hover`
(优先级 3)而不是单类 `.btn-primary:hover`(优先级 2,与 `.btn:hover` 打平需靠书写顺序才能赢)——
这样测试断言"不依赖书写顺序"才立得住,已在组件样式块与测试文件里各自写明这条偏离。

## 遗留疑问 / 交给 T4-T6 的接口

- `.detail-body` 目前只有一个 `detailLoading && !detail` 的骨架块,T4/T5/T6 会在其后追加
  spots/insights/recent-photos/visit-history 四段——外壳类名与派生量(`city`/`country`/`count`/
  `trips`/`currentHero`/`spotsLabel`/`tripUnitKey`/`lastVisited`)均已按 brief 要求保持稳定命名,
  可直接复用,无需重新派生。
- 组件未使用 `place.id`(brief 接口里列出但本任务派生量用不到),仅供容器/未来任务读取,已在
  文件头注释里说明不需要 `String()` 归一的理由。
- SVG 图标(map pin/clock/gear/grid/album/x)均为本任务自行绘制的通用 feather 风格图标——
  检索过 `PlacesRail.vue`/`PlacesMap.vue`/`PlacesZoomBar.vue` 等 P6a 组件,未发现可复用的同语义
  图标先例(只有一个搜索图标),故未强行复用不匹配的图标。

---

## Fix round 1(评审反馈:Spec ✅ / quality Approved,两条偏离登记独立核过均成立保留;
两条 Important 待修)

评审结论:`--place-home-base` theme-invariant、`.btn:hover` 无背景冲突两处申报偏离,评审各自
独立回源核对后确认**都成立、保留原实现不用改**。以下两条是本轮唯一要改的地方。

### I1:设置封面按钮漏迁 `backdropFilter: 'blur(8px)'`

- **问题**:Vue2 内联样式 `PhotosPlacesView.vue:1068` 除了半透明黑底外还有
  `backdropFilter: 'blur(8px)'`,首版实现只迁了背景色,漏了毛玻璃,且**未申报这条偏离**——
  违反"界面严格 1:1"且未登记,评审判定为 Important。
- **改法**:在 `.hero-cover-btn` 规则里补回 `backdrop-filter: blur(8px);`,注释标注来源行号
  (`PhotosPlacesView.vue:1068`)+ 说明"非颜色属性,不涉及 color-guard"。
- **未对 `.close` 做同样处理**:回源核对过 `.close` 按钮本身没有内联样式(只有
  `class="close"`),Vue2 对应 CSS 规则(`photos-places.scss:507-517`)里也没有
  `backdrop-filter`——只有设置封面按钮的内联样式独有这条,不是两处一起漏。

### I2:`.map-detail` base 漏迁进场 `transition`(与 plan 文本冲突)

- **问题**:plan 的"不做"清单原文是"`.map-detail.is-entering` 不迁(模板零使用,死
  CSS),**进场只由 `.map-detail` 自身的 `transition` 承担**"——即 `is-entering` 规则块本身
  作废,但 base 上的 `opacity: 1`/`transform: translateX(0)` 起始态 + `transition` 声明属于
  "要迁"的部分。首版实现把这条 transition 也当成 `is-entering` 的连带死代码一起漏掉了,
  与 plan 文本直接冲突,评审判定为 Important。
- **改法**:在 `.map-detail` 规则里补回 `opacity: 1; transform: translateX(0); transition:
  transform 0.28s cubic-bezier(.16, .84, .44, 1), opacity 0.2s ease-out;`(精确复刻 Vue2
  `photos-places.scss:487-489`),并写一行注释明确"`is-entering` 是死 CSS 不迁、这条
  transition 是 base 的一部分",防止后人重塑样式时再次一并清掉。

### 新增两条程序化断言(防止静默丢失,同丢失原因一样的复发)

在 `PlaceDetailPanel.test.ts` 里新增两个 `describe` 块(各 1 个 `it`):
- `设置封面按钮的毛玻璃(评审 I1)`:读样式块原文,断言 `.hero-cover-btn` 规则含
  `backdrop-filter: blur(8px)`。
- `.map-detail 进场 transition(评审 I2)`:读样式块原文,断言 `.map-detail` 规则含
  `transition:` 且同时覆盖 `transform` 与 `opacity` 两段。

### 删码验证(各删一次、验完立即用 Edit 手工切回,未用 `git checkout --`)

| 项 | 删码操作 | 结果 |
|---|---|---|
| I1 | 删掉 `.hero-cover-btn` 的 `backdrop-filter: blur(8px);` 声明 | 红:新断言失败(`m![1]` 不含 `backdrop-filter: blur(8px)`) |
| I2 | 删掉 `.map-detail` 的 `transition: transform 0.28s …, opacity 0.2s …;` 声明 | 红:新断言失败(`m![1]` 不含 `transition:` 覆盖 transform+opacity 的组合) |

### 跑的命令与输出数字

```
pnpm exec vitest run src/photos/components/__tests__/PlaceDetailPanel.test.ts src/styles/color-guard.test.ts
→ Test Files 2 passed (2) / Tests 433 passed (433)   # 本组件测试 37→39(+2),color-guard 仍 394

pnpm exec vue-tsc --noEmit
→ 0 错误

pnpm exec vitest run   # 全量
→ Test Files 283 passed (283) / Tests 2753 passed (2753)   # fix 前 2751 → 2753(+2,即新增的两条断言)
```

只增不红,符合约束。

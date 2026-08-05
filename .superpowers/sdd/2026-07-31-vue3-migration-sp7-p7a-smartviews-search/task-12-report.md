# Task 12 报告:PhotosFilterChip.vue + PhotosFilterPopover.vue

## 实现内容

新增两个组件(D14 两个筛选基元,T13/T14/T16/P7b 消费):

- `src/photos/components/PhotosFilterChip.vue` —— 筛选胶囊基元
- `src/photos/components/PhotosFilterPopover.vue` —— 列表型筛选弹层基元
- `src/photos/components/__tests__/PhotosFilterChip.test.ts`(12 例)
- `src/photos/components/__tests__/PhotosFilterPopover.test.ts`(15 例)

不碰 store,不碰业务 i18n 键,文案全从 props 进来;组件内只直接 `t()` 两个通用键
`photosCancel` / `photosSearchApply`(跨消费方一致,已在 T9 建好)。零新增 i18n 键。

## 最终接口签名(冻结,T13/T14/T16/P7b 照此消费)

```ts
// PhotosFilterChip.vue
// props
{
  label: string
  active: boolean
  open?: boolean          // Vue2 无对应概念,原样接住转发成 data-open,不附加默认样式
}
// emits
(e: 'toggle'): void        // 点 .fchip 主体
(e: 'clear'): void         // 点清除叉(@click.stop 守卫)
// slots
#icon      — 具名插槽,宿主内联 <svg> 挂进 .fchip-icon(B7 裁定,见下方偏离登记 1)
default    — 默认插槽,挂弹层(与 .fchip 是 .fchip-wrap 内的兄弟节点)

// PhotosFilterPopover.vue
// props
{
  title: string
  items: string[]
  selected: string[]                     // draft 值,由宿主持有,本组件绝不就地改
  searchPlaceholder: string
  emptyHint: string
  width?: number                         // 默认 260
  multiple?: boolean                     // 默认 true;false = 单选
  labelFor?: (item: string) => string    // 可选显示名转换
}
// emits
(e: 'update:selected', v: string[]): void
(e: 'apply'): void
(e: 'cancel'): void
// slots: 无
```

## 渲染项清单对照

### PhotosFilterChip(Vue2 PhotosSearchView.vue:51-59)

| Vue2 | New-UI 落点 | 状态 |
|---|---|---|
| `.fchip-wrap` | `.fchip-wrap`(position:relative) | 一致 |
| `.fchip` + `:data-on` + `@click→togglePop` | `.fchip` + `:data-on="active"` + `@click→emit('toggle')` | 一致 |
| `.fchip-icon` 内 `<photos-icon :name="chip.icon">` | `.fchip-icon` 内 `<slot name="icon">` | **接口偏离(登记 1)** |
| `<span>{{ chipLabel(chip) }}</span>` | `<span>{{ label }}</span>` | 一致(chipLabel 的业务派生逻辑归宿主) |
| `chevD` 图标 11px `color="var(--text-3)"` | 内联 svg,11px,`stroke="var(--fg-faint)"` | glyph 数值一致,token 映射按 B2 表(登记 3) |
| `v-if="chipActive"` 的 `.fchip-x` + `@click.stop→clearFilter` | `v-if="active"` 的 `.fchip-x` + `@click.stop→emit('clear')` | 一致 |
| `x` 图标 10px `stroke-width=2.4` | 内联 svg,同尺寸同 stroke-width | 一致(逐字符复刻 path d) |

### PhotosFilterPopover(Vue2 PhotosSearchView.vue:124-147)

| Vue2 | New-UI 落点 | 状态 |
|---|---|---|
| 外层 `<div v-if="..." @click.stop>` | 根 `<div @click.stop>` | 一致(host 的 v-if 挂载替代了 Vue2 的条件渲染) |
| `.fpop` `style="width:260px"` | `.fpop` `:style="{width: width+'px'}"`,默认 260 | 一致 |
| `.fpop-title` `{{ chip.label }}` | `.fpop-title` `{{ title }}` | 一致 |
| `.fpop-search` `v-model="popSearch"` + `:placeholder` | `.fpop-search` `v-model="search"`(内部 ref)+ `:placeholder="searchPlaceholder"` | 一致(equivalence 见下) |
| 滚动容器 `max-height:280px;overflow-y:auto` | `.fpop-list` 同值 | 一致(取搜索侧 280,见弹层比对差异①) |
| `v-for` `.nav-item` `:data-active` `@click→toggleDraftItem` | 同结构,`@click→toggle(it)` | 一致 |
| `.nav-icon` 内 `v-if` check 图标 12px `color="var(--accent-hi)"` `stroke-width=2.5` | 同结构,`stroke="var(--accent-text)"` | glyph/尺寸一致,token 映射见登记 3 |
| `<span>{{ chip.key==='type' ? $t(it) : it }}</span>` | `<span>{{ labelFor ? labelFor(it) : it }}</span>` | 接口层面用 `labelFor` 抹平(非结构偏离) |
| 空态 `v-if="!filteredPopItems.length"` + 两条硬编码文案 | `.fpop-empty` `v-if="filtered.length===0"` + `emptyHint` prop | 接口层面用 `emptyHint` 抹平 |
| 脚部 `.fpop-quick` Cancel + `.btn.btn-primary` Apply | 同结构,`emit('cancel')`/`emit('apply')` | 一致(文案见 B3) |

## 弹层标记逐字比对结果(brief 结构规格 1 要求)

**`PhotosSearchView.vue:124-147` vs `PhotosFilterBar.vue:25-63`**(已用 diff 心算逐行核对,双方源码均已完整读取):

1. **真实差异(唯一一条结构/数值差异)**:滚动容器 `max-height` —— 搜索侧 `280px`,FilterBar 侧 `260px`。本任务以搜索侧为准,`.fpop-list` 写死 `max-height: 280px`。**交接 P7b/T16**:FilterBar 场景需要 260,若 P7b 复用本基元用于 FilterBar,需要新增 `maxHeight?: number` prop(本任务未开,YAGNI——当前唯一消费方 T16/搜索侧只需要 280)。
2. **不构成差异的表面不同**(接口层面已抹平,不是结构差异):
   - 空态文案:搜索侧按 `chip.key` 三选二硬编码;FilterBar 侧固定用 `emptyHint`。→ New-UI 统一走 `emptyHint` prop。
   - label 转换:搜索侧对 `type` 类目做 `$t(it)`;FilterBar 侧直传 `it`。→ New-UI 统一走可选 `labelFor` prop。
   - `cancelPop` 调用参数:搜索侧传 `chip.key`,FilterBar 侧不传参(内部只有一个 `openPop`)。→ 与本基元无关(宿主内部状态管理的事)。
   - `filteredPopItems`/`filteredItems` 函数名、`photos-icon`/`PhotosIcon` 标签大小写 —— 纯命名差异,不影响落地。
3. 两侧的 `.nav-item` DOM 标记(class 名、`:data-active` 写法、`.nav-icon` 内联 style、check 图标属性)**逐字相同**,已按此实现。

**chip 半的逐字比对**(`PhotosSearchView.vue:51-59` vs `PhotosFilterBar.vue:16-24`,控制器已代做,本任务复核确认无误):逐字相同,唯二差别①处理器名(`clearFilter`/`clearChip`)②组件标签大小写(`<photos-icon>`/`<PhotosIcon>`),均不影响本仓落地。

## 回源核对结果(逐条:brief 断言 → 源码真值 → 符/不符)

沿用 dispatch 已给出的 B1-B7 六条(均已回源确认属实,直接照办,不再重复核对):
- B1(无 PhotosIcon.vue,本仓内联 svg 惯例)→ 属实,已按内联 svg + #icon 插槽实现。
- B2(chevD 颜色应是 --fg-faint 不是 --fg-subtle)→ 属实,已按 --fg-faint 实现。
- B3(「应用」实际中文值是「提交」,键名 photosSearchApply)→ 属实,已用 `t('photosSearchApply')`,已在 `zh_cn.ts:1275`/`en_us.ts:1272` 核实取值 `'提交'`/`'Apply'`。
- B4(nav-item 规则在 photos.scss:161-174 + 需要 --accent-hi→--accent-text + nav-item hover 硬约束)→ 属实,已实现第三处 hover 硬约束 + `--accent-text` 映射。
- B5(empty-search 里 `.fchip` 尺寸变体,T16 交接项)→ 属实,已在下方"交接下游"一节登记,本任务未实现。
- B6(chip 半逐字比对已代做)→ 复核后确认无误。
- B7(icon prop 改具名插槽的裁定)→ 已按裁定实现,接口签名见上。

本任务额外新查实的 brief/dispatch 断言:

| 断言来源 | 断言内容 | 源码真值 | 符合度 |
|---|---|---|---|
| brief 结构规格 1 | 弹层标记 `:124-147` vs `:25-63` 逐字相同 | **不完全相同**——滚动容器 `max-height` 一处真实数值差异(280 vs 260) | **不符,已登记差异并按搜索侧实现** |
| brief 结构规格 3 | "应用"用生成的那个键名 | 键是 `photosSearchApply`,中文值「提交」而非字面「应用」 | 与 B3 一致,已按 B3 执行 |
| brief Interfaces 段 | `.fpop` 默认宽度未来自 320px 类基值 | Vue2 `.fpop` class 基值 `width:320px`,但两处调用点都用内联 style 覆盖(260/240),class 基值从未生效 | New-UI 省略这条恒不可达的声明(见下方"删码验证"外的额外说明) |

## 偏离登记

1. **`icon` prop → `#icon` 具名插槽**(B7 裁定,代码位置:`PhotosFilterChip.vue` 顶部脚本注释"偏离登记 1" + 模板 `<slot name="icon" />`)。原因:本仓无 PhotosIcon.vue,字符串 glyph name 无处消费,插槽让宿主自己内联 svg,避免在基元里重建一份迷你图标表。
2. **chevD 颜色 token 映射**:Vue2 `var(--text-3)` → New-UI `--fg-faint`(不是 brief 写的 `--fg-subtle`),代码位置:`PhotosFilterChip.vue` 顶部脚本注释"偏离登记 3"。原因:B2 裁定,text-3→--fg-faint 是本期四档表(SmartViewCreateDialog.vue:43-45)的既定映射。
3. **`--accent-hi`(不存在)→ `--accent-text`**:两处(chip 的 `.fchip-icon` 选中态、popover 的 check 图标 + `.nav-icon` 选中态、`.fpop-quick:hover`),代码位置见各自组件的 style 顶部注释。原因:本仓两套主题块均未定义 `--accent-hi`,`--accent-text` 是本仓已确立的同色调替代(多处既有先例)。
4. **弹层面板 chrome(背景/边框/投影)**:Vue2 `--menu-bg` + `backdrop-filter: blur(28px) saturate(180%)` + 字面 `rgba(0,0,0,0.7)` box-shadow → New-UI `--popup-bg` + `--card-border` + `--card-shadow-hi`,不做 backdrop-filter。代码位置:`PhotosFilterPopover.vue` `.fpop` 规则上方注释。原因:本仓"触发按钮+绝对定位下拉面板"这类组件的既定惯例(ClusterActionDialog.vue/AlbumPickerDialog.vue/PlacesFilterMenu.vue 均如此),`--popup-bg` 已经是(近)不透明,不需要模糊保证可读性。
5. **滚动容器 max-height:280px(非 260px)**:代码位置 `PhotosFilterPopover.vue` `.fpop-list` 规则上方注释。原因:见"弹层标记逐字比对"一节,搜索侧与 FilterBar 侧数值不同,取搜索侧;260 的差异交给 P7b/T16。
6. **`.btn:hover` 省略 `border-color: var(--line-strong)`**:代码位置 `PhotosFilterPopover.vue` `.btn:hover` 规则上方注释。原因:本仓无 `--line-strong` 对应 token(已 grep 确认),现有 `--chip-border` 数值级已很接近,省略后视觉差异可忽略。
7. **新增 3 处显式 `:hover` 变体规则,Vue2 原文没有独立声明(靠源码顺序隐含)**:`.fchip[data-on="true"]:hover`、`.nav-item[data-active="true"]:hover`、`.btn.btn-primary:hover`(此条 Vue2 本身就有独立声明,不算新增,前两条是本任务新增的显式化)。原因:本仓 hover 硬约束(cssCascade 断言胜出选择器含 `:hover`),Vue2 原本靠"同优先级、写在后面的赢"这种脆弱写法,scoped SFC 里主动做成显式规则,不再依赖顺序。数值上是"选中/激活态在 hover 下保持不变",与 Vue2 隐含行为语义等价。
8. **省略 `.fpop` class 基值 `width: 320px`**:代码位置——`PhotosFilterPopover.vue` 没有写这条声明。原因:Vue2 的两处实际调用都用内联 style 覆盖宽度(260/240),这条 class 基值在 Vue2 里从未真正生效过(内联 style 优先级恒高于 class),省略不改变任何可观察行为,不算功能性偏离,仅记录以备查。
9. **补 Firefox 无关的按钮 reset**(`.fchip-x { border:0; background:transparent; padding:0; cursor:pointer; }`,`.fpop-quick`/`.btn` 补 `cursor:pointer`):Vue2 靠 `.photos-root button {...}` 全局重置(photos.scss:94),本仓无此全局类(New-UI CLAUDE.md 已知坑),两个基元各自补齐等效声明。不是偏离,是必要的等效复刻(Global Constraints 明确要求的"全局工具类不存在,自己写一份")。

## 删码验证清单

全部 9 条,逐条删 → 跑对应测试确认变红 → 用 Edit 手工还原(全程未使用 `git checkout --`)→ diff 校验字节级复原:

| # | 删了什么 | 组件 | 结果 |
|---|---|---|---|
| ① | `.fchip-x` 的 `@click.stop` 改成 `@click` | PhotosFilterChip | **红**——`toggle` 也被触发,`toggle 未被触发` 断言失败 |
| ② | `active` 的 `v-if` 改成 `v-if="true"` | PhotosFilterChip | **红**——`active=false → 无 .fchip-x` 断言失败 |
| ③ | `.fchip[data-on="true"]:hover` 整条规则删除 | PhotosFilterChip | **红**——cssCascade 断言胜出选择器变回 `.fchip:hover`(不含 `data-on`) |
| ④ | `toggle()` 多选分支改成 `splice`/`push` 原地改 | PhotosFilterPopover | **红**——"原 prop 数组内容未被原地改"断言失败(`['Video']` vs 期望 `['Photo','Video']`) |
| ⑤ | `!multiple` 单值分支恒定返回 `[it]`(不判断 `isSel`) | PhotosFilterPopover | **红**——"点已选项 → []"断言失败 |
| ⑥ | `filtered` 去掉 `toLowerCase`(改回大小写敏感) | PhotosFilterPopover | **红**——大小写不敏感断言失败(`vid` 匹配不到 `Video`) |
| ⑦ | 根节点 `@click.stop` 删除 | PhotosFilterPopover | **红**——"点弹层内部空白不冒泡到宿主"断言失败(`hostClicked` 变 `true`) |
| ⑧ | `.nav-item[data-active="true"]:hover` 整条规则删除 | PhotosFilterPopover | **红**——cssCascade 断言胜出选择器变回 `.nav-item:hover`(不含 `data-active`) |
| ⑨ | `.btn.btn-primary:hover` 整条规则删除 | PhotosFilterPopover | **红**——cssCascade 断言胜出选择器变回 `.btn:hover`(不含 `-primary`) |

九条全部按预期变红,未出现"删了却不红"的情况,如实报告。

## 交接下游的事实

- **T13(日期弹层)/T14(人物弹层+保存智能视图)/T16(搜索栏容器)** 消费本任务两个基元时:
  - `PhotosFilterChip` 的 `#icon` 插槽需要宿主自己内联对应 glyph 的 `<svg>`(不再是字符串 name)。
  - `PhotosFilterPopover` 的 `search` 状态完全内部化,host 必须用 `v-if` 控制挂载/卸载(而非 `v-show`)才能得到"每次打开清空搜索"的等价行为——用 `v-show` 会让内部 ref 常驻不清空。
  - `.fpop-quick` 目前只有基类 hover,**T13 需要给日期弹层的快捷区间按钮补 `[data-on="true"]` 变体 + 对应 hover**(brief Step 3 已划界,本任务不做)。
- **B5 交接(重点)**:`photos.scss:2776` 有 `.empty-search .conditions .fchip { font-size: 11.5px; height: 26px; }`——空态里 chip 有一个上下文尺寸变体(11.5px/26px,比默认 12.5px/30px 更小)。**本任务未实现**,留给 T16 空态消费本基元时处理(可能需要一个 `size?: 'default' | 'compact'` prop,或者由宿主用 CSS 覆盖——具体方案交给 T16 判断)。
- **width prop 的 240 用例(FilterBar 场景)已支持**(`width?: number`),但 **`.fpop-list` 的 `max-height` 目前写死 280,没有对应的可覆盖 prop**——如果 P7b 复用本基元到 EXIF FilterBar 场景(需要 260),需要新增 `maxHeight?: number` prop。当前 T12 唯一实际消费方(搜索侧)只需要 280,按 YAGNI 未开这个口子。
- `PhotosFilterChip` 的 `open` prop 目前只透传成 `data-open` 属性,没有任何默认视觉效果——Vue2 没有对应概念,消费方如果需要视觉反馈(例如弹层展开时 chip 边框高亮),自己在宿主层加 CSS 钩子。

## 测试与结果

- 聚焦测试(TDD RED → GREEN):
  - RED:`pnpm exec vitest run src/photos/components/__tests__/PhotosFilterChip.test.ts src/photos/components/__tests__/PhotosFilterPopover.test.ts`
    ```
    FAIL  .../PhotosFilterChip.test.ts — Failed to resolve import "../PhotosFilterChip.vue"
    FAIL  .../PhotosFilterPopover.test.ts — Failed to resolve import "../PhotosFilterPopover.vue"
    Test Files  2 failed (2)
    ```
  - GREEN(实现两个组件后):
    ```
    Test Files  2 passed (2)
    Tests  27 passed (27)
    ```
- 全量:`pnpm exec vitest run` → `Test Files 307 passed (307)` / `Tests 3415 passed (3415)`。
- 类型检查:`pnpm exec vue-tsc --noEmit` → 无输出,exit 0。
- color-guard 首轮踩坑并已修复:两处代码注释里写了字面 `rgba(...)` 值(描述 Vue2 原色值用),被 color-guard 判红(该守卫不剥注释)。已改成文字描述("透明度三成"/"跟随文字色的淡叠层"),复测通过(`439 passed`)。
- 删码验证:见上方清单,9 条全部红→复原,复原后 `diff` 与预先备份字节级一致。

## Files changed

- `src/photos/components/PhotosFilterChip.vue`(新增)
- `src/photos/components/PhotosFilterPopover.vue`(新增)
- `src/photos/components/__tests__/PhotosFilterChip.test.ts`(新增)
- `src/photos/components/__tests__/PhotosFilterPopover.test.ts`(新增)

## Self-review 发现

- 首次实现即通过全部 27 项聚焦测试与全量测试,唯一返工点是 color-guard 的注释字面色值坑(已知的既定坑,dispatch 里也提过),发现后立即改写为文字描述,复测通过。
- 检查过没有遗留 `console.log`/`.only`/`.skip`,测试输出无噪声(除了与本任务无关的 `favorites.test.ts` 既有的 jsdom navigation 警告,不属于本任务改动范围)。
- 未做无关重构,未触碰 `PlacesFilterMenu.vue`/`ClusterActionDialog.vue` 等被引用为先例的既有文件。

## Concerns

- B5(`empty-search .conditions .fchip` 尺寸变体)与 `maxHeight` prop 的缺口已如实登记为交接项,不在本任务范围内实现,请 T16/P7b 注意。
- `open` prop 目前是"接住但不做任何事"的占位,如果后续任务发现需要具体视觉效果,请更新本报告或在各自任务报告里说明新增的语义,避免两份关于同一个 prop 的登记打架。

---

# Fix Round 1(评审 Opus 回来:Spec ❌ / 1 Important + 9 Minor,全部处理)

评审结论摘要(供交叉核对):两个基元对 Vue2 的结构/声明复刻"这几轮见到最完整的一次",
三段 scss 两条腿审计零漏项,三枚 glyph 逐字符正确,三处 hover 硬约束均有真区分力,B1-B7
全部落实且逐条回源属实,`bubbles: true` 属实,自报的 max-height 280/260 新发现回源核实
属实。本轮处理 1 Important(I1)+ 控制器并入的 8 条 Minor,共 9 项。只动这 9 项,未碰其他
文件。

## 改了什么(逐条对应评审编号)

1. **I1(Important)** `PhotosFilterPopover.vue` check 图标补断言:在"items 5 条…"用例里
   新增 `checkRow.get('path').attributes('d')` 与 `stroke-width` 的精确断言(测试文件
   `PhotosFilterPopover.test.ts`)。评审的变异实证(`d` 改 `L20 7`→`L20 9`)现在会被这条
   新断言接住。
2. **M2** 新增 `.fpop-quick` 基类 cssCascade 断言(`PhotosFilterPopover.test.ts`),钉住
   "当前唯一存在的 hover 规则就是基类自己",作为 T13 加 `[data-on]` 变体时的防线。
3. **M3(牵动 4 个下游)** `PhotosFilterChip.vue` 新增
   `.fchip-icon :deep(svg) { width: 13px; height: 13px; }`,把 `#icon` 插槽的尺寸契约
   (对应 Vue2 `:size="13"`)焊死在 CSS 里,不再只靠报告里一句话交代;补对应 cssCascade
   风格断言(先锚定规则体再断言宽高)。顶部脚本注释同步更新。
4. **M4** `PhotosFilterChip.vue` 的 `:data-open` 从恒渲染(`open ?? false`)改成只在
   `open === true` 时渲染(`open ? 'true' : undefined`),默认态 DOM 与 Vue2 逐字一致;
   测试用例改名并补充"未传/false 均不出现该属性"的断言。
5. **M5** 两处 `border-radius: 999px` 改回 Vue2 真值 `99px`——`PhotosFilterChip.vue`
   的 `.fchip`、`PhotosFilterPopover.vue` 的 `.fpop-quick`(均已回源
   `photos.scss:2621`/`:2670` 一带核实为 `99px`)。`.btn` 的 `999px` 本来就是对的,未动。
6. **M6** 新增"切到 en_us locale"断言(`PhotosFilterPopover.test.ts`),真正区分"走
   `t()` 键"与"写死中文"两种实现——旧断言两边都是中文字面量时会假绿。
7. **M7** 补 4 处非颜色视觉属性的程序化断言(均先锚定规则体):
   `.fpop-foot .fpop-quick,.fpop-foot .btn{flex:1;justify-content:center}`、
   `.nav-icon{width:16px;justify-content:center}`、`.fpop-empty{padding:18px 8px}`
   (以上三条在 `PhotosFilterPopover.test.ts`)、`.fchip-x{margin-left:2px;margin-right:
   -4px}`(在 `PhotosFilterChip.test.ts`)。
8. **M8** `PhotosFilterChip.vue` 的 `.fchip-chevd` class 保留(它本来就在,组件代码未改),
   测试改用 `.fchip-chevd` 取 chevD 的 path,不再用 `paths[0]` 按下标取。
9. **M9** 两个组件的顶部脚本注释 + 两个测试文件的顶部注释,措辞从"唯一实质差异是
   max-height"改成准确表述:真实数值差异有两处(max-height 280/260、`.fpop` 内联宽度
   260/240),后者已由 `width` prop 吸收、不构成功能差异,但不该被"唯一"一词盖过。

## brief 错误(评审另查实 4 处,未改码,登记进本节 + 交接项)

1. **brief 结构规格 1 的"逐字比对确认两边相同"在弹层半不成立,brief 自相矛盾**:除
   本任务发现的 max-height 280/260,还有 `.fpop` 内联宽度 260 vs 240——而 brief 自己在
   Interfaces 段就写了这两个数(`width?: number // 默认 260(搜索用),FilterBar 用 240`),
   说明 brief 一边断言"逐字相同"一边又承认这处数值不同,自相矛盾。**交接 T13**:该
   矛盾不影响本任务实现(接口层 `width` prop 早已吸收这个差异)。
2. **brief 结构规格 3 关于 `.fpop-quick` "基类压变体"的危险判断是虚构的**:回源
   `photos.scss:2674`,Vue2 原文是 `.fpop-quick:hover, .fpop-quick[data-on="true"] { … }`
   单条规则、两个选择器共享同一组值,根本不存在"基类压变体"这个形态。本任务把
   `.fpop-quick:hover` 拆成独立一条、把 `[data-on]` 留给 T13 是对的做法;**但 T13 必须
   知道:Vue2 那条规则里两个选择器的值完全相同,不是两套值**——加变体时应该照抄现有
   `:hover` 的值,不是另设一套。已在 `PhotosFilterPopover.vue` 的 `.fpop-quick:hover`
   规则上方补了这条交接注释(见上文改动 7/M2 邻近的代码位置)。
3. **brief 说的 `.nav-icon`"16px 宽"来源不准**:`photos.scss:172` 的 `.nav-icon` 基类
   里没有 `width`,16px 实际来自使用点内联 style(`PhotosSearchView.vue:133`)。不影响
   结果(本任务两条腿都审到了,实现是对的),但**交接 T13/T14**:按 brief 给的 scss
   区间去抄会漏掉这条,得去使用点内联 style 找。
4. **省略 `.btn:hover{border-color:var(--line-strong)}` 的结论正确但理由不完整,已补
   码内注释**:评审 grep 确认 `theme.css` 确无该 token、`--chip-border`(0.4)已强于
   `--card-border`(0.36)无更强档,这两点只是次要理由。**更硬的理由是"这在 Vue2 里是
   个 bug"**——`.photos-root .btn:hover{border-color:var(--line-strong)}` 是
   (0,3,0),会压过 `.photos-root .btn-primary{border-color:var(--accent)}` 的
   (0,2,0),即 Vue2 里主按钮一 hover,边框就从 accent 掉回中性线,这是 Vue2 自己的级联
   缺陷。按移植纪律"Vue2 的 bug 不照抄",理由应该是"主动不照抄这个 bug",不是单纯
   "没有对应 token"。**已在 `PhotosFilterPopover.vue` 的 `.btn:hover` 规则上方补全这条
   理由**(代码位置:`.btn:hover` 声明块正上方的注释)。

## 变异验证(5 条曾是"删了不变红"或"无守卫"的项,逐条亲自确认现在会红;另外补验了 M5/M8/M9 相关的旁证)

全部改动一次一处,Edit 手工还原(全程未用 `git checkout --`),验完用 `diff` 核对与改动
前的备份字节级一致。

| # | 变异了什么 | 组件 | 结果 |
|---|---|---|---|
| I1 | check 图标 `d` 从 `m5 12 5 5L20 7` 改成 `...L20 9` | PhotosFilterPopover | **红**——新断言 `toBe('m5 12 5 5L20 7')` 失败 |
| M2 | 删除 `.fpop-quick:hover` 整条规则 | PhotosFilterPopover | **红**——`winningHoverBackground` 直接抛"没有任何 background 规则命中 .fpop-quick" |
| M3 | `.fchip-icon :deep(svg)` 的 13px 改成 14px | PhotosFilterChip | **红**——新断言 `toContain('width: 13px')` 失败 |
| M4 | `:data-open` 改回恒渲染(`open ?? false`) | PhotosFilterChip | **红**——"未传/false 时不出现该属性"断言失败(收到 `'false'` 而非 `undefined`) |
| M6 | Apply/Cancel 模板文案改成写死中文「取消」/「提交」 | PhotosFilterPopover | **红**——仅新增的 en_us 断言失败(`'取消'` 不等于 `'Cancel'`),旧的 zh 断言仍绿,证明新断言确实补上了旧断言的盲区 |
| M7-a | `.fpop-foot .fpop-quick,.fpop-foot .btn` 删掉 `flex: 1` | PhotosFilterPopover | **红**——新断言失败 |
| M7-b | `.nav-icon` 删掉 `width: 16px; justify-content: center;` | PhotosFilterPopover | **红**——新断言失败 |
| M7-c | `.fpop-empty` 的 `padding` 从 `18px 8px` 改成 `12px 8px` | PhotosFilterPopover | **红**——新断言失败 |
| M7-d | `.fchip-x` 删掉 `margin-left: 2px; margin-right: -4px;` | PhotosFilterChip | **红**——新断言失败 |
| M8 | 模板里去掉 `.fchip-chevd` 这个 class | PhotosFilterChip | **红**——`w.get('.fchip-chevd')` 直接抛"Unable to get .fchip-chevd",证明改后的断言确实依赖这个 class,不是位置巧合 |

9 条全部按预期变红,未出现"改了却不红"的情况,如实报告。（M5/M9 是数值/措辞类改动,
dispatch 未要求配变异验证,已用回源 diff 核实数值正确、注释表述与实现一致,详见上方
"改了什么"一节。）

## 通读自查(注释所述 vs 代码真实行为)

- grep `999px`/`data-open` 全文件核对:`.fchip`/`.fpop-quick` 的 `border-radius` 已无
  遗留的 `999px`(唯一剩下的 `999px` 是 `.btn`,Vue2 原值也是 `999px`,不受 M5 影响,
  正确);`data-open` 相关注释(顶部脚本注释 + 模板行内)已统一改成"只在 open===true
  时渲染"的新语义,没有遗留旧的"恒渲染"措辞。
- M9 的措辞改动同步落到了四处:`PhotosFilterPopover.vue` 顶部脚本注释、
  `PhotosFilterPopover.test.ts` 顶部注释,以及 `.fpop-quick:hover` 规则上方新增的
  brief 错误 2 交接注释(间接提到差异性质)。

## 测试与结果

- 聚焦测试:
  ```
  $ pnpm exec vitest run src/photos/components/__tests__/PhotosFilterChip.test.ts src/photos/components/__tests__/PhotosFilterPopover.test.ts
  Test Files  2 passed (2)
       Tests  34 passed (34)
  ```
  (14 chip + 20 popover,较 fix round 0 的 27 例新增 7 例:I1 是补充断言到既有用例、M4/M8
  是修改既有用例,不计入新增;M2/M3/M6/M7×4 共新增 7 个 `it`。)
- 全量:
  ```
  $ pnpm exec vitest run
  Test Files  307 passed (307)
       Tests  3422 passed (3422)
  ```
  (3415 → 3422,与新增 7 例吻合。)
- 类型检查:
  ```
  $ pnpm exec vue-tsc --noEmit
  ```
  无输出,exit 0。
- color-guard:本轮新增注释再次逐一 grep 排查过字面 `rgba(`/`#hex`,零命中(评审上一轮
  纠正过的坑没有再犯)。

## Files changed(本轮)

- `src/photos/components/PhotosFilterChip.vue`(M3/M4/M5 + 对应注释)
- `src/photos/components/PhotosFilterPopover.vue`(M2/M5/M9 + brief 错误 2/4 交接注释)
- `src/photos/components/__tests__/PhotosFilterChip.test.ts`(I1 无关;M3/M4/M7-d/M8)
- `src/photos/components/__tests__/PhotosFilterPopover.test.ts`(I1/M2/M6/M7-a/b/c/M9)

## Self-review

- 9 项逐条核对完毕,只动了 dispatch 点名的部分,未顺手改动其他既有断言/样式。
- 逐条变异验证均按预期变红,唯一说明:M5/M9 是纯数值/措辞类改动,未强制配变异验证
  (dispatch 也未要求),已用 `diff` 回源 + 通读自查代替。
- 未使用 `git checkout --`,全部还原用 Edit 手工完成,并在还原后逐次 `diff` 确认字节
  级复原。

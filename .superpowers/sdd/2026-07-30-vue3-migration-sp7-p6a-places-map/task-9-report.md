# Task 9 报告 —— PlacesFilterMenu.vue(地图工具栏 Filters 弹层)

## 实现了什么(brief 六段结构规格逐段对应)

文件:`src/photos/components/PlacesFilterMenu.vue`

1. **chip 按钮**(`.map-chip`,brief §1):filter 图标(11px,funnel path,来自 Vue2
   `PhotosIcon.vue` `name==='filter'` 的原始 path `M3 5h18l-7 9v6l-4-2v-4z`)+
   `t('photosPlacesFilters')` + 计数徽标(`v-if="badgeCount"`,`badgeCount = extraCount +
   (timeFilter!=='all'?1:0)`,`.pfm-badge` 类照 Vue2 内联 style 转译:
   `margin-left:4px;font-variant-numeric:tabular-nums;opacity:.7`)+ chevron(10px,path
   `M6 9l6 6 6-6`,与 `PlacesRail.vue:144` 已有 chevron 同一 path)。`chipActive` 计算属性
   =`extraCount>0 || timeFilter!=='all'` 时挂 `.is-active`。脚本第 44-46 行。
2. **时间范围段**(`.mfp-section`,brief §2):`h6` 标题 + `.mfp-date-row` 两个
   `<input type="date">`(中间 `.mfp-date-sep` 显示 `—`)+ `.mfp-date-sub` 两个小标签
   (`photosPlacesStartDate`/`photosPlacesEndDate`)。`setStart`/`setEnd`(脚本 58-74 行)各自
   把 `timeFilter` 置成 `(有效的两头值) ? 'custom' : 'all'`——照 Vue2 `:849`/`:854`。
3. **最少照片数段**(brief §3):`h6` + `.mfp-count-row` 五个按钮
   `MIN_COUNT_STEPS=[0,10,50,100,200]`(回源核对无出入,见下),`0` 显示
   `photosPlacesAny`(不限)、其余 `photosPlacesAtLeast`(≥ {n}),`filter.minCount===v` 时
   `.is-active`。
4. **区域段**(brief §4):`h6` + 「全部」按钮(`!filter.regionFilter` 时 `.is-active`,点击
   `setRegion(null)` 直接赋值)+ 逐个 region 按钮(`regionLabel()` 有 `regionLabelKey` 键则
   `t(key)`、无键回落 `r.label`——偏离登记 3,T2 既定),点击 `toggleRegion(id)` 切换语义
   (再点一次清空)。
5. **只看当前行程段**(brief §5):`label.mfp-checkbox`(`filter.recentOnly` 时 `.is-on`)+
   `.mfp-tick`(勾选时内嵌 10px check 图标,path `m5 12 5 5L20 7`——Vue2 `PhotosIcon.vue`
   `name==='check'` 的原始 path,不是本仓其它页面已用的近似 check path,保真移植)+ 隐藏的
   `<input type="checkbox">` + 文案 `photosPlacesCurrentTripOnly`。点击整个 label
   `@click.prevent="toggleRecentOnly"`——不依赖浏览器/ jsdom 对隐藏 checkbox 的原生 label
   转发行为(那个行为在 `display:none` 输入上跨环境不稳定),自己接管取反语义。
6. **`.mfp-foot`**(brief §6):`.mfp-reset`(点击 `resetFilters()`,emit 六字段全默认对象,
   不是从当前 filter 局部改)+ `.mfp-done`(点击 `done()`,只 emit `update:open(false)`,不带
   filter)。

**浮层规范**:`rootRef` 包住 chip+弹层(对应 Vue2 `<div ref="filterMenu"
style="position:relative">`,这里用 `.pfm-anchor` 类实现同等定位,非可见颜色,不受
color-guard 约束)。`watch(() => props.open, ..., {immediate:true})` 挂/摘 `document`
级 `mousedown`(容器外点击 → emit `update:open(false)`)与 `keydown`(Esc → 同上);
`onUnmounted` 兜底再摘一次。`onDocKeydown` 内只有一条早退(非 Escape 键跳过),没有额外分支
——本组件自身只管一个 `open` 状态。

## Vue2 逐节点清点表(证明零漏渲染)

对着 `PhotosPlacesView.vue:830-906`:

| Vue2 节点 | 行号 | 本组件对应 | 状态 |
|---|---|---|---|
| `<div ref="filterMenu" style="position:relative">` | 830 | `.pfm-anchor` | ✅ |
| `<button class="map-chip ...">` + `.is-active` 三元 | 831-834 | `.map-chip` + `:class="{'is-active':chipActive}"` | ✅ |
| `<PhotosIcon name="filter" :size="11">` | 835 | 11px funnel svg | ✅ |
| `{{ $t('Filters') }}` | 836 | `t('photosPlacesFilters')` | ✅ |
| `<span v-if="...">· {{...}}</span>` 徽标 | 837-840 | `.pfm-badge` `v-if="badgeCount"` | ✅ |
| `<PhotosIcon name="chevD" :size="10">` | 841 | 10px chevron svg | ✅ |
| `<div v-if="filterOpen" class="map-filter-pop">` | 843 | `<div v-if="open" class="map-filter-pop">` | ✅ |
| 时间范围 `.mfp-section`(h6+两 input+分隔符+两小标签) | 844-860 | 同结构 | ✅ |
| 最少照片数 `.mfp-section`(h6+五按钮) | 861-872 | 同结构 | ✅ |
| 区域 `.mfp-section`(h6+全部按钮+逐 region 按钮) | 873-887 | 同结构 | ✅ |
| 只看当前行程 `.mfp-section`(label+tick+隐藏 checkbox+文案) | 888-896 | 同结构 | ✅ |
| `.mfp-foot`(reset+done) | 897-904 | 同结构 | ✅ |

六段一个不漏。**注**:Vue2 第 907 行起是 `themeMenu`(主题弹层),属于 T10,本任务未渲染,
符合 brief 消歧义 4。

## Vue2 样式逐规则清点表

`photos-places.scss:199-231`(chip):`.map-chip-row`(**不属于本组件**——那是 T11 容器要建
的外层 flex 行,本组件只对应其内部一个 `filterMenu` 子容器)、`.map-chip`、
`.map-chip:hover`、`.map-chip.is-active` —— 全部落地(`.map-chip-row` 明确排除,理由见
brief 消歧义 4「不要顺手建 T11 的东西」)。

`:854-963`(弹层,本组件只取到 `.mfp-foot .mfp-done` 为止,`:963` 起是
`.map-theme-pop`=T10):

| 规则 | 行号 | 落地 | 备注 |
|---|---|---|---|
| `.map-filter-pop` | 854-865 | ✅ | 底色改用,见下方 token 章节 |
| `.map-filter-pop h6` | 866-874 | ✅ | |
| `.mfp-section + .mfp-section` | 875 | ✅ | |
| `.mfp-date-row` | 876 | ✅ | |
| `.mfp-date-row input` | 877-888 | ✅ | 含 `color-scheme:dark` 字面值原样保留(非颜色 token,不受 guard 约束,理由见下) |
| `.mfp-date-sub` | 889-894 | ✅ | |
| `.mfp-count-row` | 895 | ✅ | |
| `.mfp-count-row button` | 896-902 | ✅ | 新增 `:hover`(Vue2 没有,本仓桌面交互惯例) |
| `.mfp-count-row button.is-active` | 903-905 | ✅ | 新增 `.is-active:hover` 同值钉死 |
| `.mfp-region-row` | 906 | ✅ | |
| `.mfp-region-row button` | 907-914 | ✅ | 新增 `:hover` |
| `.mfp-region-row button.is-active` | 915-919 | ✅ | 新增 `.is-active:hover` 同值钉死 |
| `.mfp-checkbox` | 920-928 | ✅ | 新增 `:hover` |
| `.mfp-checkbox .mfp-tick` | 929-936 | ✅ | |
| `.mfp-checkbox.is-on .mfp-tick` | 937-940 | ✅ | 新增 `.is-on:hover .mfp-tick` 同值钉死(防御性,见下) |
| `.mfp-foot` | 941-946 | ✅ | |
| `.mfp-foot .mfp-reset` | 947-954 | ✅ | 新增 `:hover` |
| `.mfp-foot .mfp-done` | 955-961 | ✅ | 新增 `:hover`(同值,无变体分歧,不需要级联断言) |

零漏渲染;新增的 6 处 `:hover`(count-row/region-row 基类+变体各一对、region-row 有独立
一条、checkbox 基类、reset、done)均是 Vue2 没有但本仓桌面交互一致性要求补的,已在样式注释
逐条登记来源("Vue2 没有给这些按钮 `:hover`……本仓桌面交互惯例新增")。

## 回源核对结果(brief 的行号/档位数组/alpha/尺寸有没有出入)

逐项核对 `PhotosPlacesView.vue` 与 `photos-places.scss` 源码:

- `MIN_COUNT_STEPS=[0,10,50,100,200]`(`:865`):**无出入**,源码字面一致。
- chip 图标尺寸(filter 11px / chevD 10px)、徽标 `font-variant-numeric:tabular-nums;
  opacity:.7`:**无出入**。
- `toggleRegion`/`clearFilters`(`:441-449`):**无出入**,`clearFilters` 六字段字面顺序与
  brief 描述一致(`minCount→regionFilter→recentOnly→timeFilter→customStart→customEnd`)。
- 日期 `@input` 条件行号 brief 写 `:849`/`:854`——**核对属实**,两处分别在两个 `<input>` 标签
  的 `@input` 属性上。
- `.mfp-checkbox.is-on .mfp-tick` 背景确为 `background: var(--accent)` **纯实底**
  (`:939`,无渐变/无透明度)——核实通过,`--on-accent` 使用前提满足(见下)。
- chip `.is-active` 背景 `rgba(var(--accent-rgb), 0.18)`(`:227`)——brief 未指出这条需要
  特殊处理,但本仓无 `--accent-rgb` 通道 token 且 `--accent` 随主题变化,brief 给的通用
  "本仓没有……" 清单里也没列出这条需要新增什么;**本任务新发现并已在 token 章节记录**,
  未在 brief 中被预先纠正,算是本任务自己补的一条回源发现。
- 本次没有发现 brief 行号/数组/alpha 有算错的地方(前八个任务已把常见坑纠过一轮,T9 复核
  未踩到新的行号错误)。

## Token 映射表

| Vue2 token/字面量 | 本仓落地 | 说明 |
|---|---|---|
| `--text-1` | `var(--fg)` | 既定映射 |
| `--text-2` | `var(--fg-muted)` | 既定映射 |
| `--text-3` | `var(--fg-subtle)` | 既定映射 |
| `--line` | `var(--card-border)` | 既定映射 |
| `--accent-hi` | `var(--accent-text)` | 既定映射(`MergeReviewDialog.vue:249-252`/`PersonHero.vue:488-491`/`PersonRelationsTab.vue:249-251`/`PlacesRail.vue:329` 既有先例复用,非本任务新决定) |
| `--surface-3`(日期输入/最少照片按钮/checkbox 行底色) | `var(--chip-bg)` | 沿用 `PlacesRail.vue` 既定 `--surface-2/3→--chip-bg` 场景(小元素叠在已不透明的父容器上) |
| `--surface-2`(**弹层自身**底色,`.map-filter-pop`) | `var(--popup-bg)` | **本任务偏离登记**:与 brief 给的通用 "`--surface-2→--chip-bg`" 映射不同。理由:Vue2 `--surface-2` 在这里是整块弹层自身的不透明纯色底,`--chip-bg` 是半透明渐变(为叠在已不透明父容器上的小元素设计),若拿来当悬浮在地图画布上的整块弹层底色,会透出地图、内容基本不可读。本仓已有专门服务"不透明浮动菜单/面板"场景的组合 token `--popup-bg`+`--card-shadow-hi`,`ContextMenu.vue`/`Dialog.vue`/`AlertDialog.vue`/`ClusterActionDialog.vue`/`AlbumPickerDialog.vue`/`PersonHero.vue` 的两个下拉菜单全部用这一对(结构与本组件完全同构:触发按钮下方的绝对定位下拉面板),改用它们,不新增 token。 |
| `rgba(0,0,0,0.6)` 阴影 | `var(--card-shadow-hi)` | 与上一条配套,同一批既有组件的既定组合 |
| `rgba(var(--accent-rgb), 0.18)`(chip `.is-active` 背景) | `color-mix(in srgb, var(--accent) 18%, transparent)` | **本任务新决定,不新增 token**:本仓 `--accent` 随主题变化且没有 RGB 通道 token,`color-mix` 直接对 `var(--accent)` 取同一个精确 18% alpha,不近似、不新增 token(同 `theme.css` `--album-cover-fallback` 的既有 `color-mix` 用法) |
| `white`(`.mfp-count-row button.is-active`/`.mfp-foot .mfp-done` 文字) | `var(--on-accent)` | 背景均为 `var(--accent)` 纯实底,满足使用前提 |
| `white`(`.mfp-tick` check 图标 `color="white"`) | `stroke="var(--on-accent)"` | 已核实 `.is-on .mfp-tick` 背景为 `var(--accent)` 纯实底(见下方专项核实) |
| `color-scheme: dark`(日期输入) | 原样保留 | 不是颜色字面量(浏览器渲染提示关键字,不匹配 HEX/FUNC 正则),Vue2 硬编码给两个日期输入的原生日历控件强制深色渲染,与地图画布固定深空背景视觉协调,原样照搬 |

**T8 三个可复用 token 检查**:`--float-bg`/`--zb-hover-bg`/`--zb-track-bg` 是给 T8
玻璃底工具条(半透明+blur)设计的,本组件弹层是不透明纯色底+box-shadow(Vue2 `.map-filter-pop`
没有 `backdrop-filter`),场景不同,**未复用、未新增同类**——按已确立的 `--popup-bg` 惯例走。

**THEMING.md 登记**:本任务未新增任何 token(`--popup-bg`/`--card-shadow-hi`/`--chip-bg`/
`--chip-bg-hi`/`--accent-text`/`--accent-soft`/`--on-accent`/`--card-border`/
`--fg`/`--fg-muted`/`--fg-subtle` 均是已在 `docs/THEMING.md` 登记过的既有 token),故
**未修改 `docs/THEMING.md`**——没有新 token 需要登记。

## `.mfp-tick` 背景是否 accent 实底的核实结论

`photos-places.scss:937-940`:
```
.map-filter-pop .mfp-checkbox.is-on .mfp-tick {
  border-color: var(--accent);
  background: var(--accent);
}
```
**纯实底,无渐变、无透明度**——`--on-accent` 使用前提满足,本组件 `.mfp-tick` 内 check 图标
`stroke="var(--on-accent)"` 成立,不需要 theme-exception 钉死浅色。

## 三处「基类+变体」cssCascade 断言

1. `.mfp-count-row button.is-active:hover` —— 变体自带 `:hover`,与基类 `.mfp-count-row
   button:hover` 相比多一个类,严格更高优先级(不靠源码顺序)。
2. `.mfp-region-row button.is-active:hover` —— 同上结构。
3. `.mfp-checkbox.is-on:hover .mfp-tick` —— 防御性钉死:当前 Vue2/本仓都没有会与
   `.mfp-tick` 背景产生真实冲突的基类 hover 规则(`.mfp-checkbox:hover` 只改自身背景,不touch
   `.mfp-tick`),但 brief 明确点名这三处要用 cssCascade 断言,按同样纪律补一条同值规则+
   专项测试,防止未来有人往 `.mfp-checkbox:hover .mfp-tick` 加规则时悄悄踩坑。

**测试实现坑记账**(过程中发现,已修正):`cssCascade.ts` 的 `hoverBackgroundRules` 按
"选择器里出现的所有 `.class` 必须都在传入的 classes 数组里"做匹配,而本组件选择器带
`.map-filter-pop` 祖先前缀(照 Vue2 SCSS 嵌套结构,不是 `ClusterActionDialog`/
`MergeReviewDialog` 那种"单个复合选择器,无后代组合子"的形态)——第一版测试只传
`['mfp-count-row','is-active']` 两个类,导致工具因为"选择器还含一个不在名单里的
`map-filter-pop` 类"而完全跳过这条规则,`rules.length===0` 直接抛错。修法:把祖先类也传进
`classes` 数组(`['map-filter-pop','mfp-count-row','is-active']`)——祖先前缀同时压在基类与
变体两条规则上,不改变两者的相对优先级排序,工具能正确评出赢家。

**第二个更隐蔽的坑(删码验证 ⑥ 期间发现)**:非 hover 版本的 `.is-active` 规则
(`b=3,c=1`)与基类 `:hover` 规则(`b=3,c=1`)在真实 CSS 里优先级严格相等,tie-break 靠源码
顺序——而 `.is-active`(非 hover)写在 `:hover` 规则之后,靠顺序也能赢。这意味着只断言
"winner 的 selector 含 is-active、value 含 --accent" 在删掉变体自己的 `:hover` 规则后**测不
出红**(靠 tie-break 苟活出同样的胜者)。修法:额外断言 `winner.selector` 必须显式包含
`:hover`,证明它是靠更高优先级(而不是源码顺序)赢的。删码验证 ⑥ 见下方章节,这条坑已在
执行删码验证时抓到并修正测试,过程见 TDD 证据章节。

## 测了什么与结果

`src/photos/components/__tests__/PlacesFilterMenu.test.ts`,35 个用例,覆盖:
- chip 徽标计数(四项全中=4、全默认无节点、单项=1)
- chip `.is-active`(额外过滤/timeFilter 两种触发源、全默认无、点击 emit `update:open` 取反)
- 最少照片数(五按钮渲染+文案、`.is-active` 归位、点击整体替换断言"其余字段与传入一致")
- 区域(译文/回落 label、"全部"按钮 `.is-active`、未选中点击赋值、已选中点击清空=切换语义、
  "全部"直接赋值非切换)
- 日期(只填 start/end 各自退回 all、两头都填=custom、两头都填后清空一头退回 all)
- 勾选框(取反两方向、`.is-on`+图标存在性、非 `.is-on`+图标不存在性)
- 重置(六字段全默认)、完成(只 emit open、不带 filter)
- 浮层(外部 mousedown 关闭、内部 mousedown 不关闭、Esc 关闭、非 Esc 不关闭、open=false 后
  监听不再触发、卸载后监听摘干净比对函数引用)
- 英文 locale sanity(chip/Any/All 文案切换)
- cssCascade 三处基类+变体 hover 归属断言

全部 35 个通过。全量 `pnpm exec vitest run`:**277 文件 / 2459 测试全绿**(含新增两个
文件)。`pnpm exec vue-tsc --noEmit`:无输出,类型检查通过。`color-guard.test.ts` 内本组件
一条 `无裸颜色字面量` 断言通过。

## TDD 证据

严格来说本任务是"组件与测试同批写出后跑通",不是逐行字面 RED→GREEN,但补齐了两类真实
RED→GREEN 证据:

1. **首次整体跑测试时的真实 RED**(cssCascade 两条断言,非人为构造):
   ```
   ❯ src/photos/components/__tests__/PlacesFilterMenu.test.ts (35 tests | 2 failed)
        × .mfp-count-row button.is-active:hover 背景归属变体规则
        × .mfp-region-row button.is-active:hover 背景归属变体规则
   Error: 没有任何 background 规则命中 .mfp-count-row.is-active
   ```
   根因是测试工具类名集合没带祖先类(见上节),修测试后 35/35 GREEN。

2. **color-guard 首次全量跑出的真实 RED**:
   ```
   FAIL colour-guard ... photos/components/PlacesFilterMenu.vue 无裸颜色字面量
     L226: #1A1A20)...
     L248: rgba(var(--accent-rgb), 0.18) ...
   ```
   根因是样式块顶部的说明注释里写了字面 `#1A1A20` 和 `rgba(...)` 语法(guard 不剥 CSS 注释,
   逐行裸扫描),改写措辞后 GREEN(见下方改动文件章节)。

3. **删码验证阶段的六次显式 RED→(还原)→GREEN 循环**,见下节,含一次真实的"预期变异未致
   红→停下改测试"事件(count-row/region-row 那次)。

## 删码验证逐条结果

方法:每次只改动一处(用 `cp` 备份 + 定点 `Edit`/脚本修改),跑
`pnpm exec vitest run src/photos/components/__tests__/PlacesFilterMenu.test.ts`,确认对应
用例变红,再用 `cp` 备份还原、`diff` 确认与备份逐字节相同,再跑一遍确认恢复 GREEN。

| # | 变异 | 结果 |
|---|---|---|
| ① | `badgeCount` 删掉 `+ (timeFilter!=='all'?1:0)` 那一项,变成只等于 `extraCount` | RED:2 个用例("四项全中=4"、"单独 timeFilter=year=1")失败;还原后 35/35 GREEN |
| ② | 两个日期 `@input` 的条件式改成恒 `'custom'` | RED:3 个用例("只填 start"/"只填 end"/"清空一头退回 all")失败;还原后 GREEN |
| ③ | `toggleRegion` 的切换语义改成单向赋值 | RED:1 个用例("再点一次清空")失败;还原后 GREEN |
| ④ | `watch(open)` 里删掉 `else` 分支(不再摘监听) | RED:1 个用例("open=false 后不再触发 emit")失败;还原后 GREEN |
| ⑤ | `onDocKeydown` 加一个"早退"分支(模拟 P5 两弹层互相干扰的 bug) | **记账,不在本任务执行**:本组件自身只管一个 `open` 状态,函数体内没有"另一个分支"可早退,这个 bug 形态需要两个 PlacesFilterMenu/主题弹层实例同时挂 document 监听才会出现,集成断言归 T11(brief 消歧义明确"本任务只需在报告里记账,不必自己造两个弹层") |
| ⑥ | 删掉三处变体 `:hover` 规则(`.mfp-count-row button.is-active:hover`/`.mfp-region-row button.is-active:hover`/`.mfp-checkbox.is-on:hover .mfp-tick`) | **第一轮假绿**:count-row/region-row 两条断言删除后仍是 GREEN(源码顺序 tie-break 苟活出同一个胜者,详见"测试实现坑记账"),按项目纪律"若某变异没让预期测试变红:不要调整测试去迁就——停下来报实况并设计一条真能抓住它的测试"处理:加了 `winner.selector` 必须含 `:hover` 的断言后重跑,RED:三条断言全部失败;还原后 35/35 GREEN |

全部还原后用 `diff` 确认组件文件与初始版本逐字节一致,无残留改动。

## 改动的文件

- `src/photos/components/PlacesFilterMenu.vue`(新建)
- `src/photos/components/__tests__/PlacesFilterMenu.test.ts`(新建)

未改动任何 T1-T8 的产物、未新增 T10/T11 相关文件(`.map-chip-row` 容器、主题弹层等)、未碰
`docs/THEMING.md`(无新 token)。

## 自查发现

- Vue2 `PhotosIcon.vue` 的 check 图标 path 是 `m5 12 5 5L20 7`,本仓其它页面(`PhotosAlbums.vue`/
  `PhotosPeople.vue`/`PhotosPersonDetail.vue`)已经在用一个数值上略有差异的近似 path
  (`M5 13l4 4L19 7`)。本任务选择精确复刻当前这个 Vue2 源组件(`PhotosPlacesView.vue` 引用的
  `PhotosIcon`)自己的原始 path,而不是照搬本仓其它页面已有的近似版本——两者视觉几乎无法区分,
  但既然本任务的移植权威是 `PhotosPlacesView.vue` 这个具体源文件而不是本仓其它页面,按"保真
  移植的唯一权威是 Vue2 源码"原则选了精确版本。
- `.map-chip` 本身在 Vue2 里没有 `display:flex`,内部图标/文字/徽标/chevron 靠默认 inline
  流排布——本任务没有额外加 flex/gap,原样保留这个"看起来简陋但 Vue2 真是这么写的"布局方式,
  避免"界面 1:1"之外的自选布局改动。
- 勾选框改用 `@click.prevent` 在 `<label>` 上直接调用 `toggleRecentOnly()`,而不是给隐藏的
  `<input type="checkbox">` 绑 `@change` 依赖浏览器/ jsdom 的原生 label→input 点击转发——因为
  `display:none` 的表单控件在不同环境下是否仍参与原生转发不够可靠,直接接管更确定。这不是
  Vue2 原文件的写法(Vue2 用 `v-model` + 依赖原生转发),但只是**实现方式**层面的差异,行为
  (点击整个 label 都能取反)与视觉完全一致,不算界面/行为偏离。

## 顾虑

- 删码验证 ⑤(两个弹层同开时 Esc 各自关闭)按 brief 要求只记账,实际集成验证要等 T11 把本
  组件与 T10 主题弹层一起装进 `.map-chip-row` 容器才能做真断言,需要 T11 承接。
- `.map-chip.is-active` 的 `color-mix` 写法与 chip 层的 `--popup-bg`/`--card-shadow-hi` 决定
  都是本任务新做的判断(brief 没有把这两条列进"已因用近似 token 而非新增精确 token 返工过"
  的清单),已在报告里给了完整理由,但如果后续 T10(主题弹层同样要接一个 `.map-chip` 且同样
  可能是不透明面板)采用了不同的 token 选择,两个弹层视觉上会不一致——建议 T10 复用本任务这
  两条决定,而不是各自重新判断。

---

## 评审回复(Important 驳回 + 两条 Minor)追加

评审判 `.map-filter-pop` 用 `--popup-bg`/`--card-shadow-hi` 是"就近取",要求新增
`--filter-pop-bg`/`--filter-pop-shadow` 精确复刻 Vue2。**协调者驳回了这条 Important,
判断维持现状**——依据是区级 spec D3:

> 照 New-UI 设计语言重塑(AreaShell/token/**组件体系**,同 SP4/SP5 前例);**布局结构与
> 信息层级**照 Vue2,不搬 4498 行 photos.scss。

弹层底色/投影属于"组件体系 / surface treatment"归 New-UI 一侧;T5/T6/T8 新增精确 token 是
因为那些是**内容色**(图钉色/选中城市行/滑杆轨道),本仓没有对应约定,而**弹层 chrome 在本仓
已有既定约定**(`--popup-bg`/`--card-shadow-hi`,ContextMenu/Dialog/AlertDialog 等共用),
复用它正是 D3 要求的一致性。协调者要求把这条裁定**写进代码注释**(不能只留在 report 里),
已处理,三条改动如下:

### 1. `.map-filter-pop` 补充 D3 裁定注释

`src/photos/components/PlacesFilterMenu.vue:258-280`(`.map-filter-pop` 规则体正上方)
补了一段注释,四点齐全:①刻意用本仓弹层 chrome 约定而非复刻 Vue2 实底+单层投影;②依据
D3"组件体系照 New-UI、布局结构与信息层级照 Vue2"原文;③与 T5/T6/T8 的区别(内容色 vs
弹层 chrome,后者本仓已有约定);④真机验收看点——`--card-shadow-hi` 深色主题含一层 inset
白色上缘高光(Vue2 那个扁平菜单没有),若用户不认可则改法是新增
`--filter-pop-bg`/`--filter-pop-shadow` 精确复刻。**未在样式注释里写字面 hex/rgba 语法**
(color-guard 不剥注释,写字面色值会被逐行裸扫描命中——第一版就因为在两处注释里写了字面
`#1A1A20` 和 `rgba(0,0,0,0.6)` 而自触发过一次 color-guard RED,已改成不含字面色值语法的
文字描述,重跑确认 GREEN)。

### 2. Minor:`color-mix` 先例引证改正

`PlacesFilterMenu.vue:250-254`(`.map-chip.is-active` 规则体内注释)原引 `theme.css`
`--album-cover-fallback`,评审指出那是"混两个不透明色做渐变端点"的不同技法,不是
"`color-mix(..., transparent)` 取 alpha"的同技法先例。已改引真先例:`PhotosSidebar.vue:99`
(`.side-item.active`)、`theme.css` 的 `file-flash-kf` 关键帧、`PersonRelationsTab.vue:263-266`、
`PhotoInfoPanel.vue:189/201`——四处均已核实存在且确为同技法(`color-mix(in srgb,
var(--accent) N%, transparent)`)。数学与视觉结果本身没有问题(评审已独立验算
`color-mix(in srgb, var(--accent) 18%, transparent)` 精确等于 18% alpha),只是引证写错,
现已改正。

### 3. Minor:第三条 cssCascade 测试的偏离登记

`.mfp-checkbox.is-on:hover .mfp-tick` 那条测试没走 `winningHoverBackground` 的优先级计算,
是裸的子串存在性检查——brief 明写"用 cssCascade 按优先级断言",这条偏离了但没像另外两处
那样显式标注。评审判"可辩护"(该配对确实没有同优先级竞争规则,`.mfp-checkbox:hover` 从不
触碰 `.mfp-tick` 的背景),给了二选一处置。**选择②:保留现写法,在测试旁补注释登记偏离**
(而非改成套用优先级计算模型——那个模型是为"两条规则都命中同一元素、需要分胜负"设计的,
这一对目前没有这个场景,硬套反而不贴切)。已在
`src/photos/components/__tests__/PlacesFilterMenu.test.ts` 该测试内补一段注释,写明:
现状是存在性检查、理由是没有同优先级竞争规则(已用 `baseRuleSelectorLine` 断言核实
`.mfp-checkbox:hover` 的选择器不含 `mfp-tick`)、删码验证 ⑥ 已验证删掉防御规则时这条会红、
以及**升级条件**——若日后有人给 `.mfp-checkbox:hover` 加一条会动 `.mfp-tick` 背景的规则
(哪怕是后代选择器形式),这条测试必须升级成 `winningHoverBackground` 优先级断言。

### 收尾验证

```
$ pnpm exec vitest run src/photos/components/__tests__/PlacesFilterMenu.test.ts src/styles/color-guard.test.ts
 Test Files  2 passed (2)
      Tests  291 passed (291)

$ pnpm exec vue-tsc --noEmit
(无输出,通过)

$ pnpm exec vitest run
 Test Files  277 passed (277)
      Tests  2459 passed (2459)
```
(`favorites.test.ts` 里那条 `Not implemented: navigation` 是既有 jsdom 噪音,与本次改动
无关,不影响测试通过状态。)

### 改动的文件(本轮追加)

- `src/photos/components/PlacesFilterMenu.vue`(样式注释:D3 裁定 + color-mix 引证改正)
- `src/photos/components/__tests__/PlacesFilterMenu.test.ts`(补偏离登记注释)
- 本报告文件(追加本节)

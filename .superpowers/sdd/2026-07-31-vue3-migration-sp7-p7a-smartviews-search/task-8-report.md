# Task 8 报告:SmartViewSidePanel.vue + SmartViewActivityFeed.vue —— 右栏三段 + 活动流

状态:**DONE**

## 改了哪些文件

- 新建 `src/photos/components/SmartViewSidePanel.vue`(阈值段 / 设置段 / 统计段)
- 新建 `src/photos/components/SmartViewActivityFeed.vue`(活动流,独立成段含自己的
  `.sv-side-section` + `<h3>`)
- 新建 `src/photos/components/__tests__/SmartViewSidePanel.test.ts`(22 例)
- 新建 `src/photos/components/__tests__/SmartViewActivityFeed.test.ts`(14 例)
- 改 `src/views/PhotosSmartViewDetail.vue`:import 两个新组件、把 T6 留的
  `<aside class="sv-detail-side" data-test="sv-side-mount" />` 空壳兑现为挂载两个真组件、
  新增 `onSidePatch` 宿主接线函数(把 `patch` emit 翻译成 `store.updateSmartView(id, patch)`)
- 改 `src/views/__tests__/PhotosSmartViewDetail.test.ts`:把 T6/T7 阶段留的 T8 空壳 stub
  断言(`children.length===0`)升级成真组件断言(4 段渲染 / activity 拿到 store 数据 /
  阈值 300ms debounce 接线 / 开关点击接线)
- 改 `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`:去掉三处字面 `<b>`,新增
  `photosSvActOneMatchedBold` 一个键(详见下方 i18n 章节)
- 未改 store / `SmartViewCard.vue` / `PhotosThreshSlider.vue` /
  `SmartViewConditionEditor.vue` / `assetToPhoto` / `cssCascade.ts` / Service 仓,未新增依赖

## Vue2 `:152-230` 节点清点表(逐节点 → New-UI 落点)

| Vue2 行号 | 节点 | New-UI 落点 |
|---|---|---|
| 152-153 | `<aside class="sv-detail-side">` + 第 1 段容器 `.sv-side-section` | 宿主 `.sv-detail-side`(T6 已建外壳)+ `SmartViewSidePanel.vue` 第 1 个 `.sv-side-section` |
| 154 | `<h3>Quality threshold</h3>` | `t('photosSvQualityThreshold')` |
| 155-158 | `.sv-thresh-row`:说明文案 + `<b>{{thresh}}%</b>` | `.sv-thresh-row` + `data-test="sv-thresh-value"` |
| 159 | `<input type="range" class="sv-slider" @input>` | **不重建**——`<PhotosThreshSlider :value="thresh" @input="onThreshInput" />`(T5 已抽) |
| 160 | `.sv-slider-marks` 三档标尺 | 同上,PhotosThreshSlider 内部自带,不重复 |
| 161 | `.sv-thresh-help` `v-html="threshHelp"` | `.sv-thresh-help` + `<i18n-t keypath="photosSvThreshHelp">`(零 v-html)+ 尾巴独立拼接 |
| 164 | 第 2 段容器 | `SmartViewSidePanel.vue` 第 2 个 `.sv-side-section` |
| 165 | `<h3>Settings</h3>` | `t('photosSvSettingsSection')`(值是「设置」,偏离登记 10 的既有约定,本任务沿用不改) |
| 166-171 | 第 1 个 `.sv-toggle-row`(auto-add + paused/文案二选一 + `.sv-switch`) | 同结构,`data-test="sv-switch-live"`,补 `role="switch"`/`aria-checked`/`aria-label`(net-new a11y) |
| 173-178 | 第 2 个 `.sv-toggle-row`(include videos + `.sv-switch`) | `data-test="sv-switch-videos"`,同样补 a11y 属性 |
| 182 | 第 3 段容器 | `SmartViewSidePanel.vue` 第 3 个 `.sv-side-section` |
| 183 | `<h3>Stats</h3>` | `t('photosSvStats')` |
| 184-201 | `.sv-stat-grid` 四格(count+delta / median / storage / lastUpdated) | 四个 `.sv-stat-cell`,各带 `data-test` |
| 202 | `style="margin-top:16px"` | 原样保留内联(布局量,非颜色) |
| 203 | `style="font-size:11.5px;color:var(--text-3);margin-bottom:4px"` 小标题 | 改 class `.sv-dist-head` |
| 204-206 | `.sv-distribution` 10 根柱 `:style="distStyle(d,i)"` | 同结构,`data-test="sv-dist-bar"`,`distStyle` 逐字照搬 Vue2 `:444` |
| 207 | `.sv-dist-x` 三刻度 `50%/75%/100%` | 原样保留(纯数字字面量,不进 i18n) |
| 211 | 第 4 段容器 | `SmartViewActivityFeed.vue` 自己的 `.sv-side-section`(独立组件自带段标题,见下方"接口取舍"说明) |
| 212 | `<h3>Activity</h3>` | `t('photosSvActivity')` |
| 213-227 | `.sv-activity` → `v-for` `.sv-activity-row`(缩略图最多 3 张 / 占位块 / 文案 v-html / 时间) | `SmartViewActivityFeed.vue` 主体,零 v-html 版 |
| 216-217 | `a.seeds.length>0` → `v-for s in a.seeds.slice(0,3)` | `row.a.assetIds.length>0` → `v-for s in row.a.assetIds.slice(0,3)`(New-UI 字段名是 `assetIds`,Vue2 的 `activity` computed 里把 `assetIds` 改名叫 `seeds`,New-UI 不做这层改名,直接用后端字段名) |
| 219-221 | 占位块内联 style(26×26/4px 圆角/accent-soft 底/flex 居中) | `.sv-activity-placeholder` class,逐属性对照 |
| 224 | `.sv-activity-text v-html="a.text"` | `<i18n-t>`/`<template>` 分支,零 v-html |
| 225 | `.sv-activity-time` | `relTime(a.occurredAt, now, t, locale)` |
| 270-280 | `activityText(a, t)` 五种 + default | `rows` computed 里的 `switch`,五种 kind + 未知类型跳过(偏离登记) |

逐节点均已落地,无静默漏渲染。

## 两个组件的必含用例 → `it` 对应表

**SmartViewSidePanel.test.ts**

| brief 用例 | 对应 `it` |
|---|---|
| 三段各存在(h3×3/range×1/switch×2/stat-grid 4格/distribution 10柱/dist-x 3刻度) | `三段各存在 > h3 三个、range 一个…` |
| 拖 range 到 92 → `.sv-thresh-row b` 显示 92% | `阈值… > 拖 range 到 92 → .sv-thresh-row b 立即显示 92%` |
| fake timer 断言 300ms 后才 emit 且只 emit 一次(连拖 5 次只 1 个) | `阈值… > 连拖 5 次 → 300ms 后只 emit 一次 patch` |
| 300ms 内改回原值 → 仍 emit(不比较值) | `阈值… > 300ms 内把值改回原值 → 仍然 emit` |
| prop 回流:80→90,显示变 90 且不 emit | `prop 回流 > sv.threshold 从 80 变 90 → 显示变 90,且不 emit patch` |
| threshHelp:addedThisWeek=10,thresh=80 → n=13,`<b>`包着 13 | `threshHelp… > addedThisWeek=10、thresh=80 → n=…13,<b> 包着 13` |
| thresh=90 → 尾巴含 May miss borderline matches | `threshHelp… > thresh=90(>85)→ 尾巴含…` |
| thresh=60 → 尾巴含 May include false positives | `threshHelp… > thresh=60(<70)→ 尾巴含…` |
| 边界 85/70 都无尾巴 | `threshHelp… > 边界 85 与 70 都走无尾巴` |
| threshHelp 零 v-html(源文本 + 真 `<b>` 元素) | `threshHelp… > <template> 块不含 v-html 指令用法`(源文本);其余用例里的 `help.find('b')` 断言即"真 `<b>` 元素" |
| live:false → 第一个 switch aria-checked=false + 说明文案 | `设置段… > live=false → 第一个 switch 的 aria-checked="false"…` |
| 点它 → emit { live: true } | `设置段… > 点第一个 switch → emit { live: true }` |
| includeVideos 开关点击 → emit { includeVideos: !原值 } | `设置段… > 点第二个 switch → emit { includeVideos: !原值 }` |
| 段标题是"设置"不是"系统设置" | `设置段… > 段标题是 photosSvSettingsSection 的值…` |
| median 缺 → 0% | `统计四格 > median 缺(0)→ "0%"` |
| formatMB 三档 | `统计四格 > formatMB 三档同 T6` |
| lastUpdated 空 → — | `统计四格 > evaluatedAt 为空 → lastUpdated 是 "—"` |
| distribution=[1..10] → 第10根100%、第5根50% | `分布柱状图 > distribution=[1..10] → 第 10 根…` |
| 全0 → distMax=1,全部0%(非NaN) | `分布柱状图 > 全 0 → distMax=1…` |
| opacity 随 i 递增(0.4/0.94,toBeCloseTo) | `分布柱状图 > opacity 随 i 递增…` |
| distribution 为空数组 → 仍 10 根柱 | `分布柱状图 > distribution 为空数组 → 仍渲染 10 根柱` |

**SmartViewActivityFeed.test.ts**

| brief 用例 | 对应 `it` |
|---|---|
| 6 种 eventType 各一条 | `6 种 eventType 各一条` describe 下 7 个 it(exported 拆成"有 detail"/"无 detail"两条,凑够 brief 说的"7 条断言、6 种类型") |
| 未知 eventType → 不渲染 + warn(前缀过滤) | `未知 eventType… > 单独出现…` |
| matched 两条 DOM 里都有真 `<b>`;源文本零 v-html | `matched(1 张)`/`matched(3 张)` 两个 it 里的 `.find('b')` 断言 + `零 v-html` describe |
| 缩略图:5 条只渲染 3 张;为空 0 张 img + 占位块;参数 (id,'large') | `缩略图` describe 下两个 it |
| activity 为空 → `.sv-activity` 渲染但 0 行 | `空态… > activity 为空数组 → .sv-activity 渲染但内部 0 行` |
| now 可覆写 → 30 秒前显示 photosSvRelMinutes | `时间:now prop 可覆写 > 30 秒前的项 → 显示 photosSvRelMinutes 的值` |

**宿主接线(PhotosSmartViewDetail.test.ts,T8 追加)**

- `sv-side-mount 下渲染 SmartViewSidePanel(3 段)+ SmartViewActivityFeed(1 段)`:钉住两个
  组件都真的挂进去了(4 个 `.sv-side-section`)。
- `活动流拿到 store.activity`:钉住 `:activity="store.activity"` 这条 prop 来源。
- `拖动阈值滑块 → 300ms 后 store.updateSmartView 收到 { threshold }`:钉住
  `onSidePatch` 把 `patch` emit 原样转发给 `store.updateSmartView(id, patch)`,不需要
  额外 `.then(loadDetail)`。
- `点「自动添加新匹配」开关 → store.updateSmartView 收到 { live: true }`:同上,覆盖
  离散开关这条路径。

## 7 条删码验证逐条结果

全部逐条删除 → 跑对应测试文件确认失败 → Edit 手工还原(未用 `git checkout --`)→ 复跑全量确认恢复绿。

| # | 删的是什么 | 结果 |
|---|---|---|
| ① | 阈值 debounce 的 `setTimeout(…, 300)` 包装(直接同步 emit) | 红:"连拖 5 次→1 个" 与 "300ms 内改回仍 emit" 两条用例失败(拿到 5 个 emit,而不是 1 个) |
| ② | `watch(() => props.sv.threshold, …)` 整条 | 红:prop 回流用例失败(显示仍是 80%,不是 90%) |
| ③ | `distMax` 的 `Math.max(1, …)` → 改成 `Math.max(...dist.value)` | 红:全 0 用例失败——`height` 变成 `NaN%`,jsdom 拒绝写入非法 CSS 值,`style.height` 读出来是空串而不是 `'0%'`,同样被测试判定失败,达到"揪出 NaN"的目的 |
| ④ | 未知 eventType 的 `console.warn` 分支,改成兜底成 `created` | 红:两条未知 key 用例都失败(该行被渲染出来 / warn 计数变 0) |
| ⑤ | `assetIds.slice(0, 3)` → 改成 `assetIds`(不截断) | 红:5 条断言失败(渲染出 5 张 img,不是 3 张) |
| ⑥ | 段标题换回 Vue2 原始"系统设置"字样(注:New-UI 没有真的移植过 `Settings→系统设置` 这个键,直接在模板里改成字面量 `系统设置` 复现回归) | 红:「不含系统」用例失败 |
| ⑦ | `threshHelp` 尾巴的两个 `if`,改成恒返回 `''` | 红:thresh=90/60 两条尾巴用例都失败 |

## 回源核对结论

**scss 区间够不够?** `photos-smartview.scss:528-658` 完整覆盖了本任务需要的所有规则:
`.sv-side-section`/`.sv-thresh-row`/`.sv-thresh-help`/`.sv-toggle-row`/`.sv-switch`/
`.sv-activity*`/`.sv-stat-grid`/`.sv-stat-cell`/`.sv-distribution`/`.sv-dist-x`。唯一在
这个区间内但**不该由本任务重复实现**的是 `:543-563`(滑块轨道 + thumb + 标尺)——那是
T5 已抽出的 `PhotosThreshSlider.vue` 的地盘,本任务只消费组件,不重写这套样式(否则就是
brief 明确警告过的"整套滑块样式漏移植"同款事故的反面——这次是重复而不是遗漏)。

**内联 style 是否全部核对?** 是。在 `:152-230` 区间内 `grep 'style='` 命中 5 处
(`:202` margin-top:16px、`:203` 小标题三属性、`:205` `:style="distStyle"` 动态绑定、
`:219` 占位块、`:223`/`:225` 之间的 `style="flex:1;min-width:0"`),全部逐条核对并落地
(见上方节点清点表)。没有发现区间外遗漏的隐藏内联 style。

**几处出入?** 无与 brief 结构规格相悖的出入——brief 给的行号（`:152-230`/`:270-280`/
`:315-331`/`:444`)与真源逐条核对后一致,唯一需要澄清的是"两处都自己调 relTime,now
作为可选 prop"这句在两个组件里的落地方式不完全对称(见下方"接口取舍"),已按最保守的
方式处理并在此登记。

## `<b>` 三个键最终怎么处理的

1. **`photosSvThreshHelp`**(`<b>` 只包住插值 `{n}`,干净情形):去掉字面 `<b></b>`,
   zh 值改成 `'阈值 {pct}% 时，预计每周新增约 {n} 张照片。'`,en 值改成
   `'At {pct}%, expect ~{n} new photos per week.'`。模板用
   `<i18n-t keypath="photosSvThreshHelp" scope="global"><template #pct>…</template>
   <template #n><b>{{ threshN }}</b></template></i18n-t>`。**未新增键。**

2. **`photosSvActNMatched`**(`<b>` 实际包住的是"`{n}` + 静态词"整个短语,不是单独
   `{n}`——这一点与 brief 结构规格表格的措辞"`<b>` 包住插值 `{n}`"字面对不上,但结构规格
   明确指示"直接开槽,不需要拆键"):按 brief 明确指示执行,去掉字面 `<b></b>`,
   zh 值改成 `'{n} 张新照片 已自动添加'`,en 值改成 `'{n} new photos auto-added'`,
   模板只把 `{n}` 本身包进 `<b>`(`<template #n><b>{{ row.n }}</b></template>`)。
   **视觉后果(登记)**:加粗范围从 Vue2 的"整个短语"(如"**3 张新照片**")收窄成
   "仅数字"(如"**3** 张新照片")——这是 vue-i18n `<i18n-t>` 插槽机制的结构性限制
   (插槽只能对齐字符串里已声明的插值位,不能把语言相关的静态词一并塞进插槽而不硬编码
   到模板里),按 brief 的**唯一新增键**约束(见下一条),没有为这一行再拆一个
   `photosSvActNMatchedBold` 键来找回整句加粗。**未新增键。**

3. **`photosSvActOneMatched`**("1" 是静态字面量,拆键情形):zh 主句键改成
   `'{photo} 已自动添加'`,en 改成 `'{photo} auto-added'`;**新增**
   `photosSvActOneMatchedBold`(zh `'1 张新照片'` / en `'1 new photo'`)。模板
   `<template #photo><b>{{ t('photosSvActOneMatchedBold') }}</b></template>`。
   **这是本任务唯一新增的 i18n 键**,zh_cn.ts/en_us.ts 两处对称新增,插入位置紧邻
   `photosSvActOneMatched` 本身(未打乱其余既有键的相对顺序,`parity.test.ts` 只校验
   键集合不校验顺序,已确认)。

## 宿主接线的 patch 形状

`SmartViewSidePanel` 只发一个统一的 `patch` emit:
`(e: 'patch', patch: { threshold?: number; live?: boolean; includeVideos?: boolean }): void`。
宿主 `onSidePatch` 原样转发给 `store.updateSmartView(sv.value.id, patch)`,catch 住失败
并 toast `photosSvUpdateFailed`(复用 T7 `addCond`/`removeCond` 已建立的同款错误处理惯例)。
不需要额外 `.then(loadDetail)`——§7e-2 的 `byId(id)` 让 `sv` computed 在 store 数组项
更新后自动跟着变,`SmartViewSidePanel`/`SmartViewActivityFeed` 的 props 立刻拿到新值。

## 接口取舍(申报的偏离)

brief 的 Interfaces 段只给 `SmartViewSidePanel` 声明了 `{ sv: SmartView; busy?: boolean }`
(无 `now`),但给 `SmartViewActivityFeed` 声明了 `{ activity: SmartViewActivity[]; now?: number }`。
结构规格另一处文字又说"两处都自己调 relTime……now 作为可选 prop 便于测试"，两处表述不完全
一致。处理方式(登记):**严格按 Produces 接口签名实现**——`SmartViewSidePanel` 不接受
`now` prop,其 `lastUpdated` computed 内部直接用 `Date.now()`(与 Vue2 同名 computed
一样,只是"渲染那一刻算一次"，不是响应式时钟);`SmartViewActivityFeed` 按接口保留
`now?: number`,内部 `props.now ?? Date.now()`。**影响**:`SmartViewSidePanel` 的
`lastUpdated` 结果对外部时钟不可覆写,测试只覆盖了 `evaluatedAt` 为空时的兜底分支
(`'—'`),不覆盖具体相对时间文案的断言——这与 brief Step 1 给出的必含用例列表完全吻合
(该列表里 SidePanel 部分确实只要求"evaluatedAt 为空 → —",没有要求非空时的具体相对时间
断言),因此这个取舍不影响任何必含用例的可测性。

## 其它申报的偏离

- **两个开关的 a11y 属性**(`role="switch"`/`aria-checked`/`aria-label`)是 net-new,
  Vue2 只有裸 `<div class="sv-switch" :data-on @click>`,同 T5
  `SmartViewCreateDialog.vue` 已立的先例一致处理。
- **busy 守卫**(`data-busy` + 点击/防抖到期时短路 emit)是 net-new,Vue2 完全没有
  "PATCH 还没回来又点一次"的概念;同 T7 `SmartViewConditionEditor.vue` 的
  `removeCond`/`submit` busy 守卫是同一个理由的延伸。
- **token 映射**沿用 `SmartViewCreateDialog.vue:436-438` 已立的规范表
  (`--text-1/2/3/4 → --fg/--fg-muted/--fg-faint/--fg-subtle`、
  `--surface-1/2/3 → --popup-bg/--chip-bg/--chip-bg-hi`、`--line → --card-border`、
  `--accent-hi → --accent-text`)。注意 `PhotosSmartViewDetail.vue`(T6)在个别位置
  (如 `.sv-header-stats`)对 Vue2 的 `--text-3` 用了 `--fg-muted` 而不是
  `--fg-faint`——这是已存在于代码库里的先例分裂,不在本任务范围内统一,仅在此登记以免
  被误认为是本任务引入的新不一致。
- **分布柱渐变**:Vue2 `linear-gradient(to top, var(--accent), #B8AAFF)` 写死字面色 →
  改 `linear-gradient(to top, var(--accent), var(--accent-text))`,accent 家族两档,
  同 `PersonRelationsTab.vue:251` 的既有先例。
- **`SmartViewActivityFeed.vue` 自带 `.sv-side-section` + `<h3>Activity</h3>`**:brief
  正文没有明说这层归哪个组件持有,按"两个组件各自独立自洽、宿主不需要额外包一层"的原则
  放进 `SmartViewActivityFeed.vue` 自己的模板里(与 `SmartViewSidePanel.vue` 的三段
  各自持有 `.sv-side-section` 对称)。

## 验证记录

- `pnpm exec vitest run`:300 个测试文件、3283 例全绿(含本任务新增 36 例组件测试 +
  4 例宿主接线测试)。
- `pnpm exec vue-tsc --noEmit`:0 错误(`aria-checked` 最初写成 `String(!paused)` 触发
  `Booleanish` 类型报错,改回布尔值 `!paused`/`sv.includeVideos` 直接绑定后清零——DOM
  仍会序列化成字符串属性 `"false"`/`"true"`,测试断言不受影响)。
- `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts`:440 例
  全绿。
- `git diff`/新文件 grep 字面 `#hex`/`rgba(`:0 命中。
- 7 条删码验证:全部按上表逐条复现失败、Edit 手工还原、复跑全量确认恢复绿。

## Concerns(留给控制器/眼验)

- `photosSvActNMatched` 的加粗范围从"整句"收窄成"仅数字"(见上方"`<b>` 三个键"第 2 条),
  真机眼验时请对照 Vue2 原版确认这个收窄在视觉上是否可接受——如果不可接受,补救方案是
  新增一个 `photosSvActNMatchedBold`(值 `'{n} 张新照片'`/`'{n} new photos'`)并在
  `<template #photo>` 里嵌套调用 `t('photosSvActNMatchedBold', { n: row.n })`,但这样
  会突破 brief"本任务唯一新增一个键"的措辞,故未在本轮直接做,留给控制器裁定。
- `SmartViewSidePanel` 没有 `now` prop(见"接口取舍"),如果后续验收发现需要在真机上
  冻结"统计段最近更新"这个相对时间做视觉回归,需要先补一个 prop 再补测试。

---

# Fix round 1(评审 Spec ❌,3 Important + 5 Minor,全部并入)

状态:**DONE**

评审(opus)判 Spec ❌ / Needs fixes,依据
`.superpowers/sdd/2026-07-31-vue3-migration-sp7-p7a-smartviews-search/task-8-fix-1-findings.md`。
本轮把 3 个 Important + 5 个 Minor 全部并入,一次收干净(眼验前最后一轮)。

## 改了哪些文件

- `src/photos/components/SmartViewSidePanel.vue`(I1/I2 脚本逻辑 + M1 样式)
- `src/photos/components/SmartViewActivityFeed.vue`(I3 模板 + 文件头注释)
- `src/photos/components/SmartViewCreateDialog.vue`(**T5 的文件**,M1 样式,控制器已授权)
- `src/photos/components/PhotosThreshSlider.vue`(**T5 的文件**,M1 样式,控制器已授权)
- `src/views/PhotosSmartViewDetail.vue`(M2:登记滚动条决定,不改行为)
- `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(I3:新增 `photosSvActNMatchedBold`,
  `photosSvActNMatched` 改回 `{photo}` 主句键形态)
- `src/photos/components/__tests__/SmartViewSidePanel.test.ts`(I1/I2 回归用例 + M1/M3/M4/M5)
- `src/photos/components/__tests__/SmartViewActivityFeed.test.ts`(I3 回归用例)
- `src/photos/components/__tests__/SmartViewCreateDialog.test.ts`(**T5 测试文件**,新增
  "Fix round 2" 区块覆盖 M1)
- `src/photos/components/__tests__/PhotosThreshSlider.test.ts`(**T5 测试文件**,新增
  M1 轨道 cursor 断言)
- `src/views/__tests__/PhotosSmartViewDetail.test.ts`(M5:useRealTimers 挪 afterEach;
  I2 补充:宿主 `:busy` prop 来源用例)

## I1(Important)—— 阈值滑块拖动跨越一次 PATCH 往返

**根因**(评审诊断,申报已确认准确):`watch(() => props.sv.threshold, …)` 少了
`dragging` 门控,任何时候 prop 回流都会无条件覆盖 `thresh.value`——这与"不需要
`syncingSv`"是两件事:`syncingSv` 防的是 New-UI 已结构性不存在的自反馈死循环(New-UI 只
在用户交互时才 emit,prop 回流从不 emit);但 prop 回流本身还是会发生,只要用户还有
**尚未成功提交**的本地编辑,回流带回来的旧值就不能覆盖显示。

**改法**:
1. 新增 `dragging` ref,语义是"是否存在尚未成功 emit 出去的本地编辑"——从
   `onThreshInput` 到 `submitThreshold` 真正 emit 之前(含 busy 重试期间)全程为
   `true`,prop-reflow watch 加 `if (!dragging.value) thresh.value = v` 门控。
2. `onThreshInput`/`submitThreshold` 拆成两个函数:`onThreshInput(v)` 捕获用户交互的
   `v`,`setTimeout(() => submitThreshold(v), 300)`——`submitThreshold` 里用的是**闭包
   捕获的 `v` 参数**,不是活值 `thresh.value`,双重保险(即使 `dragging` 门控本身有
   疏漏,真正发出去的网络值也始终是用户那次交互实际拖到的数字)。

**回归用例**(`SmartViewSidePanel.test.ts`「拖动跨越一次 PATCH 往返(fix round 1 · I1
回归)」):完整走评审给出的真实时间线——t=0 拖到 92 → t=300 防抖到期 emit
`{threshold:92}` → t=350 用户继续拖到 60(不模拟"函数被调",是真的再触发一次
`setValue`)→ t=400 用 `setProps` 模拟上一发响应落地(`sv.threshold` 变回 92)→
断言**此刻显示仍是 60%,不是被抽回的 92%** → t=650 第二轮防抖到期,断言 emit 的
第二条是 `{threshold:60}`(用户最终值),不是 92(被抽回后重发的旧值)。删码验证:
去掉 `dragging` 门控 → 该用例在"t=400 显示应为 60%"处失败(实测显示变回 92%);已还原。

## I2(Important)—— busy 期间防抖到期的 emit 被静默吞掉

**根因**:`if (props.busy) return` 静默丢弃,busy 解除后不补发。

**改法**:`submitThreshold` 里 busy 时**重新 arm 定时器**(`setTimeout(() =>
submitThreshold(v), 300)`)而不是 `return`,`dragging` 保持 `true` 直到真正 emit 成功
为止(store 侧的 `patchBusy` 早退不在改动范围,组件侧这样兜住即可,注释已登记)。

**回归用例**(`SmartViewSidePanel.test.ts`「busy 期间防抖到期(fix round 1 · I2 回归)」):
busy=true 时拖到 92,连续两轮 300ms 到期都不 emit(不吞、也不放弃),`setProps({busy:
false})` 之后下一轮到期自动补发 `{threshold:92}`。删码验证:把 busy 分支改回纯
`return` → 该用例在最后一步"补发"断言处失败(`emitted('patch')` 恒 undefined);已还原。

**补充覆盖(此前零用例的三件事)**:
- `busy=true` 时点两个开关不 emit(纯派生早退,UI 仍与 store 一致,不需要重试)。
- `data-busy` 属性:busy=true/false 两种取值都各有一条断言。
- 宿主 `:busy="store.patchBusy"` 这条 prop 来源:`PhotosSmartViewDetail.test.ts` 新增
  一条用例,让 `updateSmartView` 挂起(`patchBusy=true`)期间断言两个开关都带
  `data-busy="true"`,resolve 后断言恢复 `data-busy="false"`。

## I3(Important)—— `photosSvActNMatched` 加粗范围与 Vue2 不符,且与相邻行自相矛盾

**事实纠正**(控制器回源核实 `zh_CN.json`,不记在实施者头上——上一轮 brief 前提写错):
`<b>{n} 张新照片</b>` 与 `<b>1 张新照片</b>` 形态完全对称,`<b>` 包的都是"插值 + 语言
相关静态词"整个短语,不是"一条整短语、一条只有数字"。

**改法**:新增 `photosSvActNMatchedBold`(zh `'{n} 张新照片'` / en `'{n} new
photos'`,自带插值),`photosSvActNMatched` 改回 `'{photo} 已自动添加'` /
`'{photo} auto-added'`(与 `photosSvActOneMatched` 完全同构),模板
`<template #photo><b>{{ t('photosSvActNMatchedBold', { n: row.n }) }}</b></template>`。
两个 locale 键序只追加不重排(`photosSvActNMatchedBold` 紧邻
`photosSvActNMatched` 插入)。

**回归用例**(`SmartViewActivityFeed.test.ts`):
- `matched(3 张)→ <b> 里是整个短语「3 张新照片」` 直接断言 `<b>` 文本等于完整短语。
- `单张与多张两行相邻渲染 ⇒ 两个 <b> 都是整短语,形态一致`——这条是 I3 的主守卫,专门
  钉住"相邻两行不自相矛盾"这个评审指出的核心问题(不是分别测,是同屏渲染两条断言
  两个 `<b>` 都拿整短语)。

删码验证:把 `#photo` 槽内容改回 `{{ row.n }}`(只加粗数字)→ 上述两条用例都失败
(分别期望 `'3 张新照片'`/`'5 张新照片'`,实际拿到 `'3'`/`'5'`);已还原。

## M1 —— `.sv-switch` 漏了 `photos.scss:2819-2820` 那份低优先级规则贡献的样式,连带 T5 两个文件

**事实**(控制器回源核实):Vue2 `.sv-switch` 有两份规则叠级联——高优先级的
`photos-smartview.scss:584-600` 赢了尺寸(32×18/拇指14×14),但没有声明
`transition: background`,`::after` 只覆盖了 `transition: all 0.2s`、没覆盖
`box-shadow`;低优先级的 `photos.scss:2819-2820`(brief 给的 scss 区间没盖到)声明了
`transition: background 0.15s` 与拇指投影,两者未被覆盖,照样合并进级联生效
——Vue2 真机上开关轨道变色是渐变过渡、拇指带投影,不是瞬变 + 平的。

**改法**(`SmartViewSidePanel.vue` 与 T5 的 `SmartViewCreateDialog.vue` 两处保持一致):
- `.sv-switch` 补 `transition: background 0.15s;`。
- `.sv-switch::after` 补 `box-shadow: 0 1px 3px color-mix(in srgb, black 30%,
  transparent);`(纯黑投影,用 `color-mix` 复刻,不写字面颜色函数——首次落地时手滑
  在注释里写了字面 `rgba(0,0,0,0.3)` 被 `color-guard.test.ts` 当场判红,已改成用文字
  描述数值,声明本体仍是合规的 `color-mix` 写法)。
- `PhotosThreshSlider.vue` 的 `.sv-slider` 补 `cursor: pointer;`(Vue2 `photos.scss:2817`
  的低优先级裸 `.sv-slider` 把指针光标挂在轨道本身,此前只在 thumb 伪元素上给了)。

**测试**:`SmartViewSidePanel.test.ts` 新增 2 条(transition + box-shadow,先锚定规则体
再断言属性);T5 的 `SmartViewCreateDialog.test.ts` 追加「Fix round 2」区块 2 条同构
断言;T5 的 `PhotosThreshSlider.test.ts` 追加 1 条 `.sv-slider` 的 `cursor: pointer`
断言。**T5 两个文件各自的测试文件已单独跑过,均全绿**(`SmartViewCreateDialog.test.ts`
与 `PhotosThreshSlider.test.ts` 除新增用例外原有用例一条未动、一条未破)。

## M2 —— T6 挂账的滚动条美化,结账(不重画,只登记决定)

`PhotosSmartViewDetail.vue` 的 `.sv-detail-layout`/`.sv-detail-main`/`.sv-detail-side`
注释块补了决定说明:**不移植** Vue2 `photos-smartview.scss:195-209` 的
`::-webkit-scrollbar` 定制(accent 渐变 thumb / 10px 宽 / accent 6% 轨道),继续走
`overflow-y: auto` 交给浏览器默认滚动条。理由三条(已写进注释):本分支惯例是滚动条
只隐藏不重画(`PhotosGrid.vue:420`/`PhotoFilmstrip.vue`/`PhotosPersonDetail.vue:1041`
三处先例)、`theme.css` 已有全局细滚动条兜底、SP5-P6 实证 Chrome 121+ 一旦吃到标准
`scrollbar-width`/`scrollbar-color` 就会整体禁用该元素的 `::-webkit-scrollbar`
定制族(照搬等于死代码)。不需要新增测试(没有行为变化,只是决定登记)。

## M3/M4/M5

- **M3**:`SmartViewSidePanel.test.ts` 统计四格新增一条
  `evaluatedAt` 非空(30 分钟前)→ 断言文案是 `zh.photosSvRelMinutes.replace('{n}',
  '30')`,不是恒定的 `'—'`,钉住 `relTime` 真的被调用而不只是空态兜底。
- **M4**:同文件 `threshHelp` describe 下那条用例标题里的误导性中间值
  `Math.round(13.63)` 改成真值 `Math.round(12.727…)`(结论 13 本身没错,只是标题误导);
  已 grep 全仓确认这个"13.63"字样只出现在这一处注释/标题里,没有其它地方需要跟着改。
- **M5**:`SmartViewSidePanel.test.ts` 里 3 处 `vi.useFakeTimers()`/`vi.useRealTimers()`
  改成每个 describe 各自的 `beforeEach`/`afterEach`(不再写在单个 `it` 末尾);
  `PhotosSmartViewDetail.test.ts` 的「阈值 patch → store.updateSmartView」describe 同样
  补上 `afterEach(() => vi.useRealTimers())`。

## 验证记录

- 只跑受影响的测试文件 + color-guard + parity:
  `SmartViewSidePanel.test.ts`(30 例)/ `SmartViewActivityFeed.test.ts`(15 例)/
  `SmartViewCreateDialog.test.ts`(T5,全绿,未破)/ `PhotosThreshSlider.test.ts`(T5,
  全绿,未破)/ `PhotosSmartViewDetail.test.ts`(68 例)/ `color-guard.test.ts` /
  `parity.test.ts` —— 全绿,共 605 例。
  - 中途一次真实红:M1 的注释里手滑写了字面 `rgba(0,0,0,0.3)`,被 `color-guard.test.ts`
    当场抓到并判红,已改成文字描述,复跑转绿——这本身是"注释三禁"生效的证据,如实
    记录不隐瞒。
- `pnpm exec vue-tsc --noEmit`:0 错误。
- **全量** `pnpm exec vitest run`:300 个测试文件、**3296 例**全绿(比 fix round 前的
  3283 例多 13 例,全部是本轮新增的回归/覆盖用例)。
- 删码验证(本轮新代码路径逐条复现):dragging 门控删除 → I1 用例红;busy 重试改回
  纯 return → I2 用例红;`photosSvActNMatchedBold` 槽内容改回 `{{ row.n }}` → I3 两条
  用例红。三条均已 Edit 手工还原(未用 `git checkout --`),复跑确认全绿。

## Concerns(留给控制器/眼验)

- 无新增 concerns——上一轮报告里唯一的 concern(I3 加粗范围收窄)已在本轮按控制器裁定
  的方案解决;`now` prop 那条 concern 仍然存在(未受本轮改动影响,维持原状留给后续)。

---

# Fix round 2(复审:8 条全部 ADDRESSED,只剩一处注释自相矛盾 + 两处 cosmetic)

状态:**DONE**

复审(opus)判 fix round 1 的 3 Important + 5 Minor 全部 ADDRESSED、零断言弱化,逐行核过
38 行 `-`、亲自变异复核 I1/I2/I3。**唯一开放项是通读全文件才看到的一处注释自相矛盾**
(diff 片段看不出,必须读完整文件),外加两处纯 cosmetic。三条全部按要求处理:

## 1)`SmartViewSidePanel.vue:14-16` 文件头注释与本轮 I1 修复自相矛盾(纯注释,不动代码)

**问题**:文件头「架构性简化」说明写的是"prop 回流……天然没有自反馈,不需要
`syncingSv` 这个标志,**也不需要给这条 watch 加任何"是否正在拖动"的门控**"——但 fix
round 1 的 I1 恰恰在 40 行之后新增了这个 `dragging` 门控,同一文件 40 行之内自相矛盾。
撞的是本仓"每次 fix 轮改动一个值或结论,要 grep 该结论在代码注释里的所有出现处一并改"
这条硬约束(P6a 终审同型)。

**改法**:把文件头那段改成如实区分两件事——**不需要的是 Vue2 的 `syncingSv` 自反馈
抑制**(因为 New-UI 只在用户 `@input` 时 emit、prop 回流从不 emit,天然没有这条自反馈
死循环,New-UI 没有对应物);**需要的是 `dragging` 门控**,它解决的是另一个问题:别在
用户手指还按着(或还有一轮防抖/busy 重试没发出去)的时候把显示抽回服务端旧值(fix
round 1 · I1 实测证过会丢值)。两个开关那句也补了一句"没有'用户手指还按着'这个中间态,
所以不需要 `dragging` 门控"作为呼应,避免读者读完阈值段落再问"那开关是不是也该有"。

**grep 核实**:全仓 grep 这条"不需要门控"的结论表述,只在 `SmartViewSidePanel.vue:15`
这一处出现;`SmartViewSidePanel.test.ts:110` 的注释("dragging 门控生效")与 I1/I2
两段行内注释本身都已经是准确表述(fix round 1 写的),不需要跟着改——只有文件头那一处
是修复前遗留的旧结论,已改。

## 2)`SmartViewCreateDialog.vue` 标签笔误

`fix round 1 · I8-M1` → `fix round 1 · M1`(`I8-` 是多余前缀,本仓其它同类标签都是
`fix round N · 编号` 形态,没有任务号前缀)。全仓 grep `I8-M1` 确认只有这一处。

## 3)I2 已知边界登记(不加限流,只登记)

`submitThreshold` 的 busy 分支补了一行注释:重试没有退避也没有次数上限——若
`patchBusy` 真的长期卡 `true`,会以固定 300ms 节奏永久重试下去;不是紧循环、不会冻死
浏览器(每次都要等一整个 `setTimeout`),但确无上限。控制器裁定这是可接受的设计,本轮
不加限流,只在代码注释与本报告里登记这个已知边界,留作后续如果真的观察到
`patchBusy` 长期不落地时的排查线索。

## 验证记录

- 只跑 `SmartViewSidePanel.test.ts` + `SmartViewCreateDialog.test.ts`(纯注释改动,复审
  已明确不需要跑全量):74 例全绿,与 fix round 1 收尾时的数字一致(本轮没有新增/删除
  任何测试用例,只改了三处注释)。
- `grep -nE "#[0-9a-fA-F]{3,6}|rgba?\("` 扫过两个改动文件:0 命中(纯 prose 注释,没有
  引入新的字面颜色)。

## Concerns

- I2 的重试无退避/无次数上限(见上方第 3 条)——已在代码注释与本报告登记,控制器裁定
  可接受、不需要本轮加限流。若后续真机验收观察到 `patchBusy` 长期为 `true`(例如后端
  故障导致 PATCH 恒不返回),这里会表现为阈值滑块的补发请求以 300ms 节奏持续重试且
  UI 上没有任何"重试中"提示——目前没有测试覆盖这个长期卡死场景,留作后续如果真的
  观察到再补。
- 其余 concerns 与 fix round 1 收尾时一致(`now` prop 那条仍然存在,未受本轮影响)。

# Task 13 报告:SearchDatePopover.vue —— 搜索日期弹层(5 个快捷区间 + 真日历)

## 实现内容

新增两个文件:
- `src/photos/components/SearchDatePopover.vue`(组件)
- `src/photos/components/__tests__/SearchDatePopover.test.ts`(33 例)

对 T9 已关账文件做最小回改(brief A3 授权):
- `src/photos/util/dateRange.ts`(`DateRange` 加 `key?: QuickKey | number` 字段;
  `quickRange`/`yearRange` 各自填上)
- `src/photos/util/__tests__/dateRange.test.ts`(修复被回改破坏的 3 处 `toEqual`,
  新增 6 例覆盖 `key` 透传)

组件接口与 brief 一致:`props: { draft: DateRange | null; committed: DateRange | null }`,
`emits: update:draft / apply / cancel`。日历显示的年月(`calYear`/`calMonth`)是组件内部
`ref`,挂载时按 `committed` 一次性初始化(有 `committed.end` 取其年月,否则取当前月),
与 T12 `PhotosFilterPopover.vue` 同款——宿主 T16 用 `v-if` 每次重新挂载来实现"每次打开都
重算",不是持续跟随 `committed` 的响应式绑定。

---

## T9 回改一节(必列)

**改了什么**:`DateRange` 接口新增 `key?: QuickKey | number`(可选字段,不破坏既有消费方);
`quickRange(key, now, label)` 的内部 `mk()` 把入参 `key` 原样填进返回值;`yearRange(year, label)`
把 `key: year`(年份数字本身)填进返回值。**没有改动这两个函数的任何分支逻辑**——只是在返回
对象上多带一个字段。

**为什么**:brief 结构规格 2 授权的判据回改——data-on 判据如果按 Vue2 原样用 `label` 字符串
比较(`draft.date.label === q`,`q` 是英文原文),在本仓 i18n 化后 `label` 存的是 `t()` 之后
的本地化文案,locale 一切换,同一个快捷区间在两种语言下 `label` 不相等,判据就会失配。`key`
是 `quickRange`/`yearRange` 的输入枚举/年份数字,不受 locale 影响,判据换成 `key` 比较即可
稳定。回改点落在 T9 而不是在 T13 里"包一层"是因为 `key` 属于 `DateRange` 值对象本身的语义,
不属于 T13 组件私有状态——两处消费方(未来若有其它组件也读 `DateRange.key`)不应该各自再包
一层。

**既有 26 例是否全绿**:`dateRange.test.ts` 回改前 26 例、回改后 32 例(新增 6 例:
`quickRange` 的 `it.each(QUICK_KEYS)` 覆盖 5 个 key 分支各自透传 + `yearRange` 的 1 例)。
运行结果:
```
$ pnpm exec vitest run src/photos/util/__tests__/dateRange.test.ts
 Test Files  1 passed (1)
      Tests  32 passed (32)
```
**回改必须同步修复的既有断言**:3 处 `toEqual({label,start,end})` 全对象断言(`today`/
`thisYear`/`lastYear` 各一处、`yearRange` 整年区间一处,共 4 处)因为实际返回值多了 `key`
字段而与期望对象不再相等——`toEqual` 要求精确匹配,不会忽略多出的字段。已逐一在期望对象
里补上对应的 `key` 值(`'today'`/`'thisYear'`/`'lastYear'`/`2025`)。其余只读 `.start`/`.end`
属性的用例(`last7`/`last30`/跨年边界)不受影响,未改动。

**新增覆盖**:`it.each(QUICK_KEYS)('key 字段原样透传入参 key:%s', ...)` 逐个枚举值单独跑一遍
(不是只跑此前已被 `toEqual` 顺带覆盖的 `today`/`thisYear`/`lastYear` 三个),避免 `last7`/
`last30` 两个分支的 `key` 透传抄错(比如手滑写成字面量 `'today'`)却没有测试覆盖到;
`yearRange` 补一例 `key` 是年份数字本身。

---

## 渲染项清单对照(Vue2 :61-91 逐项 → New-UI 落点)

| Vue2 (`:61-91`) | New-UI 落点 |
|---|---|
| `.fpop-title` 「Quick range」 | `.fpop-title`,文案 `t('photosSearchQuickRange')` |
| `.fpop-row` 5 个 `.fpop-quick`(`v-for` 5 个英文字面量) | `.fpop-row` + `v-for="k in QUICK_KEYS"`(5 个),文案 `t(QUICK_LABEL_KEYS[k])` |
| `.fpop-quick` 的 `:data-on="draft.date.label===q"` | `:data-on="draft?.key===k?'true':'false'"`(偏离登记,见下) |
| `.cal-head` 左 `.cal-nav`(chevL,title=Previous month) | 左 `.cal-nav`,内联 svg(path `m15 6-6 6 6 6`),`title=t('photosSearchPreviousMonth')` |
| `.cal-head` 中 `.fpop-title`(`calMonthLabel`,`margin:0`) | `<span class="fpop-title" style="margin: 0">{{ monthLabel }}</span>` |
| `.cal-head` 右 `.cal-nav`(chevR,title=Next month) | 右 `.cal-nav`,内联 svg(path `m9 6 6 6-6 6`),`title=t('photosSearchNextMonth')` |
| `.cal` 7 个 `.cal-cell.dow`(`calDows`) | `v-for="(d,i) in dows"`(`calDowLabels(locale.value)`) |
| `.cal` 的 `calCells` 格子(class 拼接 + `pickCalDay`) | `v-for="(c,i) in cells"` + `cellClass(c)` + `@click="pick(c)"` |
| 脚 `.fpop-quick`(Cancel) | `.fpop-foot` 第一个按钮,`t('photosCancel')`,`emit('cancel')` |
| 脚 `.btn.btn-primary`(Apply,height:32) | `.fpop-foot` 第二个按钮,`t('photosSearchApply')`,`emit('apply')` |

逐项核对完毕,无漏项。

---

## 两条腿审计(`photos.scss:2658-2688` 每条声明 → 落点或省略理由)

| 行 | Vue2 声明 | 落点 |
|---|---|---|
| 2658-2667 | `.fpop`(含 `width:320px`) | `.fpop`(A1 修正后带 `width: 320px`) |
| 2668 | `.fpop-title` | `.fpop-title` |
| 2669 | `.fpop-row` | `.fpop-row`(补 `flex-wrap: wrap`,brief 结构规格 2 明确要求) |
| 2670-2673 | `.fpop-quick` | `.fpop-quick` |
| 2674 | `.fpop-quick:hover, .fpop-quick[data-on="true"]` | 拆成 3 条:`:hover` / `[data-on='true']` / `[data-on='true']:hover`(A7) |
| 2675 | `.cal` | `.cal` |
| 2676 | `.cal-cell` | `.cal-cell`(含 `font-variant-numeric: tabular-nums`) |
| 2677 | `.cal-cell.dow` | `.cal-cell.dow` |
| 2678 | `.cal-cell:hover` | `.cal-cell:hover` |
| 2679 | `.cal-cell.in` | `.cal-cell.in` + 新增 `.cal-cell.in:hover`(A7) |
| 2680 | `.cal-cell.start` | `.cal-cell.start` + 新增 `.cal-cell.start:hover`(A7,`--on-accent` 正向用法) |
| 2681 | `.cal-cell.end` | `.cal-cell.end` + 新增 `.cal-cell.end:hover`(A7,`--on-accent` 正向用法) |
| 2682 | `.cal-cell.start.end` | `.cal-cell.start.end` |
| 2683 | `.cal-cell.blank` | `.cal-cell.blank` |
| 2684 | `.cal-cell.blank:hover` | `.cal-cell.blank:hover` |
| 2685 | `.cal-cell.muted` | **不迁**(A4,死 CSS,模板 grep 零命中,反向断言见测试) |
| 2686 | `.cal-head` | `.cal-head` |
| 2687 | `.cal-nav`(含 `transition: all 0.2s`) | `.cal-nav` |
| 2688 | `.cal-nav:hover` | `.cal-nav:hover` |

区间外的 `.fpop-search`(`:2695-2700`)与本任务无关(T12 列表弹层专用),已确认不迁。

---

## 回源核对结果(brief 断言 → 源码真值 → 符/不符)

1. **A1(`.fpop` 宽度)**:brief 正文「无显式 width」错,已修正为「吃基类 320px」——回源
   `photos.scss:2664` 确认 `width: 320px` 在 `.fpop` 基类里,`PhotosSearchView.vue:62` 无
   内联 style 覆盖。**符**(按修正后的 A1 实现,组件写死 `width: 320px`)。
2. **A2(locale BCP-47 转换)**:回源 `dateRange.ts:107-120`(`rangeLabel`)、`:167-174`
   (`calDowLabels`)、`:180-183`(`calMonthLabel`)三处均已 `locale.replace('_','-')`,
   无第 4 处未转换的 Intl 调用点。**符**——本组件三处调用均直传 `locale.value` 原始值。
3. **A3(`DateRange` 形状)**:回源确认 `{ label, start, end }` 三字段,无 `key`。**符**——
   已按授权加字段,见上节。
4. **A5(scss 区间完整性)**:逐条核对 `photos.scss:2658-2688`,与 brief 给出的
   `:2658-2688`/`:2658-2674` 区间划分一致,区间外仅 `.fpop-search`(与本任务无关)。**符**。
5. **A6(Vue2 真值抄录)**:逐条比对 brief 给出的 13 条声明文本与 `photos.scss:2674-2688`
   源码,完全一致(空格/属性顺序等细节也吻合)。**符**。
6. **A6 衍生要点(`--accent-hi`/`--on-accent`/`transition`/`tabular-nums`)**:
   - `--accent-hi` 本仓确认不存在(`grep theme.css` 零命中)→ 用 `--accent-text`。**符**。
   - `rgba(110,91,255,0.30)` → `--accent-soft-bd`(深 .36/浅 .30,回源 `theme.css` 确认)。
     **符**。
   - `.cal-cell.start`/`.end` 的 `color: white` 压 accent 实底 → `--on-accent` 合法用法。
     **符**,已做正向断言。
   - `.cal-nav` 的 `transition: all 0.2s` 与 `.cal-cell` 的 `font-variant-numeric:
     tabular-nums` 均已程序化断言(先锚定规则体再 `toContain`)。**符**。
7. **A7(hover 优先级相等分析)**:手算 `.cal-cell:hover`/`.in`/`.start`/`.end` 均为
   `(0,2,0)`(class+pseudo 或 2 classes),`.fpop-quick:hover`/`[data-on="true"]` 同为
   `(0,2,0)`(class+pseudo 或 class+attr)。**符**——已逐一验证并按要求补齐自带 `:hover`
   变体 + cssCascade 断言。

未发现新的 brief 事实错误(A1-A7 全部核实为准确,包括已修正过的部分)。

---

## 偏离登记

| # | Vue2 原样 | 改成什么 | 为什么 | 代码注释位置 |
|---|---|---|---|---|
| 1 | `data-on="draft.date && draft.date.label === q"`(`q` 是英文原文) | `data-on="draft?.key === k ? 'true' : 'false'"` | label 是本地化文案,locale 切换后同一快捷区间两语言下不相等,判据会失配;`key` 不受 locale 影响 | `SearchDatePopover.vue:99-100`(pick 处)+ 文件头注释 |
| 2 | `.fpop-quick:hover, .fpop-quick[data-on="true"]` 单条规则共享同一组值 | 拆成 `.fpop-quick:hover` / `.fpop-quick[data-on='true']` / `.fpop-quick[data-on='true']:hover` 三条,数值一致 | scoped SFC 下两者优先级相等,靠源码顺序苟活是本仓明确要防的形态;拆开后补自带 hover 保证"悬停已选中按钮仍是选中态" | `SearchDatePopover.vue:222-226` |
| 3 | `.cal-cell:hover` 与 `.in`/`.start`/`.end` 无对应 hover 变体(靠源码顺序让选中态在 hover 时不被顶掉) | 三个变体各自补 `:hover`,值同各自未 hover 态 | 同上,scoped SFC 不应依赖顺序苟活 | `SearchDatePopover.vue:291-294`(注释)+ 300-303/311-314/320-323(三个变体) |
| 4 | 无 `data-date` 属性 | 每个非 blank 的 `.cal-cell` 加 `:data-date="c.date"` | 纯测试/交互定位辅助,不影响任何可见样式或文案,和 T12 的 `data-active`/`PhotosFilterChip` 的 `data-open` 同类先例(本仓已确立的"额外 data 属性不算破坏 1:1"惯例) | `SearchDatePopover.vue:155` |

无其它偏离——渲染顺序、class 拼接顺序、脚部按钮顺序均照搬。

---

## 删码验证清单

| # | 删了什么 | 红/未红 | 分析 |
|---|---|---|---|
| ① | `data-on` 判据换回 `label===t(...)` 字符串比较 | **红** | `locale 从 zh 切到 en 重新挂载 → data-on 仍为 true` 用例失败(`expected 'false' to be 'true'`),命中 A3 主守卫 |
| ② | `pick` 首次开新区间时手动塞 `key: 'today'` | **红** | `第一次点...无 key 字段` 用例失败(`expected 'today' to be undefined`) |
| ③ | 去掉端点交换的 `if (end<start){...}` | **红** | `已有单日区间时点更早的日 → start/end 被交换` 用例失败(收到未交换的 `2026-07-10`/`2026-07-05` 顺序颠倒) |
| ④ | `if (!r\|\|!r.start\|\|r.end)` 去掉 `\|\|r.end` | **红** | `draft.end 已存在...重开新单日区间` 用例失败(收到旧区间 start `2026-07-05` 而非新点的 `2026-07-20`) |
| ⑤ | `if (c.blank\|\|!c.date) return` 整行删除 | **非典型:assert 未红,但 process 退出码变 1** | 详见下方专门说明 |
| ⑥ | `shiftMonth` 改成 `calMonth.value += delta`(不经 `new Date()` 归一化) | **未红**(诚实分析见下) | `calMonthLabel`/`calCells` 内部都会用 `new Date(year, month, ...)` 构造日期,JS `Date` 构造器对越界的 `month` 参数本身就会自动归一化(`new Date(2026, 12, 1)` 自动等于 2027-01-01),因此即便 `calMonth.value` 内部长期停留在 0-11 范围之外、`calYear.value` 也没有跟着更新,展示层每次都重新构造 `Date` 对象,数学上等价于"年月合并成一个绝对月序号",总能算出正确的显示结果。也就是说,只要唯一的两个消费方(`monthLabel`/`cells` 两个 computed)都是"每次都用 `new Date(calYear, calMonth, ...)` 重新计算"这种形态,`calMonth` 是否越界完全不影响可观察行为——这个简化在**当前架构下**是行为等价的,现有测试无法(也不应该硬凑出)区分力。已改回 Vue2 原版写法(用 `Date` 对象归一化两个字段),原因是:①这是 Vue2 原始写法,brief 明确要求"照搬"②保持 `calMonth` 落在 0-11、`calYear` 是真实年份这个"状态契约"本身有意义,即使当前两个消费方都能容忍越界值,未来若有第三个直接读 `calMonth.value`/`calYear.value`(不经过 `new Date` 归一化)的消费方,越界值会立即造成 bug——维持归一化是防御性的正确选择,不是为了让测试变红而保留 |
| ⑦ | 删掉 `.cal-cell.start:hover` 规则 | **红** | `cssCascade:.cal-cell.start 的 hover 胜出规则含 :hover 且含 start` 用例失败(胜出规则变回基类 `.cal-cell:hover`,不含 `start`) |

**⑤ 的详细说明(如实分析,不是assert红,但确认是进程级别的红)**:
把 `if (c.blank || !c.date) return` 整行删除后,点击 `.cal-cell.blank`(`draft` 为 `null` 场景)
时,`pick()` 走到 `!r` 分支,尝试 `rangeLabel(c.date, c.date, ...)`,而 blank 格子的 `c.date`
是 `undefined`——`rangeLabel` 内部对 `undefined` 调用 `.split('-')` 直接抛
`TypeError: Cannot read properties of undefined (reading 'split')`。这个异常在 `emit()`
被调用**之前**抛出(异常发生在对 `emit()` 参数求值的阶段),所以 `emitted('update:draft')`
确实仍是 `undefined`——**测试用例本身的那条 `expect` 并未失败**。但 vitest 把这个未捕获异常计入
`Errors: 1`,整个测试进程以退出码 `1` 结束(已用 `echo $?` 验证 `EXIT=1`),CI 层面仍会判定
这次运行失败。诚实结论:**这条 assert 对"是否删了 blank 早退"没有区分力**(因为它偶然被
"抛异常导致 emit 从未被调用"这条完全不同的路径掩盖了同一个可观察结果),但**进程级信号**
(未捕获异常)确实能捕获这处删除——只是不是通过我原本设计的那条 `expect` 生效。这属于任务里
提到的"验不红的如实报告"情形,不打算为了让这条 `expect` 本身变红而额外改写测试(会引入与
"点 blank 格不触发 emit"这个行为断言目标不符的过度设计,例如去校验"是否抛错"这种和产品行为
无关的实现细节断言)。

---

## 交接下游的事实(T14/T16/P7b 要知道的)

1. **`DateRange.key` 现在存在**:任何消费 `DateRange` 的组件(未来的 T14 若也需要判断"当前
   draft 是否等于某个预设区间")都应该优先用 `key` 比较,不要退回 `label` 字符串比较。
2. **本组件不做 portal/点外部关闭/Esc**:只 `emit('cancel')`,这些由宿主 T16 在容器层统一
   处理(同 T12)。根节点是 `<div @click.stop><div class="fpop">...</div></div>`,与 T12
   结构一致。
3. **外壳重复计数**:目前 `.fpop`/`.fpop-title`/`.fpop-quick`/`.btn`/`.btn-primary` 系列在
   `PhotosFilterPopover.vue`(T12)与本文件各有一份,约 8 条声明重复。T14 若也是弹层,会是
   第 3 份;若 T14 之后决定抽公共外壳组件,三份(或四份)是重构基准。
4. **`data-date` 属性**:非 blank 的 `.cal-cell` 上带 `data-date="YYYY-MM-DD"`,是本任务新增
   的测试/交互定位辅助属性,Vue2 没有对应物,但不影响任何可见样式,下游如果要模拟点击某天
   可以直接用这个属性定位,不需要靠"数第几个非 blank 格子"这种脆弱写法。
5. **日历初值是一次性的**:`calYear`/`calMonth` 只在组件挂载时算一次(依据 `committed`
   prop),不会响应式跟随后续 `committed` 变化。宿主必须继续用 `v-if` 重新挂载来实现"每次
   打开弹层都重算"(与 T12 同款),不能只是切换一个 `show` 布尔而不重新挂载。

---

## 测试与结果

### TDD Evidence

**RED**(组件文件不存在时跑测试):
```
$ pnpm exec vitest run src/photos/components/__tests__/SearchDatePopover.test.ts
 FAIL  src/photos/components/__tests__/SearchDatePopover.test.ts [ ... ]
Error: Failed to resolve import "../SearchDatePopover.vue" from "src/photos/components/__tests__/SearchDatePopover.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN**(实现完成后):
```
$ pnpm exec vitest run src/photos/components/__tests__/SearchDatePopover.test.ts
 Test Files  1 passed (1)
      Tests  33 passed (33)
```

### T9 回改后的 dateRange.test.ts

```
$ pnpm exec vitest run src/photos/util/__tests__/dateRange.test.ts
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

### 全量测试

```
$ pnpm exec vitest run
 Test Files  308 passed (308)
      Tests  3464 passed (3464)
```
（运行日志里出现的 `Error: Not implemented: navigation (except hash changes)` 是
`src/photos/stores/__tests__/favorites.test.ts` 里既有的 jsdom 噪声，与本任务改动无关，
本次全量运行 3464 例全部标记为 passed。）

### 类型检查

```
$ pnpm exec vue-tsc --noEmit
(无输出，exit 0)
```

### 删码验证

见上方「删码验证清单」表格，逐条已执行并还原（Edit 手工切回，未使用 `git checkout --`）。

---

## Files changed

- `src/photos/components/SearchDatePopover.vue`(新增)
- `src/photos/components/__tests__/SearchDatePopover.test.ts`(新增,33 例)
- `src/photos/util/dateRange.ts`(T9 回改:`DateRange.key` 字段)
- `src/photos/util/__tests__/dateRange.test.ts`(T9 回改配套测试修复 + 新增覆盖)

## 自查发现

- 渲染项清单、两条腿审计逐项过了一遍,无遗漏。
- 断言区分力:33 例里 cssCascade 类断言均先锚定规则体再断言属性,未使用全文件级
  `toContain`;`data-on` 相关断言专门覆盖了"locale 切换"这个主守卫场景,不会被"文案巧合
  相同"掩盖。
- 未发现需要现场修复的问题。

## Concerns

- 删码验证 ⑤ 与 ⑥ 两条不是干净的"assert 变红"信号(见上方详细分析),已如实登记而非
  强行让测试变红;认为当前测试设计是合理的(不为了凑区分力而引入与行为无关的实现细节断言),
  但提请下游 reviewer 注意这两条的性质。

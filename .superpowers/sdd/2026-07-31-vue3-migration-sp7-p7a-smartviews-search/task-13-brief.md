### Task 13: `SearchDatePopover.vue` —— 快捷区间 + 真日历

**Files:**
- Create: `src/photos/components/SearchDatePopover.vue` + `__tests__/SearchDatePopover.test.ts`
- Read-only 参考: `PhotosSearchView.vue:61-91`(模板)、`:755-777`(setDraftDateQuick / shiftCalMonth / pickCalDay)、`:790-796`(togglePop 的 date 分支)、`photos.scss:2658-2688`

**Interfaces:**
- Consumes: T9 的 `dateRange.ts` 全部导出、T9 的键
- Produces:
  ```ts
  // props
  { draft: DateRange | null; committed: DateRange | null }
  // emits
  (e: 'update:draft', v: DateRange | null): void
  (e: 'apply'): void
  (e: 'cancel'): void
  ```
  **日历显示的年月是组件内部 state**(`calYear` / `calMonth`),初值由 `committed` 决定(照搬 `:790-796`:有 `committed.end` 则取它的年月,否则取今天)。

**结构规格:**

1. `.fpop`(**默认宽,Vue2 date 弹层没有显式 width** —— 回源 `:62` 确认,`.fpop` 基类的 `min-width` 在 `scss:2658-2667`,照搬)。
2. `.fpop-title`(`photosSearchQuickRange`)+ `.fpop-row`(`flex-wrap: wrap`)含 5 个 `.fpop-quick` 按钮(`:data-on="draft?.label === t(labelKey)"` —— **⚠ 这个判据 Vue2 是 `draft.date.label === q`,`q` 是英文原文;i18n 化后 `label` 存的是 `t(...)` 的结果,所以比较对象要一致。更稳的做法:`DateRange` 加一个可选 `key?: QuickKey | number` 字段,判据改成 `draft?.key === quickKey`**。**采用后者,偏离登记** —— 字符串比较在 locale 切换时会失配)。
   - ⇒ **T9 的 `DateRange` 接口要加 `key?: QuickKey | number`**;`quickRange()` 与 `yearRange()` 各自填上。**T9 已完成时本任务负责回改 T9 的文件与测试**(在报告里明确写出这次回改)。
3. `.cal-head`:左 `.cal-nav`(chevL 14px,`title` = `photosSearchPreviousMonth`)+ 中 `.fpop-title`(`calMonthLabel(calYear, calMonth, locale)`,`margin: 0`)+ 右 `.cal-nav`(chevR,`photosSearchNextMonth`)。
4. `.cal`(`grid-template-columns: repeat(7, 1fr)`):7 个 `.cal-cell.dow`(`calDowLabels(locale)`)+ `calCells(...)` 的每格 `.cal-cell`(class 按 `blank` / `in` / `start` / `end` 拼,`@click="pick(c)"`,文本 `c.blank ? '' : c.d`)。
   - **class 拼接照搬 `:81`**:`['cal-cell', c.blank?'blank':'', c.in?'in':'', c.start?'start':'', c.end?'end':''].filter(Boolean).join(' ')`。
5. 脚:两个按钮(`photosCancel` / 应用键),Vue2 `:84-89` 用的是 `.fpop-quick`(flex:1)+ `.btn.btn-primary`(flex:1, height 32)。
6. **⚠ locale 转 BCP-47**:本组件把 `useI18n().locale.value` 传给 T9 的 `rangeLabel` / `calDowLabels` / `calMonthLabel` —— **T9 的这三个函数在内部做 `replace('_','-')`,调用方传原始 locale**(T3 实施查实:`zh_cn` 直接喂 `Intl` 会抛 `RangeError`)。若 T9 没做,本任务负责回补并加测试。
7. **方法**:
   - `setQuick(key)`:`emit('update:draft', quickRange(key, new Date(), t(QUICK_LABEL_KEYS[key])))`;然后把日历跳到该区间 `end` 的年月(照搬 `:758-759`)。
   - `shiftMonth(delta)`:`new Date(calYear, calMonth + delta, 1)` 取年月(**照搬 —— 这个写法天然处理跨年**)。
   - `pick(c)`:`c.blank` → return;`!draft || !draft.start || draft.end` → 开一段新单日区间 `{ label: rangeLabel(c.date, c.date, locale), start: c.date, end: null }`;否则补全区间并排序两端点(`end < start` 则交换),`label = rangeLabel(start, end, locale)`。**照搬 `:765-777`。**
   - **`pick` 之后 `key` 字段要清掉**(自定义区间不属于任何快捷键)⇒ 新建的 `DateRange` 不带 `key`。**这是第 2 条判据能工作的前提,注释登记。**
8. **hover 硬约束**:`.fpop-quick` 基类 hover 与 `[data-on="true"]` 共用同一条规则(Vue2 `scss:2674` 是 `.fpop-quick:hover, .fpop-quick[data-on="true"]` 并列)⇒ **本仓要拆开写并让变体自带 `:hover`**,cssCascade 断言。`.cal-cell` 的 hover 与 `.in` / `.start` / `.end` 三个变体同样处理(**`.start` / `.end` 是 accent 实底 + 白字 ⇒ 这里可以用 `--on-accent`,并做正向断言**)。
9. **`.cal-cell.muted`(`scss:2685`)在模板里无消费方** ⇒ **死 CSS 不迁**(grep 实证后登记)。

- [ ] **Step 1: 写失败测试**

必含用例:
- 结构:5 个 `.fpop-quick`(快捷区)、`.cal-head` 的两个 `.cal-nav`、7 个 `.cal-cell.dow`、`.cal` 下的格子数 = 7 + blank + 天数、脚两钮。
- 快捷区间:点「最近 7 天」→ `update:draft` 的 payload `start` 是今天减 6 天(**用 `vi.setSystemTime` 固定今天**)、`key === 'last7'`;日历标题跳到该 `end` 的月份。
- **`data-on` 用 `key` 比较不用 label**:`draft = { key: 'last7', … }` → 「最近 7 天」按钮 `data-on="true"`;**把 locale 从 zh 切到 en 重新挂载,`data-on` 仍为 true**(**这条是偏离登记的主守卫**,label 比较会在这里失配)。
- 上下月:点右 nav → 标题月份 +1;从 12 月点右 → 年份 +1、月份变 1 月(跨年);从 1 月点左 → 年份 -1、12 月。
- 日历初值:`committed` 有 `end: '2025-03-20'` → 首帧标题是 2025 年 3 月;`committed` 为 null → 是当月。
- 点格子:第一次点 → `update:draft` 的 `start` = 该日、`end` 为 **null**、**无 `key` 字段**;第二次点更晚的日 → `end` 是该日;第二次点**更早**的日 → start/end **被交换**;`draft.end` 已存在时再点 → **重开新单日区间**(照搬)。
- 点 blank 格 → 无事件。
- 区间高亮:`draft` 为 `2026-07-10..12` → `07-10` 有 `start` 与 `in`、`07-11` 只有 `in`、`07-12` 有 `end` 与 `in`;单日区间 → 该格同时有 `start` 与 `end`(触发 `.start.end` 那条圆角 CSS)。
- 脚两钮 → `cancel` / `apply`。
- cssCascade:`.fpop-quick[data-on="true"]`、`.cal-cell.in`、`.cal-cell.start` 三者的 hover/背景胜出规则各自归属变体且含 `:hover`(**`.cal-cell.in` 若无 hover 变体则只断言 `ownBackground` 归属**)。
- **`--on-accent` 正向断言**:`.cal-cell.start` / `.cal-cell.end` 的规则里前景色是 `--on-accent` 且背景是 `--accent`(这是合法用法)。
- `.cal-cell.muted` **不在**样式块里(死 CSS 未迁的反向断言)。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现(含回改 T9 的 `DateRange` 加 `key` 字段 + 补 T9 测试)**

- [ ] **Step 4: 跑全量 + tsc + color-guard,逐个删码验证**

删码清单:①`data-on` 判据换回 label 字符串比较 → locale 切换用例红;②`pick` 新建区间时误带 `key` → locale 用例或 `data-on` 用例红;③端点交换那两行 → 「点更早的日」用例红;④`draft.end` 已存在时重开新区间的分支 → 对应用例红;⑤`c.blank` 的 return → blank 用例红;⑥`shiftMonth` 换成手动 `month+1` 不过 Date → 跨年用例红;⑦`.cal-cell.start:hover` → cssCascade 用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/components/SearchDatePopover.vue src/photos/components/__tests__/SearchDatePopover.test.ts src/photos/util/dateRange.ts src/photos/util/__tests__/dateRange.test.ts
git commit -m "feat(photos): P7a-T13 搜索日期弹层 —— 5 快捷区间 + 真日历(key 判据代替 label 比较)"
```

---


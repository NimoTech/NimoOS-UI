# P5b · T10 报告 —— 第 3 刀(收官):多选收口 + 重建 + 双上限 + 弹窗 + 动作条 + 轮询 + 路由反转

- **BASE**:`sp8-ai`@`11f145a`
- **实测基线**:318 文件 / 3113 例全绿,`vue-tsc` 0,`vite build` 0
- **本刀终值**:**318 文件 / 3152 例全绿**(+0 文件,**+39 例**),`vue-tsc` exit 0,`vite build` exit 0
- 改动:6 文件,+1091 / −20 行

---

## 1. 逐文件改了什么

| 文件 | 改动 |
|---|---|
| `src/ai/knowledge/views/IndexedFilesView.vue` | +318 行:头注释新增 T10 整段;script 加 `EXPLICIT_REBUILD_CAP` / `showRebuildAllConfirm` / `selectedCount` / `overExplicitCap` / reka 六个原语 import;**补全 `rebuildRow`**、新增 `rebuildSelected` / `openRebuildAllConfirm` / `doRebuildAll` / `_flashDone`;template 加底部粘性动作条 + K7 确认弹窗。**另订正一处行号引用**(见 §11) |
| `src/ai/knowledge/views/IndexedFilesView.test.ts` | +718 行:`vi.hoisted` 骨架加 `parserReindexFiles`、`setupServiceMocks` 加 `REINDEX_OK`、`afterEach` 加 portal 宿主清理;新增 9 个 describe / **39 条用例** |
| `src/ai/knowledge/knowledgeRoutes.ts` | `indexed-files` 子路由 `component`:`KnowledgeDeferred` → `IndexedFilesView`(+ import + 申报注释) |
| `src/ai/knowledge/deferred.ts` | `DEFERRED_TABS` 摘掉 `'indexed-files'`(7 → 6) |
| `src/ai/knowledge/knowledgeRoutes.test.ts` | 那条「其余子路由仍是 KnowledgeDeferred」的断言**第三次反转**(改前原文留成注释)+ 新增 2 条正向断言,`toHaveLength(9)` → `(8)` |
| `src/ai/knowledge/deferred.test.ts` | 同款反转(改前原文留成注释)+ 新增 `expect(isDeferred('indexed-files')).toBe(false)` |

**零改动**:`knowledgeStore.ts` · `util/indexedFiles.ts` · `util/indexedFilesView.ts` · `KIcon.vue` ·
`knowledge.scss` · `knowledgeStyles.test.ts` · `zh_cn.ts` / `en_us.ts` ·
`KnowledgeLayout.vue` / `DashboardView.vue`(治理 §1.1 全期零改动清单全部未碰)。
**新增 i18n 键 0 个 / 新增 scss 类 0 个 / 新增 token 0 个**——本刀用到的 15 个键、
13 个类全部已存在(逐个 grep 核过,见 §5)。

## 2. 🔴「T9 已经替你做掉的部分」逐项核实结果

| 项 | 核实结论 | 本刀动作 |
|---|---|---|
| `toggleRow` / `toggleAll` | ✅ 完整可用,与蓝本 `:730-748` 逐行等价(K13:整体替换 Set,无 tick) | 零改动,不重写 |
| `selectablePageIds` | ✅ 完整,`filter(f => f.status !== 'tombstoned').map(f => f.file_id)`,与蓝本 `:533-536` 一致 | 零改动 |
| `allSelected` | ✅ 完整,`ids.length > 0 && ids.every(...)`(空页时为 false 的兜底在) | 零改动 |
| `someSelected` | ✅ 完整,`selectablePageIds.some(...)` | 零改动 |
| `indeterminate` 双 `watch` + `selectAllRef` | ✅ 两个 watch 与蓝本 `:583-592` 逐字等价;`ref="selectAllRef"` 挂在表头 checkbox 上 | 零改动,**只补测试**(4 条,见 §7) |
| tombstoned 行 checkbox 禁用 + title | ✅ `:disabled="file.status === 'tombstoned'"` + 三元 title,与蓝本 `:182/:184` 一致 | 零改动 |
| `rebuildRow` 空占位 | ⛔ 函数体确实是空的 | **本刀补全**(§3) |
| `doneSet` ref | ✅ 已声明(K13 同款) | 本刀只加写入口 `_flashDone`,不重新声明 |
| 分页四计算 + prev/next/pageSize | ✅ 完整 | 零改动 |

**没有发现任何重复实现**:本刀新增的 `selectedCount` / `overExplicitCap` 是在 T9 那几个
computed **之上**继续写的(`selSet.value.size`),没有重新声明 `selSet` / `selectablePageIds` /
`allSelected` / `someSelected` 中的任何一个。

## 3. `rebuildRow` 补全后的四步(蓝本 `:760-770`)

```
① store.reindexIndexedByIds([fileId], 'rebuild row')     ← 蓝本 :762(store 内部会跟着重载列表)
② store.toast(t('aiKbQueuedNJobs', { n: res.queued }))    ← 蓝本 :763,n 取响应体 queued(非写死)
③ store.startIndexedPolling()                             ← 蓝本 :764
④ _flashDone([fileId])                                    ← 蓝本 :766,2200 ms 绿闪
catch → store.toast(t('aiKbRebuildFailed'))                ← 蓝本 :768 的 K5 化(见 §6 K5)
```

**按钮 DOM 与调用点一个字都没改**(T9 交接项第 1 条的要求)——`git diff` 里
`.k-rebuild-btn` 那段模板零改动。

## 4. 双上限的落点与阈值

| 常量 | 值 | 声明位置 | 语义 | 落点 |
|---|---|---|---|---|
| `EXPLICIT_REBUILD_CAP` | **500** | 本刀新增(T8 未声明,见 §11 订正) | **前端硬拦** | ① `overExplicitCap = selectedCount > 500`;② 动作条 `.k-ab-warn` 警告;③「重建选中」`:disabled`;④ `rebuildSelected` 首行 return(蓝本 :773 的双保险) |
| `FILTER_REBUILD_CAP` | **10000** | T8 已声明(核实 = 10000,与治理 §4.4 一致) | **前端只警告,真拦在后端** | ① 弹窗内嵌超限横幅 `v-if="total > 10000"`;② K14 警示条的 `{cap}` 参数 |

🔴 **两个判据都是严格大于**,与后端一致(`service_reindex.py:26` 的 `len > 500`、
`service_files.py:205` 的 `n > 10000`)。**阈值两侧各有用例**,见 §7。

> ⚠️ **brief §2 说「两个常量 T8 已声明(`:91` / `:92`)」——实测只声明了
> `FILTER_REBUILD_CAP` 一个。** T8 的头注释与 script 注释都明确写了
> 「`EXPLICIT_REBUILD_CAP`(蓝本 :392,批量重建按钮专用)本刀不声明,T9/T10 的动作条才用到」。
> 所以本刀是**新增**这个常量,不是核实。值 = 500,与治理 §4.4 一致。

## 5. K7 弹窗的 reka 结构

照 T5 在 `QueueView.vue:559-583` 的样板逐层复用:

```
DialogRoot :open=showRebuildAllConfirm @update:open
└ DialogPortal to=".knowledge-app" defer
  └ DialogOverlay class="k-modal-bg"
    └ DialogContent class="k-modal" style="width: min(460px, 100%)" :aria-describedby="undefined"
      ├ VisuallyHidden as-child > DialogTitle        ← reka a11y 必需
      ├ div.k-confirm-body
      │ ├ div.k-confirm-icon > KIcon refresh 26
      │ ├ div.k-confirm-title                        ← aiKbRebuildAllTitle
      │ ├ div.k-confirm-summary                      ← Body1 + <br/> + Body2
      │ └ div.k-banner[data-tone=warn] (v-if total > FILTER_REBUILD_CAP)
      └ div.k-modal-foot > div.right[style=margin-left:auto]
        ├ button.k-btn.ghost   → showRebuildAllConfirm = false   (aiKbCancel)
        └ button.k-btn.danger  → doRebuildAll                    (aiKbConfirmRebuildN)
```

- **没有**裸 `<div class="k-modal-bg">` 手搓、**没有** `Teleport to="body"`。
- 蓝本 `:356` 的「点遮罩关闭」/ `:357` 的 `@click.stop`「点弹窗内不关闭」由
  DialogContent 的 `pointerDownOutside` 等价提供,**已单独写用例覆盖**(照 T5 修复轮 M-3 的先例,
  含 reka `setTimeout(0)` 延后挂监听那一次真宏任务 tick)。
- 弹窗内的错误提示**不用 toast**:超限横幅是**内嵌** `.k-banner`(蓝本 `:365-370`),
  400 的警示条也在页面主体的 `.k-banner` 里,不是 toast(遵 brief 硬约束)。
- **本刀往模板新增的类名共 15 个,全部已存在,零新增**(修复轮 1,M-2:初稿散文写「13 个」
  却列了 14 个、另把 `.right` 单列,数字与列表不符 —— 现按评审实测口径重列):

  | 组 | 类名 | 数量 | 出处 |
  |---|---|---|---|
  | 动作条 | `k-files-actionbar` / `k-ab-inner` / `k-ab-info` / `k-ab-warn` / `k-ab-actions` | **5** | 附录 D §D.2(T6 搬入) |
  | 弹窗 | `k-modal-bg` / `k-modal` / `k-confirm-body` / `k-confirm-icon` / `k-confirm-title` / `k-confirm-summary` / `k-modal-foot` | **7** | 附录 D §D.1(T2 搬入) |
  | 弹窗内嵌横幅(**复用**,T8 已在用) | `k-banner` / `k-banner-icon` | **2** | `WHITELIST_102`(P5a) |
  | 非 `k-*` | `right`(`.k-modal-foot` 内部选择器,`knowledge.scss:841`)· 按钮变体 `danger` / `primary`(`.k-btn` 块内的 `&.danger` / `&.primary`) | **3** | T2 / P5a 搬入 |

  → 12 个 `k-*`(其中 2 个是复用)+ 3 个非 `k-*` = **15**。
  逐个用 `grep "'<类>'" knowledgeStyles.test.ts` + `grep "\.<类>" knowledge.scss` 核过,全部命中。
  **`knowledgeStyles.test.ts` 白名单一行都没动、`knowledge.scss` 零改动。**

## 6. 底部动作条

蓝本 `:322-353` 逐元素照搬:

- `.k-files-actionbar` 的 `:data-active="selectedCount > 0"` —— 🔴 **不套 `String()`**。
  **brief §4 那句「(🔴 套 `String()`,照抄蓝本)」自相矛盾,已按权威源处理**:
  蓝本 `:323` 原文是 `:data-active="selectedCount > 0"`(**没套**);
  附录 D §D.3 那一行明确标 **❌ 不套**;治理 §12 **E-9** 的裁定是「逐处照抄蓝本」,
  并已读 Vue 3 `patchAttr` 源码实证 `data-*` 非特殊布尔属性、`false` 照样渲染成 `"false"`
  → **套不套渲染完全一致,行为零差异**。优先级 治理文件 > 任务 brief,故照抄不套。
  **报告显式申报,请协调者/评审复核这个取舍。**
- `.k-ab-info` 两个分支:`selectedCount > 0` 时「已选 {n} 项」(+ 超限时的 `.k-ab-warn`),
  否则 `aiKbSelectFilesHint` 提示句(内联 `style="color: var(--text-tertiary)"`,token,零字面量)。
- 「重建该 Root 全部」:`:disabled="total === 0"`,title 两分支
  (`total===0` → `aiKbNoMatchTitle`,否则 `aiKbRebuildAllTip` 带千分位)。
- 「重建选中 ({n})」:`:disabled="selectedCount === 0 || overExplicitCap"`。

## 7. 轮询收口

- **`refresh()` 后 `startIndexedPolling()`**:T8 已落地(`refresh()` 内部第二行),本刀零改动。
- **`onMounted → refresh()` / `onUnmounted → stopIndexedPolling()`**:T8 已落地且完整
  (`IndexedFilesView.vue` 的 `onMounted`/`onUnmounted` 两块),本刀零改动
  ——**本项 T8 已完成,本刀零改动**(brief §5 允许的口径)。
- 本刀新增的只是**三个重建入口成功后各一次** `store.startIndexedPolling()`
  (蓝本 `:764` / `:780` / `:803`),三条都有用例断言(`vi.spyOn(store, 'startIndexedPolling')`)。

## 8. 路由反转前后的断言文本

### `knowledgeRoutes.test.ts`

**改前**(P5b T5 原文,已留成注释块):

```
it('父路由(布局位)是 KnowledgeLayout,"" 是 DashboardView,"queue" 是 QueueView,其余 7 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', ...)
  … expect(stillDeferred).toHaveLength(9)
```

**改后**(本刀):

```
it('父路由(布局位)是 KnowledgeLayout,"" 是 DashboardView,"queue" 是 QueueView,"indexed-files" 是 IndexedFilesView,其余 6 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', ...)
  + expect(indexedFilesChild?.component).toBe(IndexedFilesView)         ← 新增
  + expect(indexedFilesChild?.component).not.toBe(KnowledgeDeferred)    ← 新增
  … expect(stillDeferred).toHaveLength(8)
```

既有的 `KnowledgeLayout` / `DashboardView` / `QueueView` 三组断言(含各自的 `not.toBe`)
**一条都没删、没改**;只把「仍是占位页」的集合从 9 缩到 8。
上一轮(T5)与上上轮(T12 / R8)的改前原文注释块**全部保留**。

### `deferred.test.ts`

**改前**(P5b T5 原文,已留成注释块):

```
it('P5a 实现 dashboard,P5b-T5 实现 queue,其余 7 个 tab 挂占位', ...)
  expect([...DEFERRED_TABS].sort()).toEqual(['allowlist','indexed-files','notes','roots','search','settings','wiki'])
```

**改后**:

```
it('P5a 实现 dashboard,P5b-T5 实现 queue,P5b-T10 实现 indexed-files,其余 6 个 tab 挂占位', ...)
  expect([...DEFERRED_TABS].sort()).toEqual(['allowlist','notes','roots','search','settings','wiki'])
  + expect(isDeferred('indexed-files')).toBe(false)     ← 新增
```

`isDeferred('dashboard')` / `isDeferred('queue')` 两条既有断言保留;
「机制钉子」那条用例(`isDeferred` 的判定来源是 `DEFERRED_TABS` 本身)零改动。

## 9. 新增用例位置索引(共 39 条)

| DoD 项 | describe | 条数 |
|---|---|---|
| 底部动作条 + `data-active` 两侧 | `底部粘性动作条(蓝本 :322-353)` | 6 |
| **`EXPLICIT_REBUILD_CAP` 500 / 501 两侧** | `EXPLICIT_REBUILD_CAP 阈值两侧(500 / 501)` | 4 |
| **`FILTER_REBUILD_CAP` 10000 / 10001 两侧** | `FILTER_REBUILD_CAP 阈值两侧(10000 / 10001)` | 2 |
| **`indeterminate` 四种组合** | `全选复选框的 indeterminate(四种组合)` | 4 |
| `rebuildRow` 三步 + K5 | `rebuildRow(蓝本 :760-770)` | 3 |
| **`_flashDone` 2200 ms 两侧** | `_flashDone 2200 ms 绿闪(蓝本 :811-823)` | 2 |
| `rebuildSelected` | `rebuildSelected(蓝本 :772-784)` | 2 |
| **K7 弹窗** | `K7:整库重建确认弹窗(蓝本 :355-381)` | 5 |
| **`filterObj` 五条 + 全项组合** | `doRebuildAll 的 filterObj 组装(蓝本 :793-799)` | 6 |
| **K14 真实入口** | `K14 真实入口:doRebuildAll 400 不回显后端 detail` | 3 |
| 整页完整性自证 | `收官刀:整页落地完整性` | 2 |

### 9.1 `indeterminate` 四种组合的用例位置与「有牙齿」的设计

jsdom 下 `indeterminate` 可读写但无视觉表现 → 断言直接读 DOM 属性
(`(el as HTMLInputElement).indeterminate`)。
🔴 **四条都刻意先经历相反状态再落到目标值**,不靠「挂载后 DOM 默认 false」蒙对:

| # | 组合 | 设计 |
|---|---|---|
| 1/4 | 全不选 | 2 行,先勾 1 行 → 断 `true`(中间态),再取消 → 断 `false` |
| 2/4 | 部分选 | 2 行选 1 → `true`,且全选框自身 `checked === false` |
| 3/4 | 全选 | 2 行:先选 1 → 断 `true`(中间态),再补第 2 → `false`,且 `checked === true` |
| 4/4 | 可选行为 0 | 3 行(2 可选 + 1 tombstoned):先选 1 → 断 `true`,再把当前页换成只剩 tombstoned 行 → `selectablePageIds` 变空 → watcher 触发 → `false`,且全选框 `disabled` |

**踩坑记录**:4/4 初稿用 `[FILE_OK, FILE_TOMBSTONED]`,只有 1 个可选行 →
选它就等于 `allSelected`,`indeterminate` 恒 false,中间态断言当场报红。
改成 3 行(2 个可选行)才造得出中间态。**这正是「先经历相反状态」这条设计要求的价值。**

### 9.2 两个上限阈值两侧的用例位置

- **500**(= 上限,不超限):`.k-ab-warn` 不存在 + 「重建选中」`disabled` undefined + `已选 500 项`
- **501**(> 上限,超限):`.k-ab-warn` 存在且文案 `toBe('超过 500 上限，请改用整库重建')` +
  「重建选中」`disabled` defined
- **10000**(= 上限):打开弹窗后 `host.querySelector('.k-modal .k-banner')` **为 null**
- **10001**(> 上限):横幅存在、`data-tone="warn"`、文案
  `toBe('共 10,001 个文件，超过单次 10,000 上限，服务器可能会拒绝（400）。请缩小路径前缀后分批重建。')`

501 行的驱动方式:`overExplicitCap` 只读 `selSet.size`(与「这些 id 在不在当前页」无关),
故用 T8/T9 已确立的 `w.vm` 写内部 ref 技巧塞 500/501 个 id,**断言仍全部落在真实 DOM**
(`data-active` / `.k-ab-warn` / 按钮 `disabled`),不是读内部状态自证。

### 9.3 `_flashDone` fake timers 两侧

一条用例把三个时刻全钉住:
点「恢复」→ flush → `data-done === 'true'`(**加**侧)→
`advanceTimersByTime(2199)` → 仍 `'true'`(精确钉住 2200,不是「某个时刻后会消失」)→
再 `advanceTimersByTime(1)` → `'false'`(**撤**侧)。
`vi.useRealTimers()` 放 `finally`(承 T8 修复轮 M-4 的教训)。
另加一条反面:`rebuildSelected` **不**绿闪(蓝本 `:772-784` 确实没有调 `_flashDone`)。

### 9.4 `filterObj` 五条 + 一条全项组合

| # | 输入 | 期望 filter |
|---|---|---|
| 1/5 | `tombstoned='all'`,其余默认 | `{}` ← **全空,证明 `!== 'all'` 判据在起作用** |
| 2/5 | `+ path_prefix='/DATA/Wiki/'` | `{ path_prefix }` |
| 3/5 | `+ mime_prefix='application/legacy-office/'` | `{ mime_prefix }` |
| 4/5 | `+ has_error=true` / `false` | `{ has_error: true }` / `{}`(两侧对照) |
| 5/5 | 默认 `'alive'` / 显式 `'tombstoned'` | `{ tombstoned: 'alive' }` / `{ tombstoned: 'tombstoned' }` |
| 附加 | 四项同时非默认 | 四个字段一起带上 |

断言是 `expect(ai.parserReindexFiles).toHaveBeenCalledWith({ filter: …, reason: 'rebuild all matching' })`
的等价形式(取最后一次调用的 `filter` 做 `toEqual`),**走真实 UI 入口**
(点动作条按钮开弹窗 → 点「确认重建」),不是直接调函数。

**踩坑记录**:一个用例里连调两次 helper 时,`DialogPortal to=".knowledge-app"` 用的是
`document.querySelector`、只认**第一个**同名宿主 → 第二轮的弹窗落进第一轮遗留的宿主里,
本轮 `host.querySelectorAll` 一个按钮都找不到。helper 里加了「进来先清上一轮 wrapper 与宿主」
的前置(已在代码注释里登记)。

### 9.5 K14 真实入口那条用例

- **T8 那条反向断言一个字都没削弱**(它用 `w.vm` 直接塞 `errorBanner`,当时没有真实入口)。
- 本刀补的是真实入口那一半,3 条:
  1. `ai.parserReindexFiles` 400(filter 超限 detail)→ 点「确认重建」→ 警示条
     `toContain('400 Bad Request')` + `toContain('重建匹配文件超过 10,000 上限')`,
     且 `not.toContain('filter matches')` / `not.toContain('12345')` /
     `not.toContain('max_reindex_by_filter')`,且弹窗已关。
  2. 普通网络错误(无 `response.data.detail`,只有 `e.message`)→ 同样只渲染固定文案,
     `not.toContain('ECONNREFUSED')` / `not.toContain('leak-me-please')`。
  3. **成功路径不留警示条**(两侧对照,证明上面两条不是「横幅恒显示」)。
- 实现侧:`doRebuildAll` 的 catch **照蓝本 `:805-807` 把后端 detail 取出来存进 `errorBanner`**,
  K14 的保证点在**渲染层**(T8 头注释已预告「即便将来 T9/T10 把后端 detail 塞进
  `errorBanner.value`,这个分支也绝不会把它渲染出来」)。这样反向断言才是真的端到端。

## 10. 属性态覆盖(附录 D §D.3)

本刀新增的唯一属性态宿主:

| 宿主 | 属性 | 真侧 | 假侧 | 断言口径 |
|---|---|---|---|---|
| `.k-files-actionbar` | `data-active` | `toBe('true')` | `toBe('false')` | 直接比字符串值,**未用 `toBeUndefined()`** |

覆盖在 2 个用例里(专门那条走「未选 → 勾选 → 取消」三态;`rebuildSelected` 成功那条
再从 `'true'` 回到 `'false'` 验证清选择)。
既有的 7 个属性态宿主(T8/T9 落的)断言**一条都没动**。
弹窗里的 `.k-banner` `data-tone="warn"` 是静态字面量,已在 10001 那条断言。

## 11. 顺手订正(增强,非削弱;显式申报)

| # | 位置 | 改前 | 改后 | 理由 |
|---|---|---|---|---|
| ① | `IndexedFilesView.vue` 头注释【K14】段 | 蓝本 `:791-808` | 蓝本 `:791-809` | brief §1 指出:`:808` 只是内层 `catch` 的闭合,函数自身的 `},` 在 `:809`。T0/T8 的行号偏 1 行 |
| ② | `IndexedFilesView.test.ts:616`(T8 那条 K14 用例的注释) | 蓝本 `:791-808` | 蓝本 `:791-809` | **修复轮 1,M-2** —— 初稿把它当「T8 当时的理解」保留不动,评审判定不成立:同一 commit 内两种行号并存本身就是缺陷,且任务书说的「顺手订正」不限于 `.vue`。已改 |

→ 现在 `src/` 里的**行号引用**全部是 `:791-809`(共 4 处:`.vue` 的 `:46` / `:156` / `:625`
+ `.test.ts` 的 `:616`),口径统一。
`grep -rn "791-808" src/` 还剩**唯一 1 处**:`IndexedFilesView.vue:157`,那是 T10 头注释里
**记录这次订正本身**的解释句(「T8 报告写的 `:791-808` 差 1 行,已一并订正」)—— 它不是陈旧引用,
是订正留痕,故保留。

**没有削弱任何 T8 / T9 既有断言**:`filtersDirty` 七条 / N12 六条 / K14+K19 反向 /
模板零裸色定向断言 / 过滤条文案集合式断言 / 四态徽标三项 + N14 的 `title` 四条 /
属性态 7 宿主 / 分页边界 —— 硬证据:`git show --format= HEAD -- src/ai/knowledge/views/IndexedFilesView.test.ts | grep '^-'`
**只有 1 行删除**(那行是被扩写的 `vi.hoisted` mock 对象,`parserFiles` 一个键 → 两个键),
其余全是纯新增。

具体到 diff:改动只落在文件头部的 mock 骨架、`setupServiceMocks`、`afterEach` 与
`:616` 那行注释,以及文件尾部的纯新增段;既有 describe 的断言体**零改动**。

## 12. §3 的 K1–K20 本任务命中的条目(显式申报)

| # | 命中情况 |
|---|---|
| **K1** 单层取数 | ✅ `store.reindexIndexedByIds` / `reindexIndexedByFilter` 的返回值直接就是 body(`res.queued`),没有 `.data` 这一层 |
| **K3/P4** toast | ✅ 一律走 `store.toast(...)`(store 内部 `useToast().show(msg, 2400)`),不自己拼 duration |
| **K5** HTTP 失败不回显后端 body | ✅ `rebuildRow` / `rebuildSelected` 的 catch 从蓝本的 `$t('Rebuild failed') + ': ' + e.message` 改成固定 `t('aiKbRebuildFailed')`。无第二句可拼故不留 `': '` 前缀 —— 与 T5 在 `QueueView.vue` 的 `bulkCancel`/`cancelOne` 同一模具(T5 修复轮 M-1 裁定:只有「有第二句 i18n 串可拼」时才保留前缀) |
| **K7** 弹窗 reka 原语 + portal 到 `.knowledge-app` | ✅ 见 §5 |
| **K12** 纯展示函数在 `util/` | ✅ 本刀零新增纯函数,`util/indexedFilesView.ts` 未改 |
| **K13** 删 tick、Set 整体替换 | ✅ `_flashDone` 写 `doneSet` 用整体替换(两次:加 / 撤),无 `doneTick`;`rebuildSelected` 清选择同款 |
| **K14** rebuild-all 400 不回显 detail | ✅ 见 §9.5(真实入口到齐) |
| **K19** 加载错误横幅不回显 `e.message` | ✅ T8 已落,本刀零改动,既有反向断言未削弱 |

**K2 / K4 / K6 / K8 / K9 / K10 / K11 / K15 / K16 / K17 / K18 / K20 本刀未命中**
(分别属于 scss 并档、图标、agent 离线、`fmtAgo` 副本、scss 嵌套/死段、store 守卫、
硬编码英文、`.k-modal-head` 不搬、failed 桶重试、`Indexing` 键——都不在本刀范围)。
**K1–K20 之外零偏离。**

## 13. §3.5 的 N1–N14 本任务命中的,确实照抄了

| # | 照抄确认 |
|---|---|
| **N7** `(x \|\| [])` 兜底 | ✅ 本刀没删任何兜底;`res.queued` 蓝本就是裸读(无兜底),照抄裸读 —— 后端 200 一定带 `queued`(fixture 实测),`undefined` 时 vue-i18n 渲染成空,与 Vue2 一致 |
| **N12** `active ↔ alive` 反向映射 | ✅ `doRebuildAll` 的 `filterObj.tombstoned` 送的是 **API 值**(`alive`/`tombstoned`),不是 UI 值 `active` —— 因为它直接读 `store.…filters.tombstoned`(存的就是 API 值)。用例 5/5 断言 `{ tombstoned: 'alive' }` 钉住了这一点 |
| **N13** `.k-status-badge-cn` | ✅ 未补样式、未进白名单(T9 已登记,本刀零改动) |
| **N10** `.k-empty-btn` | ✅ 同上 |
| **N11** 悬空 `fade-in` | ✅ `knowledge.scss` 零改动 |
| **N14** `statusBadgeMap` 的 `en`/`key` 两字段并存 | ✅ 未合并、未改 |
| **N9** 无 debounce | ✅ 未加 debounce |
| `⚠️N` 的 9 行错译 | ✅ 本刀用到的 15 个键里**没有** `⚠️N` 标记的那 9 行(`aiKbRebuild`「恢复」是 `⚠️N` #55,但它是 T9 落的行内按钮文案,本刀零改动、既有断言 `toContain('恢复')` 保留)。本刀新用的 15 个键值逐字取自 `zh_cn.ts`,未改一个标点 |

**另:蓝本 `:773` 的「按钮已 disabled 还再判一次」照抄不删**(报告里已注明它不是冗余:
键盘/程序化调用时它是唯一的拦),并为两个分支各写了一条用例。

**蓝本 `_flashDone` 的 `setTimeout` 没有卸载清理 → 照抄。** 判据(治理 §2):
2200 ms 后回调只是把一个 `ref` 换成新 `Set`,组件已卸载时该写入不触发渲染、不持有 DOM 引用,
不是「可复现的错误行为」。代码注释已登记。

## 14. 每个 mock 取自哪个 fixture

| mock | 形状来源 | 大小写 |
|---|---|---|
| `ai.parserFiles(...)` | T8/T9 既有:`p5b-fixtures/files-all-8.json` / `files-has-error.json`(空态) | snake_case(§4.1 零转换) |
| `ai.parserReindexFiles` 成功 → `REINDEX_OK` | **`p5b-fixtures/reindex-one.http`** 的 200 响应体逐字:`{"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}` | snake_case |
| `ai.parserReindexFiles` 400(file_ids 超限)→ `CAP_400_FILE_IDS` | **`p5b-fixtures/reindex-cap-400.http`** 逐字:`{"detail":"too many file_ids (max 500)"}`(**已实测**) | — |
| `ai.parserReindexFiles` 400(filter 超限)→ `CAP_400_FILTER` | **`p5b-fixtures/README.md`「未实测 · 源码推定的形状」表**:`{"detail":"filter matches {n} files (> 10000); narrow it or raise max_reindex_by_filter"}`(`service_reindex.py:53-58`) | — |
| `FILE_OK` / `FILE_INDEXING` / `FILE_ERROR` / `FILE_TOMBSTONED` | T9 既有(前两个是真 fixture 行,后两个 §4.5 已登记真机造不出) | snake_case |
| `capIds(n)` 的 501 个 id | 纯 id 字符串,不是 file 行;行 schema 未变 | — |

🔴 **`CAP_400_FILTER` 是「源码推定、未实测」的形状**(fixture README 明确标注;本机只有 8 个文件,
10000 上限触发不了)。按 README 记的形状用,**报告在此注明**。
**零手编 mock**;`service.notes.*` 本刀一个都没用到(不存在 §4.2 的大小写搞反风险)。

## 15. RED 探针(7 次,含 brief 要求的 6 次 + 路由反转 1 次)

每次都是「改实现 → 跑测试 → 记原始报红 → `cp` 还原 → `diff -q` 确认字节一致」。
`git status --short` 全程只有本刀那 6 个 `M`,无额外污染。

### 探针 ① `overExplicitCap` 的 `>` 改成 `>=`

```
× 选中 500 个(= 上限,后端判据是 len > 500)→ 不超限:无警告、「重建选中」可点 18ms
AssertionError: expected true to be false // Object.is equality
 Tests  1 failed | 145 passed (146)
```
→ **精确报红,且只有 500 那一侧报红**(501 侧仍绿)= 两侧都被钉住。

### 探针 ② `_flashDone` 的 `setTimeout` 整块删掉

```
× 重建成功后该行 data-done 立刻 true;2199 ms 仍 true;满 2200 ms 后撤成 false 27ms
AssertionError: expected 'true' to be 'false' // Object.is equality
 Tests  1 failed | 145 passed (146)
```
→ 「撤」侧精确报红。

### 探针 ③ `filterObj` 里的 `f.tombstoned !== 'all'` 判据删掉

```
× 1/5 全空:tombstoned="all" 且其余三项默认 → filter 是 {}(证明 `tombstoned !== "all"` 判据真的在起作用) 47ms
× 2/5 path_prefix 非空 → 带 path_prefix 42ms
× 3/5 mime_prefix 非空 → 带 mime_prefix 38ms
× 4/5 has_error=true → 带 has_error;false 时不带(两侧对照) 40ms
AssertionError: expected { tombstoned: 'all' } to deeply equal {}
AssertionError: expected { path_prefix: '/DATA/Wiki/', …(1) } to deeply equal { path_prefix: '/DATA/Wiki/' }
AssertionError: expected { …(2) } to deeply equal { Object (mime_prefix) }
AssertionError: expected { has_error: true, tombstoned: 'all' } to deeply equal { has_error: true }
 Tests  4 failed | 142 passed (146)
```

### 探针 ④ K14 改回回显后端 `detail`(`<b>400 Bad Request</b> · {{ errorBanner }}`)

```
× K14: rebuild-all 400 分支不回显后端 detail,只留固定 "400 Bad Request" + aiKbRebuildCapHint(反向断言) 24ms   ← T8 那条
× filter 超限 400 → 警示条只有「400 Bad Request」+ aiKbRebuildCapHint,后端 detail 一个字都没有 27ms          ← 本刀新增
× 普通网络错误(无 response.data.detail)同样只渲染固定文案,不回显 e.message 28ms                              ← 本刀新增
AssertionError: expected '400 Bad Request · too many file_ids (…' not to contain 'too many file_ids'
AssertionError: expected '400 Bad Request · filter matches 1234…' not to contain 'filter matches'
AssertionError: expected '400 Bad Request · ECONNREFUSED leak-m…' not to contain 'ECONNREFUSED'
 Tests  3 failed | 143 passed (146)
```
→ T8 那条与本刀两条**一起**报红,证明真实入口那一半确实接上了同一条渲染链路。

### 探针 ⑤ 两个 `indeterminate` `watch` 里的赋值删掉(改成空回调)

```
× 1/4 全不选:先勾一行让它变 true,再取消 → 回 false(不是靠挂载默认值蒙对) 26ms
× 2/4 部分选(2 行里选 1 行)→ indeterminate=true,且全选框自身 checked=false 19ms
× 3/4 全选(2 行全选中)→ indeterminate=false(先经过部分选的 true 再补齐第二行) 18ms
× 4/4 可选行为 0:先在有可选行时变 true,再让当前页只剩 tombstoned 行 → indeterminate 回 false 且全选框禁用 16ms
AssertionError: expected false to be true // Object.is equality   ×4
 Tests  4 failed | 142 passed (146)
```
→ 🔴 **四条全部报红**(包括「期望 false」的 1/4 与 4/4 —— 因为它们的中间态断言
`expect(indet(w)).toBe(true)` 先炸)。这正是「先经历相反状态」设计的目的:
**没有一条是恒真断言**。

### 探针 ⑥ 动作条 `data-active` 改成恒 `true`

```
× data-active 两侧都断言:未选中 "false",勾选一行后 "true",再取消回 "false"(直接比字符串值) 14ms
× 选中两行后点「重建选中」:派全部选中 id + reason、toast、起轮询、清空选择 28ms
AssertionError: expected 'true' to be 'false' // Object.is equality   ×2
 Tests  2 failed | 144 passed (146)
```

### 探针 ⑦(自加)路由反转回退(`indexed-files` 退回 `KnowledgeDeferred` + `DEFERRED_TABS` 加回)

```
× P5a 实现 dashboard,P5b-T5 实现 queue,P5b-T10 实现 indexed-files,其余 6 个 tab 挂占位 5ms
× 父路由(布局位)是 KnowledgeLayout,"" 是 DashboardView,"queue" 是 QueueView,"indexed-files" 是 IndexedFilesView,其余 6 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred 4ms
AssertionError: expected [ 'allowlist', 'indexed-files', …(5) ] to deeply equal [ 'allowlist', 'notes', 'roots', …(3) ]
AssertionError: expected { __name: 'KnowledgeDeferred', …(3) } to be { __name: 'IndexedFilesView', …(3) } // Object.is equality
 Tests  2 failed | 4 passed (6)
```
→ 还原后 `6 passed (6)`。

## 16. 三门实测数字

```
pnpm test                    exit=0    Test Files  318 passed (318)
                                             Tests  3152 passed (3152)
pnpm exec vue-tsc --noEmit   exit=0    (输出为空)
pnpm build                   exit=0    ✓ built in 12.66s
                                       只有既有的 >500 kB chunk 警告
```

- 增量:**+0 文件 / +39 例**(brief 预期「+0 文件、+20 例左右,补 indeterminate 后更多」→ 符合)。
- **零红项**,治理 §8 登记的两处已知噪声(`persist.test.ts` IndexedDB flaky /
  `AgentComposer.test.ts` vue-i18n teardown 竞态)本次都没有出现,无需复跑。
- 中途一次 `vue-tsc` 报红并已修:`TS2550 Property 'at' does not exist on type 'any[][]'`
  ——本仓 tsconfig 的 `lib` 低于 es2022,`Array.prototype.at` 无类型声明,改成
  `calls[calls.length - 1]` 等价写法(代码注释已登记)。**这是测试代码的类型严格性问题,
  不是实现让步。**

## 17. 🔴 整页 DOM 完整性的自证(机械可核)

用「剥注释 + 统计模板开标签」+「蓝本标识符越界 grep」两把尺子自查(与评审的核法一致):

### 17.1 模板开标签逐类型计数(剥掉 HTML 注释后)

| 标签 | 蓝本 | New-UI | 结论 |
|---|---|---|---|
| `KIcon` | **25** | **25** | ✅ |
| `button` | **15** | **15** | ✅ |
| `span` | **56** | **56** | ✅ |
| `input` | 6 | 6 | ✅ |
| `label` | 5 | 5 | ✅ |
| `option` | 9 | 9 | ✅ |
| `select` | 4 | 4 | ✅ |
| `template` | 7 | 7 | ✅ |
| `b` | 3 | 3 | ✅ |
| `br` | 2 | 2 | ✅ |
| `div` | **60** | **58** | ⬇ −2,**已完整交代**(见下) |
| `DialogRoot` / `DialogPortal` / `DialogOverlay` / `DialogContent` / `DialogTitle` / `VisuallyHidden` | 0 | 各 1 | K7 替换 |

**`div` 差 2 的完整交代**:蓝本 `:356` 的 `<div class="k-modal-bg">` 与 `:357` 的
`<div class="k-modal">` 在 New-UI 里分别由 `DialogOverlay class="k-modal-bg"` 与
`DialogContent class="k-modal"` 承担(reka 运行时同样渲染成 `div`,类名一字不差)。
→ **58 div + 2 个承担 div 角色的 reka 组件 = 60,与蓝本精确对齐。**
其余 4 个 reka 组件(`DialogRoot` / `DialogPortal` 不渲染元素、
`VisuallyHidden as-child` 不多包一层、`DialogTitle` 是新增的 a11y 必需元素)不占蓝本的 div 名额。

### 17.2 蓝本 script 标识符越界 grep

把蓝本所有 `data()` 字段 / `computed` 名 / `methods` 名 / 顶层 `const`/`function` 抽出来,
逐个在 New-UI 文件里 grep,**唯一找不到的是 `justDone`**
——它是蓝本 `:482` 的 Vue2 反应性土办法(`justDone() { void this.doneTick; return this.doneSet }`),
**K13 已授权删除**(模板改成直接 `doneSet.has(...)`)。同族的 `selected` / `expanded` /
`selTick` / `expTick` / `doneTick` 也一并按 K13 不落。

### 17.3 无残留占位

新增了一条机械用例(`收官刀:整页落地完整性` 里的第 2 条):读源文件、**先剥掉 HTML 注释与
JS 行/块注释**(治理 §9:「在文件里找文本」必须先排除注释),再断言
`not.toMatch(/\bTODO\b/i)` / `not.toMatch(/\bFIXME\b/i)` /
`not.toMatch(/function\s+\w+\s*\([^)]*\)\s*(:\s*[\w<>|\s]+)?\s*\{\s*\}/)`(空函数体)。
最后那条正是 T9 留的 `rebuildRow` 占位的形状 —— 现在它已被补全,断言绿。

**结论:蓝本 826 行三刀累计全部落地,本文件再无占位、无空函数体、无 TODO。**
本文件现 **1187 行**(含 T8/T9/T10 三段共约 300 行申报注释)。

## 18. 🔴 任务书勘误(T10 回权威源核出,**格式照治理文件 §12**,下游一律以本节为准)

`p5b-task-10-brief.md` 的两条错。**独立 opus 评审(修复轮 1,2026-08-02)已四处独立核实、
判两条全部成立 —— 错在任务书,不在实现。** 🔴 **P5c 若复用同一套 brief 模板会再撞上,故留痕。**

| # | 任务书原文 | 权威源实际 | 处置 |
|---|---|---|---|
| **B-1** | §4「底部粘性动作条」:「`data-active="selectedCount > 0"`(🔴 **套 `String()`**,照抄蓝本)」 | 🔴 **这句自相矛盾** —— 蓝本 `IndexedFilesView.vue:323` 原文是 `:data-active="selectedCount > 0"`,**没套**。四处独立核实一致:① 蓝本原文;② **附录 D §D.3 那一行明确标 ❌ 不套**;③ **治理 §12 E-9 的裁定是「逐处照抄蓝本」**,并指出 P5a `.k2-cc` 事故的真实教训是**属性名错**(附录写 `[data-active]`,蓝本实际 `[data-on]`)而**不是** `String()`;④ 评审自读 `@vue/runtime-dom@3.5.39` 的 `patchAttr`(`:560`)确认 `data-active` **不在** `isSpecialBooleanAttr` 里 → `false` 走 `setAttribute` 渲染成 `"false"`,**套与不套渲染完全一致** | **照抄蓝本,不套 `String()`**。优先级:设计文档 > 治理文件 + 附录 > **任务 brief**。断言口径不变(`toBe('true')` / `toBe('false')`,禁 `toBeUndefined()`)。**行为零差异**,不是偏离 |
| **B-2** | §2「双上限」:「两个常量 T8 已声明(`:91` / `:92`),核实值与治理 §4 一致」 | 🔴 **T8 只声明了 `FILTER_REBUILD_CAP` 一个。** T8 的头注释与 script 注释都明确写了「`EXPLICIT_REBUILD_CAP`(蓝本 :392,批量重建按钮专用)**本刀不声明**,T9/T10 的动作条才用到」 | `EXPLICIT_REBUILD_CAP = 500` 是 **T10 新增**(不是核实)。值与治理 §4.4 一致(后端 `MAX_REINDEX_FILE_IDS`,`service_reindex.py:26`) |

> 教训(同治理 §2 那条「brief / 计划书里标了『已核』的数据,评审仍须回权威源复核」):
> **B-1 是「brief 自己写了两个互相矛盾的要求」——「套 String()」与「照抄蓝本」不可能同时满足。
> 遇到这种情况按优先级取权威源,并显式申报,不要自己挑一个执行。**

## 18.1 遗留疑问

1. 🔴 **`CAP_400_FILTER` 的 400 响应体形状是「源码推定、未实测」**(fixture README 登记)。
   若将来在多文件机器上实测出不同形状,K14 的反向断言里那三个 `not.toContain` 字符串要跟着更新
   ——但 K14 的**保证**(不回显任何后端 detail)与形状无关,不会因此失效。
2. B-1 / B-2 两条已由评审判定成立(见 §18),**不再是待确认项**。

## 19. 给验收 / P5c 的交接项

1. **`indexed-files` 已上线可访问**:`/app/#/ai/knowledge/indexed-files`
   (dev server `:5288`;`DEFERRED_TABS` 现剩 6 项:`search` / `wiki` / `notes` /
   `roots` / `allowlist` / `settings`)。
2. **本机真机验收的限制**(治理 §4.5,不是缺陷):
   - 只有 8 个文件、`limit` 默认远大于 8 → **分页恒 1/1**,翻页本身验不了(禁用态可验)。
   - `error` / `tombstoned` 徽标、`errhint`、`zerohint`、tombstoned 行禁选 **真机全验不了**。
   - **两个上限真机都触发不了**(选不到 501 个、总数到不了 10001)→ 只有单测覆盖。
   - **`.k-ab-warn` 超限警告与弹窗内嵌超限横幅真机看不到**(同上)。
   - 可真验的:动作条随勾选出现/消失、「重建该 Root 全部」→ 弹窗 → 确认 → toast
     「已入队 N 个任务」→ 行变 `indexing` + 30 秒自动刷新、单行「恢复」的 2200 ms 绿闪。
   - ⚠️ **重建是真写操作**:会把文件墓碑后重新入队(pending 队列会涨)。验收时注意。
3. **P5c 需要的**:`.k-modal-head` / `.k-modal-title` / `.k-modal-x` / `.k-modal-body`
   四个类(K17)仍未搬,`knowledge.scss` 里也仍没有 —— P5c 如果有带标题栏的弹窗要先搬它们。
4. **后端票(仍挂账)**:filter 模式超限的 400 响应体形状**未实测**;
   §4.3 的「按 file_ids 重试」后端 §B 也未做。
5. **`.knowledge-app` portal 宿主**:本视图独立单测时要 `withHost()` 造宿主,
   而且 `DialogPortal to` 只认 `document.querySelector` 的**第一个**同名宿主
   ——一个用例里多次挂载必须先清宿主(§9.4 踩坑记录),P5c 写弹窗测试时会再撞上。

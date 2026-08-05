# Task 7 报告:SmartViewConditionEditor.vue —— 条件 chips + 加条件弹层

状态:**DONE**

## 改了哪些文件

- 新建 `src/photos/components/SmartViewConditionEditor.vue`
- 新建 `src/photos/components/__tests__/SmartViewConditionEditor.test.ts`(20 例)
- 改 `src/views/PhotosSmartViewDetail.vue`:import + 挂载真组件到
  `data-test="sv-cond-editor-mount"`、新增 `addCond`/`removeCond` 两个宿主接线函数、把
  `.sv-header-conds` 的占位样式(`min-height: 4px`)补成 Vue2 scss:252 的真实 flex 布局
- 改 `src/views/__tests__/PhotosSmartViewDetail.test.ts`:把 T6 的空壳 stub 断言升级成
  4 条真组件断言(渲染数量 / 删除接线 / 提交接线 / busy 转发),T8 的空壳断言原样保留、
  单独成 describe
- 未新增 i18n 键(全部复用 T1/T6 已有键)、未改 store / Service 仓

## Vue2 `:26-59` 节点清点表(逐节点 → New-UI 落点)

| Vue2 行号 | 节点 | New-UI 落点 |
|---|---|---|
| 26 | `.sv-header-conds` 容器(flex/wrap/gap 6/margin-bottom 6/align-items center) | 宿主 `PhotosSmartViewDetail.vue` 的 `.sv-header-conds`(T6 只留 `min-height:4px` 占位,本任务补齐真实布局属性) |
| 27-30 | `v-for` 条件 chip(文本 + `.sv-cond-x` 内含 9px x 图标),整个 chip `@click` 删除,`:title` | `SmartViewConditionEditor.vue` 的 `<span class="sv-cond sv-cond-removable" data-test="sv-cond-chip">` + `.sv-cond-x`(内联 9px x svg) |
| 31 | 相对定位包裹 div(`position:relative;display:inline-block`) | 保留同款内联 `style`,不新起 class(同文件已有先例) |
| 32-34 | `.sv-cond.sv-cond-add` 按钮,`ref`,`:data-open`,点击 toggle,10px plus 图标 | `.sv-cond-add`(`data-test="sv-cond-add-btn"`,`:data-open="open"`,`@click="toggleOpen"`) |
| 35 | `<transition name="sv-menu">` | Vue3 `<Transition name="sv-menu">`,`-enter-from`/`-leave-to` 写法,数值与 `PhotosSmartViewDetail.vue` 已有的同名 transition 完全一致(能复用就复用) |
| 36 | `.sv-cond-pop`(`v-if`,`ref`,局部 `@keydown.esc`) | `.sv-cond-pop`(`data-test="sv-cond-pop"`);Esc 改走 document 级(见下方"偏离登记") |
| 37 | `.sv-cond-pop-head` 文案 | 同名 class,文案键 `photosSvNewCondition` |
| 38-42 | input:`ref`/`v-model`/占位/Enter 提交/Esc 关闭 | `.sv-cond-pop-input`(`data-test="sv-cond-pop-input"`),`@keydown.enter.prevent="submit"` + `@keydown.esc.prevent="close"`(与 document 级 Esc 并存,互不冲突) |
| 43-46 | `v-if="condSuggestions.length>0"` 建议标题(sparkles 10px + accent-hi 色文案) | `.sv-cond-pop-sugg-head` |
| 47-51 | `v-if` 建议 chip 组,`+ {{s}}`,点击 `addCondSuggestion` | `.sv-cond-pop-sugg` → `.sv-cond-pop-chip`(`data-test="sv-cond-suggestion"`) |
| 52-55 | foot:`.sv-btn-ghost`(Done,28px)+ `.sv-btn-primary`(Add,28px,`:disabled="!newCond.trim()"`) | `.sv-cond-pop-foot` → `data-test="sv-cond-done"` / `data-test="sv-cond-submit"`(`:disabled="!draft.trim() || busy"`,busy 是偏离登记见下) |
| 334-343 | `condSuggestions` computed(POOL 过滤 + slice 8) | 直接消费 T1 的 `condSuggestionsFor(props.conds)`,未重新实现 |
| 445-449 | `removeCond` | 宿主 `removeCond`(`updateSmartView({conds: filtered})`),组件侧只 emit |
| 450-454 | `openAddCond` | `openPop`:`open=true`、`draft=''`、`nextTick` 聚焦 |
| 455-458 | `closeAddCond` | `close`:`open=false`、`draft=''` |
| 459-468 | `submitCond` | `submit`:空白→关闭;去重跳过;成功清空 draft + 重新聚焦,**弹层不关** |
| 470-477 | `addCondSuggestion` | `addSuggestion`:去重后 emit,清空后仍重新聚焦(无需清 draft,原本就没写进 draft) |
| 386-391 | 点外部关闭(`condPop`/`addCondBtn` 均不含 target) | `onDocumentMouseDown`,`watch(open)` 挂/摘 |

逐节点均已落地,无静默漏渲染。

## 必含用例 → `it` 对应表

| brief 必含用例 | 对应 `it`(`SmartViewConditionEditor.test.ts`) |
|---|---|
| conds 3 条 → 3+1;`[]` → 0+1 | `chips 渲染` 两条 |
| 点 chip 任意处 / 点叉 → remove 事件 | `删除条件` 两条 |
| 点「添加条件」→ 弹层出现 + 聚焦;再点 → 关闭 | `弹层开关 > 点「添加条件」...` |
| Enter 提交 → add 事件 + 弹层仍开 + input 清空 + 连续第二条 | `提交条件` 第一条 |
| 空白 + Enter → 无 add + 弹层关闭 | `提交条件 > 输入空白...` |
| 已存在 + Enter → 无 add(去重)+ 清空 + 弹层仍开 | `提交条件 > 输入一条已存在...` |
| 建议不含已有 / 最多 8 条 / 点建议→add+仍开 / 12/12 全占用→整块不渲染 | `建议区` 四条 |
| busy → primary disabled + chip 删除不发 remove | `busy` 一条 |
| 点外部关闭 / 点内部不关 / 点按钮本身走 toggle | `点外部关闭` 三条 |
| Esc → 关闭 + handler 源码无早退 | `Esc` 两条 |
| cssCascade:removable 与 `[data-open]` 变体 hover 归属 | `cssCascade` 两条 |

共 20 例,与 brief 必含用例逐条对齐,一次通过(未见过中间失败,首次跑测即 20/20 绿——
说明前序 T1/T6 留下的契约边界够清楚)。

## 删码验证逐条结果

| # | 删的内容 | 预期 | 实测 | 结论 |
|---|---|---|---|---|
| ① | `submit` 里 `if (!props.conds.includes(v))` 去重判断 → 直接 emit | 重复条件用例红 | `输入一条已存在的条件...` 红(`emitted('add')` 变成 `[['scene: sunset']]`,期望 `undefined`) | 成立 |
| ② | `submit` 成功分支加回 `close()` | 「弹层仍开」用例红 | 两条测试红(`add`+Enter 后弹层已关 / 已存在条件用例 input 未清空,因为组件在 close() 里清了 draft 但断言路径变了) | 成立 |
| ③ | `onDocumentMouseDown` 去掉 `btn && !btn.contains(target)` 半判据 | 「点按钮走 toggle」用例红 | 该用例红(mousedown 打在按钮自己身上时被误判为"点外部",popover 被提前关掉) | 成立 |
| ④ | `condSuggestionsFor` 换成 `[...COND_SUGGESTIONS]` 原样 | 「建议不含已有」用例红 | 3 条用例红(不去重、8 条上限失效因为已经≤12、12/12 覆盖不触发"整块不渲染") | 成立(比 brief 预期的 1 条更多,一并登记) |
| ⑤ | primary 按钮 `:disabled` 去掉 `|| busy` | busy 用例红 | 该用例红(`disabled` 属性变成 `undefined`) | 成立 |
| ⑥ | 删 `.sv-cond-removable:hover` 规则 | cssCascade 用例红 | 该用例红(`winningHoverBackground` 直接抛"没有任何 background 规则命中"异常,不是简单的值不对,是规则整个消失） | 成立 |

六条全部按预期变红,逐条用 Edit 手工还原(未用 `git checkout --`),还原后重跑 20 例全绿。

## 回源核对结论

- **scss 区间是否够**:brief 给的 `photos-smartview.scss:252-376` 覆盖了本组件全部样式
  规则(base `.sv-cond`、`.sv-cond-removable`/`.sv-cond-x`、`.sv-cond-add`、
  `.sv-cond-pop` 全套、`.sv-header-conds`),**这次区间是准的**,未发现区间外遗漏规则。
  唯一需要"跨区间借用"的是 `.sv-btn-ghost`/`.sv-btn-primary` 的**基础属性**——它们的
  36px 版本定义在 `photos-smartview.scss:970-1004`(区间外),弹层里用的 28px 版本是靠
  `PhotosSmartViewDetail.vue:53-54` 的内联 style **覆盖**同一个类的 height/padding/
  font-size,其余属性(背景/边框/圆角/字重/hover/disabled)仍来自 970-1004 的基类。本组件
  作用域独立(scoped),没有 36px 版本可继承,所以把"基类属性 + 28px 覆盖"合并写成一份
  完整定义,已在组件注释里说明。
- **内联 style 审计**:`grep 'style='` 命中的只有 Vue2 `:31` 的
  `position:relative;display:inline-block`(相对定位包裹 div)和 `:53`/`:54` 的
  28px 按钮尺寸覆盖(已并入上一条)。均已落地,无遗漏。
- **区间内每条规则逐条过了吗**:是,255-376 共 18 条规则(含多个 `:hover`/伪类变体)
  逐条对照落地,细节见上方节点清点表。出入只有一处见下方"申报的偏离"第 4 条(base
  `.sv-cond` 无 hover)。

## 宿主接线怎么做的

`PhotosSmartViewDetail.vue` 新增:

```ts
async function addCond(cond: string): Promise<void> {
  const s = sv.value
  if (!s) return
  try {
    await store.updateSmartView(s.id, { conds: [...s.conds, cond] })
  } catch (e) { toast.show(t('photosSvUpdateFailed')) }
}
async function removeCond(cond: string): Promise<void> {
  const s = sv.value
  if (!s) return
  try {
    await store.updateSmartView(s.id, { conds: s.conds.filter((c) => c !== cond) })
  } catch (e) { toast.show(t('photosSvUpdateFailed')) }
}
```

模板:

```html
<div class="sv-header-conds" data-test="sv-cond-editor-mount">
  <SmartViewConditionEditor :conds="sv.conds" :busy="store.patchBusy" @add="addCond" @remove="removeCond" />
</div>
```

`patch` 形状是整体替换 `conds` 数组(不是增量字段),与 Vue2
`removeCond`/`submitCond`/`addCondSuggestion` 三个方法的请求体形状一致。store 内部把
`conds` 键名转成 `condsRaw` 发给后端(`updateSmartView` 已有逻辑),接线层不需要关心。
不需要额外 `.then(loadDetail())`——§7e-2 的 `byId(id)` computed 让 `sv`/`conds` 在 store
数组项更新后自动跟着变,组件立刻拿到新的 `conds` prop。

## 申报的偏离

1. **`busy` 期间禁用 primary 按钮 + 拦截 chip 删除 + 拦截键盘 Enter/建议点击提交**(brief
   结构规格 6 已预先要求登记):Vue2 的 `updateSmartView` 无重入守卫,New-UI 的
   `patchBusy` 会短路重复请求但界面不给反馈就成了"点了没反应"。除了 brief 明确点名的
   "primary 按钮 disabled + chip 删除不发 remove",我把同一条理由延伸到了
   `submit()`/`addSuggestion()` 函数体内部(`if (props.busy) return`)——这是防止键盘
   Enter 路径绕过按钮的 `disabled` 属性,不是一条新的、未申报的偏离,只是同一条已登记
   偏离在键盘路径上的自然延伸。另外给 `.sv-cond-removable` 加了
   `[data-busy="true"]` 视觉态(`opacity:0.6;cursor:not-allowed`),Vue2 没有这个视觉反馈,
   同一条理由下的追加登记。
2. **Esc 处理改成 document 级监听**,不是 Vue2 局部的 `@keydown.esc="closeAddCond"`(popover
   容器)+ 局部 `@keydown.esc.prevent`(input)两处混合写法。这是遵循 plan Global
   Constraints 的通例要求("浮层 Esc 一律 document 级监听 + watch(open) 挂/摘"),
   input 上的 `@keydown.esc.prevent="close"` 按 brief 结构规格字面要求保留(两者不冲突,
   input 聚焦时两条路径都会触发 close,是幂等操作)。
3. **`.sv-cond` 基类没有 hover——brief 结构规格 7 "`.sv-cond` 基类有 hover" 与源码不符**。
   逐行核对 `photos-smartview.scss:96-102`(base `.sv-cond`)确认没有任何 `:hover` 规则;
   `.sv-cond-removable:hover`(:273)与 `.sv-cond-add:hover`(:294)都是变体自己独立声明的
   hover,不存在"变体压过基类"的真实碰撞场景。本组件**没有**新增一个 Vue2 不存在的
   base hover(避免生造视觉),但仍按硬约束写了两条 cssCascade 断言(`.sv-cond-removable`
   与 `.sv-cond-add[data-open="true"]`)——如实登记:这两条断言验证的是"变体 hover 确实
   生效、选择器含 `:hover`",而不是"变体压过一个真实存在的基类 hover"的回归防护,因为
   后者在 Vue2 源码里根本不存在,不构成可证伪的碰撞场景。`.sv-cond-add[data-open="true"]`
   与 `.sv-cond-add:hover` 在 Vue2 原值完全相同(都是同一组 accent 描边/accent-soft 底/
   accent-hi 字),即使工具的 `classSpecificity` 低估属性选择器的分数,也不会产生真实的
   白底白字风险——已用 `expect(win.specificity).toBe(2)` 断出具体数值。
4. **`.sv-btn-ghost`/`.sv-btn-primary` 是本组件作用域内独立定义的 28px 版本**,不是从
   `PhotosSmartViewDetail.vue` 或 `SmartViewCreateDialog.vue` 继承(Vue scoped style 不
   跨文件共享)。颜色 token 映射沿用本任务族已确立的规则:`--line`/`--line-stronger`→
   `--card-border`(先例 `PersonAvatar.vue:157-159`),`--surface-2`→`--chip-bg`、
   `--surface-3`→`--chip-bg-hi`,`--text-1/2/3`→`--fg`/`--fg-muted`/`--fg-faint`(先例
   `SmartViewCreateDialog.vue:45`),`--accent-hi`(纯文字色语义)→`--accent-text`,
   `rgba(var(--accent-rgb),0.4)`→`--accent-soft-bd`,primary 按钮渐变→
   `background: var(--accent); color: var(--on-accent);`(全局约定 §33 既定写法)。

## 命令

```
pnpm exec vitest run src/photos/components/__tests__/SmartViewConditionEditor.test.ts   # 20 passed
pnpm exec vitest run                                                                     # 298 files / 3234 passed
pnpm exec vue-tsc --noEmit                                                                # exit 0
```

---

## Fix round 1(评审:Spec ✅ / Task 质量 Needs fixes → 本轮后 Task 质量应转 ✅)

状态:**DONE**

评审独立重做节点清点表(14 组节点 + 18 条 scss 规则)判**零漏渲染**,两条腿审计到位,
6 条删码里 5 条独立复核**全部成立、无一被推翻**(本期头一个删码清单零翻车)。本轮只处理
1 Important(I1)+ 1 并入的 Minor(M1)。brief 预测偏差(删码④)与「`.sv-cond` 基类无
hover」的申报成立两条已由控制器记台账,不在本轮改动范围。

### I1(Important)—— `.sv-cond-add[data-open="true"]` 的 cssCascade 断言是零价值恒真断言

**根因**:`cssCascade.ts` 的 `hoverBackgroundRules` 用 `pseudoHits.every(p => p === ':hover')`
判定"是不是 hover 规则"——纯属性/纯类选择器没有任何 `:` 伪类,`pseudoHits` 是空数组,
`.every()` 空数组恒真,于是非 hover 规则也被收进候选;`classSpecificity` 又不给方括号
计分,`.sv-cond-add:hover`(2 分)恒胜 `.sv-cond-add[data-open="true"]`(1 分,即使被
误收也赢不了),导致 `winningHoverBackground(style, ['sv-cond-add'])` 永远只看得见
`.sv-cond-add:hover` 自己——改错 `[data-open="true"]` 的背景值、甚至整条删掉,断言都
测不出来。

**两处都改了**:

1. **`src/photos/components/__tests__/cssCascade.ts`**(控制器授权改的共享文件):
   - `hoverBackgroundRules` 循环里加一行:选择器不含 `:hover` 直接 `continue`(修
     vacuous-truth)。
   - `classSpecificity` 的正则补一项 `\[[^\]]*\]`,给属性选择器计分(修低算分)。
   - **两处都补了独立回归测试**(合成 CSS 字符串,不依赖本组件真实样式,见下方"新增
     测试"),证明修复本身生效,不只是"没弄坏别的"。
2. **`src/photos/components/SmartViewConditionEditor.vue` / `.test.ts`**:把原来的
   `expect(win.specificity).toBe(2)` 恒真断言换成 Vue2 `scss:294-303` 真正编码的不变量
   ——`.sv-cond-add:hover` 与 `.sv-cond-add[data-open="true"]` 三条声明逐字相同(打开态
   视觉等同 hover 态),改成用 `parseCssRules` 分别锚定两条规则体,断言
   `background`/`border-color` 相等,且 `[data-open="true"]` 规则本身存在(删掉即红)。
   组件文件头注释与 `.sv-cond-add` 规则上方的注释同步改写,不再说"按硬约束写了
   cssCascade 断言"。

**改共享文件的全量验证(硬要求)**:

| | Test Files | Tests |
|---|---|---|
| 改前(`git stash` 掉 cssCascade.ts 的改动) | 298 | 3234 passed |
| 改后 | 298 | 3238 passed(+4:M1 两条 + cssCascade.ts 合成回归两条,I1 主断言是 1↔1 替换不计入净增) |

**13 个既有消费方专项复核**(`SmartViewConditionEditor`/`PlacesThemeMenu`/
`ClusterActionDialog`/`PlacesFilterMenu`/`SmartViewCreateDialog`/`PlaceCoverPicker`/
`PlaceDetailPanel`/`MergeReviewDialog`/`PlacesRail`/`PlaceSpotDialog`/
`PhotosSmartViewDetail` 共 11 个测试文件、404 个用例):改前 404 passed、改后 404
passed,**逐条结论未变**——回源确认这 13 个消费方传的都是纯类变体(`is-active`/
`cad-btn-danger`/`mrd-btn-primary`/`cp-tab`/`rail-place` 等),没有用到属性选择器,
vacuous-truth 漏洞此前确实只咬到本任务这一处。

**新增测试**(`SmartViewConditionEditor.test.ts` 末尾,独立 describe,不依赖本组件样式):
- `vacuous-truth 修复:纯类选择器(无 :hover)不再被误收进 hover 候选` —— 合成
  `.a:hover{...} .a.b{...}`(两者修复前同分,`.a.b` 写在后面会被 order 决胜误判为
  "胜出的 hover 规则",其 selector 根本不含 `:hover`)。
- `属性选择器计分修复:[data-flag]:hover 的 specificity 现在算上属性选择器` —— 合成
  `.y[data-flag="true"]:hover{...} .y:hover{...}`(属性规则写在前面,修复前 order 决胜
  选中后写的纯类规则;修复后属性规则 3 分 > 2 分,稳定胜出,与书写顺序无关)。

### M1(并入)—— `submit()`/`addSuggestion()` 内部的 `busy` guard 补覆盖

补了两条测试(`describe('busy')` 内):
- `busy: true → input 里按 Enter 不发 add(disabled 挡不住键盘路径)`
- `busy: true → 点建议 chip 不发 add`

### 删码验证(本轮新增/改动的断言,逐条)

| # | 删的内容 | 结果 |
|---|---|---|
| A | `cssCascade.ts`:去掉 `if (!bare.includes(':hover')) continue` | `vacuous-truth 修复` 用例红(收到 2 条候选而非 1 条) |
| B | `cssCascade.ts`:`classSpecificity` 去掉 `\[[^\]]*\]` | `属性选择器计分修复` 用例红(胜出规则变回 `.y:hover`) |
| C | 组件:整条删掉 `.sv-cond-add[data-open="true"]` | 不变量用例红(`openRule` 为 `undefined`,断言在 `toBeTruthy()` 先炸) |
| D | 组件:`[data-open="true"]` 的 `background` 改成 `var(--chip-bg)` | 不变量用例红(与 hover 规则的 background 不等)——**这正是评审两次变异实测的原场景,复现并确认已被新断言捕获** |
| E | 组件:`submit()` 删 `if (props.busy) return` | busy+Enter 用例红 |
| F | 组件:`addSuggestion()` 删 `if (props.busy) return` | busy+建议点击 用例红 |

六条全部按预期变红,逐条用 Edit 手工还原(未用 `git checkout --`),全部还原后重跑绿。

### 命令

```
pnpm exec vitest run src/photos/components/__tests__/SmartViewConditionEditor.test.ts   # 24 passed
pnpm exec vitest run                                                                      # 298 files / 3238 passed
pnpm exec vue-tsc --noEmit                                                                 # exit 0
pnpm exec vitest run src/styles/color-guard.test.ts                                        # 427 passed
```

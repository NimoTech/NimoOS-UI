# P5d · T5 报告 —— `openInApp.ts` 补两函数(§16)+ 票 3 守卫债(§15.3)

起点 HEAD `cb73071`(T0–T4 五刀关账、评审 clean)。改动仅 3 个已改文件,**零新建文件**
(文件数仍 329,`.vue` 仍 180)。

## 计划书 §T5 逐条对照

1. **`openDirInNewTab(dirPath)`** —— 逐字照抄蓝本 `openInApp.js:52-55`
   (`if (!dirPath) return; window.open(filesPathUrl(dirPath, ''), '_blank')`),
   `filesPathUrl` 用本仓既有的那个(`:41-43`,`/app/#/files?path=…&highlight=…`)。
   落在 `openFileInNewTab` 之后、`PHOTOSET_PREFIX` 之前(`openInApp.ts:56-62`)。
2. **`agentSessionUrl(sessionId)` + `openAgentSessionInNewTab(sessionId)`** —— 按裁定 A-8
   逐字照抄蓝本 `openInApp.js:117-124`,指向旧 Vue2 应用 `/#/ai/agent?session=…`
   (**无** `/app` 前缀)。落在文件末尾(`:111-128`),申报注释同款
   `photosAssetUrl`(`:37-39` + 文件头 `:5-9`)的写法,写明「New-UI 的 `/ai/agent`
   尚未实现 `?session=` 深链(AgentPage.vue / agentStore 零读取),故借道旧应用;
   实现后应换成 `/app/#/ai/agent?session=…`」。
3. **早退两侧用例**:`openDirInNewTab('')` / `(null)` / `(undefined)` 与
   `openAgentSessionInNewTab('')` / `(null)` / `(undefined)` 各自断言 `window.open`
   **不被调用**(`openInApp.test.ts` 新增 describe 块,均已跑绿)。
4. **`openNoteInNewTab` 确认未补**:`grep -rn "openNoteInNewTab" src/` 全仓零命中。
   登记进 P5e/P5f 交接项(见下)。
5. **开票(A-8)**:**「New-UI Agent 页补 `?session=` 深链」** —— `AgentPage.vue` /
   `agentStore` 目前零 `?route.query.session` 读取,`openAgentSessionInNewTab` 暂借道
   旧 Vue2 应用;待 New-UI 侧补上该深链支持后,`agentSessionUrl` 应改回
   `/app/#/ai/agent?session=…`。
6. **具名色扫描**(票 3a)——`knowledgeStyles.test.ts` 新增
   `namedColorOffensesInValues()`:只在 `background-color` / `border-color` /
   `background` / `border` / `box-shadow` / `color` / `fill` / `stroke` 的**值**部分
   找 8 个整词具名色(与既有 `:510-517` 同一份清单)。**RED + 反向探针两头验**(见 §RED 探针)。
7. **覆盖范围扩到 `src/ai/components/**`**:新增 `COMPONENTS_VUE_FILES`(70 个文件,
   `find src/ai/components -name "*.vue" | wc -l` 实测 70)+ 集合相等防漂移断言 + 抽取/
   覆盖度自检 + hex/rgb/hsl + 具名色,四类断言全套铺开。**扩范围前先用独立脚本
   `/tmp/scan_components.mjs`(逻辑与生产测试代码同构)对 70 个文件做过一次性
   dry-run:`anyIssue: false`(零 hex/rgb/hsl/具名色命中,且 70 个文件全部抽取成功、
   无 `NO TEMPLATE EXTRACTED`)。真实测试跑绿印证同一结论,不触发 NEEDS_CONTEXT。**
8. **`src/` 下非测试文件除 `openInApp.ts` 外零改动**:`git diff --name-only` 只有
   `src/ai/services/openInApp.ts`(改)· `src/ai/services/openInApp.test.ts`(测试)·
   `src/ai/styles/knowledgeStyles.test.ts`(测试)。`openInApp.ts` 的 `git diff` 全部是
   `+` 新增行,原有 7 个导出(`fileDirAndName`/`photosAssetUrl`/`filesPathUrl`/
   `openPhotoInNewTab`/`openFileInNewTab`/`photosSetUrl`/`openPhotoSetInNewTab`)
   一字未改。

## 具名色守卫两头探针(票 3a DoD)

**探针①(必须报红)**:在 `QueueView.vue:474`(`white-space: nowrap;`)之后插入
`color: white;`(`cp` 备份 → `sed -i '474a\  color: white;'` 行首锚定注入 → `diff` 先证
落盘)。跑 `-t "具名色"`:
```
FAIL views/QueueView.vue —— 模板内属性值位置…零具名色
AssertionError: … 发现具名色:
color: white: expected [ 'color: white' ] to deeply equal []
```
还原:`cp` 备份覆盖 →
`md5sum` 前后一致(`ff6bd0d…` = `ff6bd0d…`)、`git diff`/`git status` 该文件干净。

**探针②(必须不报红)**:同一个 `QueueView.vue:474` 的真实 `white-space: nowrap;`
——探针①还原后重跑 `-t "具名色"`:`82 passed`,`views/QueueView.vue` 那条在其中,
零红。属性名 `white-space` 根本不在 `COLOR_VALUE_PROPS` 名单里,天然被排除,
不需要额外的连字符特判。

**两头都过** —— 守卫成立。

## `agentSessionUrl` 正向 + 反向断言(带判别力验证)

正向:`expect(agentSessionUrl('sess 1')).toBe('/#/ai/agent?session=sess%201')`。
反向:`expect(agentSessionUrl('sess 1')).not.toBe('/app/#/ai/agent?session=sess%201')`。
**RED 探针**(模拟「顺手统一前缀」回归):`cp` 备份 → 把
`return '/#/ai/agent?session=' + …` 改成 `'/app/#/ai/agent?session=' + …` → 跑
`openInApp.test.ts -t agentSessionUrl`:5 条失败(含正向断言、反向断言、
`toHaveBeenCalledWith` 三种形式),证明该组测试对这个具体回归有判别力。
还原:`cp` 覆盖 → `md5sum` 前后一致(`248a875…` = `248a875…`)、`git status` 干净。
还原后重跑全量 `openInApp.test.ts`:`33 passed`。

## `src/ai/components/**` 扫描结果(票 3b)

零既有违规(见条目 7),**未触发 NEEDS_CONTEXT**。

## 三门(全量)

```
pnpm test                  exit=0   Test Files 329 passed (329)  Tests 3839 passed (3839)
pnpm exec vue-tsc --noEmit exit=0
pnpm build                 exit=0(仅既有 >500KB chunk 警告)
```
算式:起点 `3607` + 本刀新增 `232` = `3839`(实测)。构成:`openInApp.test.ts` +10
(`openDirInNewTab` 3 条 + `agentSessionUrl`/`openAgentSessionInNewTab` 7 条)、
`knowledgeStyles.test.ts` +222(知识库区具名色 it.each 11 条 + components 扩展
describe:文件清单 1 + 抽取/覆盖度 70 + hex/rgb 70 + 具名色 70 = 211;
10+222=232)。文件数仍 **329**(零新建)。

## K/N 申报

无新增 K/N 号偏离 —— `agentSessionUrl`/`openAgentSessionInNewTab` 是**逐字照抄蓝本**
(裁定 A-8 直接授权,非本任务自定偏离);`openDirInNewTab` 沿用既有落点惯例
(`filesPathUrl`,文件头注释里早已申报过,非本刀新增申报)。守卫加强本身不是产品逻辑
偏离,不占 K 号。

## 交接项登记

- **票(A-8)**:New-UI Agent 页补 `?session=` 深链支持(转 P5e/P5f)。
- `openNoteInNewTab` 本期未补,登记进 P5e/P5f(`FileDetailDrawer` 可能要用)。

## 自证

- `git status --short`:仅 3 个已知改动文件,无其它改动。
- `git diff --stat`:`openInApp.ts` +27/-0、`openInApp.test.ts` +72/-0、
  `knowledgeStyles.test.ts` +181/-0 —— 全部纯新增,无删改行。

## 修复轮 1 —— 具名色扫描先剥 HTML 注释 【已按协调者裁定回退,理由见「修复轮 2」】

> 🔴 **本节记录的做法已被协调者本人推翻并要求回退**(见下方「修复轮 2(回退)」节)。
> **反转不删、留痕** —— 本节原文保留,不代表当前代码状态。当前代码状态以「修复轮 2」为准
> (`knowledgeStyles.test.ts` 逐字节回到 `11ad79b`,即本节改动之前的状态)。

独立评审回执:规格 ✅、质量 ✅、零 Critical/Important。协调者按跨刀风险把评审的一条 Minor
(`namedColorOffensesInValues` 未先剥 HTML 注释,散文注释里写 `background: black` 会误报)
升级为必修 —— 依据:T6/T7/T8 按纪律要写的"偏差申报注释"格式几乎必然引用蓝本原色值
(如 `<!-- K39:蓝本 rgba(255,149,0,.14) → --warning-soft -->`),这条脆弱点在下三刀近乎必然
触发,而"扫描撞注释"在本档是反复栽过的家族(P5c §9)。

### 修法:复用既有 `stripComments`,补 HTML 注释这一档

`knowledgeStyles.test.ts:23-27`(改前)只剥两类:`/\*[\s\S]*?\*\//g`(JS/CSS 块注释)+
`/^[ \t]*\/\/.*$/gm`(整行 `//` 行注释)。**未覆盖 HTML 注释 `<!-- -->`**——而 `.vue`
模板里的偏差申报注释一律是这一种。按协调者要求**没有另写一个 helper**,而是在既有函数上
补第三条 `.replace(/<!--[\s\S]*?-->/g, '')`(放在最前面剥,再剥 `/* */`、再剥 `//` 行注释)。
该函数唯一的既有调用点(`:34` 的 `const css = stripComments(rawSource)`,给 `knowledge.scss`
——一个纯 `.scss` 文件)不受影响:`.scss` 从不含 `<!-- -->`,新增的这行 `replace` 在那里恒为
空操作(全量三门跑绿、`knowledge.scss` 相关的全部既有断言数字不变,证实零回归)。
落地:`namedColorOffensesInValues` 的两个调用点(`KNOWLEDGE_VUE_FILES` 与
`COMPONENTS_VUE_FILES` 两个 describe 各一处)都改成
`stripColorCalls(stripComments(tmpl))`(先剥注释、再剥 `var()`/`color-mix()`)。
**`.vue` 模板里 HTML 注释与 JS/CSS 注释都要覆盖**——本仓 `.vue` 模板段唯一会出现的注释语法
就是 HTML 注释,`stripComments` 改动后三种语法全覆盖(HTML `<!-- -->` · JS/CSS 块注释
`/* */` · 整行 `//`),无遗漏语法档。

### 两头判据(探针形式做完即还原,未留成常驻用例——见下方"为什么不留常驻"）

选用 `src/ai/components/blocks/ConfirmCard.vue`(`cp` 备份 → `md5sum` 记录 →
行首锚定 `sed -i 'N a\...'` 注入 → `diff`/`md5sum` 先证注入落盘 → 跑对应用例 →
`cp` 备份覆盖还原 → `md5sum` 前后比对一致 · `git status`/`git diff` 干净)。

**判据①(不冤枉)**:在 `:79`(`{{ resolvedValue ? t('aiAccepted') : … }}`,已确认全仓唯一)
之后插入 `<!-- 蓝本 background: black,已换 --bg-sunken -->`。跑
`-t "ConfirmCard"`:
```
Test Files  1 passed (1)
     Tests  3 passed | 272 skipped (275)
```
三条(抽取/覆盖度、hex/rgb、具名色)全绿——那句散文注释不再被误判。

**判据②(仍有牙,关键的第二条)**:在同一份、**仍带着上面那条注释**的文件里,紧接着
再插入一行真违规 `<span style="color: white">probe</span>`(注释之外的真代码)。
再跑 `-t "ConfirmCard"`:
```
Tests  1 failed | 2 passed | 272 skipped (275)
FAIL … blocks/ConfirmCard.vue —— 模板内属性值位置…零具名色
AssertionError: … 发现具名色:
color: "> …
```
具名色测试精确报红(抽取/hex 两条仍绿)——证明剥注释没有把整个守卫一起剥废。

还原:`cp` 备份覆盖 → `md5sum` 前后一致(`832dc1f…` = `832dc1f…`)、
`git status --short` / `git diff` 该文件均干净。还原后重跑 `-t "ConfirmCard"`:
`3 passed | 272 skipped (275)`,恢复绿。

**为什么两条判据都以探针形式做完即还原、未留成常驻用例**:协调者的收尾要求只问"若不留,
说清为什么";理由是——① 这两条探针验证的是**测试基础设施本身**(`stripComments`/
`namedColorOffensesInValues` 的组合行为),不是某个具体产品文件应该长期满足的不变量,
留在 `ConfirmCard.vue` 里会把与该文件业务无关的注释/违规文本永久嵌进生产模板;
② 现有的 70+11 条具名色 `it.each` 已经是这套逻辑的常驻回归网(它们全部走
`stripColorCalls(stripComments(tmpl))` 这条新链路),任何未来把 `stripComments` 改回
不剥 HTML 注释的回归,会在**这些既有用例**上重新暴露(只要有人在真实模板里写申报注释就会
触发)——判别力已经在常驻断言里,不需要再额外常驻一份"专门验证剥注释行为"的用例。

### 三门(全量,`/tmp/p5d-t5-fix-{test,tsc,build}.log`)

```
pnpm test                  exit=0   Test Files 329 passed (329)  Tests 3839 passed (3839)
pnpm exec vue-tsc --noEmit exit=0
pnpm build                 exit=0(仅既有 >500KB chunk 警告)
```
算式:`3839 + 0 = 3839`(本轮零新增常驻用例——原因见上方"为什么不留常驻";两条判据均以
探针形式做完即还原)。文件数仍 **329**。

### 产品代码零改动自证

```
$ git status --short
 M src/ai/styles/knowledgeStyles.test.ts
$ git diff --stat
 src/ai/styles/knowledgeStyles.test.ts | 21 ++++++++++++++++-----
 1 file changed, 16 insertions(+), 5 deletions(-)
```
本轮唯一改动文件是 `knowledgeStyles.test.ts`(测试文件);`openInApp.ts` 与
`openInApp.test.ts` 均未再改动。

### 债务票 D-5(协调者已登记,本刀不动)

评审 Minor 2(`<style>` 块的具名色扫描仍是全仓缺口,`color-guard.test.ts` 只扫
hex/rgb/hsl)已由协调者登记为债务票 D-5,交 P5e/P5f。本期 `.vue` 按 K44 纪律零
`<style>` 块,不会咬到,本刀未做任何处理。

### 附:发现但未处理的一处平行风险(仅供协调者参考,未擅自处理)

既有的 hex/rgb/hsl 具名色测试(`it.each` 那条"模板内…零 hex / rgb / hsl 字面量",
本刀之前就有)同样只吃 `stripColorCalls(tmpl)`、未剥注释——协调者给的示例注释本身
(`rgba(255,149,0,.14)`)若真的原样出现在申报注释里,会被那条测试的
`/\b(rgba?|hsla?)\s*\(/` 命中而误报,风险性质与本轮修的问题完全一致。
**本轮严格按指令只改了 `namedColorOffensesInValues` 的调用点,未触碰这条 hex/rgb 测试**
(指令只点名前者,且"产品代码之外"的顺手扩大范围本身也需要协调者拍板)。是否需要同款处理,
留给协调者判断——如需要,改法与本轮完全一致(两处 `stripColorCalls(tmpl)` 各自套一层
`stripComments`)。

**【修复轮 2 追记】上面这条"平行风险"提得对,但协调者据此得出的结论(两条扫描都该剥注释)
是反的 —— 真正成立的结论是反过来的:「hex/rgb/hsl 测试不剥注释,是本档一贯且正确的口径」,
所以具名色测试也不该剥注释。详见下方「修复轮 2」。**

## 修复轮 2(回退)—— 具名色扫描恢复不剥注释(§0.3 明令注释也禁色字面量)

### 协调者的裁定:修复轮 1 的判断是错的

计划书 **§0.3 硬约束第 1 条原文**(协调者取证):
> 一切可见颜色必须是 `var(--…)`;禁 `#hex` / `rgb()` / `rgba()` / 具名色(`white`/`black` 也算);
> 禁 `theme-exception` 逃逸;**注释里也不许出现色字面量**。

**结论**:注释里出现 `background: black` 是**真阳性**(§0.3 明令禁止),不是「误报」。
修复轮 1 里我(实现者)与独立评审都把这个真阳性错判成假阳性,协调者又据此把"T6/T7/T8 的偏差
申报注释必然含色字面量"当理由把它升级成必修——**这个前提本身不成立**:协调者核实 T2
(`git show f128450 -- src/ai/styles/knowledge.scss`)的申报注释一律写「蓝本 `knowledge.scss:2060`」
「附录 B §B.1 是权威」「alpha 沿用蓝本 0.3/0.24」——**引 file:line 与附录行号,不写色字面量**,
且顺利通过了不剥注释的 hex/rgb 扫描。**T5 提出的"平行风险"(既有 hex/rgb/hsl 扫描同样不剥
注释)恰恰是发现这个错误裁定的线索**:那条一直不剥注释的扫描不是遗漏,是本档一贯且正确的口径。

### 回退内容

1. 两个 `namedColorOffensesInValues` 调用点(`KNOWLEDGE_VUE_FILES` 与 `COMPONENTS_VUE_FILES`
   两个 describe 各一处)的 `stripColorCalls(stripComments(tmpl))` 改回
   `stripColorCalls(tmpl)`,与既有 hex/rgb/hsl 扫描口径一致。
2. `stripComments` 里修复轮 1 新加的第三档 `.replace(/<!--[\s\S]*?-->/g, '')` 与配套文件头注释
   一并删除——回退后它零调用点,留着是死代码(同 T5 明令不许补 `openNoteInNewTab` 的道理一致)。
3. 逐字核对:`git diff 11ad79b -- src/ai/styles/knowledgeStyles.test.ts` **为空**
   (`git diff 11ad79b..HEAD` 需在本轮提交后核,提交前先核工作树对 `11ad79b` 为空,已确认)。

### 两头判据(还原纪律同上:`cp` 备份 → 行首锚定注入 → 先证落盘 → `cp` 覆盖 → `md5sum` 比对)

复用同一份 `ConfirmCard.vue`(`:79` 锚点,全仓唯一)。

**判据①(真阳性恢复,与回退前相反)**:注入
`<!-- 蓝本 background: black,已换 --bg-sunken -->`(注释内,不带任何注释外违规)。
```
Tests  1 failed | 2 passed | 272 skipped (275)
FAIL … blocks/ConfirmCard.vue —— 模板内属性值位置…零具名色
AssertionError: … 发现具名色:
color: "> …
```
**必须报红,且确实报红**——与修复轮 1(同一条注入,当时报绿)结果相反,证明 §0.3 的行为
（注释也扫)已经恢复。

**判据②(仍有牙)**:还原后,改注入注释外的真违规
`<span style="color: white">probe</span>`(不带注释)。
```
Tests  1 failed | 2 passed | 272 skipped (275)
FAIL … blocks/ConfirmCard.vue —— 模板内属性值位置…零具名色
AssertionError: … 发现具名色:
color: "> …
```
仍然精确报红——证明回退后守卫对真实产品违规依旧有判别力(不是"退步到全瞎")。

⚠️ **两次报错的 offender 文本形态相同**(`color: "> …` 这个看起来与注入内容不直接对应的长
片段)——这是 `namedColorOffensesInValues` 里 `[^;]+` 值捕获本身就有的既有特征(修复轮 1 的
探针里已出现过同款现象),与本轮回退无关:`ConfirmCard.vue` 里有些 `style="…"` 属性的最后一条
声明没有跟随的 `;`,值捕获会一路扫到**下一个真实分号**为止(可能跨越好几个标签),把中途任何
文本(含我们的注入)都吞进同一个"值"里一起判定。**这不影响判据的正确性**(两次都正确检测到
注入带来的具名色、都精确指名 `ConfirmCard.vue` 报红),只是 offender 的展示片段较长、不总是
从注入点本身开始——不在本轮回退的修改范围内,不处理。

还原:`cp` 备份覆盖 → `md5sum` 前后一致(`832dc1f…` = `832dc1f…`)、
`git status --short` / `git diff` 该文件均干净。

### 给 T6/T7/T8 的可直接引用结论

> **§0.3 明令注释里也不许出现色字面量。** 迁移时的偏差申报注释一律**引「蓝本 `file:line`」
> 与「附录 B 行号」**,**禁在注释里写 `#hex` / `rgb()` / `rgba()` / 具名色**。T2(`f128450`)
> 已按此做且通过不剥注释的扫描,是可照抄的先例。具名色与 hex/rgb/hsl 两条扫描**都不剥
> 注释,这是有意为之**,不是遗漏。

### 逐字节自证

```
$ git diff 11ad79b -- src/ai/styles/knowledgeStyles.test.ts   # 提交前,工作树 vs 11ad79b
(空输出,exit=0)
```
提交后同等价的核法是 `git diff 11ad79b..HEAD -- src/ai/styles/knowledgeStyles.test.ts`(同样应为空)。

### 三门(全量,`/tmp/p5d-t5-fix2-{test,tsc,build}.log`)

```
pnpm test                  exit=0   Test Files 329 passed (329)  Tests 3839 passed (3839)
pnpm exec vue-tsc --noEmit exit=0
pnpm build                 exit=0(仅既有 >500KB chunk 警告)
```
与修复轮 1 之前(`11ad79b`)完全一致的数字:329 / 3839 / 0 / 0。

### 产品代码零改动自证

```
$ git status --short
 M src/ai/styles/knowledgeStyles.test.ts
```
本轮唯一改动文件仍是 `knowledgeStyles.test.ts`(测试文件),且内容已回退到与 `11ad79b`
逐字节一致;`openInApp.ts` / `openInApp.test.ts` 未再改动。

### 遗留 NEEDS_CONTEXT

无。回退按协调者裁定逐字执行,未发现需要偏离该裁定的理由。

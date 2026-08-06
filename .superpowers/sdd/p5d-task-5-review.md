# P5d · T5 独立评审报告 —— `openInApp.ts` 补两函数 + 票 3 守卫债

评审范围:`review-cb73071..11ad79b.diff`(BASE `cb73071` → HEAD `11ad79b`)。
全部结论均为评审者自跑复核,未采信实现者报告的任何断言。

## 两个独立判定

1. **规格符合(§T5 1–8 条)**:✅ 全部符合。
2. **任务质量**:**通过**,附一条 Minor 级发现(见下)。

## 第一必查项 —— 232 条新增用例的构成

**精确复核**(独立 diff/grep/vitest 得出,非采信报告):
- `openInApp.test.ts` +10:`openDirInNewTab` 3 条(正常/空串/null-undefined)+
  `agentSessionUrl`/`openAgentSessionInNewTab` 7 条(正向、反向、特殊字符编码、
  `window.open` 调用断言、调用反向断言、空串早退、null/undefined 早退)。
- `knowledgeStyles.test.ts` +222:既有 `KNOWLEDGE_VUE_FILES`(11 个文件,`sed` 逐一
  数过)新增具名色 it.each 11 条 + `COMPONENTS_VUE_FILES` 新 describe 块
  (`find src/ai/components -name "*.vue" | wc -l` 实测 **70**,与常量数组逐项核对
  相符):文件清单相等 1 + 抽取/覆盖度 70 + hex/rgb/hsl 70 + 具名色 70 = 211。
  11 + 211 = 222。10 + 222 = 232。`3607 + 232 = 3839` —— 全量 `pnpm test` 独立复跑
  结果 **Test Files 329 passed / Tests 3839 passed**,逐位吻合。

**抽样 RED 探针(自选 3 个 `src/ai/components/**` 文件,含两个"当前零颜色声明"的
文件,以检验空壳是否连"未来牙口"都没有)**:
- `blocks/ConfirmCard.vue`(该文件模板里本来就有大量 `color:`/`background:`
  内联样式)、`icons/AgentIcon.vue`(该文件模板**零** `style=` 属性)、
  `blocks/TerminalCard.vue`(该文件模板**零** `style=` 属性)。
- 手法:`cp` 备份 → 在 `<template>` 开标签行之后锚定插入
  `<div style="color: white">RED_PROBE</div>` → `sed -n` 核对确已落盘 →
  `pnpm exec vitest run … -t "具名色"` → **3 个文件全部报红**(含两个零样式属性
  的文件)→ `cp` 备份覆盖还原 → `md5sum` 逐字节比对三文件前后一致
  (`832dc1f…`/`0322273…`/`cabb71d…` 三对分别相等)→ `git status --short`/
  `git diff --stat` 该三文件干净 → 重跑同一条命令确认恢复绿(**82 passed**)。

**空壳判断**:用 `grep` 精确分类 70 个组件文件 —— **25 个文件的模板里本来就有
`color:`/`background:`/`border:` 等真实内联样式声明**(如 `SemanticSearchCard.vue`
`scoreColor()`/`kindColor()` 动态背景色、`ConfirmCard.vue`/`PermissionRequestCard.vue`
的按钮内联色等),**45 个文件当前模板零任何 `style=` 属性或零颜色相关属性**——
这 45 个文件的"具名色"这一档用例目前是**空壳**(搜索域为空,自动通过)。
但 RED 探针证明:即便是这 45 个"空壳"文件之一(`AgentIcon.vue`/`TerminalCard.vue`),
**注入违规后照样报红**——因为扫描逻辑是运行时对文件内容做正则匹配,不是针对
当前内容的快照断言。**结论:这 232 条里,约 70 条(45 个组件的具名色档 + 少量
knowledge 侧同类)是「当前空壳」,但全部具备「未来牙口」(将来任何人在这些文件的
`<template>` 里加具名色内联样式,守卫会立刻报红)**——不是「连未来也报不出来的
真空壳」。这类空壳是本档"按文件参数化守卫"的固有代价,不是本刀实现缺陷。

⚠️ **需要指出的架构局限(见下方 Minor 发现)**:这套 ③′ 守卫**只扫 `<template>`
块**(`extractTemplate` 只取 `<template>...</template>` 之间的内容),**不扫
`<style>` 块**——`<style>` 块的具名色扫描由全仓 `color-guard.test.ts` 负责,但
**该守卫至今仍只扫 hex/rgb/hsl,完全不扫具名色**(已用 `Read` 核实
`src/styles/color-guard.test.ts` 全文,`HEX`/`FUNC` 两个正则,无具名色逻辑)。
即:**`<style>` 块里的 `color: white` 这类真实违规,本刀的两条守卫谁都不扫**——
票 3 的字面范围(治理 §15.3、brief §16)明确写的是「中央 ③′ 守卫扩到
`src/ai/components/**`」,③′ 本来就是模板扫描器,本刀严格照办没有越权,
**但这意味着"具名色扫描"这张票在 `<style>` 块维度上仍是缺口**,应登记交接,
不算本刀缺陷(本刀范围界定清楚且被诚实执行)。

## 具名色守卫两头 + 自加易冤枉写法

- **① `color: white` 必须报红**:上面 3 文件 RED 探针已证,报红。
- **② `QueueView.vue:474` 的 `white-space: nowrap` 必须不报红**:未做任何修改,
  直接跑 `pnpm exec vitest run … -t "QueueView" --reporter=verbose`,三条断言
  (抽取/覆盖度、hex-rgb-hsl、具名色)**全部 `✓` 通过**,`md5sum` 确认该文件本评审
  全程零改动(`ff6bd0da032bf62d888f105decd5f4f3`)。
- **自加易冤枉写法**(用与生产测试逐字同构的独立脚本 `/tmp/.../probe.mjs` 跑纯函数
  逻辑,不碰仓库文件):
  - `border-left: 1px solid var(--line);` → **clean**(var() 剥离生效)。
  - `background-image: url(whitepaper.png);` → **clean**(`background-image` 不在
    `COLOR_VALUE_PROPS` 名单里,不会被切到;即使被切到,值里的 "whitepaper" 也不会
    被整词匹配命中)。
  - `<div class="icon-white-bg"> white comment here -->` → **clean**(没有
    `prop:` 前缀,正则不切)。
  - `border: 1px solid whitesmoke;` → **clean**(整词边界排除复合词)。
  - `grayscale(1)` → **clean**。
  - **发现一处假阳性**:`<!-- background: black in a comment, not real CSS -->`
    → **被 FLAGGED**(误报)。原因:`namedColorOffensesInValues` 直接对整个
    `<template>` 文本做正则扫描,**没有先剥离 HTML 注释 `<!-- -->`**,只要注释里
    出现「`background:`/`color:` 等 + 后接具名色词」的散文措辞就会被当成真实 CSS
    声明误报。**目前 81 个受测文件(11 knowledge + 70 components)里未出现这种写法**
    (已用 `grep -rn "<!--"` 核实零命中,不是当前失败,是潜在脆弱点)。
    **判为 Minor**(见下方发现清单)。

## `agentSessionUrl` / `openAgentSessionInNewTab` 落点与判别力

- 指向 `/#/ai/agent?session=…`(无 `/app` 前缀),申报注释与 `photosAssetUrl`
  同款,`git diff` 逐行核对确认(`openInApp.ts:111-120` 注释 + `:121-127` 两个导出)。
- **`/app` 前缀统一变异复现**(`cp` 备份 → md5 `248a87546f72aefdc75d108114f3f719`
  → `Edit` 把 `return '/#/ai/agent?session=' + …` 改成
  `'/app/#/ai/agent?session=' + …` → 跑 `openInApp.test.ts -t agentSessionUrl`):
  **5 条全部失败**,含:①正向断言(`builds a URL pointing at the OLD Vue2 app`)、
  ②反向断言(`does NOT point at the New-UI-mounted equivalent`)、③特殊字符编码断言、
  ④ `toHaveBeenCalledWith` 形式、⑤ `openAgentSessionInNewTab` 的反向断言。
  **正向 + 反向两侧都报红,判别力确认成立**。`cp` 覆盖还原 → md5 前后一致
  → `git status --short`/`git diff --stat` 干净 → 重跑 `openInApp.test.ts` 全量
  **33 passed**。
- `!dirPath`/`!sessionId` 早退两侧用例齐全(`openDirInNewTab`/`openAgentSessionInNewTab`
  各自的空串 + null/undefined 用例,`window.open` 断言不被调用)——diff 里逐条可见。

## 「70 文件零既有违规」独立复核

**独立复核结论:成立。** `find src/ai/components -name "*.vue" | wc -l` 实测 **70**,
与 `COMPONENTS_VUE_FILES` 常量数组逐项一致(文件清单相等断言本身也在全量测试里
通过,329/3839 全绿印证)。独立跑 `pnpm test`(未做任何修改的干净树)结果 **exit=0,
329 passed / 3839 passed**,其中包含全部 70×3+1=211 条 components 相关断言,
**无一条失败**——证实当前 70 个文件在(模板内联样式位置的)hex/rgb/hsl/具名色
三个维度上确无既有违规。**未触发 NEEDS_CONTEXT 是正确处置。**

## 其余逐条核验(§T5 1–8)

1. `openDirInNewTab` 逐字照抄蓝本 `openInApp.js:52-55`(已用
   `git -C NimoOS-UI show 7a6ee6b7:.../openInApp.js` 取原文比对,`if (!dirPath) return;
   window.open(filesPathUrl(dirPath, ''), '_blank')` 逻辑完全一致,仅 `filesPathUrl`
   落点用本仓既有实现)—— 符合。
2. `agentSessionUrl`/`openAgentSessionInNewTab` 逐字照抄蓝本 `:117-124`,按裁定 A-8
   指向无 `/app` 前缀落点,申报注释齐全 —— 符合。
3. 早退两侧用例齐全 —— 符合(见上)。
4. `openNoteInNewTab` 未补:`grep -rn "openNoteInNewTab" src/` **零命中** —— 符合。
5. 票 A-8 已开(报告 §5,原文完整、指向明确的 New-UI Agent `?session=` 深链缺口)
   —— 符合。
6. 具名色扫描钉在属性值位置,RED+反向两头都验证成立 —— 符合(见上,附带一条
   Minor 级注释未剥离的脆弱点)。
7. 覆盖范围扩到 `src/ai/components/**`,70 文件零既有违规,独立复核成立,未触发
   NEEDS_CONTEXT 且这一处置正确 —— 符合。
8. `src/` 下非测试文件零改动(除 `openInApp.ts`):`git diff --name-only
   cb73071..11ad79b -- src/ | grep -v '\.test\.ts$'` 只输出
   `src/ai/services/openInApp.ts` 一行 —— 符合。`git diff --stat` 该文件
   **+27/-0**,纯新增(两段新导出 + 申报注释),既有 7 个导出逐字未动
   (`git diff` 无 `-` 行落在原有导出区间)—— 符合。

## 三门(独立复跑,非采信)

```
pnpm test                  exit=0   Test Files 329 passed (329)   Tests 3839 passed (3839)
pnpm exec vue-tsc --noEmit exit=0
pnpm build                 exit=0(仅既有 >500KB chunk 警告,无新增警告)
```
算式 `3607 + 232 = 3839` 核实一致。`find src -name "*.vue" | wc -f` = **180**,
文件数（`git status --short` 干净,零新建文件,与报告「仍 329」一致)。
`git rev-parse HEAD` = `11ad79b611db8156f78443cf6b5e88a4c2715af9`,`git status --short`
评审全程结束后为空。

## 发现(按严重度)

- **Minor** —— `src/ai/styles/knowledgeStyles.test.ts` 新增的
  `namedColorOffensesInValues()`(约 `:1150-1165` 一带,新增函数)对整段
  `<template>` 文本做正则扫描前**未剥离 HTML 注释 `<!-- -->`**,若模板注释里出现
  「`background:`/`color:` 等词 + 具名色措辞」的散文描述会被误判为真实 CSS 违规。
  当前 81 个受测文件(11 knowledge + 70 components)用
  `grep -rn "<!--" <dir> --include="*.vue" | grep -iE "color\s*:|background\s*:|border\s*:|fill\s*:|stroke\s*:|shadow\s*:"`
  核实**零命中**,不是本刀的失败,是潜在脆弱点。复现:见上文
  `/tmp/.../probe.mjs` 的第 5 个用例
  (`<!-- background: black in a comment, not real CSS --> → FLAGGED`)。
  建议登记交接,下次改这个函数时补一步注释剥离(或在正则前加 HTML 注释剥离,
  与 `stripColorCalls` 同款「先剥离再扫描」的既有手法一致)。

- **Minor**(架构局限,非缺陷,登记以防误解)—— 票 3a 具名色扫描仅覆盖
  `<template>` 内联 `style=`/`:style=` 属性值,`<style>` 块的具名色扫描仍是
  全仓缺口(`color-guard.test.ts` 只扫 hex/rgb/hsl,不扫具名色,已读全文确认)。
  这是票 3 在 brief/治理字面范围内的正确执行(③′ 本来就是模板扫描器),但
  「具名色扫描」这张票整体在 `<style>` 维度仍未闭合,应向 P5e/P5f 明确交接
  （若尚未交接)。

## 无法核验项

- 无。本刀范围小(1 个产品文件 + 2 个测试文件),三门、diff、md5、RED/反向探针
  均已独立复现,未发现需要 NEEDS_CONTEXT 升级的问题。

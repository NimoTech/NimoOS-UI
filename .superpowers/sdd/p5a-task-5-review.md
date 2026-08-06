# SP8-P5a Task 5 独立评审 —— 路由 + 占位页 + 占位机制

评审范围:commit `5644ed8`(父 `76367d2`),分支 `sp8-ai`,工作目录 `.sp8/NimoOS-New-UI`。
纪律声明:未采信实现者报告的任何数字/结论,全部自跑/自 grep 复核;未提交任何改动;RED 探针与 TS2345
验证均已精确还原(`git status --short` 干净)。

## A. 路由正确性

**蓝本权威读取**(`git -C NimoOS-UI show main:src/router/route.js`,非工作树):

```
{ path: '',          name: 'KnowledgeDashboard', ... }
{ path: 'search',        name: 'KnowledgeSearch' }
{ path: 'wiki',          name: 'KnowledgeWiki' }
{ path: 'indexed-files', name: 'KnowledgeIndexedFiles' }
{ path: 'queue',         name: 'KnowledgeQueue' }
{ path: 'roots',     name: 'KnowledgeRoots' }
{ path: 'allowlist', name: 'KnowledgeAllowlist' }
{ path: 'notes',     name: 'KnowledgeNotes' }
{ path: 'settings',  name: 'KnowledgeSettings' }
```
+ `/ai/parser`→`AIParser`、`/ai/parser/test`→`AIParserTest`。

`knowledgeRoutes.ts` 逐条比对:**path 顺序、name 逐字、component 全部 === `KnowledgeDeferred`** —
11/11 全部吻合,包括容易出错的 `wiki` 在 `search` 之后、`notes` 在 `allowlist` 之后两处顺序陷阱。

- **A2 `router/index.ts` 足迹**:`git diff 76367d2..5644ed8 -- src/router/index.ts` 只有 +2 行
  (`import { knowledgeRoutes } ...` + `...knowledgeRoutes,`),没有动其它任何行。插入点确认在
  `/ai/settings` 之后、`/login` 之前,符合 brief。
- **A4 深链**:`src/router/index.test.ts` 新增用例断言 `router.getRoutes()` 含
  `/ai/knowledge`、`/ai/knowledge/notes`、`/ai/parser/test`,全量测试跑通,自己也用探针 2 验证过它有判别力。
- **A5 冲突检查**:自己 grep 了本仓 `router/index.ts` 现有全部 15 条既有路由的 name/path,与新 11 个
  PascalCase name 及对应 path 无一重复;全仓 grep `KnowledgeDashboard`/`AIParser` 等 11 个 name 字符串,
  命中仅在 `src/ai/knowledge/` 目录内(即本次新增本身),无外部重复定义。**无冲突**。

## B. 占位机制

- `DEFERRED_TABS` = 除 `dashboard` 外的 8 个,`KnowledgeTabId` 9 个成员与 9 个子路由一一对应,核对无误。
- `isDeferred` 实测读 `DEFERRED_TABS`(见下方独立 RED 探针——恒真改造后两条用例精确报红,证明它不是恒定实现)。
- `KnowledgeDeferred.vue`:零 `<style>` 块(diff 全文确认无 `<style>` 标签)。用到的 6 个类
  (`k-scroll`/`k-scroll-inner`/`k-empty`/`k-empty-illust`/`k-empty-title`/`k-empty-sub`)已自己
  `grep -n` 确认在 `src/ai/styles/knowledge.scss` 全部真实存在(420/426/434/440/456/457 行)。
  ⚠️ 待协调者裁定(非本任务缺陷):附录 D 的 CSS 白名单(T4/T11 负责的 32+65 类)未列出 `k-empty*`
  这组类,而 brief Step 4 原文明确指示复用 `.k-empty*`——这些类实测确实已在 `knowledge.scss` 里
  (由更早的 T1-T4 提交落地),本任务只是消费者,不是缺陷,但附录 D 文档本身有遗漏,建议协调者后续补记。

## C. i18n(R6)

- `grep -c aiKb` 两个语言包各为 2(仅本次新增两条,之前为 0——`git show 76367d2:src/i18n/{zh_cn,en_us}.ts`
  确认零命中),且各只出现一次(无重复属性)。
- **逐码点比对方法**:写小脚本用正则从两个文件提取 `aiKbDeferredTitle`/`aiKbDeferredHint` 的字符串字面量,
  与期望值做 `===` 比较,再对每个字符 `codePointAt(0)` 打印十六进制序列人工核对。
  结果:4/4 全部 `MATCH`。
  `aiKbDeferredHint` 中文值末尾码点为 `3002`(中文句号「。」,非 ASCII `2e`/全角变体),
  英文值末尾码点为 `2e`(ASCII 句点)。`aiKbDeferredTitle` 两档均无多余空格(首尾码点核对过)。
- 值中无字面 `@`,无需 `{'@'}` 转义;`parity.test.ts`/`messageSyntax.test.ts` 在全量测试中全绿。
- 附录 A(108/109 行)与两个文件里的值逐字一致。

## D. 测试质量

- **D13**「11 条路由 component 全部 === `KnowledgeDeferred`」这条主动加的断言:读了代码,`toBe(c, KnowledgeDeferred)`
  用真实导入的组件引用比较（非字符串/类型名比较），T12 一旦把 `''` 换成 `DashboardView` 会精确报红。判断有效。
- **D14** `router/index.test.ts` 新增用例:已用实现者探针 2 的方式复核逻辑(注释掉 spread 行 → 3 个 path 断言
  全部找不到 → 精确报红),逻辑成立。
- **D15** `git diff 76367d2..5644ed8 -- src/router/index.test.ts` 只有 `+` 行(新增一个 `it` 块),
  未删改既有两条断言(`/files/shares`、`/files/NimoOS-HD/Documents` 两条用例原样保留)。
- **D16 TS2345 核实**:把 `deferred.test.ts` 里的 `(DEFERRED_TABS as readonly string[]).includes(notListed)`
  改回 brief 原文 `DEFERRED_TABS.includes(notListed)`,跑 `pnpm exec vue-tsc --noEmit`——
  **确实报错**:`error TS2345: Argument of type '"dashboard"' is not assignable to parameter of type
  '"search" | "settings" | ... | "notes"'`（`deferred.test.ts:24:35`）。已还原,`git diff --stat` 确认无残留。
  **断言力核实**:`as readonly string[]` 只是类型层面 widen,运行时仍调用同一个真实数组的
  `Array.prototype.includes`,与 `isDeferred` 内部实现同款写法,**断言力未下降**——该用例的意图
  「`isDeferred` 判定来源是 `DEFERRED_TABS` 本身」仍然成立(我的独立 RED 探针也证明了这点:把
  `isDeferred` 改成恒真后,这条用例精确报红)。判定:**合理的测试代码修正,非实现让步**。

## E. 独立 RED 探针(未复用实现者的两次)

**破坏**:`src/ai/knowledge/deferred.ts` 第 27-29 行
```
- return (DEFERRED_TABS as readonly string[]).includes(id)
+ return true   // 恒真
```
**跑 `pnpm test src/ai/knowledge/deferred.test.ts`**:2/3 用例精确报红——
- `占位机制(K7) > P5a 只实现 dashboard,其余 8 个 tab 挂占位`(`isDeferred('dashboard')` 期望 `false` 收到 `true`)
- `占位机制(K7) > isDeferred 的判定来源是 DEFERRED_TABS 本身`(同上)

**已还原**:`cp` 回原文件,`git status --short` 干净,复跑该测试文件 3/3 转绿。

## F. 三门与卫生

自跑结果(全量,未截断):
```
pnpm test                  exit=0   Test Files 307 passed (307)   Tests 2742 passed (2742)
pnpm exec vue-tsc --noEmit exit=0   (无输出)
```
与实现者报告的 307/2742 一致,且本次全绿,未触发任何已知噪声用例(`persist.test.ts`/`AgentComposer.test.ts`)。
`pnpm build` 未重跑(治理文件允许:实现者已跑过 exit 0,本任务未改任何构建相关内容)。

**提交卫生**:`git show --stat 5644ed8` 只含 9 个文件(5 新建 + `router/index.ts` + `router/index.test.ts`
+ 两个语言包),与报告一致。`git status --short` 干净。`NimoOS-UI`(只读蓝本仓,`git log -1` 仍是
`f6859134`,未受影响,唯一 untracked 文件 `FRONTEND_API_GUIDE.md` 与本任务无关、未碰)与
`.sp8/NimoOS-Service`(`git log` 最新是 T1/T2 的 wiki/notes 提交,均在 T5 之前,T5 本身未在 Service
仓产生任何新提交)均确认干净。

**§3.5 8 条「照抄不改」**:本任务不涉及数据契约/后端字段逻辑,报告称「无命中项」,自己复核 diff 全文
（路由表 + 占位页 + i18n + 测试)确认无 N1-N8 相关代码,**属实**。

## 结论

- **Spec 合规**:✅
- **任务质量**:通过
- 未发现 Critical/Important 级缺陷。

## 授权偏离核对(§2/§3 三件套)

1. name 用蓝本 PascalCase——已在 `knowledgeRoutes.ts` 顶部注释申报,报告里也列出。✅
2. component eager import——已在注释与报告申报。✅
3. 不照抄 Vue2 meta/`hidden`——已在注释与报告申报。✅
4. R6 两条 i18n 键提前由 T5 落地——已在报告与语言包注释块标注。✅
5. 布局路由自身 component 暂指 `KnowledgeDeferred`(brief 未明说这点,实现者自行决定并申报)——
   合理的临时占位,T10 落地 `KnowledgeLayout.vue` 后会替换,不影响功能(该布局组件目前无
   `<router-view>`,子路由暂不会嵌套渲染,但因子路由组件同样是 `KnowledgeDeferred`,视觉无差异,
   不构成缺陷)。
6. TS2345 测试代码修正——见 D16,已验证真实存在且断言力未降。✅

## ⚠️ 待协调者裁定

- 附录 D CSS 白名单未列出本任务使用的 `k-empty*` 类组(`k-empty`/`k-empty-illust`/`k-empty-title`/
  `k-empty-sub`)。这些类已确认真实存在于 `knowledge.scss`(T1-T4 落地),brief Step 4 原文明确指示
  使用它们,本任务只是消费方,**不算 T5 的缺陷**,但建议协调者后续把这组类补进附录 D 文档,避免后续
  任务(T10/T11 等)对"白名单穷尽"产生误解。

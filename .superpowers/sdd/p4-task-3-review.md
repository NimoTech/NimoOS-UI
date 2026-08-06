# SP8-P4 Task 3 评审 —— 错误映射 `mcpErrorKey.ts`

评审者:独立复核,未采信实现者报告的任何结论,自行回源、自行跑测试、自行设计 RED 探针。

## 判定

1. **规范符合(Spec)**:✅
2. **任务质量(Quality)**:通过

## 后端错误串穷举复核(自己 grep 权威源,非抄计划)

- `NimoOS-AI/route/v2/mcp.go`:400 三条在 `:277`(url required for http/sse)、`:282`(command required for stdio)、`:286`(transport must be...);404 "mcp server not found" 实测 **5 处**:`:152,168,186,332,441`(任务书只列 152/187/332 且 187 抄错,应为 186);502 `agent unreachable` 在 `:351`,`c.JSON` 直出、不经 `echo.NewHTTPError`。
- `pkg/mcpparse/mcpparse.go`:`errors.New` 恰 5 处,`:36,47,62,76,138`,与实现/任务书一致,未发现遗漏分支。
- `agent/mcp_client/client.py`:`error_key` 恰 4 值,`:437,448,453,456`,与实现一致。
- **echo 默认错误处理器确认**:`labstack/echo/v4@v4.12.0/echo.go:417` 起的 `DefaultHTTPErrorHandler` 用 `{"message": ...}` 包体,本仓未见自定义 `HTTPErrorHandler` 覆盖(grep 全库为空)——证实 `rawMessage()` 读 `data.message` 的假设成立,不是臆测。
- **报告对任务书行号错误的申报核实无误**:404 行号确实是 `187`→应为`186`(抄错)+ 遗漏 `168`/`441`(同串,不影响映射,已在文件头注释里如实标注,未沿用错误行号)。
- 结论:映射表**无遗漏**——三条 400、五处 404 同一串、502、五条 parse、四个 error_key 全部命中,兜底覆盖其余。

## 兜底穷举验证(独立构造后端可能返回但未被列出的形状)

自建临时探针文件 `mcpErrorKey.scratch.test.ts`(验证后已删除,`git status` 干净,不计入提交):
- 裸字符串 body(非 `{message}`/`{detail}` 包裹)→ 不匹配任何键,落兜底,**不含**原文关键词。
- 数组 body → 不匹配任何键,落兜底,不泄漏。
- `error_key: null` → 落 `toTestView` 默认分支,`error` 字段(`'LEAKED'`)未进入返回值。
- 502 但 body 是非 JSON 字符串(模拟真实网关级 502,非应用层 `{ok:false,error:'agent unreachable'}`)→ `toTestViewFromError` 仅按 `status===502` 判定,不读 body,仍安全返回 `agentDown`,无泄漏。
- 五个探针**全部通过**,证明兜底确实兜住。

**但这四种形状(裸字符串体、数组体、`error_key:null`、502+非常规 body)在正式测试文件 `mcpErrorKey.test.ts` 里完全没有对应用例** —— 只是恰好因为 `typeof x === 'object'` / `Array.isArray` 等类型防御顺带兜住,不是设计出来被断言钉住的。按公共约束 §11 与任务书要求的"未覆盖就是 Important"标准,判定为 **Important(测试覆盖缺口,非功能缺陷)**。

## 优先级/互斥复核

- `no command (only environment variables)` 与 `no command after parsing`/`no command after '--'` 均用 `===` 相等匹配(非 `startsWith`),源码本身无前缀抢占风险 —— 复核通过。
- `saveServerErrorKey` 与 `toTestViewFromError` 对 `mcp server not found` 口径一致(都返回 `aiMcpSrvErrNotFound`),复核通过(见下方 RED 探针 1)。

## RED 探针(全部执行、全部精确还原,`git status` 干净)

**探针 1(评审者独立设计,非复述报告)**:把 `saveServerErrorKey` 里 `if (s === 'mcp server not found')` 的字符串误改成 `'mcp servers not found'`。
- RED:`1 failed`,精确命中 `saveServerErrorKey —— 后端 validateAndClean 的三条 400 > 404 mcp server not found`(`expected 'aiCfgSaveFailed' to be 'aiMcpSrvErrNotFound'`),其余 28 条不受影响。
- 还原后:`Tests 29 passed (29)`,`git status --short` 无输出。

**探针 2(独立验证报告 Step5 解释是否成立)**:先按 brief 原样删除 `parseCommandErrorKey` 的 OnlyEnv 分支 → 复现报告所述:只有「独立的键」1 条报红,「不能被抢走」的 `not.toBe` 断言对"整支删除"这种破坏方式确实没有判别力(结果落进了另一个 `≠ NoCommand` 的兜底键,天然满足 `not.toBe`)。随后**换一种破坏方式**独立验证该断言并非全局空转:改成 `if (s.startsWith('no command')) return 'aiMcpSrvParseErrNoCommand'` 放在 OnlyEnv 检查之前(即注释描述的真实"抢占"缺陷)→ 此时**两条测试同时报红**,包括之前那条 `not.toBe`(`expected 'aiMcpSrvParseErrNoCommand' not to be 'aiMcpSrvParseErrNoCommand'`)。
- 结论:报告的解释成立且如实——该 `not.toBe` 断言对"抢占类"缺陷（它本来要防的那种)有效,只是对"整支删除"这一种特定破坏方式无判别力;两种缺陷模式合起来看,测试套件整体无覆盖盲区,**不构成空转用例**,不追加发现。
- 全部还原后:`Tests 29 passed (29)`,`git status --short` 无输出。

## 其它检查

- 提交 `39f7e449` `git show --stat` 只含 `mcpErrorKey.ts` + `mcpErrorKey.test.ts` 两个新文件,无关文件零改动。
- 纯函数无 `vue-i18n` import,调用方 `t()`(grep 确认文件内无 `useI18n`/`vue-i18n` 引用)。
- `McpTestView` 类型(`src/ai/types/mcpServer.ts:94-96`)与实现返回形状逐字段一致。
- `detail` 非字符串归一 `''`(含嵌套对象)有专门用例覆盖,复核通过。
- i18n:本任务不产出键,`aiCfgSaveFailed` 复用现有键(grep 确认 `zh_cn.ts:1039`/`en_us.ts:1027` 已存在),未新增、未冲突。
- §3.5"照抄不改"5 条与本任务范围无关,未见顺手修正。

## 发现汇总

- **Important**:裸字符串 body / 数组 body / `error_key: null` / 502+非常规 body 四种"后端可能返回但映射表未列"的形状,当前虽然安全(靠 `typeof`/`Array.isArray` 类型防御兜住,评审已用独立探针验证无泄漏),但**没有被 `mcpErrorKey.test.ts` 的任何用例覆盖**,属于任务书"构造后端可能返回但映射表没列的形状"这条硬性检查项要求覆盖而未覆盖的情形。建议补 4-5 条用例把这份安全性钉死,防止未来重构（例如误加 `String(data)` 兜底)悄悄捅破。

无 Critical 发现。

## 自己实测的三门数字

```
pnpm test:                  Test Files 298 passed (298) / Tests 2612 passed (2612), exit=0
pnpm exec vue-tsc --noEmit: exit=0(无输出)
pnpm build:                 exit=0,仅 >500KB chunk 警告(许可范围内)
```
与报告数字一致,无红项。

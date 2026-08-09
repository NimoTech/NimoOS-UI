# SP14 全支评审修复轮 —— 最终报告

范围:全支评审逮到的 8 条 finding,一次修完,三个 commit。全部命令在
`/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/ai-catchup` 跑出,分支 `sp14-ai-catchup`。

## 一、finding 1(超时注释数字漂移)—— 真实后端值取证

```
grep -n "25 \* time.Second\|100 \* time.Second\|timeout := " NimoOS-AI/route/v2/mcp.go
344:	timeout := 25 * time.Second // > Python TEST_TIMEOUT(20s), so Python cancels and frees first
346:	timeout = 100 * time.Second // stdio first npx/uvx download is slow; > Python STDIO_TEST_TIMEOUT(90s)

grep -n "TEST_TIMEOUT = 20\|STDIO_TEST_TIMEOUT = 90" NimoOS-AI/agent/mcp_client/client.py
738:TEST_TIMEOUT = 20
739:STDIO_TEST_TIMEOUT = 90
```

`NimoOS-AI` `git log -1`:`c15e47cafd6af59075f9673f09613a03242dc665`,`2026-08-06 20:24:29 -0700`。

原注释写的「Go 代理 43s(http)/125s(stdio)」是错的,真实值是 **25s / 100s**;Python 端行号确认为
`client.py:738-739`。不等式 `135000 > 100000 > 90000` 仍然成立,常量 `135000` 不用改,只重写了注释:
先写不变量(axios 必须大于 Go 的 stdio 上限,Go 的 stdio 上限必须大于 Python 的 stdio 上限),再把
具体数字标成「NimoOS-AI main@c15e47c(2026-08-06)时点快照,两仓独立发版会漂,不是契约」。
`packages/service/src/ai.ts` 与设计文档 §3.4 两处都改了。

## 二、finding 2(#141 不可验)—— grep 结果

```
grep -rn "protocol_era\|protocol_version\|supported_versions\|connect_timeout" NimoOS-AI/agent/mcp_client/
```

零命中 `protocol_era` / `protocol_version` / `supported_versions` 作为字典键或字符串字面量;
`connect_timeout` 只作为函数参数名/局部变量出现(`_connect_timeout()`、`_connect()` 的形参),
从未作为 `error_key` 声明。`test_server()` 的返回体逐字确认为:

```python
return {"ok": True, "tool_count": len(metas), "tools": [m["name"] for m in metas]}
```

三个字段一个都不给。对着这个后端,`protocolLine()` 恒为 `null`,协议行永不渲染 —— 这是后端形状
决定的,不是待补的真机验证步骤。已在设计文档 §6 与 `.superpowers/sdd/sp14/closeout.md` §4 两处
改写(均保持中文,按仓库既有约定)。

## 三、代码/测试改动清单

| Finding | 文件 | 改动 |
|---|---|---|
| 1 | `packages/service/src/ai.ts` | 重写 `testMCPServer` 上方注释(独立 commit) |
| 3 | `packages/service/src/ai.ts` | `confirmAgentAction` 的 `extra` 注释译成英文(同一 commit) |
| 4a | `McpElicitFormCard.test.ts` | 新增 `format:'uri'` 非 `type="url"` + email/date/date-time 映射钉子 + multi_enum 预勾选钉子 |
| 4b | `BlockRenderer.batchA.test.ts` | 两条断言改用各卡独有结构(`.mcc-fields`/`form` vs `.mcc-url`),**变异验证见下** |
| 4c | `McpServerDetail.test.ts` | 新增「协议字段整个缺失」用例,断言 `.mcp-test-proto` 不存在且无 `undefined` |
| 5 | `McpElicitFormCard.vue` | `multi_enum` 默认值过 `String()` 再塞进 `values`,并注明这是对 Vue2 逻辑的修正(非照抄) |
| 6 | `McpElicitUrlCard.vue` | `trim()` 一次,同一个字符串同时用于校验与 `window.open` |
| 7 | `.gitignore` | 删掉命名内部阶段/任务的 harness 三行忽略条目 |
| 8a | `McpServerDetail.vue` | 「守卫在下面」改成指向真实文件 `src/ai/styles/knowledgeStyles.test.ts` |
| 8b | `useOpenAction.ts` | 补充 `strangler:disabled:/ai` 只回退 AI 磁贴、Knowledge 磁贴不受影响的说明 |

## 四、变异验证(finding 4 第二条,强制)

把 `BlockRenderer.vue` 的 `BLOCK_MAP` 两条互换:

```diff
-  mcp_elicit_form: McpElicitFormCard,
-  mcp_elicit_url: McpElicitUrlCard,
+  mcp_elicit_form: McpElicitUrlCard,
+  mcp_elicit_url: McpElicitFormCard,
```

`pnpm exec vitest run src/ai/components/blocks/BlockRenderer.batchA.test.ts` 结果:

```
 FAIL  ... > mcp_elicit_form 分发到 McpElicitFormCard(非灰 chip,且是表单卡而非 URL 卡)
   expect(w.find('.mcc-fields').exists()).toBe(true)   // Received: false

 FAIL  ... > mcp_elicit_url 分发到 McpElicitUrlCard(非灰 chip,且是 URL 卡而非表单卡)
   expect(w.find('.mcc-url').exists()).toBe(true)       // Received: false

 Test Files  1 failed (1)
      Tests  2 failed | 27 passed (29)
```

两条新断言如预期变红,原来只查 `.mcc-perm` 的写法在同样的互换下会保持全绿(两卡共享该根类)。
换回原映射后 `git diff src/ai/components/blocks/BlockRenderer.vue` 为空,确认已还原。

## 五、测试与类型检查命令与真实输出

```
$ pnpm exec vitest run src/ai/ src/home/ src/i18n/ packages/service/
 Test Files  233 passed (233)
      Tests  4167 passed (4167)
```

（本地首次跑出过 1 个失败:`src/home/components/DesktopContextMenu.test.ts` 的
「clicking the rendered item opens the wallpaper picker」。经 `git stash` 验证同一测试文件在
**未改动的分支基线上单独跑也会以不同断言失败**——两次失败点不同(一次是 `defaultPrevented`,
一次是 `dialogOpen`),判定为该文件既有的、与本次改动无关的时序性 flaky 测试,非本次修复引入。
重跑后确认稳定全绿。）

```
$ pnpm exec vue-tsc --noEmit
(无输出,exit 0,0 错误 —— 未触发「stale confirmAgentAction 签名」问题,不需要 pnpm install)
```

## 六、三个 commit

```
df91b6b fix(service): correct drifted backend numbers in the MCP probe comment
        (packages/service/src/ai.ts 单独一个 commit —— finding 1 + finding 3)

03e6ba1 fix(ai): close review-flagged gaps in the MCP elicitation and protocol-line code
        (finding 4/5/6/7/8 的代码与测试改动)

0cf986a docs(sp14): correct backend numbers and #141 verifiability in the record
        (设计文档 §3.4/§6 + closeout.md §4 的文档修正 —— finding 1 的文档半 + finding 2)
```

## 七、未变更范围确认

- 未碰 `useConfirmResolve.ts`、`agentStore.resolveElicitation`、i18n 键、`mcpElicitValidate.ts`。
- `.gitignore` 删除的三行经核对未切开 `oss/manifest.mjs` 里对 `.gitignore` 的两条 PATCH 锚点
  (锚点文本止于 `vite.config.tmlab.ts`,harness 行在其之后,删除不影响锚点匹配)。
- `git status` 收尾时干净,三个 commit 均只 `git add` 了列出的显式路径。

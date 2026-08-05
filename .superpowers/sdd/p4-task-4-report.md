# SP8-P4 Task 4 报告 —— i18n 双档(MCP 分区)

## 改了什么

- `src/i18n/zh_cn.ts`:文件末尾 AI 区(`// <<< SP8-P3b Task 2` 之后)新增
  `// >>> SP8-P4 Task 4` 区块,76 个新键(§4.2 62 条 + §4.3 14 条)。
- `src/i18n/en_us.ts`:对应位置同增 76 个新键,两档顺序逐行一致(便于人工比对)。
- 未新增/未修改任何 `.vue` 或其它文件。

Vue2 对照:所有 §4.2 键的中文值来自 `NimoOS-UI/src/assets/lang/zh_CN.json`(权威源),
逐字照抄(见下方 Step 4 程序化比对)。§4.3 的 14 条是本期新文案(D5/D8 产物),Vue2 无
对应物,按设计文档 `2026-07-31-vue3-migration-sp8-p4-mcp-design.md` §5.3/§6 核对(设计文档
只给出 `aiMcpSrvTestErrTimeout`→"探测超时" 一例作插图,与任务书表格一致,无冲突)。

## 复用键清单(8 个,§4.1)

先 `grep` 确认两档均存在且中文值逐字相同,结果全部匹配,**未新增任何重复键**:

| Vue2 文案 | 复用键 | zh 值(两档实测) | 一致? |
|---|---|---|---|
| `Refresh` | `aiCfgRefresh` | 刷新 | 是 |
| `Cancel` | `aiCancel` | 取消 | 是 |
| `Save` | `aiCfgSave` | 保存 | 是 |
| `Saving…` | `aiCfgSaving` | 保存中… | 是 |
| `Saved` | `aiCfgSaved` | 已保存 | 是 |
| `Save failed` | `aiCfgSaveFailed` | 保存失败 | 是 |
| `Delete failed` | `aiCfgDeleteFailed` | 删除失败 | 是 |
| `Enabled` | `aiCfgEnabled` | 启用 | 是 |

## 新增键清单

### §4.2(Vue2 有对应物,62 条 —— 任务书正文说「63」但实际表格逐行数出来是 62,见下方「申报」)

```
aiMcpSrvAdd, aiMcpSrvSearchPlaceholder, aiMcpSrvGroupEnabled, aiMcpSrvGroupDisabled,
aiMcpSrvNoMatch, aiMcpSrvEmpty, aiMcpSrvLoadFailed, aiMcpSrvEnabledToast,
aiMcpSrvDisabledToast, aiMcpSrvUpdateFailed, aiMcpSrvRemovedName, aiMcpSrvAddedName,
aiMcpSrvPickHint, aiMcpSrvPickSub, aiMcpSrvEditConfig, aiMcpSrvRemove, aiMcpSrvStatus,
aiMcpSrvDisabled, aiMcpSrvTransport, aiMcpSrvHeaders, aiMcpSrvConfigured, aiMcpSrvNone,
aiMcpSrvEnv, aiMcpSrvConfiguration, aiMcpSrvConfigHint, aiMcpSrvTest, aiMcpSrvTesting,
aiMcpSrvCommand, aiMcpSrvArgs, aiMcpSrvEnvVars, aiMcpSrvConfiguredHidden, aiMcpSrvUrl,
aiMcpSrvReqHeaders, aiMcpSrvTestStdioHint, aiMcpSrvTestOk, aiMcpSrvTestFailed,
aiMcpSrvToolsNote, aiMcpSrvRemoveTitle, aiMcpSrvRemoveBody, aiMcpSrvRemoveConfirm,
aiMcpSrvEditTitle, aiMcpSrvQuickAdd, aiMcpSrvQuickAddHint, aiMcpSrvParsing,
aiMcpSrvFillForm, aiMcpSrvName, aiMcpSrvNamePlaceholder, aiMcpSrvTransportType,
aiMcpSrvTransportHttp, aiMcpSrvTransportSse, aiMcpSrvTransportStdio, aiMcpSrvOptional,
aiMcpSrvKvKey, aiMcpSrvKvValue, aiMcpSrvAddHeader, aiMcpSrvKvHint,
aiMcpSrvCommandPlaceholder, aiMcpSrvOnePerLine, aiMcpSrvAddVariable,
aiMcpSrvSavedLocally, aiMcpSrvAddServer, aiMcpSrvParseFailed
```
（数了一遍,62 个。）

### §4.3(Vue2 无对应物,本期新文案,14 条)

```
aiMcpSrvTestErrTimeout        探测超时 / Probe timed out                     — error_key=probe_timeout
aiMcpSrvTestErrConnect        连不上这个服务器 / Could not connect to this server — error_key=connect_failed
aiMcpSrvTestErrListTimeout    读取工具列表超时 / Timed out listing tools      — error_key=list_timeout
aiMcpSrvTestErrListFailed     连上了,但读不到工具列表 / Connected, but could not list tools — error_key=list_failed
aiMcpSrvTestErrAgentDown      AI 助手服务没在运行,无法发起探测 / The AI agent service is not running, so the probe could not start — 502
aiMcpSrvTestDetail            技术详情 / Technical details                   — D8 折叠标题
aiMcpSrvErrUrlRequired        HTTP / SSE 传输必须填端点 URL / Endpoint URL is required for HTTP / SSE — 保存 400
aiMcpSrvErrCommandRequired    STDIO 传输必须填命令 / Command is required for STDIO — 保存 400
aiMcpSrvErrBadTransport       传输方式只能是 HTTP、SSE 或 STDIO / Transport must be HTTP, SSE or STDIO — 保存 400
aiMcpSrvErrNotFound           这个服务已经不存在了,请刷新列表 / This server no longer exists — refresh the list — 404
aiMcpSrvParseErrEmpty         请先粘贴一行命令或 URL / Paste a command or URL first — 解析 400
aiMcpSrvParseErrNoCommand     没解析出可执行的命令 / No runnable command found — 解析 400(合并两条后端串)
aiMcpSrvParseErrOnlyEnv       只有环境变量,后面缺一条命令 / Only environment variables — a command is missing — 解析 400
aiMcpSrvParseErrQuotes        引号没有配对 / Unbalanced quotes                — 解析 400
```

合计新增 62 + 14 = **76 个键**（不是任务书 Step 6 示例提交信息里写的「77」，见下方申报），加 8 个复用键 = 本任务共触碰 84 个键名。

## 与 T3 已写死键名的对账

`grep -o "aiMcpSrv[A-Za-z]*" src/ai/util/mcpErrorKey.ts | sort -u` 实测输出 15 个键：

```
aiMcpSrvErrBadTransport, aiMcpSrvErrCommandRequired, aiMcpSrvErrNotFound,
aiMcpSrvErrUrlRequired, aiMcpSrvParseErrEmpty, aiMcpSrvParseErrNoCommand,
aiMcpSrvParseErrOnlyEnv, aiMcpSrvParseErrQuotes, aiMcpSrvParseFailed,
aiMcpSrvTestErrAgentDown, aiMcpSrvTestErrConnect, aiMcpSrvTestErrListFailed,
aiMcpSrvTestErrListTimeout, aiMcpSrvTestErrTimeout, aiMcpSrvTestFailed
```

外加 T3 里已复用的既有键 `aiCfgSaveFailed`（`saveServerErrorKey` 兜底分支）。
全部 16 个键（15 个 `aiMcpSrv*` + 1 个既有）逐字命中本任务新增/复用的键名——
**零遗漏、零拼写偏差**。T3 只返回键名字符串，不 `t()` 渲染，本任务把这些键名接上了
实际文案，T5–T9 消费时可直接 `t(msgKey)`。

## Step 3：i18n 守卫

```
pnpm exec vitest run src/i18n/
 Test Files  3 passed (3)
      Tests  16 passed (16)
```
`parity.test.ts`（键集一致）与 `messageSyntax.test.ts`（`@` 转义）全绿。

## Step 4：程序化逐码点比对（完整输出）

脚本按任务书 Step 4 骨架、把 §4.2 全表 62 条填进 `PAIRS`（§4.3 的 14 条不在 Vue2
语言包里，按任务书说明不进此脚本）后跑出：

```
$ python3 - <<'PY' … PY
PAIRS count: 62
MISMATCH: none
```

（脚本对正则做了一处必要增强：原任务书骨架只匹配单引号字符串，本任务里
`aiMcpSrvParseFailed` 的英文值含撇号（`"Couldn't parse that command"`），文件里该行按
本仓既有惯例改用双引号书写（同 `en_us.ts` 里既有的 `aiSkErrDescAngle` /
`filesViewerDontSave` 写法），因此比对脚本同时识别单/双引号字面量并按各自转义规则解码，
比对目标仍是 `src/i18n/zh_cn.ts` 的中文值 vs `zh_CN.json`，未改变比对逻辑本身。）

全部 62 项 `MISMATCH: none`，中文标点（顿号、省略号、全角括号、间隔号 `·`、中文逗号句号）
逐码点核对无一处偏差。

## 与 zh_CN.json 不一致之处

**没有发现**。§4.2 全部 62 条中文值与 `zh_CN.json` 逐码点相同（见上）。

## 任务书本身的两处计数偏差（申报，不影响交付内容）

1. 任务书正文（brief 第 56/165/189 行附近的散文）多次写「§4.2 63 条」，但实际
   markdown 表格（brief L62–123）逐行数出来是 **62 条**（已用
   `sed -n '62,123p' brief | grep -c '^| \`aiMcpSrv'` 核实两次）。以**表格实际内容**为准
   （公共约束 §2：brief 数据与事实冲突时是 brief 错），本任务按 62 条实现，62 条全部
   完整覆盖、无缺项。
2. Step 6 示例提交信息模板写「77 新键」，按 62+14=76 计算应为 **76**。已在下方 commit
   信息里改用实际数字 76，未逐字照抄模板里的数字（这条不属于「i18n 值不许改一个标点」
   的约束范围——那条约束管的是键值内容，不是提交信息里的算术计数）。

## §3 那 11 条已授权偏离 —— 本任务命中情况

**均不适用**。本任务只新增 i18n 键值对，不涉及组件、弹窗、颜色、竞态等逻辑，D1–D11
均与本任务无关，未产生任何新偏离。

## §3.5 那 5 条「照抄不改」—— 本任务命中情况

**均不适用**（N1–N5 都是组件级行为约定，本任务不含任何组件代码）。

## 三门完整终值

```
pnpm test
 Test Files  298 passed (298)
      Tests  2619 passed (2619)
exit=0
（完整日志：/tmp/p4-t4-test.log）

pnpm exec vue-tsc --noEmit
exit=0
（完整日志：/tmp/p4-t4-tsc.log，空)

pnpm build
✓ built in 49.44s
exit=0
（完整日志：/tmp/p4-t4-build.log；仅有既有的 >500KB chunk 警告，无第三方包外的告警）
```

无红项。本任务未新增 `.vue`，`color-guard.test.ts` 用例数不变（298 文件 / 2619 例，
较 T3 收尾值一致，T1–T3 已把基线从 296/2574 推到 298/2619，本任务持平未变）。

## Commit

```
git add src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(ai): SP8-P4 T4 MCP 分区 i18n 双档(76 新键,8 键复用)"
```

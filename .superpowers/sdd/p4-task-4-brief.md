# SP8-P4 Task 4 任务书

**先读**(顺序不可换,本文件与它们冲突时以它们为准):
1. `.sp8/NimoOS-New-UI/.superpowers/sdd/p4-common-constraints.md` —— 公共约束,**你的行为准则**
2. `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p4-mcp-design.md` —— 设计文档,**权威**
   (公共约束 > 本任务书;设计文档 > 本任务书。发现冲突立即在报告里申报,不要默默选一边。)

## Global Constraints(计划原文,逐字)

- **工作区**:只写 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。**本期 Service 仓与两个后端仓零改动。**
- **界面 / 视觉 / 交互严格 1:1 照 Vue2**(DOM 结构、class、文案、尺寸、动效、键位、**组件拆分**);**逻辑 / bug 不照抄**,偏离必须三件套齐全(代码注释注明 Vue2 `file:line` + 报告申报 + 台账登记)。**未申报的偏离本身就是缺陷。**
- **一切可见颜色必须 `var(--…)` token**,禁 `#hex` / `rgb()` / `rgba()` / 具名色(`white`/`black` 也算)。**内联 `:style` 里的颜色同样违规。** ⚠️ `color-guard.test.ts` **不扫 `.scss`**,Task 1 的配色无回归网。
- **单层取数**:共享包 `service.ai.*` 已 `return res.data`,消费端**不许再剥一层**。Vue2 的 `resp.data` 照抄即缺陷(设计 §3,本期命中 4 处)。
- **界面永不回显后端原文 / JSON**,一律走 i18n 键映射(先例 `util/channelsFormat.ts:65-76`)。
- **新 i18n 键双档同增**(`src/i18n/{zh_cn,en_us}.ts`),值逐字照本计划 Task 4 的表,**不许自行翻译、不许改标点**(含 `·` `…` `(` `)` 与中文逗号句号)。字面 `@` 写成 `{'@'}`。
- **import 一律相对路径**(本仓无 `@/` 别名先例)。
- **状态一律组件本地 `ref`**,不新建 store。
- **组件里零 `<style>` 块**;用到的每个 CSS 类先 `grep` 确认存在。
- **toast 真签名**:`show(text: string, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`(`src/stores/toast.ts:18-27`)。
- **每个任务跑全量三门**,输出完整落盘,**禁 `| tail`**。基线 **296 文件 / 2574 例绿 · tsc 0 · build 0**。
- 禁 `git add -A` / `git add .`,只显式列路径;禁 rebase / reset / stash / merge / **push**。一个任务 = 一个语义提交。

## File Structure(全期文件落点,供你定位自己的位置)

| 文件 | 责任 | 任务 |
|

---

## Task 4: i18n 双档

**Files:**
- Modify: `src/i18n/zh_cn.ts`
- Modify: `src/i18n/en_us.ts`
- Test: 既有 `src/i18n/parity.test.ts` / `messageSyntax.test.ts` 自动覆盖

**Interfaces:**
- Consumes: 无
- Produces: 下表全部键,供 T5–T9 使用。

### 4.1 复用既有键(8 个,**不许重复新增**)

先 `grep` 确认存在且值逐字相同,再在报告里列出复用清单:

| Vue2 文案 | 复用键 | zh 值 |
|---|---|---|
| `Refresh` | `aiCfgRefresh` | 刷新 |
| `Cancel` | `aiCancel` | 取消 |
| `Save` | `aiCfgSave` | 保存 |
| `Saving…` | `aiCfgSaving` | 保存中… |
| `Saved` | `aiCfgSaved` | 已保存 |
| `Save failed` | `aiCfgSaveFailed` | 保存失败 |
| `Delete failed` | `aiCfgDeleteFailed` | 删除失败 |
| `Enabled`(状态值 + 表单字段标签,两处) | `aiCfgEnabled` | 启用 |

### 4.2 新增键(**中文值逐字照抄,不许改一个标点**)

**en 档取值规则:除下表 §4.3 的 14 条新文案外,一律 = Vue2 的 key 字面量**(`en_US.json` 里有的就等于它,缺的 4 条按约束也用 key 字面量)。

| 键 | zh_cn | en_us |
|---|---|---|
| `aiMcpSrvAdd` | `新增 MCP 服务` | `Add MCP server` |
| `aiMcpSrvSearchPlaceholder` | `搜索服务…` | `Search servers…` |
| `aiMcpSrvGroupEnabled` | `已启用服务` | `Enabled servers` |
| `aiMcpSrvGroupDisabled` | `已停用服务` | `Disabled servers` |
| `aiMcpSrvNoMatch` | `没有匹配的服务` | `No servers match` |
| `aiMcpSrvEmpty` | `还没有 MCP 服务,点击 + 添加一个。` | `No MCP servers yet. Click the + to add one.` |
| `aiMcpSrvLoadFailed` | `无法加载 MCP 服务` | `Could not load MCP servers` |
| `aiMcpSrvEnabledToast` | `服务已启用` | `Server enabled` |
| `aiMcpSrvDisabledToast` | `服务已停用` | `Server disabled` |
| `aiMcpSrvUpdateFailed` | `更新失败` | `Update failed` |
| `aiMcpSrvRemovedName` | `已移除 {name}` | `Removed {name}` |
| `aiMcpSrvAddedName` | `已添加 {name}` | `Added {name}` |
| `aiMcpSrvPickHint` | `在左侧选择一个 MCP 服务` | `Pick an MCP server on the left` |
| `aiMcpSrvPickSub` | `或新增一个,通过 Model Context Protocol 给 Nimo 接入新工具。` | `Or add one to give Nimo new tools over the Model Context Protocol.` |
| `aiMcpSrvEditConfig` | `编辑配置` | `Edit configuration` |
| `aiMcpSrvRemove` | `移除服务` | `Remove server` |
| `aiMcpSrvStatus` | `状态` | `Status` |
| `aiMcpSrvDisabled` | `未启用` | `Disabled` |
| `aiMcpSrvTransport` | `传输` | `Transport` |
| `aiMcpSrvHeaders` | `请求头` | `Headers` |
| `aiMcpSrvConfigured` | `已配置` | `Configured` |
| `aiMcpSrvNone` | `无` | `None` |
| `aiMcpSrvEnv` | `环境变量` | `Env` |
| `aiMcpSrvConfiguration` | `配置` | `Configuration` |
| `aiMcpSrvConfigHint` | `Nimo 如何连接该服务` | `How Nimo connects to this server` |
| `aiMcpSrvTest` | `测试连接` | `Test connection` |
| `aiMcpSrvTesting` | `测试中…` | `Testing…` |
| `aiMcpSrvCommand` | `命令` | `Command` |
| `aiMcpSrvArgs` | `参数` | `Arguments` |
| `aiMcpSrvEnvVars` | `环境变量` | `Environment variables` |
| `aiMcpSrvConfiguredHidden` | `已配置(已隐藏)` | `Configured (hidden)` |
| `aiMcpSrvUrl` | `端点 URL` | `Endpoint URL` |
| `aiMcpSrvReqHeaders` | `请求头` | `Request headers` |
| `aiMcpSrvTestStdioHint` | `stdio 首次可能需要约 90 秒(会现场下载 server)。` | `This can take up to 90s for stdio (first run downloads the server).` |
| `aiMcpSrvTestOk` | `已连接 · {n} 个工具` | `Connected · {n} tools` |
| `aiMcpSrvTestFailed` | `连接失败` | `Connection failed` |
| `aiMcpSrvToolsNote` | `工具由该服务在握手时声明。对话中首次调用会请求你的许可。` | `Tools are declared by this server during handshake. The first call in a conversation will ask for your permission.` |
| `aiMcpSrvRemoveTitle` | `移除该 MCP 服务?` | `Remove this MCP server?` |
| `aiMcpSrvRemoveBody` | `Nimo 将断开与 {name} 的连接,其工具不再对 Agent 可用。你可以稍后重新添加。` | `Nimo will disconnect from {name}; its tools will no longer be available to the agent. You can add it again later.` |
| `aiMcpSrvRemoveConfirm` | `移除` | `Remove` |
| `aiMcpSrvEditTitle` | `编辑 MCP 服务` | `Edit MCP server` |
| `aiMcpSrvQuickAdd` | `快速添加` | `Quick add` |
| `aiMcpSrvQuickAddHint` | `粘贴一行命令或 URL` | `paste a command or URL` |
| `aiMcpSrvParsing` | `解析中…` | `Parsing…` |
| `aiMcpSrvFillForm` | `填充表单` | `Fill form` |
| `aiMcpSrvName` | `名称` | `Name` |
| `aiMcpSrvNamePlaceholder` | `例如:brave / notion / my-tools` | `e.g. brave / notion / my-tools` |
| `aiMcpSrvTransportType` | `传输方式` | `Transport type` |
| `aiMcpSrvTransportHttp` | `远程 · 可流式 HTTP` | `Remote · streamable HTTP` |
| `aiMcpSrvTransportSse` | `远程 · 服务器推送事件` | `Remote · server-sent events` |
| `aiMcpSrvTransportStdio` | `本地 · 运行一个命令` | `Local · runs a command` |
| `aiMcpSrvOptional` | `可选` | `optional` |
| `aiMcpSrvKvKey` | `键` | `Key` |
| `aiMcpSrvKvValue` | `值` | `Value` |
| `aiMcpSrvAddHeader` | `添加请求头` | `Add header` |
| `aiMcpSrvKvHint` | `留空保持不变;填写则覆盖全部。` | `Leave blank to keep current; filling in replaces all.` |
| `aiMcpSrvCommandPlaceholder` | `例如 npx / uvx / python` | `e.g. npx / uvx / python` |
| `aiMcpSrvOnePerLine` | `每行一个` | `One per line` |
| `aiMcpSrvAddVariable` | `添加变量` | `Add variable` |
| `aiMcpSrvSavedLocally` | `保存在这台 NAS 本地` | `Saved locally on this NAS` |
| `aiMcpSrvAddServer` | `添加服务` | `Add server` |
| `aiMcpSrvParseFailed` | `无法解析该命令` | `Couldn't parse that command` |

### 4.3 本期新文案(Vue2 无对应物 —— D5 / D8 的产物,14 条)

| 键 | zh_cn | en_us | 用途 |
|---|---|---|---|
| `aiMcpSrvTestErrTimeout` | `探测超时` | `Probe timed out` | `error_key=probe_timeout` |
| `aiMcpSrvTestErrConnect` | `连不上这个服务器` | `Could not connect to this server` | `error_key=connect_failed` |
| `aiMcpSrvTestErrListTimeout` | `读取工具列表超时` | `Timed out listing tools` | `error_key=list_timeout` |
| `aiMcpSrvTestErrListFailed` | `连上了,但读不到工具列表` | `Connected, but could not list tools` | `error_key=list_failed` |
| `aiMcpSrvTestErrAgentDown` | `AI 助手服务没在运行,无法发起探测` | `The AI agent service is not running, so the probe could not start` | 502 |
| `aiMcpSrvTestDetail` | `技术详情` | `Technical details` | D8 折叠标题 |
| `aiMcpSrvErrUrlRequired` | `HTTP / SSE 传输必须填端点 URL` | `Endpoint URL is required for HTTP / SSE` | 保存 400 |
| `aiMcpSrvErrCommandRequired` | `STDIO 传输必须填命令` | `Command is required for STDIO` | 保存 400 |
| `aiMcpSrvErrBadTransport` | `传输方式只能是 HTTP、SSE 或 STDIO` | `Transport must be HTTP, SSE or STDIO` | 保存 400 |
| `aiMcpSrvErrNotFound` | `这个服务已经不存在了,请刷新列表` | `This server no longer exists — refresh the list` | 404 |
| `aiMcpSrvParseErrEmpty` | `请先粘贴一行命令或 URL` | `Paste a command or URL first` | 解析 400 |
| `aiMcpSrvParseErrNoCommand` | `没解析出可执行的命令` | `No runnable command found` | 解析 400(合并两条后端串) |
| `aiMcpSrvParseErrOnlyEnv` | `只有环境变量,后面缺一条命令` | `Only environment variables — a command is missing` | 解析 400 |
| `aiMcpSrvParseErrQuotes` | `引号没有配对` | `Unbalanced quotes` | 解析 400 |

- [ ] **Step 1: 先 grep 确认无重复键**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
grep -nE '^\s+aiMcpSrv[A-Za-z]+:' src/i18n/zh_cn.ts src/i18n/en_us.ts
```

预期:**零命中**(重复属性会是 TS 错误)。

- [ ] **Step 2: 双档同增**

按上表逐条加进 `zh_cn.ts` 与 `en_us.ts`,**放在文件末尾 AI 区键的后面,保持两档顺序一致**(便于人工比对)。

- [ ] **Step 3: 跑 i18n 守卫**

```bash
pnpm exec vitest run src/i18n/
```

预期:`parity.test.ts`(键集一致)与 `messageSyntax.test.ts`(`@` 转义)全绿。

- [ ] **Step 4: 程序化逐码点复核中文值(P3b 教训 4:标点错误肉眼看不出)**

```bash
cd /home/nimo/NimoTech && python3 - <<'PY'
import json, re
zh = json.load(open('NimoOS-UI/src/assets/lang/zh_CN.json'))
src = open('.sp8/NimoOS-New-UI/src/i18n/zh_cn.ts', encoding='utf-8').read()
# 键 -> Vue2 原英文串(只列 §4.2 那 63 条,§4.3 的 14 条不在 Vue2 语言包里)
PAIRS = {
  'aiMcpSrvAdd': 'Add MCP server',
  'aiMcpSrvSearchPlaceholder': 'Search servers…',
  # …实现者补齐 §4.2 全表…
}
bad = []
for k, en in PAIRS.items():
    m = re.search(r"^\s+%s:\s*'((?:[^'\\]|\\.)*)'," % k, src, re.M)
    if not m: bad.append((k, 'MISSING')); continue
    got, want = m.group(1), zh.get(en)
    if got != want:
        bad.append((k, [ (c, hex(ord(c))) for c in got ], [ (c, hex(ord(c))) for c in want or '' ]))
print('MISMATCH:', bad if bad else 'none')
PY
```

预期:`MISMATCH: none`。把输出贴进报告。**这一步不许跳过** —— 中文逗号 `,` / 省略号 `…` / 全角括号 `()` / 间隔号 `·` 肉眼与半角形近。

- [ ] **Step 5: 跑全量三门**

命令同 T1 Step 6(日志名 `p4-t4-*`)。**本任务不新增 `.vue`。**

- [ ] **Step 6: Commit**

```bash
git add src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(ai): SP8-P4 T4 MCP 分区 i18n 双档(77 新键,8 键复用)"
```

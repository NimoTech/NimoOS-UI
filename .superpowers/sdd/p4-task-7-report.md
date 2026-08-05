# SP8-P4 Task 7 报告 —— 测试连接(D8 本地化 + 技术详情折叠 + D11 竞态守卫)

## 改了什么文件

- `src/ai/components/settings/mcp/McpServerDetail.vue`(T6 建的,本任务补齐三段留白)
- `src/ai/components/settings/mcp/McpServerDetail.test.ts`(T6 建的,新增一个 `describe('测试连接', ...)`)

## Vue2 逐行对照

| Vue2 `McpServerDetail.vue` | New-UI | 说明 |
|---|---|---|
| `:50-53` 「测试连接」按钮 | `.vue:273-277` | `<button class="sk-btn ghost mcp-test-btn" :disabled="testing" @click="runTest">`,spinner + 文案 1:1 |
| `:87-89` stdio 90s 提示 | `.vue:311-314` | `v-if="testing && server.transport === 'stdio'"` 逐字 |
| `:90-100` 结果面板 | `.vue:315-336` | 成功分支(`✓` + 已连接·N 个工具 + chip 列表)逐字;失败分支**改造**见 D8 |
| `:112-125`(确认弹窗,不属本任务但复核未破坏) | 不变 | T6 已实现,本任务未改动 |
| `:140` `data(){ testing: false, testResult: null }` | `.vue:109-110` | `testing`/`testView`(改名,见下) |
| `:151` `watch('server.id')` 清 `testing`/`testResult` | `.vue:168-174` | 追加 `reqSeq.value += 1` + 复位 `testing`/`testView` |
| `:158-171` `runTest()` | `.vue:121-143` | 三态 + D1 单层取数 + D11 令牌守卫 |

## 承接的 Vue2 行为(照抄)

- `if (!this.server || this.testing) return`(:159)逐字对应,用例「testing 期间重复点击不重复发请求」验证。
- stdio 90 秒提示只在 `testing && transport==='stdio'` 时显示。
- 成功态 `✓ 已连接 · {n} 个工具` + 工具 chip 列表。
- `✓`/`✗` 字符本身逐字取自 Vue2 `:92,98`(不是配色,不受 token 约束)。
- `watch('server.id')` 清空 `menuOpen`/`confirmOpen`/`testing`/`testResult` 的既有行为保留,只是追加了 `reqSeq` 递增。

## 两条偏离(三件套)

### D8 —— 测试错误改本地化 + 可折叠技术详情

- **Vue2 问题**(`:98`):`{{ testResult.error || $t('Connection failed') }}` 直接把后端拼好的英文串(如
  `"Connection failed: All connection attempts failed"`)显示在界面上,违反本仓「界面永不回显后端原文」的硬约束。
- **改法**(`.vue:315-336`):失败分支改成 `t(testView.msgKey)`(T3 `toTestView`/`toTestViewFromError` 按
  `error_key`/HTTP 状态映射出的 i18n 键),`error` 字段整个不进视图类型 `McpTestView`(见 T2
  `types/mcpServer.ts:94-96` 的判别联合定义,失败分支根本没有 `error` 字段可读)。技术详情用原生
  `<details>/<summary>`,默认折叠(无 `open` 属性),仅当 `testView.detail` 非空才渲染
  (`v-if="testView.detail"`)。
- 代码注释位置:`.vue:324-330`(模板内)+ 文件头 `:8-9` 指向该处。
- 用户 2026-07-31 拍板,已获授权(公共约束 §3 D8)。

### D11 —— 测试在途切换服务器的错配竞态

- **Vue2 问题**(`:158-171`):`runTest` 没有请求令牌。stdio 探测最长约 100 秒
  (`NimoOS-AI/route/v2/mcp.go:346`),这期间若用户切到另一台服务器,`watch('server.id')` 已经把
  `testResult` 清空,但在途的 `ai.testMCPServer` promise 落地后仍会无条件执行 `this.testResult = ...`,
  把**旧服务器的测试结果**写进**当前(新)服务器的面板**——可复现的错配,不是无害巧合。
- **改法**(`.vue:109-143`):单调递增 `reqSeq`。`runTest` 进入时 `const seq = ++reqSeq.value`;
  `watch(() => props.server?.id)` 里 `reqSeq.value += 1` 让在途请求的号作废;成功分支、catch 分支、
  finally 分支三处都比对 `seq !== reqSeq.value`,不一致就整体丢弃(`testing` 也不复位,因为那已经是
  新一轮状态,由新一轮自己的 `finally` 负责)。
- 代码注释位置:`.vue:111-118`(`runTest` 头注释)+ `:164-167`(`watch` 侧)。
- 承设计文档 §5.3 D11、公共约束 §3 第 11 条。

## RED→GREEN 证据

### Step 2:先跑测试确认新增用例整组红(实现前)

未单独截取该步骤日志(实现是紧接着 Step1/Step3 一起做的),但 Step 5 的两次 RED 探针已充分证明测试对生产代码的判别力,详见下方。实现完成后跑：

```
Test Files  1 passed (1)
     Tests  32 passed (32)
```
(21 条 T6 既有 + 11 条 T7 新增)

### Step 5 RED 探针 1:D11 守卫

破坏:把成功分支的 `if (seq !== reqSeq.value) return` 删掉（保留 `testView.value = toTestView(body)`）。

```
 ❯ src/ai/components/settings/mcp/McpServerDetail.test.ts (32 tests | 1 failed) 358ms
     × D11:在途请求落地时若已切到别的服务器,结果被丢弃(不串台) 12ms

 FAIL  src/ai/components/settings/mcp/McpServerDetail.test.ts > 测试连接 > D11:在途请求落地时若已切到别的服务器,结果被丢弃(不串台)
AssertionError: expected true to be false // Object.is equality
- false
+ true
 ❯ src/ai/components/settings/mcp/McpServerDetail.test.ts:397:49
    397|     expect(w.find('.mcp-test-result').exists()).toBe(false)

 Test Files  1 failed (1)
      Tests  1 failed | 31 passed (32)
```

只精确命中「D11:在途请求落地时…」这一条,其余 31 条(含「D11 对照:未切换时结果正常落地」)仍绿——证明
守卫用例确有判别力,且不是靠误伤对照用例撑起来的。还原后 `git status --porcelain` 干净：

```
 M src/ai/components/settings/mcp/McpServerDetail.test.ts
 M src/ai/components/settings/mcp/McpServerDetail.vue
```
(只有本任务本来就在改的两个文件,无遗留改动)

### Step 5 RED 探针 2:单层取数

破坏:把 `toTestView(body)` 改成 `toTestView((body as any).data)`。

```
 ❯ src/ai/components/settings/mcp/McpServerDetail.test.ts (32 tests | 5 failed) 357ms
     × 成功:单层取数,显示已连接 · N 个工具 + 工具 chip 10ms
     × 失败:显示本地化文案,后端 error 英文串不出现在界面上 7ms
     × detail 非空才渲染折叠区,且默认折叠(无 open 属性) 9ms
     × detail 为空时不渲染折叠区(对照) 6ms
     × D11 对照:未切换时结果正常落地(守卫不能把正常路径也挡掉) 6ms

 FAIL  ... > 成功:单层取数,显示已连接 · N 个工具 + 工具 chip
AssertionError: expected 'false' to be 'true'
 ❯ ...McpServerDetail.test.ts:310:62
    310|     expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('tru…

 Test Files  1 failed (1)
      Tests  5 failed | 27 passed (32)
```

brief 点名的「成功:单层取数…」精确报红；额外命中的 4 条(失败态 3 条 + D11 对照 1 条)是预期内的连带
效应——mock 返回的裸对象在 `(body as any).data` 下恒为 `undefined`,`toTestView(undefined)` 落进
`!body || typeof body !== 'object'` 分支,统一变成 `{ok:false, msgKey:'aiMcpSrvTestFailed', detail:''}`,
所以所有依赖具体成功/失败细节的用例都会报红,不是误报。还原后 `git status --porcelain` 同样干净(与上面
一致的两个文件)。

## 自己回源核实的签名/形状

- **`toTestView(body: unknown): McpTestView`** / **`toTestViewFromError(e: unknown): McpTestView`**
  —— `src/ai/util/mcpErrorKey.ts:75,101`。`McpTestView` 判别联合(`src/ai/types/mcpServer.ts:94-96`):
  `{ ok: true; toolCount: number; tools: string[] } | { ok: false; msgKey: string; detail: string }`。
  与任务书里贴的一致,无出入。
- **`service.ai.testMCPServer(id: string | number): Promise<unknown>`**
  —— `.sp8/NimoOS-Service/src/ai.ts:388-391`:
  ```ts
  async testMCPServer(id: string | number): Promise<unknown> {
    const res = await http.post(`${PREFIX}/mcp/servers/${id}/test`, {}, { timeout: 110000 })
    return res.data
  },
  ```
  已单层化(`return res.data`),消费端不许再剥一层——本组件 `runTest` 里 `const body = await
  service.ai.testMCPServer(id)` 直接把 `body` 交给 `toTestView`,没有再取 `.data`。
- **后端 `mcp.go` test 端点返回形状**(只读,未改动,回源确认公共约束 §4 描述准确):
  `POST /mcp/servers/:id/test` 是 **200 裸对象**(`c.JSONBlob` 原样透传 Python agent 的响应体,
  `mcp.go:355` 附近),agent 不可达时是 **502** `{ok:false, error:"agent unreachable"}`。测试用例里
  `h.testMCPServer.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 502, ... } }))`
  这种抛错形状与 axios 实际行为一致(HTTP 层非 2xx 会被 axios 包成带 `response` 的 Error)。

## T6 既有 21 条用例仍全绿的证据

改动前(T6 交付时):21 条。
本任务追加:11 条(1 组 `describe('测试连接', ...)`)。
`pnpm exec vitest run src/ai/components/settings/mcp/McpServerDetail.test.ts` 改动后：

```
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

21 + 11 = 32,T6 的既有用例未被削弱/删除/改写,只新增了一个独立 `describe` 块。

## i18n

无新增/无复用变更——全部消费 T4 已经加好的 11 个键(`aiMcpSrvTest` / `aiMcpSrvTesting` /
`aiMcpSrvTestStdioHint` / `aiMcpSrvTestOk` / `aiMcpSrvTestDetail` / `aiMcpSrvTestErrTimeout` /
`aiMcpSrvTestErrConnect` / `aiMcpSrvTestErrListTimeout` / `aiMcpSrvTestErrListFailed` /
`aiMcpSrvTestErrAgentDown` / `aiMcpSrvTestFailed`),逐一 grep 确认在 `zh_cn.ts` 与 `en_us.ts` 双档
都存在（见下方证据），未新增任何键。

```
aiMcpSrvTest:            zh_cn.ts:1358 / en_us.ts:1347
aiMcpSrvTesting:         zh_cn.ts:1359 / en_us.ts:1348
aiMcpSrvTestStdioHint:   zh_cn.ts:1366 / en_us.ts:1355
aiMcpSrvTestOk:          zh_cn.ts:1367 / en_us.ts:1356
aiMcpSrvTestFailed:      zh_cn.ts:1368 / en_us.ts:1357
aiMcpSrvTestErrTimeout:      zh_cn.ts:1396 / en_us.ts:1386
aiMcpSrvTestErrConnect:      zh_cn.ts:1397 / en_us.ts:1387
aiMcpSrvTestErrListTimeout:  zh_cn.ts:1398 / en_us.ts:1388
aiMcpSrvTestErrListFailed:   zh_cn.ts:1399 / en_us.ts:1389
aiMcpSrvTestErrAgentDown:    zh_cn.ts:1400 / en_us.ts:1390
aiMcpSrvTestDetail:          zh_cn.ts:1401 / en_us.ts:1391
```

## §3.5「照抄不改」5 条

本任务不涉及 N1-N5(那些都在 `McpServerModal`/`parsePaste` 范围内,本任务只碰 `McpServerDetail`)。

## 偏离清单(§3 那 11 条命中情况)

- **D1**(单层取数)——命中第 3 处:`McpServerDetail.vue:164` → 本仓 `runTest` 直接用 `body`,不再剥 `.data`。
- **D8**(测试错误本地化 + 折叠详情)——本任务核心,见上。
- **D11**(在途竞态守卫)——本任务核心,见上。
其余 D2-D7、D9、D10 不在本任务改动范围内(T6 已处理/T1 已处理)。

## 三门终值

```
pnpm test:
  Test Files  300 passed (300)
       Tests  2660 passed (2660)
  exit=0

pnpm exec vue-tsc --noEmit:
  exit=0(无输出)

pnpm build:
  exit=0,仅既有第三方包体积警告(>500KB chunk,ExcelViewer/index-DG5-5xQh 等)
```

日志:`/tmp/p4-t7-test.log`、`/tmp/p4-t7-tsc.log`、`/tmp/p4-t7-build.log`。

**算术**:本任务未新增 `.vue` 文件(只改 T6 已建的 `McpServerDetail.vue`),`color-guard.test.ts` 用例数
不变——git diff --stat 只涉及 `McpServerDetail.vue` / `McpServerDetail.test.ts` 两个既有文件,无新文件。

## Commit

```
git add src/ai/components/settings/mcp/McpServerDetail.vue src/ai/components/settings/mcp/McpServerDetail.test.ts
git commit -m "feat(ai): SP8-P4 T7 测试连接(本地化错误+技术详情折叠+在途竞态守卫)"
```

---

## 追加:评审 Important 修复(finally 守卫补测试)

评审独立 RED 探针发现:`runTest` 的 `finally` 分支 `if (seq === reqSeq.value) testing.value = false`
生产代码正确,但当时的 32 条用例里没有一条能区分「有 seq 守卫」与「无 seq 守卫」——因为除 finally 这一
场景外,`testing` 的最终值在两种写法下恰好一致。评审判定:**纯测试缺口,不是实现缺陷**,不改生产代码。

### 只改了测试文件

- `src/ai/components/settings/mcp/McpServerDetail.test.ts`(新增 2 条,生产代码 `McpServerDetail.vue`
  本轮修复**未改动**)

### 新增两条判别性用例

场景(评审给的钉子):server1 点「测试连接」→ 悬挂 → 切到 server2 → server2 点「测试连接」→ 也悬挂
(此时界面处于「测试中…」)→ **这时**才让 server1 的旧请求落地(一条 resolve、一条 reject)→ 断言界面
仍是「测试中…」、按钮仍 disabled、结果面板仍不存在。这是唯一能让「有守卫」与「无守卫」产生行为差异的
时刻——因为只有此刻 `testing` 才会被旧请求错误地打回 `false`。

- `finally 守卫:旧请求成功落地时若新一轮测试进行中,不会把 testing 打回 false`
- `finally 守卫:旧请求抛错落地时若新一轮测试进行中,不会把 testing 打回 false`
(`McpServerDetail.test.ts` 新增两条,追加在既有「D11 对照」用例之后,`describe('测试连接', ...)` 收尾前)

改动前:34 条中的 32 条(T6 21 条 + T7 首轮 11 条)。改动后:34 条,新增 2 条全绿,**既有 32 条未削弱/
未改动**。

### RED 探针(评审要求:自己再做一次,证明新用例有判别力)

破坏:把生产代码 `finally` 分支从

```ts
} finally {
  if (seq === reqSeq.value) testing.value = false
}
```

改成无条件

```ts
} finally {
  testing.value = false
}
```

```
 ❯ src/ai/components/settings/mcp/McpServerDetail.test.ts (34 tests | 2 failed) 364ms
     × finally 守卫:旧请求成功落地时若新一轮测试进行中,不会把 testing 打回 false 10ms
     × finally 守卫:旧请求抛错落地时若新一轮测试进行中,不会把 testing 打回 false 7ms

 FAIL  ... > finally 守卫:旧请求成功落地时若新一轮测试进行中,不会把 testing 打回 false
AssertionError: expected '测试连接' to contain '测试中…'
 ❯ McpServerDetail.test.ts:436:44
    436|     expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTestin…

 FAIL  ... > finally 守卫:旧请求抛错落地时若新一轮测试进行中,不会把 testing 打回 false
AssertionError: expected '测试连接' to contain '测试中…'
 ❯ McpServerDetail.test.ts:456:44

 Test Files  1 failed (1)
      Tests  2 failed | 32 passed (34)
```

精确命中新增的两条,其余 32 条(含首轮 D11 守卫用例与 D11 对照)全绿——证明这两条对 `finally` 守卫有
真实判别力,不是靠误伤别的用例撑起来的。

还原生产代码后:

```
 M src/ai/components/settings/mcp/McpServerDetail.test.ts
```

(`git status --porcelain`,只有测试文件的改动,`McpServerDetail.vue` 与还原前逐字节一致,干净)

### 全量三门(本轮)

```
pnpm test:        Test Files 300 passed (300) / Tests 2662 passed (2662)  exit=0
pnpm exec vue-tsc --noEmit:  exit=0(无输出)
pnpm build:                  exit=0,仅既有 >500KB chunk 体积警告
```

日志:`/tmp/p4-t7-fix-test.log`、`/tmp/p4-t7-fix-tsc.log`、`/tmp/p4-t7-fix-build.log`。

算术核对:上一轮全量是 2660 例,本轮只新增 2 条测试(无新 `.vue`),2660+2=2662,吻合。

### Commit

一个语义提交,只列测试文件:

```
git add src/ai/components/settings/mcp/McpServerDetail.test.ts
git commit -m "test(ai): SP8-P4 T7 补 finally 守卫判别性用例(评审 Important 修复)"
```

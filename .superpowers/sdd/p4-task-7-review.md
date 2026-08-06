# SP8-P4 Task 7 评审 —— 测试连接(D8 本地化 + 技术详情折叠 + D11 竞态守卫)

评审者:独立 sonnet 评审(未采信实现者报告，全部自查/自跑)。

## 判定

1. **规范符合(Spec)**:✅
2. **任务质量(Quality)**:通过(附一条 Important 级测试覆盖缺口，建议后续补测，不阻塞)

## 方法与证据

### ① D11 竞态守卫——逐处核对

打开 `src/ai/components/settings/mcp/McpServerDetail.vue:122-143`：

- `runTest` 进入即 `const seq = ++reqSeq.value`（:124）——✅
- 成功分支 `if (seq !== reqSeq.value) return`（:135）——✅
- catch 分支 `if (seq !== reqSeq.value) return`（:138）——✅
- **finally 分支** `if (seq === reqSeq.value) testing.value = false`（:141）——✅ 三处全部比对，未漏
- `watch(() => props.server?.id, …)`（:168-174）里 `reqSeq.value += 1`，让在途请求作废——✅，同一 watch 里还复位 `testing`/`testView`

自己推演四种场景：切换后旧请求成功落地→被序号挡下（成功分支 return）；切换后旧请求抛错落地→同样被挡（catch 分支 return）；连续切两次→每次 watch 都令 reqSeq 递增，只有最新序号能写入；切回原服务器→`props.server?.id` watch 会话每次变化都令旧序号作废，即使 id 数值巧合相同，序号本身单调递增不会回退，故不会误放行。四种情形均不串台。

两条对应测试（`McpServerDetail.test.ts:397-411` 丢弃用例、`:413-422` 对照用例）确实有判别力：丢弃用例让旧 promise 在 `setProps` 切换**之后**才 resolve（`resolveOld` 延后调用），不是「查结果面板不存在」这种在切换后本来就成立的弱写法；对照用例证明守卫不会误伤未切换场景。已用自己独立设计的 RED 探针验证（见下）。

### ② D8 呈现——对照设计文档 §5.3

- `error_key` 四值映射：`probe_timeout→aiMcpSrvTestErrTimeout` / `connect_failed→aiMcpSrvTestErrConnect` / `list_timeout→aiMcpSrvTestErrListTimeout` / `list_failed→aiMcpSrvTestErrListFailed`，均在 `src/ai/util/mcpErrorKey.ts:88-93` 的 `toTestView` 里逐值对上，未知值落 `aiMcpSrvTestFailed` 兜底——与设计表格一致。
- 502 `agent unreachable` 走 `toTestViewFromError`（`mcpErrorKey.ts:101-112`），`status===502 || bodyError==='agent unreachable'` 判定，专用键 `aiMcpSrvTestErrAgentDown`——一致。
- `detail` 为空时折叠区不渲染：模板 `v-if="testView.detail"`（`.vue:331`），`detailOf()` 空值归一成 `''`（falsy）——一致，且有对照测试（`detail 为空时不渲染折叠区`）。
- `<details>` 默认折叠：无 `open` 属性（`.vue:331`），测试断言 `d.attributes('open')).toBeUndefined()`——一致。
- `summary` 文案 `aiMcpSrvTestDetail`（`.vue:332`）——一致。
- 自己 grep 确认 `McpTestView` 判别联合（`src/ai/types/mcpServer.ts:94-96`）失败分支根本**没有** `error` 字段——类型层面就杜绝了后端英文串进视图，不只是模板没写。逐路径确认界面文本：成功路径只有 `msgKey`/`toolCount`/`tools`；失败路径（`connect_failed`/`probe_timeout`/502）测试里都断言 `w.text()).not.toContain(<英文原串>)` 且全部通过。

### ③ 单层取数

`src/ai/components/settings/mcp/McpServerDetail.vue:134`：`const body = await service.ai.testMCPServer(id)` 直接交给 `toTestView(body)`，无第二层 `.data`。回源核实 `/home/nimo/NimoTech/.sp8/NimoOS-Service/src/ai.ts:388-391`：

```ts
async testMCPServer(id: string | number): Promise<unknown> {
  const res = await http.post(`${PREFIX}/mcp/servers/${id}/test`, {}, { timeout: 110000 })
  return res.data
},
```

确实已单层化。命中设计 §3 D1 第 3 处。

### ④ 与 Vue2 的 1:1

对照 Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerDetail.vue`：
- 按钮 `:50-53` vs `.vue:274-277`：class、`:disabled="testing"`、spinner `v-if="testing"`、文案切换逐字一致。
- `mcp-test-hint` 条件 `:87` vs `.vue:312`：`testing && server.transport === 'stdio'`，逐字一致。
- 结果面板 `data-ok` 属性、`✓`/`✗` 字符（Vue2 `:92,98`）逐字保留。
- 工具 chip `v-for`：Vue2 用循环变量名 `t`（与 `$t()` 不冲突，因为 Vue2 用全局 `$t`）；本仓 `useI18n()` 解构出局部 `t`，若沿用 `t` 会遮蔽 i18n 函数，改名 `tool` 是必要的标识符调整，不影响 DOM/key，可接受。
- 重复点击守卫 `if (!props.server || testing.value) return`（`.vue:123`）与 Vue2 `:159` 逐字对应，测试覆盖。

### ⑤ 落点

T6 遗留的三处占位注释（脚本 `runTest`、模板按钮、模板结果面板）经 diff 确认**全部被替换**，无残留占位标记；插入位置与 Vue2 行序一致（section-head 按钮 → section-body 提示/结果面板 → script 内 `runTest`/`watch`）。

### ⑥ 测试组织

- mock 用 `vi.hoisted()`（`McpServerDetail.test.ts:19-20`），避免 TDZ。
- 用 `diff` 逐行核对 T6 交付版（`git show b9ac9e1:...`，21 条）与当前版本：**21 条既有用例的断言原文一字未改**，唯一的改动是文件头两行 import/注释追加、`vi.hoisted` 骨架插入、以及在文件尾部**新增独立** `describe('测试连接', …)` 块（11 条）。无弱化/删除。
- 自跑 `pnpm exec vitest run McpServerDetail.test.ts` → `32 passed`，与「21+11=32」吻合。
- mock 返回全部是裸对象（`{ok:true, tool_count:2, tools:[...]}` 等），未见 `{data:…}` 包装。
- 异步断言全部用 `flushPromises()`，仅在同步状态检查（如刚 `trigger('click')` 后立即查 disabled/spinner）用 `nextTick()`，符合公共约束用法。

### ⑦ 判别力（A/B 对照）

stdio 提示 vs http 不提示（两次挂载对照）✅；detail 有 vs 无 ✅；成功 vs 失败 ✅；D11 丢弃 vs 正常落地对照 ✅。均有两侧用例，非空转。

## RED 探针

### 探针 1（独立设计，非复述实现者的两次）：finally 分支的序号守卫

实现者的两次 RED 探针只覆盖了「D11 成功分支守卫」与「单层取数」，**未覆盖 finally 分支自身**。我独立设计了针对 finally 分支的破坏：把

```ts
} finally {
  if (seq === reqSeq.value) testing.value = false
}
```

改成

```ts
} finally {
  testing.value = false
}
```

（即让 finally 无条件复位 `testing`，不再比对序号）。

破坏后跑 `pnpm exec vitest run src/ai/components/settings/mcp/McpServerDetail.test.ts`：

```
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

**32 条全部仍然绿。** 说明现有测试集**没有**任何用例能单独抓出「finally 分支不比对序号」这个缺陷——需要的场景是：切到新服务器后**在新服务器上再次点击测试**（新一轮 `testing=true`，新 seq），旧服务器的请求此时才 resolve/reject，若 finally 无条件复位会把新一轮的 `testing` 错误打回 false（界面从「测试中…」跳回空闲，而新请求其实还在跑）——这正是任务书本身点名的最危险场景，但 brief 给的 11 条用例里没有一条构造这个「新一轮已经在途」的时序。

**已精确还原**：`cp /tmp/McpServerDetail.vue.bak` 覆盖回原文件，`git status --porcelain` 输出为空（干净）。

生产代码本身是**正确**的（finally 分支确实比对了 `seq === reqSeq.value`，见 ①），这不是功能缺陷，而是**测试覆盖缺口**：finally 分支的守卫没有专属的判别性用例，未来若被误改会漏检。定为 Important（test-coverage），不影响本次 Quality 判定为「通过」，但建议登记台账供后续任务顺手补一条。

## 发现清单

- **[Important][test-coverage]** `finally` 分支的 `seq === reqSeq.value` 守卫没有专属判别性测试——独立 RED 探针证实：把该分支改成无条件复位 `testing.value = false`，32 条既有用例全部仍绿。生产代码本身正确，仅测试覆盖有缺口。建议后续补一条「切换后旧请求晚于新一轮请求落地，finally 不应打断新一轮 testing 态」的用例。
- 其余核对项（D8 映射、单层取数、1:1 视觉、落点替换、mock 组织、判别力对照）均无发现。

## 自己实测的三门数字

```
pnpm test:                 Test Files 300 passed (300) / Tests 2660 passed (2660)  exit=0
pnpm exec vue-tsc --noEmit: (无输出)                                                exit=0
pnpm build:                 built in 11.90s，仅既有第三方包体积警告                   exit=0
```

**color-guard 算术核对**：T6 收官 300 文件 / 2649 例（`p4-task-6-review.md` 已核对的基线）。本任务**未新增** `.vue`（只改 T6 建的 `McpServerDetail.vue`）→ color-guard 全量文件数**应不变**；本任务新增 11 条独立用例 → 总用例数应为 2649 + 11 = 2660。实测 300 文件 / 2660 例，与算术吻合。另单独跑 `src/styles/color-guard.test.ts` 得 169 例（对应仓库现有 167 个 `.vue` 文件 + 2 条非逐文件用例），与 T6 之后未新增 `.vue` 的预期一致。

## 提交范围

`git show --stat HEAD`（39fed70）只含 `src/ai/components/settings/mcp/McpServerDetail.vue` 与
`McpServerDetail.test.ts` 两个文件，符合任务范围。

## §3.5「照抄不改」5 条

本任务不涉及 N1-N5（均属 `McpServerModal`/`parsePaste` 范围）——核对属实，未被「顺手修正」。

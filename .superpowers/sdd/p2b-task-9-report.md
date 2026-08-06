# SP8-P2b Task 9 报告 —— `mcpConnect` 纯函数

## 逐文件改了什么

- **新建** `src/ai/util/mcpConnect.ts`:5 项导出，1:1 取自 Vue2
  `NimoOS-UI/src/views/AI/Settings/sections/McpTokensSection.vue`：
  - `MCP_PLACEHOLDER_TOKEN = '<YOUR_TOKEN>'` ← Vue2 `:128` `PLACEHOLDER_TOKEN`。
  - `mcpEndpointUrl(origin?)` ← Vue2 `:138-141` `endpointUrl` computed。
  - `buildMcpInstruction(template, endpointUrl, token)` ← Vue2 `:157-161` `buildInstruction`
    （保留 `.split(x).join(y)` 写法，不改成 `.replace`，因为模板里 `{url}` 出现不止一次）。
  - `buildMcpJson(endpointUrl, token)` ← Vue2 `:162-166` `buildJson`。
  - `formatEpochMs(ms)` ← Vue2 `:209-216` `fmtCreated`/`fmtLastUsed` 共享的
    「按毫秒（不 ×1000）格式化，空值给 `'-'`」核心；`$t('Created')`/`$t('Last used')`/
    `$t('Never used')` 的文案前缀留给 Task 10 组件层拼接，不进本纯函数模块（brief 明确
    只要求 `formatEpochMs`，未要求把三种前缀文案也搬进来；已在代码注释里申报）。
- **新建** `src/ai/util/mcpConnect.test.ts`：9 例，逐字取自 brief Step 1。

## Vue2 file:line → New-UI 标记/行为对照

| Vue2 | New-UI |
|---|---|
| `McpTokensSection.vue:138-141` `endpointUrl` | `mcpEndpointUrl()` |
| `McpTokensSection.vue:157-161` `buildInstruction` | `buildMcpInstruction()` |
| `McpTokensSection.vue:162-166` `buildJson` | `buildMcpJson()` |
| `McpTokensSection.vue:209-211` `fmtCreated`（数值部分） | `formatEpochMs()` |
| `McpTokensSection.vue:213-215` `fmtLastUsed`（数值部分） | `formatEpochMs()` |
| `McpTokensSection.vue:128` `PLACEHOLDER_TOKEN` | `MCP_PLACEHOLDER_TOKEN` |

## 承接的 Vue2 测试断言（`__tests__/McpTokensSection.spec.js`）

5 条（brief 文字里写「6 条」，但列举的名字只有 5 个不重复项，逐一核对如下）：

1. `endpointUrl uses window origin`（spec:82-85）→ `mcpConnect.test.ts` 的
   「mcpEndpointUrl 拼在 origin 后面…」+「不传参时用 window.location.origin」两例。
2. `fmtCreated() formats created_at as ms date-time (no x1000)`（spec:87-91）→
   「formatEpochMs 按毫秒解释时间戳，不再乘 1000」。
3. `fmtLastUsed() shows "Never used" when falsy, else ms date-time`（spec:93-98）→
   数值部分承接进「formatEpochMs 对 0/undefined/null 一律返回 "-"」+ 上一条的 ms 格式化；
   「Never used」文案本身按 D2/i18n 边界移交 Task 10（本任务不产出该文案）。
4. `buildInstruction() inlines the endpoint URL and the token`（spec:100-107）→
   「buildMcpInstruction 把 {url} 与 {token} 全部替换」+「用占位令牌时占位串原样出现」。
5. `buildJson() is valid MCP config JSON with url + bearer`（spec:109-114）→
   「buildMcpJson 是合法 MCP 配置 JSON，带 url 与 Bearer」+「两空格缩进多行文本」。

## RED→GREEN 证据

Step 2（模块不存在）未单独跑（模块与测试文件同一批写入），Step 4 直接跑：
`pnpm test src/ai/util/mcpConnect.test.ts` → 1 file / 9 tests passed。

## 全量测试门

```
pnpm test                    → 282 files / 2238 tests passed（无红项，
                                含已知 flaky persist.test.ts 也是绿的）
pnpm exec vue-tsc --noEmit   → 无输出，通过
pnpm build                   → 通过，只有既有 >500KB chunk 警告
```

## i18n

**无新增、无复用。** 本任务的纯函数按 brief 与「i18n 留在纯模块外」的指示，
`buildMcpInstruction` 的 `template` 参数由调用方（Task 10 组件）传入已翻译文本；
`formatEpochMs` 不产出任何文案前缀。`src/i18n/{zh_cn,en_us}.ts` 未触碰，
未 `git add` 任何 i18n 文件。

## 偏离申报

- **`formatEpochMs` 未复刻 fmtLastUsed 的「Never used」整句**，只保留两者共享的
  「毫秒格式化 + 空值兜底」数值核心，兜底串统一为 Vue2 fmtCreated 的 `'-'`。这是照抄
  brief 给定签名（`formatEpochMs(ms): string // '-' 当空`），非临时决定；「Never used」
  文案交给 Task 10 组件层按 `last_used_at` 是否为空自行选择前缀，不影响本任务测试的
  判别力（对应 Vue2 断言的数值格式化部分已被承接）。
- 时间戳格式化用 `new Date(ms).toLocaleString()`，与 Vue2 完全一致，是环境相关
  （locale/timezone）字符串；但测试里断言的是 `formatEpochMs(ms)` 与
  `new Date(ms).toLocaleString()` 相等 —— 两侧同一次 CI 运行、同一 Node 环境，
  结果必然相同，不存在跨环境不确定性。
- 按 §2 指令，未打开 `SettingsPage.vue`，未做任何接线。

## 提交

`git add src/ai/util/mcpConnect.ts src/ai/util/mcpConnect.test.ts` → commit `e6cbfd7`，
`git show --stat HEAD` 确认只含这两个文件；`git status` 干净。

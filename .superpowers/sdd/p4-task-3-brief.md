# SP8-P4 Task 3 任务书

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

## Task 3: 错误映射 `mcpErrorKey.ts`

**Files:**
- Create: `src/ai/util/mcpErrorKey.ts`
- Test: `src/ai/util/mcpErrorKey.test.ts`

**Interfaces:**
- Consumes: `McpTestResult` / `McpTestView`(T2)
- Produces:
  ```ts
  export function saveServerErrorKey(e: unknown): string
  export function parseCommandErrorKey(e: unknown): string
  export function toTestView(body: unknown): McpTestView          // 200 成功响应体 → 视图
  export function toTestViewFromError(e: unknown): McpTestView    // 抛出的错误 → 视图
  ```

**先例(必须先读):** `src/ai/util/channelsFormat.ts:65-76`(`addBotErrorKey`)· `src/ai/util/apiError.ts`(取值链,**本任务不用它**——它可能返回后端原文)。

**后端串权威源(自己回源复核,不许只信本计划):**
`NimoOS-AI/route/v2/mcp.go:273-289`(validateAndClean)· `mcp.go:152,187,332`(not found)· `pkg/mcpparse/mcpparse.go:36,47,62,76,138`(parse)· `agent/mcp_client/client.py:437,448,453,456`(test)· `route/v2/mcp.go:351`(agent unreachable)。

- [ ] **Step 1: 写失败的测试 `mcpErrorKey.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  saveServerErrorKey, parseCommandErrorKey, toTestView, toTestViewFromError,
} from './mcpErrorKey'

/** 造一个 axios 风格的错误(共享包不吞 error,原样抛)。 */
function httpErr(status: number, data: unknown) {
  return Object.assign(new Error('Request failed'), { response: { status, data } })
}

describe('saveServerErrorKey —— 后端 validateAndClean 的三条 400', () => {
  it('url required for http/sse', () => {
    expect(saveServerErrorKey(httpErr(400, { message: 'url required for http/sse' })))
      .toBe('aiMcpSrvErrUrlRequired')
  })
  it('command required for stdio', () => {
    expect(saveServerErrorKey(httpErr(400, { message: 'command required for stdio' })))
      .toBe('aiMcpSrvErrCommandRequired')
  })
  it("transport must be 'http', 'sse' or 'stdio'", () => {
    expect(saveServerErrorKey(httpErr(400, { message: "transport must be 'http', 'sse' or 'stdio'" })))
      .toBe('aiMcpSrvErrBadTransport')
  })
  it('404 mcp server not found', () => {
    expect(saveServerErrorKey(httpErr(404, { message: 'mcp server not found' })))
      .toBe('aiMcpSrvErrNotFound')
  })
  it('大小写与首尾空白不敏感', () => {
    expect(saveServerErrorKey(httpErr(400, { message: '  URL Required For HTTP/SSE  ' })))
      .toBe('aiMcpSrvErrUrlRequired')
  })
  it('认不出的一律落通用兜底键,绝不回显后端原文', () => {
    const k = saveServerErrorKey(httpErr(500, { message: 'sql: database is locked' }))
    expect(k).toBe('aiCfgSaveFailed')
    expect(k).not.toContain('sql')
  })
  it('无 response / 网络错 → 通用兜底', () => {
    expect(saveServerErrorKey(new Error('Network Error'))).toBe('aiCfgSaveFailed')
    expect(saveServerErrorKey(null)).toBe('aiCfgSaveFailed')
    expect(saveServerErrorKey(undefined)).toBe('aiCfgSaveFailed')
  })
  it('也读 FastAPI 的 detail 形状(同 channelsFormat 的双读惯例)', () => {
    expect(saveServerErrorKey(httpErr(400, { detail: 'command required for stdio' })))
      .toBe('aiMcpSrvErrCommandRequired')
  })
})

describe('parseCommandErrorKey —— mcpparse 的五条 400', () => {
  it('empty command', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'empty command' })))
      .toBe('aiMcpSrvParseErrEmpty')
  })
  // 「没解析出可执行的命令」是同一个用户可见原因的两种后端措辞,合并到一个键。
  // (合并前已按 P3b 教训 2 检查过:两条对用户而言就是同一件事——粘贴的内容里
  //  找不到可执行命令,措辞差异只反映后端在哪一步发现的。)
  it('no command after parsing → 同一个「没有可执行命令」键', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'no command after parsing' })))
      .toBe('aiMcpSrvParseErrNoCommand')
  })
  it("no command after '--' → 同一个「没有可执行命令」键", () => {
    expect(parseCommandErrorKey(httpErr(400, { message: "no command after '--'" })))
      .toBe('aiMcpSrvParseErrNoCommand')
  })
  it('no command (only environment variables) → 独立的键(原因不同:只有环境变量)', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
      .toBe('aiMcpSrvParseErrOnlyEnv')
  })
  it('unbalanced quotes in command', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'unbalanced quotes in command' })))
      .toBe('aiMcpSrvParseErrQuotes')
  })
  // 判别力:「只有环境变量」的串以 "no command" 开头,若实现用 startsWith 匹配
  // 会被 NoCommand 抢走。这条钉住优先级。
  it('「只有环境变量」不能被「没有可执行命令」抢走', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
      .not.toBe('aiMcpSrvParseErrNoCommand')
  })
  it('认不出的落通用兜底,不回显原文', () => {
    const k = parseCommandErrorKey(httpErr(400, { message: 'some brand new parser error' }))
    expect(k).toBe('aiMcpSrvParseFailed')
    expect(k).not.toContain('brand new')
  })
})

describe('toTestView —— 200 响应体 → 视图', () => {
  it('成功', () => {
    expect(toTestView({ ok: true, tool_count: 3, tools: ['a', 'b', 'c'] }))
      .toEqual({ ok: true, toolCount: 3, tools: ['a', 'b', 'c'] })
  })
  it('成功但 tools 缺失 → 空数组,tool_count 缺失 → 0', () => {
    expect(toTestView({ ok: true })).toEqual({ ok: true, toolCount: 0, tools: [] })
  })
  it('probe_timeout', () => {
    expect(toTestView({ ok: false, error_key: 'probe_timeout', error: 'Probe timed out' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrTimeout', detail: '' })
  })
  it('connect_failed 带 detail', () => {
    expect(toTestView({
      ok: false, error_key: 'connect_failed',
      error: 'Connection failed: All connection attempts failed',
      detail: 'All connection attempts failed',
    })).toEqual({
      ok: false, msgKey: 'aiMcpSrvTestErrConnect', detail: 'All connection attempts failed',
    })
  })
  it('list_timeout', () => {
    expect(toTestView({ ok: false, error_key: 'list_timeout' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListTimeout', detail: '' })
  })
  it('list_failed', () => {
    expect(toTestView({ ok: false, error_key: 'list_failed', detail: 'boom' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: 'boom' })
  })
  // 判别力:后端拼好的英文 error 串绝不能漏进视图。四个 error_key 各钉一次。
  it('后端的 error 英文串永不进入视图', () => {
    for (const key of ['probe_timeout', 'connect_failed', 'list_timeout', 'list_failed']) {
      const v = toTestView({ ok: false, error_key: key, error: 'LEAKED-ENGLISH-STRING' })
      expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
    }
  })
  it('未知 error_key → 通用兜底键,detail 仍保留', () => {
    expect(toTestView({ ok: false, error_key: 'brand_new_key', detail: 'd' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: 'd' })
  })
  it('完全不是对象 / null / undefined → 失败 + 通用兜底', () => {
    expect(toTestView(null)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
    expect(toTestView(undefined)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
    expect(toTestView('nope')).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
  })
  it('detail 非字符串时归一成空串', () => {
    expect(toTestView({ ok: false, error_key: 'list_failed', detail: { a: 1 } }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: '' })
  })
})

describe('toTestViewFromError —— 抛出的错误 → 视图', () => {
  it('502 agent unreachable(mcp.go:351)', () => {
    expect(toTestViewFromError(httpErr(502, { ok: false, error: 'agent unreachable' })))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
  })
  it('404 mcp server not found', () => {
    expect(toTestViewFromError(httpErr(404, { message: 'mcp server not found' })))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvErrNotFound', detail: '' })
  })
  it('网络错 / 无 response → 通用兜底', () => {
    expect(toTestViewFromError(new Error('Network Error')))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
  })
  it('任意后端原文都不进入视图', () => {
    const v = toTestViewFromError(httpErr(500, { message: 'LEAKED-ENGLISH-STRING' }))
    expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run src/ai/util/mcpErrorKey.test.ts
```

预期:FAIL（`Failed to resolve import "./mcpErrorKey"`)。

- [ ] **Step 3: 写实现**

结构照 `channelsFormat.ts:65-76`:**纯函数不碰 vue-i18n**,只返回键,调用方 `t()`。
必须包含的实现要点:

```ts
// 取后端错误串:同时读 Go 的 message 与 FastAPI 的 detail(承 channelsFormat
// 与 apiError 的双读惯例);匹配前 trim + toLowerCase。
function rawMessage(e: unknown): string { /* … */ }
```

- `saveServerErrorKey`:三条 validate 串 + `mcp server not found` → 对应键;**其余一律 `'aiCfgSaveFailed'`**
- `parseCommandErrorKey`:五条 parse 串 → 四个键(两条合并,见测试注释);其余 `'aiMcpSrvParseFailed'`
  ⚠️ **匹配必须用相等而非 `startsWith`**,否则 `no command (only environment variables)` 会被 `no command after parsing` 之外的前缀逻辑吃掉(测试已钉)
- `toTestView`:`error_key` 四值查表 → 键;`detail` 只在是字符串时保留,否则 `''`;`ok:true` 时 `tool_count ?? 0`、`tools` 非数组 → `[]`
- `toTestViewFromError`:先看 body 的 `error === 'agent unreachable'` **或** `status === 502` → agentDown;再看 `mcp server not found` → notFound;否则通用兜底。**永不把 body 里的任何字符串放进 `detail`**(那是后端英文原文)

文件头注释必须写明:为什么不用 `apiError.apiErrorMessage`(它可能返回后端原文,`apiError.ts:18-20` 自己就写了这个警告)。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run src/ai/util/mcpErrorKey.test.ts
```

预期:PASS。

- [ ] **Step 5: RED 探针(必做,贴两段输出)**

把 `parseCommandErrorKey` 里 `no command (only environment variables)` 那条分支删掉 → 跑测试 → 确认「『只有环境变量』不能被『没有可执行命令』抢走」与「no command (only environment variables) → 独立的键」两条**精确报红** → 精确还原 → 再跑确认全绿、`git status` 干净。

- [ ] **Step 6: 跑全量三门**

命令同 T1 Step 6(日志名 `p4-t3-*`)。**本任务不新增 `.vue`。**

- [ ] **Step 7: Commit**

```bash
git add src/ai/util/mcpErrorKey.ts src/ai/util/mcpErrorKey.test.ts
git commit -m "feat(ai): SP8-P4 T3 MCP 错误映射(后端串→i18n 键,界面零原文)"
```

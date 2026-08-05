## Task 9: `mcpConnect` 纯函数

**Files:**
- Create: `src/ai/util/mcpConnect.ts`
- Create: `src/ai/util/mcpConnect.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function mcpEndpointUrl(origin?: string): string
  export function buildMcpInstruction(template: string, endpointUrl: string, token: string): string
  export function buildMcpJson(endpointUrl: string, token: string): string
  export function formatEpochMs(ms: number | undefined | null): string   // '-' 当空
  export const MCP_PLACEHOLDER_TOKEN = '<YOUR_TOKEN>'
  ```
  Task 10 消费全部五项。

**背景：** Vue2 把这些写成 `computed` / `methods`，既有测试用 `M.buildJson.call(ctx, 'token')` 借 this 直调。`<script setup>` 没有 methods 对象可借，**不抽成纯函数就只能靠挂载组件查 DOM 间接验证，会削弱 Vue2 那 6 条断言的判别力**（`endpointUrl uses window origin` / `fmtCreated…no x1000` / `fmtLastUsed…` / `buildInstruction…` / `buildJson is valid MCP config JSON`）。这是保住既有覆盖的必要条件。

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, it, expect } from 'vitest'
import {
  mcpEndpointUrl, buildMcpInstruction, buildMcpJson, formatEpochMs, MCP_PLACEHOLDER_TOKEN,
} from './mcpConnect'

describe('mcpConnect', () => {
  it('mcpEndpointUrl 拼在 origin 后面并以 / 结尾（承接 Vue2「endpointUrl uses window origin」）', () => {
    expect(mcpEndpointUrl('http://nas.local')).toBe('http://nas.local/v1/ai/mcp-rpc/')
    expect(mcpEndpointUrl('http://nas.local').endsWith('/v1/ai/mcp-rpc/')).toBe(true)
  })

  it('mcpEndpointUrl 不传参时用 window.location.origin', () => {
    expect(mcpEndpointUrl()).toBe(`${window.location.origin}/v1/ai/mcp-rpc/`)
  })

  it('mcpEndpointUrl 在 origin 为空时退化成相对路径（不产出 "undefined/v1/..."）', () => {
    expect(mcpEndpointUrl('')).toBe('/v1/ai/mcp-rpc/')
  })

  it('buildMcpInstruction 把 {url} 与 {token} 全部替换（承接 Vue2 同名用例）', () => {
    const tpl = 'connect url={url} token={token} again={url}'
    const out = buildMcpInstruction(tpl, 'http://nas.local/v1/ai/mcp-rpc/', 'secret')
    expect(out).toBe('connect url=http://nas.local/v1/ai/mcp-rpc/ token=secret again=http://nas.local/v1/ai/mcp-rpc/')
    expect(out).not.toContain('{url}')
    expect(out).not.toContain('{token}')
  })

  it('buildMcpInstruction 用占位令牌时占位串原样出现', () => {
    const out = buildMcpInstruction('token={token}', 'u', MCP_PLACEHOLDER_TOKEN)
    expect(out).toContain('<YOUR_TOKEN>')
  })

  it('buildMcpJson 是合法 MCP 配置 JSON，带 url 与 Bearer（承接 Vue2 同名用例）', () => {
    const parsed = JSON.parse(buildMcpJson('http://nas.local/v1/ai/mcp-rpc/', 'secret'))
    expect(parsed.mcpServers.nimoos.url).toBe('http://nas.local/v1/ai/mcp-rpc/')
    expect(parsed.mcpServers.nimoos.headers.Authorization).toBe('Bearer secret')
  })

  it('buildMcpJson 是两空格缩进的多行文本（照 Vue2 JSON.stringify(…, null, 2)，textarea 要可读）', () => {
    expect(buildMcpJson('u', 't')).toContain('\n  "mcpServers"')
  })

  it('formatEpochMs 按毫秒解释时间戳，不再乘 1000（承接 Vue2「no x1000」）', () => {
    const ms = 1710000000000
    expect(formatEpochMs(ms)).toBe(new Date(ms).toLocaleString())
  })

  it('formatEpochMs 对 0 / undefined / null 一律返回 "-"', () => {
    expect(formatEpochMs(0)).toBe('-')
    expect(formatEpochMs(undefined)).toBe('-')
    expect(formatEpochMs(null)).toBe('-')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/ai/util/mcpConnect.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现**

```ts
// SP8-P2b Task 9 —— 1:1 取自 Vue2 src/views/AI/Settings/sections/McpTokensSection.vue
// 的 endpointUrl computed(:157-162)与 buildInstruction/buildJson/fmtCreated/
// fmtLastUsed 四个 methods(:167-176、:213-221)。
//
// 抽成纯函数的理由:Vue2 既有测试用 `M.buildJson.call(ctx, token)` 借 this 直调
// methods,<script setup> 没有 methods 对象可借;不抽出来那 6 条断言只能降级成
// 「挂载后查 textarea 文本」,判别力变弱。
export const MCP_PLACEHOLDER_TOKEN = '<YOUR_TOKEN>'

const MCP_PATH = '/v1/ai/mcp-rpc/'

export function mcpEndpointUrl(origin?: string): string {
  const o = origin ?? (typeof window !== 'undefined' ? window.location?.origin : '') ?? ''
  return o + MCP_PATH
}

export function buildMcpInstruction(template: string, endpointUrl: string, token: string): string {
  // Vue2 用 .split(x).join(y) 而不是 .replace(x, y) —— 因为 replace 只换第一处。
  // 模板里 {url} 确实出现不止一次,照搬这个写法。
  return template.split('{url}').join(endpointUrl).split('{token}').join(token)
}

export function buildMcpJson(endpointUrl: string, token: string): string {
  return JSON.stringify(
    { mcpServers: { nimoos: { url: endpointUrl, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  )
}

export function formatEpochMs(ms: number | undefined | null): string {
  // Vue2 :215 —— created_at / last_used_at 后端给的是**毫秒**,不要再 ×1000。
  return ms ? new Date(ms).toLocaleString() : '-'
}
```

- [ ] **Step 4: 跑测试确认通过（9 例）+ 全量测试门 + 提交**

```bash
pnpm test src/ai/util/mcpConnect.test.ts
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/util/mcpConnect.ts src/ai/util/mcpConnect.test.ts
git commit -m "SP8-P2b Task 9: mcpConnect 纯函数(端点/接入说明/配置 JSON/时间格式化)"
git show --stat HEAD && git status
```

---


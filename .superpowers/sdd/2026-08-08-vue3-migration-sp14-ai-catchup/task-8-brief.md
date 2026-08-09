### Task 8: #141 MCP 协议版本探测

**Files:**
- Modify: `src/ai/types/mcpServer.ts:95-97`（`McpTestView` 成功态加三字段）
- Modify: `src/ai/util/mcpErrorKey.ts`（`toTestView` 归一 + `connect_timeout`）
- Create: `src/ai/util/mcpProtocol.ts` + `src/ai/util/mcpProtocol.test.ts`
- Modify: `src/ai/util/mcpErrorKey.test.ts`
- Modify: `src/ai/components/settings/mcp/McpServerDetail.vue`
- Modify: `src/ai/styles/mcp-styles.scss`
- Modify: `packages/service/src/ai.ts`（timeout 135000，**独立 commit**）
- Modify: `src/i18n/zh_cn.ai.ts` · `src/i18n/en_us.ai.ts`

**Interfaces:**
- Produces:
  ```ts
  // types/mcpServer.ts
  export type McpTestView =
    | { ok: true; toolCount: number; tools: string[]
        protocolEra: string; protocolVersion: string; supportedVersions: string[] }
    | { ok: false; msgKey: string; detail: string }
  // util/mcpProtocol.ts
  export function protocolLine(v: McpTestView): { key: string; params: Record<string, string> } | null
  ```

**新增 i18n 键**：

| 键 | zh_cn | en_us |
|---|---|---|
| `aiMcpSrvProtoOnly` | `协议 {version}` | `Protocol {version}` |
| `aiMcpSrvProtoAlso` | `协议 {version} · 另支持 {list}` | `Protocol {version} · also supports {list}` |
| `aiMcpSrvProtoLegacy` | `不支持最新协议 · 协商到 {version}` | `Latest protocol not supported · negotiated {version}` |
| `aiMcpSrvTestErrConnectTimeout` | `连接超时` | `Connection timed out` |

**改文案**：`aiMcpSrvTestStdioHint` 改成不带数字的说法 —— zh：`stdio 首次可能需要几分钟（会现场下载 server）。`；en：`This can take up to a couple of minutes for stdio (first run downloads the server).`

- [ ] **Step 1: 写 `protocolLine` 的失败测试**

`src/ai/util/mcpProtocol.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { protocolLine } from './mcpProtocol'
import type { McpTestView } from '../types/mcpServer'

function ok(over: Partial<Extract<McpTestView, { ok: true }>> = {}): McpTestView {
  return {
    ok: true, toolCount: 1, tools: ['a'],
    protocolEra: 'modern', protocolVersion: '2025-06-18', supportedVersions: ['2025-06-18'],
    ...over,
  }
}

describe('protocolLine', () => {
  it('modern 且只有协商版本 → 单版本行', () => {
    expect(protocolLine(ok())).toEqual({ key: 'aiMcpSrvProtoOnly', params: { version: '2025-06-18' } })
  })

  it('modern 且还声明了别的 → 另支持行(剔掉协商版本本身)', () => {
    expect(protocolLine(ok({ supportedVersions: ['2025-06-18', '2024-11-05', '2025-03-26'] })))
      .toEqual({ key: 'aiMcpSrvProtoAlso', params: { version: '2025-06-18', list: '2024-11-05, 2025-03-26' } })
  })

  it('legacy → 不支持最新协议行', () => {
    expect(protocolLine(ok({ protocolEra: 'legacy', protocolVersion: '2024-11-05' })))
      .toEqual({ key: 'aiMcpSrvProtoLegacy', params: { version: '2024-11-05' } })
  })

  it('era 为 unknown → 不渲染', () => {
    expect(protocolLine(ok({ protocolEra: 'unknown' }))).toBeNull()
  })

  it('旧后端整个不给这些字段 → 不渲染,且绝不打印 undefined', () => {
    expect(protocolLine(ok({ protocolEra: '', protocolVersion: '', supportedVersions: [] }))).toBeNull()
  })

  it('era 是 modern 但版本号为空 → 不渲染(宁可不显示也不显示半句话)', () => {
    expect(protocolLine(ok({ protocolVersion: '' }))).toBeNull()
  })

  it('失败态一律不渲染', () => {
    expect(protocolLine({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/ai/util/mcpProtocol.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 扩类型 + 归一 + 纯函数**

`src/ai/types/mcpServer.ts`：成功态改成

```ts
export type McpTestView =
  | {
      ok: true; toolCount: number; tools: string[]
      // #141:后端 200 里的协议协商结果。旧后端整个不给这三项,归一成 '' / []。
      protocolEra: string; protocolVersion: string; supportedVersions: string[]
    }
  | { ok: false; msgKey: string; detail: string }
```

`src/ai/util/mcpErrorKey.ts::toTestView` 成功态改成：

```ts
  if (b.ok === true) {
    const raw = body as { protocol_era?: unknown; protocol_version?: unknown; supported_versions?: unknown }
    return {
      ok: true,
      toolCount: typeof b.tool_count === 'number' ? b.tool_count : 0,
      tools: Array.isArray(b.tools) ? b.tools : [],
      // 旧后端不给这三项 —— 归一成空,视图据此整行不渲染,绝不打印 undefined。
      protocolEra: typeof raw.protocol_era === 'string' ? raw.protocol_era : '',
      protocolVersion: typeof raw.protocol_version === 'string' ? raw.protocol_version : '',
      supportedVersions: Array.isArray(raw.supported_versions)
        ? raw.supported_versions.filter((v): v is string => typeof v === 'string')
        : [],
    }
  }
```
并在 `switch (b.error_key)` 里加一条：
```ts
    case 'connect_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrConnectTimeout', detail }
```

`src/ai/util/mcpProtocol.ts`：

```ts
// SP14 T8(Vue2 #141)—— 连接测试成功时那一行协议版本文案。
//
// 与 Vue2 的差别只有一处:Vue2 把这段写在 McpServerDetail 的 computed 里,本仓照
// mcpErrorKey 的既有分工,纯函数只产 i18n 键 + 参数,由视图 t() 出当前语言。
// 合成一个元素而不是 modern/legacy 两个近似 div —— 两者只差一个条件与一个类。
import type { McpTestView } from '../types/mcpServer'

export function protocolLine(v: McpTestView): { key: string; params: Record<string, string> } | null {
  if (!v.ok) return null
  const version = v.protocolVersion
  // era 不是这两个值(含 'unknown'、含旧后端整个不给)就整行不渲染;
  // 版本号为空也不渲染 —— 宁可什么都不显示,也不显示半句话。
  if (!version) return null
  if (v.protocolEra === 'legacy') return { key: 'aiMcpSrvProtoLegacy', params: { version } }
  if (v.protocolEra !== 'modern') return null
  // modern:supported_versions 是服务端自己的完整声明,双时代服务端会把旧修订也列在
  // 这里。协商到的那个单独显示,其余作为「另支持」。
  const list = v.supportedVersions.filter((x) => x !== version)
  return list.length
    ? { key: 'aiMcpSrvProtoAlso', params: { version, list: list.join(', ') } }
    : { key: 'aiMcpSrvProtoOnly', params: { version } }
}
```

- [ ] **Step 4: 补 `toTestView` 的测试**

在 `src/ai/util/mcpErrorKey.test.ts` 里新增：

```ts
it('toTestView 带上协议三字段', () => {
  expect(toTestView({ ok: true, tool_count: 2, tools: ['a', 'b'],
    protocol_era: 'modern', protocol_version: '2025-06-18',
    supported_versions: ['2025-06-18', '2024-11-05'] })).toEqual({
    ok: true, toolCount: 2, tools: ['a', 'b'],
    protocolEra: 'modern', protocolVersion: '2025-06-18',
    supportedVersions: ['2025-06-18', '2024-11-05'],
  })
})

it('toTestView:旧后端不给协议字段时归一成空,不是 undefined', () => {
  expect(toTestView({ ok: true, tool_count: 0, tools: [] })).toEqual({
    ok: true, toolCount: 0, tools: [],
    protocolEra: '', protocolVersion: '', supportedVersions: [],
  })
})

it('toTestView:connect_timeout 有专属键', () => {
  expect(toTestView({ ok: false, error_key: 'connect_timeout', detail: 'x' }))
    .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrConnectTimeout', detail: 'x' })
})
```

- [ ] **Step 5: 接进视图**

`McpServerDetail.vue`：`<script setup>` 里 `import { protocolLine } from '../../../util/mcpProtocol'`（**路径按该文件既有的相对深度写，别照抄**）并加

```ts
const protoLine = computed(() => (testView.value ? protocolLine(testView.value) : null))
```

模板里，成功分支的 `.mcp-test-tools` 之后加一个元素：

```vue
                  <div v-if="protoLine" class="mcp-test-proto" :class="{ 'is-legacy': protoLine.key === 'aiMcpSrvProtoLegacy' }">
                    {{ t(protoLine.key, protoLine.params) }}
                  </div>
```

`src/ai/styles/mcp-styles.scss` 在 `.mcp-tool-chip` 规则之后加：

```scss
.mcp-test-proto { margin-top: 6px; font-size: 13px; color: var(--text-secondary); }
.mcp-test-proto.is-legacy { color: var(--warning); }
```

同时把 `McpServerDetail.vue:313` 那行「stdio 90 秒提示照抄」的注释改成说明「文案已去掉具体秒数，因为那个数字跨仓漂过两次」。

- [ ] **Step 6: 补组件测试**

在 `src/ai/components/settings/mcp/McpServerDetail.test.ts` 里新增三例（照该文件既有的 mock 与挂载写法）：
1. 后端返 `protocol_era: 'modern'` + 两个版本 → 页面出现「协议 2025-06-18 · 另支持 2024-11-05」，元素带 `.mcp-test-proto` 且**不带** `.is-legacy`；
2. `protocol_era: 'legacy'` → 元素带 `.is-legacy`；
3. `protocol_era: 'unknown'` → `.mcp-test-proto` 不存在，且整页文本里搜不到 `undefined`。

- [ ] **Step 7: 加 i18n 键 + 改 stdio 提示（zh + en 双写）**

- [ ] **Step 8: 跑测试**

Run: `pnpm exec vitest run src/ai/util/mcpProtocol.test.ts src/ai/util/mcpErrorKey.test.ts src/ai/components/settings/mcp/ src/i18n/parity.test.ts`
Expected: PASS。

- [ ] **Step 9: Commit（前端部分）**

```bash
git add src/ai/types/mcpServer.ts src/ai/util/mcpProtocol.ts src/ai/util/mcpProtocol.test.ts \
        src/ai/util/mcpErrorKey.ts src/ai/util/mcpErrorKey.test.ts \
        src/ai/components/settings/mcp/McpServerDetail.vue src/ai/components/settings/mcp/McpServerDetail.test.ts \
        src/ai/styles/mcp-styles.scss src/i18n/zh_cn.ai.ts src/i18n/en_us.ai.ts
git commit -m "$(cat <<'EOF'
feat(ai): show which MCP protocol version a server negotiated

A dual-era server lists its legacy revisions alongside the negotiated one,
so the line names the negotiated version and folds the rest into "also
supports"; a legacy-era server gets a warning-coloured line instead. Servers
reporting an unknown era, and older backends that omit the fields entirely,
render no line at all rather than printing undefined.

The stdio wait hint drops its hard-coded duration. That number was copied
across a repo boundary and drifted twice in one change set; a number-free
phrasing cannot go stale.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: 改探测超时（包，独立 commit）**

`packages/service/src/ai.ts:389`：

```ts
    // 探测超时链必须外层最大:axios > Go > Python,这样最先放弃的永远是持有子进程与
    // 套接字、能报出准确原因的那一层。Go 代理是 43s(http)/125s(stdio)
    // (NimoOS-AI route/v2/mcp.go),Python 兜底是 TEST_TIMEOUT / STDIO_TEST_TIMEOUT
    // (NimoOS-AI agent/mcp_client/client.py)。这里若是三者里最小的,一个慢但正常的
    // stdio 服务端会在浏览器侧被掐断,准确的探测错误永远到不了用户面前。
    async testMcpServer(id: string | number): Promise<unknown> {
      const res = await http.post(`${PREFIX}/mcp/servers/${id}/test`, {}, { timeout: 135000 })
      return unwrap…  // 保持该函数既有的返回处理不变
    },
```
在 `packages/service/src/ai.test.ts` 里补一例断言 `post` 第三参为 `{ timeout: 135000 }`。

Run: `pnpm exec vitest run packages/service/src/ai.test.ts`
Expected: PASS。

```bash
git add packages/service/src/ai.ts packages/service/src/ai.test.ts
git commit -m "$(cat <<'EOF'
fix(service): keep the MCP probe timeout above the layers beneath it

The probe timeout chain nests outside-in -- axios > Go > Python -- so the
layer owning the subprocess and socket always gives up first and can report
an accurate reason. Splitting the Python budget into phases pushed the stdio
ceiling past this 110s, inverting the outermost link: any stdio probe
running longer than that was aborted in the browser, the panel fell back to
a generic failure, and the real error never surfaced. 135s clears the Go
proxy's 125s stdio ceiling.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---


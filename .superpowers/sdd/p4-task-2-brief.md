# SP8-P4 Task 2 任务书

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

## Task 2: 类型 + 视觉工具

**Files:**
- Create: `src/ai/types/mcpServer.ts`
- Create: `src/ai/util/mcpServerVisual.ts`
- Test: `src/ai/util/mcpServerVisual.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  // types/mcpServer.ts
  export type McpTransport = 'http' | 'sse' | 'stdio'
  export interface McpServer {
    id: number; name: string; transport: string; url: string
    command: string; args: string[]; enabled: boolean
    has_headers: boolean; has_env: boolean
  }
  export interface McpParsed {
    transport: string; command: string; args: string[]
    env: Record<string, string>; url: string; suggested_name: string
  }
  export interface McpTestResult {
    ok: boolean; tool_count?: number; tools?: string[]
    error?: string; error_key?: string; detail?: string
  }
  export interface McpServerFormPayload {
    name: string; transport: string; enabled: boolean
    url?: string; command?: string; args?: string[]
    headers?: Record<string, string>; env?: Record<string, string>
  }
  export type McpTestView =
    | { ok: true; toolCount: number; tools: string[] }
    | { ok: false; msgKey: string; detail: string }

  // util/mcpServerVisual.ts
  export const SERVER_GLYPH = 'drive'
  export function serverColor(name: unknown): string       // 返回 SKILL_COLOR_IDS 之一
  export function transportLabel(t: unknown): string       // 大写化,非串/空 → ''
  ```

**蓝本:** 后端 `NimoOS-AI/route/v2/mcp.go:41-51`(`mcpDTO`)· `pkg/mcpparse/mcpparse.go:13-20`(`Parsed`)· `agent/mcp_client/client.py:432-461`(test 返回)· Vue2 `mcpServerVisual.js`(15 行)。

- [ ] **Step 1: 写 `types/mcpServer.ts`**

体例照 `src/ai/types/skill.ts` 的文件头注释:写明每个 interface 对齐后端哪个文件哪几行、端点前缀是 `/v1/ai`(不是 `/v2/ai` —— P3b 终审 M4 踩过)、**无信封裸返回,消费端单层取数**。

逐字段注释要点(必须写进代码注释):
- `id` 是 **number**(Go `int64`,`mcp.go:42`)
- `args` 后端 `toMcpDTO`(`mcp.go:54-58`)保证非 nil,但消费端仍写 `(s.args || [])` 兜底 —— Go 的 nil slice 会序列化成 `null`,这类兜底是**必要防御,不许删**
- `has_headers` / `has_env` 只是布尔位,**密文永不下发**(`mcp.go:62`)
- `McpParsed.transport` 后端**只会产出 `"http"` 或 `"stdio"`,永不产出 `"sse"`**(`mcpparse.go:38,80`)—— 不是缺陷,SSE 由用户在表单里手选
- `McpTestResult.error_key` 只有 4 个值(`probe_timeout` / `connect_failed` / `list_timeout` / `list_failed`),`detail` 仅 `connect_failed` / `list_failed` 带;**`error` 字段是后端拼好的英文串,本仓不上界面**

- [ ] **Step 2: 写失败的测试 `mcpServerVisual.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { serverColor, transportLabel, SERVER_GLYPH } from './mcpServerVisual'
import { SKILL_COLOR_IDS } from '../components/settings/skills/SkillTile.vue'

const PALETTE = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate']

describe('serverColor', () => {
  it('与 SkillTile 的色板逐字相同(复用同一套 --grad-sk-* token)', () => {
    expect([...SKILL_COLOR_IDS]).toEqual(PALETTE)
  })

  it('同名同色(确定性哈希)', () => {
    expect(serverColor('context7')).toBe(serverColor('context7'))
  })

  it('返回值永远落在色板内', () => {
    for (const n of ['a', 'brave', 'notion', '中文名', 'x'.repeat(200), '@scope/pkg']) {
      expect(PALETTE).toContain(serverColor(n))
    }
  })

  // 判别力:如果实现写死返回 'blue',这条会红。
  it('不同名字能落到至少 3 种不同颜色', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']
    expect(new Set(names.map(serverColor)).size).toBeGreaterThanOrEqual(3)
  })

  it('空名 / null / undefined 回落 blue(Vue2 String(name || "") 的行为)', () => {
    expect(serverColor('')).toBe('blue')
    expect(serverColor(null)).toBe('blue')
    expect(serverColor(undefined)).toBe('blue')
  })

  // 钉住 Vue2 的确切哈希(h = h*31 + charCode,>>> 0),换算法会红。
  it('逐字复刻 Vue2 的哈希取值', () => {
    expect(serverColor('brave')).toBe(PALETTE[hash('brave') % 7])
    expect(serverColor('notion')).toBe(PALETTE[hash('notion') % 7])
    function hash(s: string) {
      let h = 0
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
      return h
    }
  })
})

describe('transportLabel', () => {
  it('大写化', () => {
    expect(transportLabel('http')).toBe('HTTP')
    expect(transportLabel('sse')).toBe('SSE')
    expect(transportLabel('stdio')).toBe('STDIO')
  })
  it('空 / null / undefined → 空串(Vue2 String(t || "") 的行为)', () => {
    expect(transportLabel('')).toBe('')
    expect(transportLabel(null)).toBe('')
    expect(transportLabel(undefined)).toBe('')
  })
})

describe('SERVER_GLYPH', () => {
  it('是 drive —— AgentIcon 里必须存在这个图标名', () => {
    expect(SERVER_GLYPH).toBe('drive')
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm exec vitest run src/ai/util/mcpServerVisual.test.ts
```

预期:FAIL（`Failed to resolve import "./mcpServerVisual"`)。

- [ ] **Step 4: 写 `util/mcpServerVisual.ts`**

```ts
// SP8-P4 Task 2 —— 1:1 移植自 Vue2 src/views/AI/MCP/mcpServerVisual.js(15 行)。
// 哈希算法、色板顺序、取模逐字保留;色板与 SkillTile.vue 的 SKILL_COLOR_IDS
// 完全相同(两边都映射到 tokens.scss:235-241 的 --grad-sk-* 七个渐变 token),
// 故不新建色板、不新增 token。
//
// 类型放宽到 unknown:Vue2 :7 是 `String(name || '')`,对 null/undefined/数字
// 都做了兜底,这里保持同样的宽容度(列表数据来自后端,name 理论上必为 string,
// 但兜底是 Vue2 既有行为,不收紧)。
const PALETTE = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate']

/** Vue2 mcpServerVisual.js:4 —— 后端没有图标字段,全部 MCP 服务统一用这个字形。 */
export const SERVER_GLYPH = 'drive'

/** Vue2 mcpServerVisual.js:6-11 逐字移植。 */
export function serverColor(name: unknown): string {
  const s = String(name || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** Vue2 mcpServerVisual.js:13-15 逐字移植。 */
export function transportLabel(t: unknown): string {
  return String(t || '').toUpperCase()
}
```

- [ ] **Step 5: 跑测试确认通过**

```bash
pnpm exec vitest run src/ai/util/mcpServerVisual.test.ts
```

预期:PASS,全部用例绿。

- [ ] **Step 6: 跑全量三门**

命令同 T1 Step 6(日志名换 `p4-t2-*`)。预期:**296 文件 / 2574+N 例绿**(N = 本任务新增用例数)· tsc 0 · build 0。**本任务不新增 `.vue`,color-guard 用例数不变。**

- [ ] **Step 7: Commit**

```bash
git add src/ai/types/mcpServer.ts src/ai/util/mcpServerVisual.ts src/ai/util/mcpServerVisual.test.ts
git commit -m "feat(ai): SP8-P4 T2 MCP 类型 + 视觉工具(色板复用 SkillTile 七色)"
```

### Task 4: `ElicitField` 类型 + `validateArrayFields` 纯函数

**Files:**
- Create: `src/ai/types/mcpElicit.ts`
- Create: `src/ai/util/mcpElicitValidate.ts`
- Test: `src/ai/util/mcpElicitValidate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types/mcpElicit.ts
  export interface ElicitOption { value: string | number; title: string }
  export interface ElicitField {
    key: string
    type: 'string' | 'integer' | 'number' | 'boolean' | 'enum' | 'multi_enum'
    title?: string
    description?: string
    required?: boolean
    default?: unknown
    format?: string | null
    min_length?: number | null
    max_length?: number | null
    minimum?: number | null
    maximum?: number | null
    options?: ElicitOption[] | null
    min_items?: number | null
    max_items?: number | null
  }
  // util/mcpElicitValidate.ts
  export function validateArrayFields(
    fields: ElicitField[] | null | undefined,
    values: Record<string, unknown> | null | undefined,
    t?: (key: string, params?: Record<string, unknown>) => string,
  ): string | null
  ```
  Task 5 用两者。

**字段名权威源：** `NimoOS-AI/agent/mcp_client/elicitation_schema.py:134-143`（`_blank()` 造出来的描述符）。**不要手编字段名。**

- [ ] **Step 1: 写失败的测试**

`src/ai/util/mcpElicitValidate.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { validateArrayFields } from './mcpElicitValidate'
import type { ElicitField } from '../types/mcpElicit'

// 字段形状逐字取自后端 elicitation_schema.py:134-143 的 _blank(),不手编。
function multiEnum(over: Partial<ElicitField> = {}): ElicitField {
  return {
    key: 'tags', type: 'multi_enum', title: '标签', description: '',
    required: false, default: null, format: null,
    min_length: null, max_length: null, minimum: null, maximum: null,
    options: [{ value: 'a', title: 'A' }, { value: 'b', title: 'B' }],
    min_items: null, max_items: null,
    ...over,
  }
}

const echo = (s: string, p?: Record<string, unknown>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(p?.[k] ?? ''))

describe('validateArrayFields', () => {
  it('全合法时返回 null', () => {
    expect(validateArrayFields([multiEnum()], { tags: ['a'] }, echo)).toBeNull()
  })

  it('required 且一项没选 → 报 is required', () => {
    const r = validateArrayFields([multiEnum({ required: true })], { tags: [] }, echo)
    expect(r).toBe('标签: is required')
  })

  it('min_items 独立于 required:required=false 选 0 项照样违规', () => {
    const r = validateArrayFields([multiEnum({ required: false, min_items: 1 })], { tags: [] }, echo)
    expect(r).toBe('标签: pick at least 1')
  })

  it('max_items 超了报 pick at most', () => {
    const r = validateArrayFields([multiEnum({ max_items: 1 })], { tags: ['a', 'b'] }, echo)
    expect(r).toBe('标签: pick at most 1')
  })

  it('非 multi_enum 字段一律跳过(哪怕值不合法)', () => {
    const f: ElicitField = { key: 'name', type: 'string', required: true, min_items: 5 }
    expect(validateArrayFields([f], { name: '' }, echo)).toBeNull()
  })

  it('缺 title 时用 key 兜底', () => {
    const r = validateArrayFields([multiEnum({ title: undefined, required: true })], { tags: [] }, echo)
    expect(r).toBe('tags: is required')
  })

  it('fields/values 为空或缺键都不炸', () => {
    expect(validateArrayFields(null, null, echo)).toBeNull()
    expect(validateArrayFields([multiEnum({ min_items: 1 })], {}, echo)).toBe('标签: pick at least 1')
  })

  it('不传 t 时原样返回模板串(保持独立可测)', () => {
    const r = validateArrayFields([multiEnum({ required: true })], { tags: [] })
    expect(r).toBe('{label}: is required')
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/ai/util/mcpElicitValidate.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 写两个文件**

`src/ai/types/mcpElicit.ts`：把上面 **Interfaces** 里的两个 interface 逐字落盘，文件头加注释：

```ts
// SP14 T4 —— MCP elicitation 的字段描述符。
// 字段名逐字取自后端 NimoOS-AI/agent/mcp_client/elicitation_schema.py:134-143
// 的 _blank(),保持 snake_case(它是网络上的形状,不是本仓命名风格问题)。
```

`src/ai/util/mcpElicitValidate.ts`：

```ts
// SP14 T4 —— 前端唯一一条手写的 elicitation 校验规则。1:1 移植自 Vue2
// src/views/AI/Agent/blocks/mcpElicitValidate.js。
//
// 这里**故意**没有别的:其余全部约束由控件结构(select / checkbox 只产合法值)与
// 浏览器原生约束(required / minlength / maxlength / min / max / step / type=email
// / type=date / type=datetime-local)执行,权威规则只有后端
// agent/mcp_client/elicitation_schema.py::validate_content 那一份。
//
// 为什么不在这里把后端规则再写一遍:那就是两份实现,而 NimoOS-AI 与本仓是两个独立
// 发版的 git 仓库,靠人工同步必然漂移,而漂移的后果曾经是「用户填的答案被后端静默
// 丢弃、卡片已 resolve、没有回头路」。现在是:规则一份 + 浏览器执行 + 后端退回时
// 带原因重问(见 elicitation.py::MAX_ANSWER_ATTEMPTS)。
//
// 数组是唯一没有原生对应物的:checkbox 组没有有意义的 required,minItems/maxItems
// HTML 也表达不了。所以只有它落在这里。
import type { ElicitField } from '../types/mcpElicit'

type Translate = (key: string, params?: Record<string, unknown>) => string

/**
 * 全部数组字段合法时返回 null,否则返回一条已翻译的 "Title: reason"。
 *
 * `t` 由调用方传入(组件里就是 useI18n 的 t)。为什么要传而不是在这里写死英文:
 * 这条 reason 会直接显示成 submitError,而卡片里其余每一条文案都走了 i18n ——
 * 只有错误路径给中文用户看英文,恰好是最需要看懂的那一条。文案字面量留在 t('…')
 * 调用里,提取脚本照样扫得到。默认值 s => s 保持这个 helper 单独可测。
 */
export function validateArrayFields(
  fields: ElicitField[] | null | undefined,
  values: Record<string, unknown> | null | undefined,
  t: Translate = (s) => s,
): string | null {
  for (const f of fields || []) {
    if (f.type !== 'multi_enum') continue
    const raw = values ? values[f.key] : undefined
    const v = Array.isArray(raw) ? raw : []
    const label = f.title || f.key
    if (f.required && v.length === 0) return t('{label}: is required', { label })
    // 注意:这里**不**对空数组 continue —— min_items 独立于 required,
    // 一个 required:false 但 min_items:1 的字段选了 0 项时仍然违规。
    if (f.min_items !== null && f.min_items !== undefined && v.length < f.min_items)
      return t('{label}: pick at least {n}', { label, n: f.min_items })
    if (f.max_items !== null && f.max_items !== undefined && v.length > f.max_items)
      return t('{label}: pick at most {n}', { label, n: f.max_items })
  }
  return null
}
```

> ⚠️ 上面三条模板串是 Vue2 的**英文原文键**。本仓走键名 i18n，所以 Task 5 接进卡片时会把它们换成 `aiMcpElicitErrRequired` / `aiMcpElicitErrMinItems` / `aiMcpElicitErrMaxItems` 三个键（Task 5 Step 1 会一并改这里的测试）。**本任务先按上面原样落地**，让纯函数自己先绿。

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm exec vitest run src/ai/util/mcpElicitValidate.test.ts`
Expected: PASS，8 例。

- [ ] **Step 5: Commit**

```bash
git add src/ai/types/mcpElicit.ts src/ai/util/mcpElicitValidate.ts src/ai/util/mcpElicitValidate.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): validate only the elicitation constraint HTML cannot express

Everything else a field can require -- required, lengths, numeric bounds,
email and date shapes -- the browser already enforces, and the authoritative
copy of the rules lives in the backend's validate_content. Restating them
here would create a second implementation in a separately released repo,
and the last time those drifted the user's answers were dropped silently
after the card had already resolved. Array bounds have no native equivalent,
so they are the one rule that stays on this side.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---


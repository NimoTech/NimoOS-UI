# SP14 AI 区补迁 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 `origin/main` 在 2026-07-15 之后新增的三条 AI 区功能补进 New-UI —— MCP elicitation 两张卡（#136）、MCP 协议版本探测（#141）、Knowledge 桌面磁贴（#98）。

**Architecture:** elicitation 走既有的 SSE → `dispatchEvent` → `appendBlock` → `BlockRenderer` → 卡片链路，卡片经新的 `useConfirmResolve` composable 共享「409 → 一次性 expired 折叠」状态机，最终落到 `agentStore.resolveElicitation` → `service.ai.confirmAgentAction`（补第 5 个可选参数 `extra`）。#141 走本仓既有的 `toTestView` 归一层 + 新纯函数 `protocolLine`。#98 是纯加法：`SYSTEM_APPS` 加一项。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · Pinia · vue-i18n 9 · Vitest + @vue/test-utils（jsdom）· pnpm

**设计文档：** `docs/superpowers/specs/2026-08-08-vue3-migration-sp14-ai-catchup-design.md`

## Global Constraints

- **工作树 `.claude/worktrees/ai-catchup`，分支 `sp14-ai-catchup`**。所有命令从该目录跑，不要 `cd` 回主仓。
- **提交信息一律英文**（`commit-messages-english-only`，2026-08-07 起）。正文说明**为什么**，不复述 diff。结尾加：
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **颜色只能用 theme token**（`var(--…)`）。禁止新写 `#hex` / `rgb()` / `rgba()` / 具名色。本期用到的 token 全部已存在于 `src/ai/styles/tokens.scss`：`--purple` `--purple-soft` `--purple-soft-border` `--danger` `--danger-soft` `--success` `--success-soft` `--warning` `--text-on-accent` `--bg-chip` `--bg-canvas` `--bg-elevated` `--line` `--line-faint` `--text-primary` `--text-secondary` `--text-tertiary` `--font-mono` `--r-sm` `--r-lg` `--shadow-sm`。**一个新 token 都不需要加。**
- **i18n 键必须同时加进 `src/i18n/zh_cn.ai.ts` 与 `src/i18n/en_us.ai.ts`**，否则 `src/i18n/parity.test.ts` 直接红。中文文案以 Vue2 `src/assets/lang/zh_CN.json` 为准，不要自己译。
- **测试里不要另建 `createI18n`** —— `vitest.setup.ts:24-26` 已把 i18n 全局装进 `config.global.plugins`，再建一个会重复安装并刷 `[Vue warn]`。
- **CSS 注释里 `*` 不要紧贴 `/`**（会提前关闭注释、吞掉后面整条规则，五道门全瞎）。
- **`<select>` 的背景只能给实心 token 色**，不能用渐变或半透明 —— Chrome 会把它带到弹出列表且优先于 `color-scheme`，造成白底白字。
- **两处 `packages/service/` 的改动各自独立成一个 commit**（Task 2、Task 8），方便主分支 SP12 合并时单独取舍。
- 每个任务结束跑 `pnpm exec vitest run <本任务的测试文件>`；**整支收尾门**见 Task 10。

---

## 文件结构

| 文件 | 职责 | 任务 |
|---|---|---|
| `.superpowers/sdd/sp14/task-0-backend-probe.md` | 设备端 elicitation 能力探测结论 | T0 |
| `src/ai/composables/useConfirmResolve.ts` | 三卡共用的 409/提交状态机 | T1 |
| `packages/service/src/ai.ts` | `confirmAgentAction` 第 5 参 `extra`（T2）；探测 timeout 135s（T8） | T2 / T8 |
| `src/ai/stores/agentStore.ts` | `resolveElicitation` | T3 |
| `src/ai/types/mcpElicit.ts` | `ElicitField` / `ElicitOption` 类型 | T4 |
| `src/ai/util/mcpElicitValidate.ts` | 唯一一条手写校验（数组约束） | T4 |
| `src/ai/components/blocks/McpElicitFormCard.vue` | 表单卡 | T5 |
| `src/ai/components/blocks/McpElicitUrlCard.vue` | URL 授权卡 | T6 |
| `src/ai/services/dispatchEvent.ts` | 两个 `kind` 分支 | T7 |
| `src/ai/components/blocks/BlockRenderer.vue` | 两个 BLOCK_MAP 映射 | T7 |
| `src/ai/components/blocks/McpPermissionCard.vue` | 接 composable、删「更改」按钮 | T7 |
| `src/ai/types/mcpServer.ts` · `src/ai/util/mcpErrorKey.ts` · `src/ai/util/mcpProtocol.ts` · `McpServerDetail.vue` · `src/ai/styles/mcp-styles.scss` | #141 协议版本行 | T8 |
| `src/home/apps/icons/knowledge.svg` · `systemApps.ts` · `useOpenAction.ts` · `defaultLayout.ts` | #98 桌面磁贴 | T9 |

---

### Task 0: 探测设备端 agent 是否支持 elicitation

**Files:**
- Create: `.superpowers/sdd/sp14/task-0-backend-probe.md`

**Interfaces:**
- Produces: 一条结论（`支持` / `不支持` / `无法判定`），Task 10 的验收步骤据此二选一。

**背景：** Python agent 跑在容器里（`:8282` 有响应但 `pgrep` 看不到进程）。`GET /openapi.json` 判不出来 —— confirm 端点收的是无类型裸 body，elicitation 是 SSE 事件种类而不是 HTTP 端点。

- [ ] **Step 1: 按顺序试这四条，记录每条的真实输出**

```bash
# 1) 容器在不在（本会话可能无权限，无权限就如实记「无法判定」，不要猜）
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i agent

# 2) 容器里的 agent 代码有没有这两个事件种类
docker exec <上一步的容器名> grep -rl "mcp_elicit_form" /app 2>/dev/null

# 3) 退而求其次:本地仓库的版本(只能说明「我们手上的代码有」,不代表设备上有)
grep -n "mcp_elicit_form" /home/nimo/NimoTech/NimoOS-AI/agent/mcp_client/elicitation.py

# 4) 设备上 Go 侧 AI 服务的构建时间(判断新旧的旁证)
ls -l --time-style=long-iso /usr/bin/nimoos-ai 2>/dev/null
```

- [ ] **Step 2: 写结论文件**

`.superpowers/sdd/sp14/task-0-backend-probe.md` 必须包含：每条命令的**原始输出**、一句结论、以及结论对 Task 10 验收的影响。
**不允许写「应该支持」这类推测** —— 拿不到证据就写「无法判定，验收走 CDP 注入路径」。

- [ ] **Step 3: Commit**

```bash
git add .superpowers/sdd/sp14/task-0-backend-probe.md
git commit -m "$(cat <<'EOF'
docs(sp14): record whether the device agent speaks MCP elicitation

Acceptance for the two elicitation cards depends on whether a real
elicitation can be triggered on this device. The agent runs in a container,
so neither pgrep nor the OpenAPI document answers the question -- the
confirm endpoint takes an untyped body and elicitation is an SSE event kind,
not a route. Records what the probe actually returned so the acceptance
round does not have to guess.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1: `useConfirmResolve` composable

**Files:**
- Create: `src/ai/composables/useConfirmResolve.ts`
- Test: `src/ai/composables/useConfirmResolve.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function useConfirmResolve<A extends string>(): {
    decision: Ref<A | null>
    submitting: Ref<boolean>
    expired: Ref<boolean>
    submitError: Ref<string>
    run: (action: A, send: () => Promise<void>) => Promise<void>
    fail: (msgKey: string) => void
  }
  ```
  Task 5 / 6 / 7 的三张卡都用它。`fail(msgKey)` 供卡片在**发请求之前**就判失败时用（缺 confirmId、URL scheme 不合法）。

- [ ] **Step 1: 写失败的测试**

`src/ai/composables/useConfirmResolve.test.ts`：

```ts
import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useConfirmResolve } from './useConfirmResolve'

// useI18n() 需要组件实例,所以经一个宿主组件取 composable 的返回值。
// i18n 由 vitest.setup.ts 全局装好,这里不要再 createI18n。
function host() {
  let api!: ReturnType<typeof useConfirmResolve<'accept' | 'decline' | 'cancel'>>
  const C = defineComponent({
    setup() { api = useConfirmResolve<'accept' | 'decline' | 'cancel'>(); return () => null },
  })
  const wrapper = mount(C)
  return { api, wrapper }
}

function httpError(status: number) {
  return Object.assign(new Error('boom'), { response: { status } })
}

describe('useConfirmResolve', () => {
  it('成功后落 decision,并清掉 submitting', async () => {
    const { api } = host()
    await api.run('accept', async () => {})
    expect(api.decision.value).toBe('accept')
    expect(api.submitting.value).toBe(false)
    expect(api.expired.value).toBe(false)
    expect(api.submitError.value).toBe('')
  })

  it('409 是终态:置 expired,不置 decision', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw httpError(409) })
    expect(api.expired.value).toBe(true)
    expect(api.decision.value).toBeNull()
    expect(api.submitError.value).toBe('确认已过期，请重新发送指令')
  })

  it('expired 之后再点一次,send 根本不会被调用', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw httpError(409) })
    const send = vi.fn(async () => {})
    await api.run('decline', send)
    expect(send).not.toHaveBeenCalled()
  })

  it('500 可重试:不置 expired,只写 submitError', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw httpError(500) })
    expect(api.expired.value).toBe(false)
    expect(api.decision.value).toBeNull()
    expect(api.submitError.value).toContain('提交失败')
  })

  it('无 response 的网络错也走可重试分支', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw new Error('Network Error') })
    expect(api.expired.value).toBe(false)
    expect(api.submitError.value).toContain('Network Error')
  })

  it('submitting 期间的重入被挡住', async () => {
    const { api } = host()
    let release: () => void = () => {}
    const first = api.run('accept', () => new Promise<void>((r) => { release = r }))
    const send = vi.fn(async () => {})
    await api.run('decline', send)
    expect(send).not.toHaveBeenCalled()
    release()
    await first
  })

  it('fail() 直接写错误,不动 decision/expired', () => {
    const { api } = host()
    api.fail('aiConfirmInvalid')
    expect(api.submitError.value).toBe('确认请求无效（缺少 confirm_id）')
    expect(api.decision.value).toBeNull()
    expect(api.expired.value).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/ai/composables/useConfirmResolve.test.ts`
Expected: FAIL —— `Failed to resolve import "./useConfirmResolve"`

- [ ] **Step 3: 写实现**

`src/ai/composables/useConfirmResolve.ts`：

```ts
// SP14 T1 —— 三张确认卡(McpPermissionCard / McpElicitFormCard / McpElicitUrlCard)
// 共用的提交状态机,对齐 Vue2 #136 的最终形态。
//
// 为什么抽出来而不是各卡复制:#136 的要求就是「三卡行为一致」。confirm_id 是一次性的
// (后端 ConfirmManager.resolve 会把它从 _pending 移除),此后每次 POST 都是 409。
// 复制三份判据必漂,而漂掉的后果是用户对着一张永远点不动的卡反复点。
import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

export interface ConfirmResolveApi<A extends string> {
  decision: Ref<A | null>
  submitting: Ref<boolean>
  expired: Ref<boolean>
  submitError: Ref<string>
  run: (action: A, send: () => Promise<void>) => Promise<void>
  fail: (msgKey: string) => void
}

export function useConfirmResolve<A extends string>(): ConfirmResolveApi<A> {
  const { t } = useI18n()
  const decision = ref<A | null>(null) as Ref<A | null>
  const submitting = ref(false)
  const expired = ref(false)
  const submitError = ref('')

  async function run(action: A, send: () => Promise<void>): Promise<void> {
    // expired 是单向的:后端已经不认这个 confirm_id 了,再发多少次都是 409。
    if (expired.value || submitting.value) return
    submitting.value = true
    submitError.value = ''
    try {
      await send()
      decision.value = action
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } } | null)?.response?.status
      // 只有 409 是终态。500 或断连时 confirm_id 可能还活在 _pending 里,
      // 卡片保持可用、表单内容不清空,允许用户重试。
      if (status === 409) {
        expired.value = true
        submitError.value = t('aiConfirmExpired')
      } else {
        const detail = (e as Error | null)?.message || t('aiUnknownError')
        submitError.value = t('aiSubmitFailed', { detail })
      }
    } finally {
      submitting.value = false
    }
  }

  // 请求还没发出去就判失败的路径(缺 confirm_id、URL scheme 不在白名单)。
  function fail(msgKey: string): void {
    submitError.value = t(msgKey)
  }

  return { decision, submitting, expired, submitError, run, fail }
}
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm exec vitest run src/ai/composables/useConfirmResolve.test.ts`
Expected: PASS，7 例。

- [ ] **Step 5: 变异验证**

把 `if (status === 409)` 临时改成 `if (status === 410)`，重跑：「409 是终态」与「expired 之后再点」两例必须红。改回来。

- [ ] **Step 6: Commit**

```bash
git add src/ai/composables/useConfirmResolve.ts src/ai/composables/useConfirmResolve.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): share one confirm-resolution state machine across the MCP cards

A confirm_id is single-use, so every POST after the first returns 409. The
cards need identical handling of that -- one-way expiry, no retry -- and
three hand-copied versions of the same judgement would drift. Only 409 is
terminal: a 500 or a dropped connection may leave the id alive, so those
stay retryable and the card keeps whatever the user typed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 共享包 `confirmAgentAction` 补第 5 参 `extra`（独立 commit）

**Files:**
- Modify: `packages/service/src/ai.ts:39-51`
- Test: `packages/service/src/ai.test.ts`

**Interfaces:**
- Produces: `confirmAgentAction(sessionId, confirmId, confirmed, remember?, extra?: Record<string, unknown>)`。Task 3 用它。

**为什么必须动包：** elicitation 是三态（`accept`/`decline`/`cancel`）且可带答案，两态的 `confirmed` 表达不了；Vue2 `service/ai.js:75-83` 的落法就是透传一个 `extra`。用户 2026-08-08 明确解除了「不改包」的限制，条件是独立成一个 commit。

- [ ] **Step 1: 写失败的测试**

在 `packages/service/src/ai.test.ts` 里新增（放到既有 `confirmAgentAction` 相关用例旁；若无则新建一个 `describe`）：

```ts
it('confirmAgentAction 不传 extra 时,body 与今天逐字相同', async () => {
  const post = vi.fn(async () => ({ data: { ok: true } }))
  const api = createAi({ post } as never, () => null)
  await api.confirmAgentAction('s1', 'c1', true)
  expect(post).toHaveBeenCalledWith('/v1/ai/agent/sessions/s1/confirm', {
    confirm_id: 'c1', confirmed: true, remember: false,
  })
})

it('confirmAgentAction 把 extra 展开进 body(elicitation 的 action/content 走这里)', async () => {
  const post = vi.fn(async () => ({ data: { ok: true } }))
  const api = createAi({ post } as never, () => null)
  await api.confirmAgentAction('s1', 'c1', true, false, { action: 'accept', content: { name: 'Ada' } })
  expect(post).toHaveBeenCalledWith('/v1/ai/agent/sessions/s1/confirm', {
    confirm_id: 'c1', confirmed: true, remember: false,
    action: 'accept', content: { name: 'Ada' },
  })
})
```

> ⚠️ 先读 `packages/service/src/ai.test.ts` 顶部，照该文件**既有**的构造方式取 `createAi` / mock http 实例与 `PREFIX` 真实值；上面的 `'/v1/ai/agent/...'` 要换成该文件里其它用例断言的同一形状，**不要照抄我这行前缀**。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run packages/service/src/ai.test.ts -t 'extra'`
Expected: FAIL —— 第二例收到的 body 里没有 `action`/`content`。

- [ ] **Step 3: 改实现**

`packages/service/src/ai.ts`：

```ts
    async confirmAgentAction(
      sessionId: string | number,
      confirmId: string,
      confirmed: boolean,
      remember = false,
      // MCP elicitation 的 action / content 走这里透传:elicitation 是三态
      // (accept/decline/cancel)且可带答案,两态的 confirmed 表达不了。其它卡片
      // 一律不传,后端既有的两态路径逐字不变。
      extra?: Record<string, unknown>,
    ): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/sessions/${sessionId}/confirm`, {
        confirm_id: confirmId,
        confirmed,
        remember,
        ...(extra || {}),
      })
      return res.data
    },
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm exec vitest run packages/service/src/ai.test.ts`
Expected: PASS（含既有全部用例 —— 「不传 extra 时 body 逐字不变」这条是回归护栏）。

- [ ] **Step 5: Commit（本任务单独一个 commit，不要和别的搅在一起）**

```bash
git add packages/service/src/ai.ts packages/service/src/ai.test.ts
git commit -m "$(cat <<'EOF'
feat(service): let confirmAgentAction carry an elicitation payload

MCP elicitation is three-state -- accept, decline, cancel -- and an accept
carries the user's answers. The boolean `confirmed` cannot express that, so
the caller passes the extra fields through and `confirmed` keeps its old
meaning for the backend's existing bookkeeping. Omitting the argument
produces a byte-identical request body, which the added test pins.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `agentStore.resolveElicitation`

**Files:**
- Modify: `src/ai/stores/agentStore.ts`（在 `confirmAgentAction`（约 `:1103`）下方新增；并加进文件末尾 return 的导出清单，约 `:1248`）
- Test: `src/ai/stores/agentStore.elicit.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `service.ai.confirmAgentAction(sid, cid, confirmed, remember, extra)`
- Produces: `store.resolveElicitation(confirmId: string, action: 'accept' | 'decline' | 'cancel', content?: Record<string, unknown> | null): Promise<void>`

- [ ] **Step 1: 写失败的测试**

`src/ai/stores/agentStore.elicit.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const h = vi.hoisted(() => ({ confirmAgentAction: vi.fn(async () => ({})) }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

import { useAgentStore } from './agentStore'

describe('agentStore.resolveElicitation', () => {
  beforeEach(() => { setActivePinia(createPinia()); h.confirmAgentAction.mockClear() })

  it('accept 带答案:confirmed=true,action/content 走 extra', async () => {
    const s = useAgentStore()
    s.activeSessionId = 'sess-1'
    await s.resolveElicitation('c1', 'accept', { name: 'Ada' })
    expect(h.confirmAgentAction).toHaveBeenCalledWith(
      'sess-1', 'c1', true, false, { action: 'accept', content: { name: 'Ada' } },
    )
  })

  it('decline 无答案:confirmed=false,extra 里只有 action', async () => {
    const s = useAgentStore()
    s.activeSessionId = 'sess-1'
    await s.resolveElicitation('c1', 'decline')
    expect(h.confirmAgentAction).toHaveBeenCalledWith(
      'sess-1', 'c1', false, false, { action: 'decline' },
    )
  })

  it('没有活动会话时抛错,而不是静默 return', async () => {
    const s = useAgentStore()
    s.activeSessionId = null
    await expect(s.resolveElicitation('c1', 'accept')).rejects.toThrow('no active session')
    expect(h.confirmAgentAction).not.toHaveBeenCalled()
  })

  it('缺 confirmId 抛错', async () => {
    const s = useAgentStore()
    s.activeSessionId = 'sess-1'
    await expect(s.resolveElicitation('', 'accept')).rejects.toThrow('confirm_id missing')
    expect(h.confirmAgentAction).not.toHaveBeenCalled()
  })
})
```

> ⚠️ 先读 `src/ai/stores/agentStore.test.ts` 的开头，照它**既有**的 mock 与 store 取用方式对齐（`activeSessionId` 是 ref 还是可直接赋值的属性、`useAgentStore()` 是否要传 profile）。上面的写法若与既有测试不一致，以既有测试为准。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/ai/stores/agentStore.elicit.test.ts`
Expected: FAIL —— `s.resolveElicitation is not a function`

- [ ] **Step 3: 写实现**

在 `confirmAgentAction` 下方新增：

```ts
    /**
     * Vue2 agentStore.js:519-530 —— MCP elicitation 的三态决议。
     *
     * 与 confirmAgentAction 的两处差别,都是刻意的:
     * 1) elicitation 是三态(accept / decline / cancel)且 accept 可带答案,所以
     *    action / content 经 extra 透传;`confirmed` 仍照发(action === 'accept'),
     *    让后端既有的簿记逐字不变。
     * 2) 无会话时**抛**而不是像 confirmAgentAction 那样静默 return —— 静默 return 会
     *    resolve 掉这个 promise,卡片于是翻到「已把回答发给 X」/「已在新标签页打开」,
     *    而实际上一个字节都没发出去:后端回调还挂在 wait_elicit 里(最长 24h),整次
     *    工具调用就这么无声地卡死。抛出去,卡片的 catch 才能把它显示出来。
     *    confirmAgentAction 那条路径不阻塞工具调用,所以保持原样不动。
     */
    async function resolveElicitation(
      confirmId: string,
      action: 'accept' | 'decline' | 'cancel',
      content: Record<string, unknown> | null = null,
    ): Promise<void> {
      if (!activeSessionId.value) throw new Error('no active session')
      if (!confirmId) throw new Error('confirm_id missing')
      await service.ai.confirmAgentAction(
        activeSessionId.value, confirmId, action === 'accept', false,
        content === null ? { action } : { action, content },
      )
    }
```

并在文件末尾的 return 对象里，`confirmAgentAction,` 之后加一行 `resolveElicitation,`。

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm exec vitest run src/ai/stores/agentStore.elicit.test.ts src/ai/stores/agentStore.test.ts`
Expected: PASS（含既有 store 测试不回归）。

- [ ] **Step 5: Commit**

```bash
git add src/ai/stores/agentStore.ts src/ai/stores/agentStore.elicit.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): resolve MCP elicitation through a three-state store action

Elicitation answers cannot ride the two-state confirm path: accept, decline
and cancel are distinct outcomes and an accept carries content. Unlike
confirmAgentAction this throws when there is no active session instead of
returning quietly -- a silent return resolves the promise, the card flips to
"answer sent", and nothing was sent, leaving the backend callback parked in
wait_elicit for up to 24 hours with the whole tool call hung behind it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

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

### Task 5: `McpElicitFormCard.vue`

**Files:**
- Create: `src/ai/components/blocks/McpElicitFormCard.vue`
- Test: `src/ai/components/blocks/McpElicitFormCard.test.ts`
- Modify: `src/ai/util/mcpElicitValidate.ts`（三条模板串换成 i18n 键）+ 其测试
- Modify: `src/i18n/zh_cn.ai.ts` · `src/i18n/en_us.ai.ts`

**Interfaces:**
- Consumes: `useConfirmResolve`（T1）· `store.resolveElicitation`（T3）· `validateArrayFields` / `ElicitField`（T4）
- Produces: 组件 props `{ confirmId, server, message, fields, error }`，供 T7 的 BLOCK_MAP 映射 `mcp_elicit_form`。

**新增 i18n 键**（zh / en 双写）：

| 键 | zh_cn | en_us |
|---|---|---|
| `aiMcpElicitAsk` | `{server} 向你提问` | `{server} is asking you a question` |
| `aiMcpElicitBounced` | `这个回答未被接受：{reason}` | `That answer was not accepted: {reason}` |
| `aiMcpElicitSend` | `发送回答` | `Send answer` |
| `aiMcpElicitDecline` | `拒绝回答` | `Decline` |
| `aiMcpElicitCancel` | `取消` | `Cancel` |
| `aiMcpElicitSent` | `已把回答发给 {server}` | `Answer sent to {server}` |
| `aiMcpElicitDeclined` | `已拒绝回答 {server}` | `Declined to answer {server}` |
| `aiMcpElicitCancelled` | `已取消` | `Cancelled` |
| `aiMcpElicitYes` | `是` | `Yes` |
| `aiMcpElicitUnanswered` | `（未作答）` | `(not answered)` |
| `aiMcpElicitErrRequired` | `{label}：必填` | `{label}: is required` |
| `aiMcpElicitErrMinItems` | `{label}：至少选 {n} 项` | `{label}: pick at least {n}` |
| `aiMcpElicitErrMaxItems` | `{label}：至多选 {n} 项` | `{label}: pick at most {n}` |

- [ ] **Step 1: 先把纯函数的三条串换成键，并改它的测试**

`mcpElicitValidate.ts` 里三处 `t('{label}: …')` 改成 `t('aiMcpElicitErrRequired', { label })` / `t('aiMcpElicitErrMinItems', { label, n: f.min_items })` / `t('aiMcpElicitErrMaxItems', { label, n: f.max_items })`；
`mcpElicitValidate.test.ts` 里 `echo` 的断言相应改成断言**键与参数**：

```ts
const echo = (s: string, p?: Record<string, unknown>) => `${s}|${JSON.stringify(p ?? {})}`
// …
expect(validateArrayFields([multiEnum({ required: true })], { tags: [] }, echo))
  .toBe('aiMcpElicitErrRequired|{"label":"标签"}')
```
（其余用例照此改；「不传 t」那例改成断言返回键名本身。）

- [ ] **Step 2: 写卡片的失败测试**

`src/ai/components/blocks/McpElicitFormCard.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import McpElicitFormCard from './McpElicitFormCard.vue'
import type { ElicitField } from '../../types/mcpElicit'

const resolveElicitation = vi.fn(async () => {})
vi.mock('../../composables/useProvidedAgentStore', () => ({
  useProvidedAgentStore: () => ({ resolveElicitation }),
}))

function field(over: Partial<ElicitField> = {}): ElicitField {
  return {
    key: 'name', type: 'string', title: '名字', description: '',
    required: true, default: null, format: null,
    min_length: null, max_length: null, minimum: null, maximum: null,
    options: null, min_items: null, max_items: null,
    ...over,
  }
}

function mountCard(props: Record<string, unknown> = {}) {
  return mount(McpElicitFormCard, {
    props: { confirmId: 'c1', server: 'brave', message: '请填写', fields: [field()], error: '', ...props },
    attachTo: document.body,
  })
}

function httpError(status: number) {
  return Object.assign(new Error('boom'), { response: { status } })
}

describe('McpElicitFormCard', () => {
  beforeEach(() => { resolveElicitation.mockClear(); resolveElicitation.mockResolvedValue(undefined) })

  it('填好后点「发送回答」:accept + 已填字段', async () => {
    const w = mountCard()
    await w.find('input.mcc-input').setValue('Ada')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', { name: 'Ada' })
    expect(w.text()).toContain('已把回答发给 brave')
  })

  it('浏览器校验门:reportValidity 为假时根本不发请求', async () => {
    const w = mountCard()
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => false
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).not.toHaveBeenCalled()
  })

  it('数组规则:min_items 不满足时写 submitError,不发请求', async () => {
    const w = mountCard({
      fields: [field({ key: 'tags', type: 'multi_enum', title: '标签', required: false, min_items: 1,
        options: [{ value: 'a', title: 'A' }] })],
    })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).not.toHaveBeenCalled()
    expect(w.find('.mcc-err').text()).toContain('至少选 1 项')
  })

  it('空的可选字段整个不发送', async () => {
    const w = mountCard({ fields: [field({ required: false })] })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', {})
  })

  it('数字字段送出去的是 number 不是字符串', async () => {
    const w = mountCard({ fields: [field({ key: 'age', type: 'integer', title: '年龄', required: false })] })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('input.mcc-input').setValue('42')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', { age: 42 })
  })

  it('「拒绝回答」发 decline 且 content 为 null', async () => {
    const w = mountCard()
    await w.findAll('button.mcc-btn')[1].trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'decline', null)
    expect(w.text()).toContain('已拒绝回答 brave')
  })

  it('409 之后整卡折叠:不留任何按钮与表单', async () => {
    resolveElicitation.mockRejectedValueOnce(httpError(409))
    const w = mountCard()
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('确认已过期')
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.find('form').exists()).toBe(false)
  })

  it('500 之后卡片仍可用,填的内容还在', async () => {
    resolveElicitation.mockRejectedValueOnce(httpError(500))
    const w = mountCard()
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('input.mcc-input').setValue('Ada')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(w.find('form').exists()).toBe(true)
    expect((w.find('input.mcc-input').element as HTMLInputElement).value).toBe('Ada')
  })

  it('后端退回原因显示在卡上', () => {
    const w = mountCard({ error: 'name: must be at least 3 characters' })
    expect(w.find('.mcc-bounced').text()).toContain('must be at least 3 characters')
  })

  it('缺 confirmId 时点发送不发请求,只报无效', async () => {
    const w = mountCard({ confirmId: '' })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).not.toHaveBeenCalled()
    expect(w.find('.mcc-err').text()).toContain('确认请求无效')
  })

  it('enum 渲染成 select,可选时首项是「（未作答）」', () => {
    const w = mountCard({
      fields: [field({ key: 'plan', type: 'enum', title: '套餐', required: false,
        options: [{ value: 'pro', title: 'Pro' }] })],
    })
    const opts = w.findAll('select.mcc-input option')
    expect(opts[0].text()).toBe('（未作答）')
    expect(opts[1].text()).toBe('Pro')
  })
})
```

- [ ] **Step 3: 跑测试确认它红**

Run: `pnpm exec vitest run src/ai/components/blocks/McpElicitFormCard.test.ts`
Expected: FAIL —— 组件文件不存在。

- [ ] **Step 4: 写组件**

`src/ai/components/blocks/McpElicitFormCard.vue`。**移植自 Vue2 `src/views/AI/Agent/blocks/McpElicitFormCard.vue`（264 行）**，改动只有四处：`<script setup>` + TS、i18n 走键、状态机走 `useConfirmResolve`、颜色走 token。

```vue
<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/McpElicitFormCard.vue -->
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { useConfirmResolve } from '../../composables/useConfirmResolve'
import { validateArrayFields } from '../../util/mcpElicitValidate'
import type { ElicitField } from '../../types/mcpElicit'

const props = withDefaults(defineProps<{
  confirmId?: string
  server?: string
  message?: string
  fields?: ElicitField[]
  // 后端退回上一次作答的原因(重问循环)。首次提问为空。
  error?: string
}>(), { confirmId: '', server: '', message: '', fields: () => [], error: '' })

const { t } = useI18n()
const store = useProvidedAgentStore()
const { decision, submitting, expired, submitError, run, fail } =
  useConfirmResolve<'accept' | 'decline' | 'cancel'>()

const form = ref<HTMLFormElement | null>(null)

// 规范:支持默认值的客户端 SHOULD 用默认值预填表单。
const values = reactive<Record<string, unknown>>({})
for (const f of props.fields) {
  if (f.type === 'multi_enum') values[f.key] = Array.isArray(f.default) ? [...f.default] : []
  else if (f.type === 'boolean') values[f.key] = f.default === true
  else values[f.key] = f.default === null || f.default === undefined ? '' : f.default
}

// 描述符 format -> 原生 input type。挑选原则是「控件产得出的东西后端一定收」:
//   email          -> 浏览器执行的正是后端那条 WHATWG 正则,按构造一致
//   date/date-time -> 控件只吐 YYYY-MM-DD / YYYY-MM-DDTHH:MM,正是后端两条正则的形状
//   uri            -> 故意**不**用 type="url":它比后端规则严,会拒掉后端本会接受的值
//                     (例如 mailto:a@b),用户就卡在一个填得没错的表单上、无法提交
const FORMAT_INPUT_TYPE: Record<string, string> = { email: 'email', date: 'date', 'date-time': 'datetime-local' }

function fieldId(f: ElicitField): string { return `mcc-${props.confirmId}-${f.key}` }

// 描述符 -> DOM 属性。这里是前端与后端规则的**唯一**接触面:不复制规则,只声明由谁执行。
// 缺失的约束整个不发(而不是发 undefined),免得渲染出 minlength="undefined" 这种
// 反而让浏览器拦错东西的属性。
function inputAttrs(f: ElicitField): Record<string, unknown> {
  const a: Record<string, unknown> = { type: 'text', required: !!f.required }
  if (f.type === 'integer' || f.type === 'number') {
    a.type = 'number'
    a.step = f.type === 'integer' ? 1 : 'any'
    if (f.minimum !== null && f.minimum !== undefined) a.min = f.minimum
    if (f.maximum !== null && f.maximum !== undefined) a.max = f.maximum
    return a
  }
  if (f.format && FORMAT_INPUT_TYPE[f.format]) a.type = FORMAT_INPUT_TYPE[f.format]
  if (f.min_length !== null && f.min_length !== undefined) a.minlength = f.min_length
  if (f.max_length !== null && f.max_length !== undefined) a.maxlength = f.max_length
  return a
}

// 空的可选字段整个不发:后端 validate_content 会把 schema 里没有的键当错误,
// 而一个空字符串对 required 字段以外的东西没有任何意义。
function buildPayload(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of props.fields) {
    const v = values[f.key]
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) { if (v.length) out[f.key] = [...v]; continue }
    if (f.type === 'integer' || f.type === 'number') {
      const n = Number(v)
      out[f.key] = Number.isNaN(n) ? v : n // 非数字原样送,交给后端校验报错
      continue
    }
    out[f.key] = v
  }
  return out
}

async function submit(): Promise<void> {
  // 门 1:浏览器。required / minlength / maxlength / min / max / step /
  // type=email|date|datetime-local 全由它执行,并且会自己弹出原生提示。
  const el = form.value
  if (el && typeof el.reportValidity === 'function' && !el.reportValidity()) return
  // 门 2:数组规则 —— HTML 表达不了 minItems/maxItems,这是唯一的手写规则。
  const payload = buildPayload()
  const err = validateArrayFields(props.fields, payload, t)
  if (err) { submitError.value = err; return }
  // 权威校验在后端。它若退回,重问循环会带着原因重发一张新卡。
  await resolve('accept', payload)
}

async function resolve(action: 'accept' | 'decline' | 'cancel', content: Record<string, unknown> | null = null): Promise<void> {
  if (!props.confirmId) { fail('aiConfirmInvalid'); return }
  await run(action, () => store.resolveElicitation(props.confirmId, action, content))
}
</script>

<template>
  <div class="mcc-perm">
    <!-- expired 压过一切:被消费掉的 confirm_id 再也不可能成功,
         所以卡片必须停止提供任何可点的东西 —— 表单也算。 -->
    <div v-if="expired" class="mcc-perm-resolved" data-decision="expired">
      <span class="rico"><AgentIcon name="x" :size="13" /></span>
      <span>{{ t('aiConfirmExpired') }}</span>
    </div>
    <div v-else-if="decision" class="mcc-perm-resolved" :data-decision="decision">
      <span class="rico"><AgentIcon :name="decision === 'accept' ? 'check' : 'x'" :size="13" /></span>
      <span v-if="decision === 'accept'">{{ t('aiMcpElicitSent', { server }) }}</span>
      <span v-else-if="decision === 'decline'">{{ t('aiMcpElicitDeclined', { server }) }}</span>
      <span v-else>{{ t('aiMcpElicitCancelled') }}</span>
    </div>
    <template v-else>
      <div class="mcc-perm-ribbon">
        <AgentIcon name="bell" :size="12" />
        {{ t('aiMcpElicitAsk', { server }) }}
        <span class="badge">MCP</span>
      </div>
      <!-- 纯文本插值:规范禁止把 elicitation 文案里的 URL 渲染成可点链接 -->
      <div class="mcc-perm-ask">{{ message }}</div>

      <!-- 后端退回上一次作答时把原因放在 error 里,必须显示 —— 否则用户只会再填一遍一样的 -->
      <div v-if="error" class="mcc-bounced">
        <AgentIcon name="x" :size="12" />
        {{ t('aiMcpElicitBounced', { reason: error }) }}
      </div>

      <form ref="form" class="mcc-fields" @submit.prevent="submit">
        <div v-for="f in fields" :key="f.key" class="mcc-field">
          <label :for="fieldId(f)">
            {{ f.title || f.key }}<span v-if="f.required" class="req">*</span>
          </label>
          <p v-if="f.description" class="hint">{{ f.description }}</p>

          <input
            v-if="f.type === 'string' || f.type === 'integer' || f.type === 'number'"
            :id="fieldId(f)" v-model="values[f.key]" v-bind="inputAttrs(f)" class="mcc-input">

          <label v-else-if="f.type === 'boolean'" class="mcc-check">
            <input v-model="values[f.key]" type="checkbox"> {{ t('aiMcpElicitYes') }}
          </label>

          <select
            v-else-if="f.type === 'enum'" :id="fieldId(f)" v-model="values[f.key]"
            :required="f.required" class="mcc-input">
            <option v-if="!f.required" value="">{{ t('aiMcpElicitUnanswered') }}</option>
            <option v-for="o in (f.options || [])" :key="String(o.value)" :value="o.value">{{ o.title }}</option>
          </select>

          <div v-else-if="f.type === 'multi_enum'" class="mcc-multi">
            <label v-for="o in (f.options || [])" :key="String(o.value)" class="mcc-check">
              <input v-model="values[f.key]" type="checkbox" :value="o.value"> {{ o.title }}
            </label>
          </div>
        </div>
      </form>
      <div class="mcc-perm-foot">
        <button class="mcc-btn primary" :disabled="submitting" @click="submit">
          <AgentIcon name="check" :size="13" /> {{ t('aiMcpElicitSend') }}
        </button>
        <button class="mcc-btn ghost" :disabled="submitting" @click="resolve('decline')">
          {{ t('aiMcpElicitDecline') }}
        </button>
        <button class="mcc-btn deny" :disabled="submitting" @click="resolve('cancel')">
          {{ t('aiMcpElicitCancel') }}
        </button>
        <span v-if="submitError" class="mcc-err">{{ submitError }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mcc-perm {
  border: 1px solid var(--line); border-radius: var(--r-lg);
  background: var(--bg-elevated); box-shadow: var(--shadow-sm);
  overflow: hidden; max-width: 560px; margin: 2px 0;
}
.mcc-perm-ribbon {
  display: flex; align-items: center; gap: 7px; padding: 7px 14px;
  font-size: 11px; font-weight: 600; color: var(--purple);
  background: var(--purple-soft); border-bottom: 1px solid var(--purple-soft-border);
}
.mcc-perm-ribbon .badge {
  margin-left: auto; font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  padding: 1px 7px; border-radius: 999px;
  background: var(--purple-soft-border); color: var(--purple); text-transform: uppercase;
}
.mcc-perm-ask {
  padding: 12px 16px; font-size: 13.5px; line-height: 1.55; color: var(--text-secondary);
}
.mcc-perm-foot {
  display: flex; align-items: center; gap: 8px; padding: 12px 16px;
  border-top: 1px solid var(--line-faint); background: var(--bg-canvas); flex-wrap: wrap;
}
.mcc-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; border-radius: var(--r-sm); font-size: 13px; font-weight: 500;
  border: 0; cursor: pointer; transition: all 120ms ease; white-space: nowrap;
}
.mcc-btn[disabled] { opacity: 0.6; cursor: not-allowed; }
.mcc-btn.primary { background: var(--purple); color: var(--text-on-accent); }
.mcc-btn.primary:hover { filter: brightness(1.06); }
.mcc-btn.ghost { background: var(--bg-chip); color: var(--text-secondary); }
.mcc-btn.ghost:hover { background: var(--line); color: var(--text-primary); }
.mcc-btn.deny { background: transparent; color: var(--text-tertiary); margin-left: auto; }
.mcc-btn.deny:hover { color: var(--danger); background: var(--danger-soft); }
.mcc-err { font-size: 12px; color: var(--danger); width: 100%; }
.mcc-perm-resolved {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  font-size: 13px; color: var(--text-secondary); background: var(--bg-canvas);
}
.mcc-perm-resolved .rico {
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
  display: grid; place-items: center;
}
/* decision 的取值是 accept / decline / cancel —— 从 McpPermissionCard 抄来的
   allow|always|deny 在这张卡上永远匹配不到(Vue2 抄错过,已解决态的图标一直没颜色)。 */
.mcc-perm-resolved[data-decision="accept"] .rico { background: var(--success-soft); color: var(--success); }
.mcc-perm-resolved[data-decision="decline"] .rico,
.mcc-perm-resolved[data-decision="cancel"] .rico { background: var(--danger-soft); color: var(--danger); }
/* expired 不是用户做的决定 —— 中性灰,不用 decline 的红。 */
.mcc-perm-resolved[data-decision="expired"] .rico { background: var(--bg-chip); color: var(--text-tertiary); }
.mcc-perm-resolved[data-decision="expired"] { color: var(--text-tertiary); }
.mcc-fields { padding: 0 16px 4px; display: flex; flex-direction: column; gap: 12px; }
.mcc-field label { display: block; font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
.mcc-field .req { color: var(--danger); margin-left: 3px; }
.mcc-field .hint { margin: 2px 0 6px; font-size: 12px; color: var(--text-tertiary); }
/* 实心底,不能用渐变/半透明:Chrome 会把 select 的背景带到弹出列表且优先于
   color-scheme,半透明底会渲染成白底白字(见 newui-css-invisible-failure-guards)。 */
.mcc-input {
  width: 100%; padding: 7px 10px; font-size: 13px; border-radius: var(--r-sm);
  border: 1px solid var(--line); background: var(--bg-canvas); color: var(--text-primary);
}
.mcc-input:focus { outline: none; border-color: var(--purple); }
.mcc-check { display: inline-flex; align-items: center; gap: 6px; font-weight: 400; font-size: 13px; }
.mcc-multi { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
.mcc-bounced {
  display: flex; gap: 7px; margin: 0 16px 10px; padding: 8px 11px;
  border-radius: var(--r-sm); font-size: 12.5px; line-height: 1.5;
  color: var(--danger); background: var(--danger-soft);
}
</style>
```

- [ ] **Step 5: 加 i18n 键（zh + en 双写）**

按本任务开头的表把 13 个键加进 `src/i18n/zh_cn.ai.ts` 与 `src/i18n/en_us.ai.ts`（放在既有 `aiMcp*` 键附近）。

- [ ] **Step 6: 跑测试**

Run: `pnpm exec vitest run src/ai/components/blocks/McpElicitFormCard.test.ts src/ai/util/mcpElicitValidate.test.ts src/i18n/parity.test.ts`
Expected: PASS。

- [ ] **Step 7: 变异验证**

`submit()` 里临时把 `if (err) { submitError.value = err; return }` 的 `return` 删掉 → 「数组规则」那例必须红。改回来。

- [ ] **Step 8: Commit**

```bash
git add src/ai/components/blocks/McpElicitFormCard.vue src/ai/components/blocks/McpElicitFormCard.test.ts \
        src/ai/util/mcpElicitValidate.ts src/ai/util/mcpElicitValidate.test.ts \
        src/i18n/zh_cn.ai.ts src/i18n/en_us.ai.ts
git commit -m "$(cat <<'EOF'
feat(ai): render MCP elicitation forms as a card

The card carries the user's answers to a third-party server, so its tests
mount it and click the real buttons rather than calling methods directly --
the Vue 2 original shipped with the whole submit path uncovered because its
tests never rendered the template. Optional fields left blank are omitted
entirely: the backend treats a key outside the schema as an error, and an
empty string means nothing for anything but a required field.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `McpElicitUrlCard.vue`

**Files:**
- Create: `src/ai/components/blocks/McpElicitUrlCard.vue`
- Test: `src/ai/components/blocks/McpElicitUrlCard.test.ts`
- Modify: `src/i18n/zh_cn.ai.ts` · `src/i18n/en_us.ai.ts`

**Interfaces:**
- Consumes: `useConfirmResolve`（T1）· `store.resolveElicitation`（T3）
- Produces: 组件 props `{ confirmId, server, message, url, host, hostAscii, punycode, insecure }`，供 T7 映射 `mcp_elicit_url`。

**新增 i18n 键**（zh / en 双写）：

| 键 | zh_cn | en_us |
|---|---|---|
| `aiMcpElicitUrlAsk` | `{server} 需要你在外部站点上完成授权` | `{server} needs you to authorize on an external site` |
| `aiMcpElicitUrlOpen` | `打开并授权` | `Open and authorize` |
| `aiMcpElicitUrlOpened` | `已在新标签页打开。请在那边完成授权，然后让 Nimo 重试。` | `Opened in a new tab. Finish authorizing there, then ask Nimo to retry.` |
| `aiMcpElicitUrlNote` | `在这里同意只表示打开页面 —— Nimo 看不到授权是否已完成。` | `Consenting here only opens the page — Nimo cannot see whether the authorization finished.` |
| `aiMcpElicitUrlIdn` | `这个地址使用了国际化域名，可能被做得很像知名站点 —— 登录前请仔细核对。` | `This address uses an internationalized domain. It can be made to look like a well-known site — check it carefully before signing in.` |
| `aiMcpElicitUrlPuny` | `Punycode 写法：{host}` | `Punycode form: {host}` |
| `aiMcpElicitUrlInsecure` | `这个地址不是 HTTPS。不要在上面输入账号密码。` | `This address is not HTTPS. Do not enter credentials on it.` |
| `aiMcpElicitUrlBlocked` | `这个链接无法打开：只允许 http 与 https 地址。` | `This link cannot be opened: only http and https addresses are allowed.` |

- [ ] **Step 1: 写失败的测试**

`src/ai/components/blocks/McpElicitUrlCard.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import McpElicitUrlCard from './McpElicitUrlCard.vue'

const resolveElicitation = vi.fn(async () => {})
vi.mock('../../composables/useProvidedAgentStore', () => ({
  useProvidedAgentStore: () => ({ resolveElicitation }),
}))

function mountCard(props: Record<string, unknown> = {}) {
  return mount(McpElicitUrlCard, {
    props: {
      confirmId: 'c1', server: 'notion', message: '请授权',
      url: 'https://auth.example.com/oauth?x=1', host: 'auth.example.com',
      hostAscii: '', punycode: false, insecure: false, ...props,
    },
  })
}

describe('McpElicitUrlCard', () => {
  let open: ReturnType<typeof vi.fn>
  beforeEach(() => {
    resolveElicitation.mockClear(); resolveElicitation.mockResolvedValue(undefined)
    open = vi.fn()
    vi.stubGlobal('open', open)
  })

  it('点「打开并授权」:带 noopener,noreferrer 开新标签页并立刻 accept', async () => {
    const w = mountCard()
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(open).toHaveBeenCalledWith('https://auth.example.com/oauth?x=1', '_blank', 'noopener,noreferrer')
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', null)
    expect(w.text()).toContain('已在新标签页打开')
  })

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<h1>hi'],
    ['blob:https://evil.example/x'],
    ['myapp://launch'],
  ])('scheme 白名单拦下 %s:不打开、不发请求', async (url) => {
    const w = mountCard({ url })
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(open).not.toHaveBeenCalled()
    expect(resolveElicitation).not.toHaveBeenCalled()
    expect(w.find('.mcc-err').text()).toContain('只允许 http 与 https')
  })

  it('http(非 https)允许打开,但 insecure 警告要在', async () => {
    const w = mountCard({ url: 'http://plain.example.com/x', host: 'plain.example.com', insecure: true })
    expect(w.text()).toContain('不是 HTTPS')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(open).toHaveBeenCalled()
  })

  it('host 高亮:整条 URL 都在,host 单独成一段', () => {
    const w = mountCard()
    expect(w.find('.mcc-url .host').text()).toBe('auth.example.com')
    expect(w.find('.mcc-url').text()).toContain('https://')
    expect(w.find('.mcc-url').text()).toContain('/oauth?x=1')
  })

  it('host 在 URL 里找不到时整条落到 after,不崩', () => {
    const w = mountCard({ host: 'nowhere.example' })
    expect(w.find('.mcc-url .host').text()).toBe('')
    expect(w.find('.mcc-url').text()).toContain('https://auth.example.com/oauth?x=1')
  })

  it('punycode 警告;有 hostAscii 时并排显示 punycode 拼法', () => {
    const w = mountCard({ punycode: true, hostAscii: 'xn--80ak6aa92e.com' })
    expect(w.find('.mcc-alarm').text()).toContain('国际化域名')
    expect(w.find('.mcc-alarm .ascii').text()).toContain('xn--80ak6aa92e.com')
  })

  it('punycode 为真但 hostAscii 为空时不渲染并排行', () => {
    const w = mountCard({ punycode: true, hostAscii: '' })
    expect(w.find('.mcc-alarm').exists()).toBe(true)
    expect(w.find('.mcc-alarm .ascii').exists()).toBe(false)
  })

  it('409 之后整卡折叠,不留按钮', async () => {
    resolveElicitation.mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 409 } }))
    const w = mountCard()
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('确认已过期')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('「取消」发 cancel', async () => {
    const w = mountCard()
    await w.findAll('button.mcc-btn')[1].trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'cancel', null)
    expect(open).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/ai/components/blocks/McpElicitUrlCard.test.ts`
Expected: FAIL —— 组件不存在。

- [ ] **Step 3: 写组件**

`src/ai/components/blocks/McpElicitUrlCard.vue`，移植自 Vue2 同名文件（220 行）。脚本部分：

```vue
<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/McpElicitUrlCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { useConfirmResolve } from '../../composables/useConfirmResolve'

// window.open 的参数是**完全由第三方 MCP 服务端控制**的字符串,所以这里是白名单而不是
// 黑名单。javascript: 在若干浏览器里会在继承 opener 源的文档里执行;data: 与 blob:
// 渲染的是攻击者的 HTML,而用户读到的是「NimoOS 替我打开的页面」;注册过的自定义协议
// 直接拉起本地程序。这些都不是「去外部站点完成授权」。
// 后端 elicitation.py::_ALLOWED_URL_SCHEMES 已经拦过一次,这里不是冗余:NimoOS-AI 与
// 本仓是两个独立发版的仓库,用户手上完全可能是「新前端 + 旧后端」。
const OPENABLE_URL_RE = /^https?:\/\//i

const props = withDefaults(defineProps<{
  confirmId?: string
  server?: string
  message?: string
  url?: string
  host?: string
  // host 的 punycode 拼法,且**只在与 host 不同时**非空(后端 _host_flags)
  hostAscii?: string
  punycode?: boolean
  insecure?: boolean
}>(), {
  confirmId: '', server: '', message: '', url: '', host: '',
  hostAscii: '', punycode: false, insecure: false,
})

const { t } = useI18n()
const store = useProvidedAgentStore()
const { decision, submitting, expired, submitError, run, fail } =
  useConfirmResolve<'accept' | 'cancel'>()

// 域名高亮:整条 URL 都要看得见(规范要求展示完整 URL),但让 host 在视觉上跳出来,
// 因为那才是用户唯一能据以判断「我要不要在这里登录」的部分。
// 用 indexOf 而不是 split:路径里可能再次出现同样的字符串。
const urlParts = computed(() => {
  const url = props.url || ''
  const host = props.host || ''
  const at = host ? url.indexOf(host) : -1
  if (at < 0) return { before: '', host: '', after: url }
  return { before: url.slice(0, at), host, after: url.slice(at + host.length) }
})

async function openAndAccept(): Promise<void> {
  if (submitting.value || expired.value) return
  // scheme 白名单:见文件顶部注释。卡片上的「不是 HTTPS」只是一条提示,不是关卡 ——
  // 关卡在这里,拦下就报错而不是打开。
  if (!OPENABLE_URL_RE.test(String(props.url || '').trim())) {
    fail('aiMcpElicitUrlBlocked')
    return
  }
  // noopener,noreferrer:不给第三方页面 window.opener,也不泄漏来源
  window.open(props.url, '_blank', 'noopener,noreferrer')
  // 立刻回 accept。规范:accept 只表示「用户同意进行这次交互」,不表示交互已完成。
  // 对真实 OAuth 服务端,重发原请求时授权多半还没落地,最终落到轮次耗尽 —— 后端
  // _rounds_exceeded_msg 会告诉模型「让用户完成授权后重试」。
  await resolve('accept')
}

async function resolve(action: 'accept' | 'cancel'): Promise<void> {
  if (!props.confirmId) { fail('aiConfirmInvalid'); return }
  await run(action, () => store.resolveElicitation(props.confirmId, action, null))
}
</script>
```

模板与样式**照 Vue2 原文移植**，四处照本仓约定改写：
- `$t('…')` → `t('aiMcpElicitUrl…')`（键见本任务开头的表）
- `rgba(175,82,222,0.06)` → `var(--purple-soft)`；`rgba(175,82,222,0.14)` → `var(--purple-soft-border)`；
  `rgba(255,59,48,0.08|0.1)` → `var(--danger-soft)`；`rgba(52,199,89,0.14)`+`#1f9d4d` → `var(--success-soft)`+`var(--success)`；
  `#fff` → `var(--text-on-accent)`；`.mcc-url .host` 的底色 → `var(--purple-soft)`
- `data-decision` 选择器只留 `accept` / `cancel` / `expired`（这张卡不发 `decline`）
- `expired` 屏放在 `decision` 屏**之前**（它压过一切）

- [ ] **Step 4: 加 i18n 键（zh + en 双写）**

- [ ] **Step 5: 跑测试**

Run: `pnpm exec vitest run src/ai/components/blocks/McpElicitUrlCard.test.ts src/i18n/parity.test.ts`
Expected: PASS。

- [ ] **Step 6: 变异验证**

把 `OPENABLE_URL_RE` 临时改成 `/^\w+:/`（放行一切 scheme）→ 四条白名单用例必须红。改回来。

- [ ] **Step 7: Commit**

```bash
git add src/ai/components/blocks/McpElicitUrlCard.vue src/ai/components/blocks/McpElicitUrlCard.test.ts \
        src/i18n/zh_cn.ai.ts src/i18n/en_us.ai.ts
git commit -m "$(cat <<'EOF'
feat(ai): gate MCP authorization links behind an http(s) allowlist

The URL comes from a third-party MCP server and lands in window.open, where
javascript: can run against a document inheriting our origin, data: and
blob: render attacker HTML the user reads as a page NimoOS opened, and a
registered custom scheme launches a local program. The "not HTTPS" line is
advice, not a gate, so the gate lives in the click handler. The backend
checks the same thing, but the two repos ship independently and a new
frontend can meet an old backend.

Also shows the punycode spelling next to the hostname, which the backend
only sends when the two forms differ -- exactly when the eye cannot tell.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 接线 —— `dispatchEvent` 两分支 + `BlockRenderer` 映射 + 权限卡过期态

**Files:**
- Modify: `src/ai/services/dispatchEvent.ts:203-230`（`confirmation_required` 的 `else if` 链）
- Modify: `src/ai/components/blocks/BlockRenderer.vue:25-59`
- Modify: `src/ai/components/blocks/McpPermissionCard.vue`（全文）
- Test: `src/ai/services/dispatchEvent.elicit.test.ts`（新建）· `src/ai/components/blocks/McpPermissionCard.test.ts`（新建）
- Modify: `src/ai/components/blocks/BlockRenderer.batchA.test.ts`（补两个映射断言）
- Modify: `src/i18n/zh_cn.ai.ts` · `src/i18n/en_us.ai.ts`（删 `aiChange` 若确认全仓无其它引用）

**Interfaces:**
- Consumes: T5 / T6 两个组件
- Produces: 块类型 `mcp_elicit_form` / `mcp_elicit_url`

**事件契约权威源：** `NimoOS-AI/agent/mcp_client/elicitation.py:118-152`（`_url_card` / `_form_card`）+ `:211`（`dict(card, confirm_id=…, error=reason)`）。**逐字对照，不手编。**

- [ ] **Step 1: 写失败的测试**

`src/ai/services/dispatchEvent.elicit.test.ts`：

```ts
import { describe, it, expect, vi } from 'vitest'
import { dispatchEvent } from './dispatchEvent'

function actions() {
  return {
    appendBlock: vi.fn(), patchBlock: vi.fn(() => true), pushActivityStep: vi.fn(),
    markRunningStepDone: vi.fn(), setStreamingDone: vi.fn(), pushUserMessage: vi.fn(),
    startAssistant: vi.fn(),
  } as never
}

describe('dispatchEvent —— MCP elicitation', () => {
  it('mcp_elicit_form 映射成表单块(字段名照后端 _form_card)', () => {
    const a = actions()
    dispatchEvent({
      type: 'confirmation_required', kind: 'mcp_elicit_form',
      confirm_id: 'c1', server: 'brave', message: '请填写',
      fields: [{ key: 'name', type: 'string' }], error: 'too short',
    }, a)
    expect((a as any).appendBlock).toHaveBeenCalledWith({
      type: 'mcp_elicit_form', confirmId: 'c1', server: 'brave', message: '请填写',
      fields: [{ key: 'name', type: 'string' }], error: 'too short',
    })
  })

  it('fields 不是数组时归一成空数组', () => {
    const a = actions()
    dispatchEvent({ type: 'confirmation_required', kind: 'mcp_elicit_form', confirm_id: 'c1' }, a)
    expect((a as any).appendBlock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mcp_elicit_form', fields: [], error: '' }),
    )
  })

  it('mcp_elicit_url 映射成 URL 块,host_ascii 改名 hostAscii', () => {
    const a = actions()
    dispatchEvent({
      type: 'confirmation_required', kind: 'mcp_elicit_url',
      confirm_id: 'c2', server: 'notion', message: '请授权',
      url: 'https://x.example/a', host: 'x.example',
      punycode: true, host_ascii: 'xn--x.example', insecure: false,
    }, a)
    expect((a as any).appendBlock).toHaveBeenCalledWith({
      type: 'mcp_elicit_url', confirmId: 'c2', server: 'notion', message: '请授权',
      url: 'https://x.example/a', host: 'x.example',
      hostAscii: 'xn--x.example', punycode: true, insecure: false,
    })
  })

  it('未知 kind 仍走既有的通用 confirm 分支(不被两个新分支吃掉)', () => {
    const a = actions()
    dispatchEvent({ type: 'confirmation_required', kind: 'something_else', confirm_id: 'c3' }, a)
    expect((a as any).appendBlock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'confirm', confirmId: 'c3' }),
    )
  })
})
```

`src/ai/components/blocks/McpPermissionCard.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import McpPermissionCard from './McpPermissionCard.vue'

const confirmAgentAction = vi.fn(async () => {})
vi.mock('../../composables/useProvidedAgentStore', () => ({
  useProvidedAgentStore: () => ({ confirmAgentAction }),
}))

const mountCard = () => mount(McpPermissionCard, {
  props: { confirmId: 'c1', server: 'brave', tool: 'search', rememberScope: 'tool' },
})

describe('McpPermissionCard', () => {
  beforeEach(() => { confirmAgentAction.mockClear(); confirmAgentAction.mockResolvedValue(undefined) })

  it('允许一次 → confirmed=true, remember=false', async () => {
    const w = mountCard()
    await w.find('.mcc-allow-once').trigger('click')
    await flushPromises()
    expect(confirmAgentAction).toHaveBeenCalledWith('c1', true, false)
  })

  it('已解决态不再提供「更改」按钮(它只会把用户送进下一个 409)', async () => {
    const w = mountCard()
    await w.find('.mcc-allow-once').trigger('click')
    await flushPromises()
    expect(w.find('.undo').exists()).toBe(false)
  })

  it('409 之后整卡折叠成一行,不留任何按钮', async () => {
    confirmAgentAction.mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 409 } }))
    const w = mountCard()
    await w.find('.mcc-allow-once').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('确认已过期')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('500 之后按钮仍在,可以重试', async () => {
    confirmAgentAction.mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500 } }))
    const w = mountCard()
    await w.find('.mcc-allow-once').trigger('click')
    await flushPromises()
    expect(w.find('.mcc-allow-once').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/ai/services/dispatchEvent.elicit.test.ts src/ai/components/blocks/McpPermissionCard.test.ts`
Expected: FAIL —— 事件落到通用 `confirm` 分支；权限卡的「更改」按钮还在。

- [ ] **Step 3: 改 `dispatchEvent.ts`**

在 `} else if (e.kind === 'mcp_install') { … }` 之后、`} else {`（通用 confirm）之前插入：

```ts
      } else if (e.kind === 'mcp_elicit_form') {
        // 后端退回上一次作答时会带着 error 重发同一个问题(新的 confirm_id),
        // 这里就是新的一张卡 —— 旧的那张已经 resolve,停在「已发送」上。
        actions.appendBlock({
          type: 'mcp_elicit_form',
          confirmId: e.confirm_id || '',
          server: e.server || '',
          message: e.message || '',
          fields: Array.isArray(e.fields) ? e.fields : [],
          error: e.error || '',
        })
      } else if (e.kind === 'mcp_elicit_url') {
        actions.appendBlock({
          type: 'mcp_elicit_url',
          confirmId: e.confirm_id || '',
          server: e.server || '',
          message: e.message || '',
          url: e.url || '',
          host: e.host || '',
          // host 的 punycode 拼法。后端只在它与 host 不同时才给 —— 也就是用户
          // 光看看不出来的同形异义情况(见 elicitation.py::_host_flags)。
          hostAscii: e.host_ascii || '',
          punycode: !!e.punycode,
          insecure: !!e.insecure,
        })
```

- [ ] **Step 4: 改 `BlockRenderer.vue`**

加两个 import 与两个 BLOCK_MAP 条目：

```ts
import McpElicitFormCard from './McpElicitFormCard.vue'
import McpElicitUrlCard from './McpElicitUrlCard.vue'
// …
  mcp_elicit_form: McpElicitFormCard,
  mcp_elicit_url: McpElicitUrlCard,
```

在 `src/ai/components/blocks/BlockRenderer.batchA.test.ts` 里照该文件既有的断言形状，补两条「`mcp_elicit_form` / `mcp_elicit_url` 渲染出对应卡片而不是灰色降级 chip」。

- [ ] **Step 5: 改 `McpPermissionCard.vue`**

- 脚本：删掉本地的 `decision` / `submitting` / `error` 三个 ref，改用
  `const { decision, submitting, expired, submitError, run, fail } = useConfirmResolve<'allow' | 'always' | 'deny'>()`；
  `resolve(confirmed, remember)` 里先 `if (!props.confirmId) { fail('aiConfirmInvalid'); return }`，
  再 `await run(!confirmed ? 'deny' : (remember ? 'always' : 'allow'), () => store.confirmAgentAction(props.confirmId, confirmed, remember))`。
- 模板：在 `v-if="decision"` **之前**插入 expired 屏（与另两张卡逐字同形）：

```vue
    <div v-if="expired" class="mcc-perm-resolved" data-decision="expired">
      <span class="rico"><AgentIcon name="x" :size="13" /></span>
      <span>{{ t('aiConfirmExpired') }}</span>
    </div>
    <div v-else-if="decision" class="mcc-perm-resolved" :data-decision="decision">
```
- 模板：删掉已解决屏里的 `<button class="undo">`；`{{ error }}` 改成 `{{ submitError }}`。
- 样式：删 `.mcc-perm-resolved .undo` 与 `.undo:hover` 两条规则；补 expired 两条：

```css
/* expired 不是用户做的决定 —— 中性灰,不用 deny 的红。 */
.mcc-perm-resolved[data-decision="expired"] .rico { background: var(--bg-chip); color: var(--text-tertiary); }
.mcc-perm-resolved[data-decision="expired"] { color: var(--text-tertiary); }
```

- [ ] **Step 6: 清理 `aiChange` 键**

```bash
grep -rn "aiChange" src/ | grep -v "\.test\."
```
若只剩 i18n 两个文件里的定义（无消费者），从 `zh_cn.ai.ts` 与 `en_us.ai.ts` **同时**删除；若别处还在用，保留并在提交信息里说明。

- [ ] **Step 7: 跑测试**

Run: `pnpm exec vitest run src/ai/services/ src/ai/components/blocks/ src/i18n/parity.test.ts`
Expected: PASS。**若 `BlockRenderer.batchA.test.ts` 或别处有测试断言了「409 保留按钮」的旧行为，改写它并在文件里留一行注释说明「期望被反转的原因」，不要直接删。**

- [ ] **Step 8: 变异验证**

把 `BlockRenderer` 的 `mcp_elicit_url` 映射临时删掉 → batchA 那条新断言必须红。改回来。

- [ ] **Step 9: Commit**

```bash
git add src/ai/services/dispatchEvent.ts src/ai/services/dispatchEvent.elicit.test.ts \
        src/ai/components/blocks/BlockRenderer.vue src/ai/components/blocks/BlockRenderer.batchA.test.ts \
        src/ai/components/blocks/McpPermissionCard.vue src/ai/components/blocks/McpPermissionCard.test.ts \
        src/i18n/zh_cn.ai.ts src/i18n/en_us.ai.ts
git commit -m "$(cat <<'EOF'
feat(ai): route elicitation events to their cards and collapse expired ones

Wires the two new confirmation kinds through the stream reducer and the
block map, and moves the permission card onto the shared resolution state
machine so all three behave alike after a 409.

The permission card also loses its "Change" action. It only set decision
back to null, which reconnected the buttons to a confirm_id the backend had
already consumed -- there was no path where clicking it could succeed, only
another 409. Reproduce the old behaviour by stopping the session while a
card is on screen and clicking anything.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

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

### Task 9: #98 Knowledge 桌面磁贴

**Files:**
- Create: `src/home/apps/icons/knowledge.svg`
- Modify: `src/home/apps/systemApps.ts`
- Modify: `src/home/composables/useOpenAction.ts:36-52`
- Modify: `src/home/grid/defaultLayout.ts`
- Test: `src/home/apps/systemApps.test.ts`（若不存在则新建）· `src/home/composables/useOpenAction.test.ts`（补例）
- Modify: `src/i18n/zh_cn.ts` · `src/i18n/en_us.ts`（磁贴名是**桌面**文案，不在 `.ai` 分片里 —— 落笔前确认既有 `appFiles` / `appAi` 在哪个文件，跟着放）

**Interfaces:**
- Produces: `SYSTEM_APPS` 多一项 `{ key: 'knowledge', label: 'appKnowledge', … }`

**为什么这条值得做：** `/ai/knowledge` 有 11 条路由、9 项 rail、笔记/Wiki/队列/白名单全都实现了，但**全仓没有任何入口** —— 只有知识库内部互跳，桌面、AI 页、设置里都进不去。这不是「补个磁贴」，是补上唯一的入口。

- [ ] **Step 1: 搬图标**

```bash
cp /home/nimo/NimoTech/NimoOS-UI/src/assets/img/app/knowledge.svg src/home/apps/icons/knowledge.svg
```
（Vue2 那份是 #98 引入的 31 行 svg。若文件里有硬编码颜色，那属于「品牌识别色」例外 —— 与既有 `ai.svg` / `files.svg` 同一处置，不要 token 化。）

- [ ] **Step 2: 写失败的测试**

`src/home/apps/systemApps.test.ts`（若已存在就往里加）：

```ts
import { describe, it, expect } from 'vitest'
import { SYSTEM_APPS, SYSTEM_APP_KEYS } from './systemApps'

describe('SYSTEM_APPS —— knowledge(SP14 #98)', () => {
  it('知识库在系统应用表里,带 i18n 键与图标', () => {
    const k = SYSTEM_APPS.find((a) => a.key === 'knowledge')
    expect(k).toBeDefined()
    expect(k!.label).toBe('appKnowledge')
    expect(k!.icon).toBeTruthy()
  })

  it('key 不重复(Dock 与 AddPanel 都按 key 去重)', () => {
    expect(new Set(SYSTEM_APP_KEYS).size).toBe(SYSTEM_APP_KEYS.length)
  })
})
```

在 `src/home/composables/useOpenAction.test.ts` 里补（照该文件既有的 `router.push` mock 写法）：

```ts
it('知识库磁贴走应用内路由 /ai/knowledge', () => {
  const { openApp } = useOpenAction()
  openApp('knowledge')
  expect(push).toHaveBeenCalledWith('/ai/knowledge')
})
```

- [ ] **Step 3: 跑测试确认它红**

Run: `pnpm exec vitest run src/home/apps/systemApps.test.ts src/home/composables/useOpenAction.test.ts`
Expected: FAIL —— 表里没有 knowledge；`openApp('knowledge')` 落到 `window.location.href = '/#/legacy'`。

- [ ] **Step 4: 改三个文件**

`systemApps.ts`：加 import 与一项（`glyph` 用一个书本/文库形状的 path，与既有 `G` 常量同风格）：

```ts
import iconKnowledge from './icons/knowledge.svg'
// G 里加:
  book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v15H6.5a2 2 0 0 0-2 2Z"/><path d="M9 7.5h6M9 11h6"/>',
// SYSTEM_APPS 里 ai 之后加:
  { key: 'knowledge', name: 'Knowledge', label: 'appKnowledge', cls: 'ic-knowledge', glyph: G.book, icon: iconKnowledge },
```

> `cls: 'ic-knowledge'` 要在 `src/styles/theme.css` 的 `.ic-*` 渐变段里有对应定义（那是**有意为之的品牌色例外**，两套主题都保留）。照既有 `.ic-ai` 的写法加一条，并在旁边留注释标明属于既有例外。

`useOpenAction.ts` 的 `openApp` 里，`ai` 那条之后加：

```ts
      // 知识库:SP8 建的应用内路由,Vue2 侧没有对应入口 ⇒ 不设回退 flag(无处可退)。
      if (key === 'knowledge') { router.push('/ai/knowledge'); return }
```

`defaultLayout.ts` 的 `DEFAULT` 里加一格（放在 `{ kind: 'app', key: 'vm', c: 12, r: 6 … }` 之后的空位，例如 `c: 11, r: 6` 已被 appstore 占用 → 用 `{ kind: 'app', key: 'knowledge', c: 3, r: 1, w: 1, h: 1 }` 会撞 storage 小组件；**落笔前先按 `c/r/w/h` 把现有 21 项画一遍网格，挑一个真正空的格子**，并在测试里断言它不与任何既有项重叠）。

- [ ] **Step 5: 加 i18n 键**

`appKnowledge` → zh：`知识库`；en：`Knowledge`。放进 `appFiles` / `appAi` 所在的同一个文件。

- [ ] **Step 6: 跑测试**

Run: `pnpm exec vitest run src/home/ src/i18n/parity.test.ts`
Expected: PASS（含既有 `defaultLayout.test.ts` 不回归 —— 若它断言了项数，一并更新）。

- [ ] **Step 7: Commit**

```bash
git add src/home/apps/icons/knowledge.svg src/home/apps/systemApps.ts src/home/apps/systemApps.test.ts \
        src/home/composables/useOpenAction.ts src/home/composables/useOpenAction.test.ts \
        src/home/grid/defaultLayout.ts src/styles/theme.css src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "$(cat <<'EOF'
feat(home): give Knowledge a desktop tile

/ai/knowledge has eleven routes and a nine-item rail, and until now nothing
in the app linked to any of them -- only the knowledge pages navigate
between themselves, so the whole area was reachable only by typing the URL.
Vue 2 reached it from a home tile; the port took the routes and left the
tile behind.

The tile pushes an in-app route rather than opening a tab as Vue 2 did: the
AI area moved into this application at SP8-P6, so a new tab would drop the
in-app state. No strangler fallback flag, because Vue 2 has no Knowledge
entry to fall back to.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: 收尾门 + 台账

**Files:**
- Create: `.superpowers/sdd/sp14/closeout.md`

- [ ] **Step 1: 跑整支收尾门，逐条记录真实数字**

```bash
pnpm exec vitest run                      # 全量,记录 文件数/用例数/失败数
pnpm exec vue-tsc --noEmit                # 类型
pnpm exec vitest run src/styles           # color-guard 等样式守卫
pnpm exec vitest run src/i18n             # parity
pnpm build                                # 构建
```

> ⚠️ 任何一条不绿都**不许**记「通过」。`vitest run` 退出码非 0 但零失败的情况本仓出现过（`sp7-photos-migration-progress` 那次是别处的 mock 缺口）—— 如实写清楚是哪一条、为什么。

- [ ] **Step 2: 跑 oss 导出的安全形式**

```bash
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/9be6eba5-49d2-4544-b285-669477868c4c/scratchpad/oss-sp14 --no-commit --allow-dirty-oss
```
**不得裸调 `export.mjs`。** 新增的 AI 区文件（两张卡、composable、两个纯函数）属于开源产物树里被剔除的 AI 面 —— 确认导出没有因为新文件而报错，若报错按 `oss-web-ui-export-project` 那条记忆里的配方补 manifest。

- [ ] **Step 3: 真浏览器自查**

起 dev server：`pnpm dev --host --port 5279`，然后按 Task 0 的结论二选一：
- **后端支持** → 用一个会 elicit 的 MCP server 真触发，两张卡都过一遍（含 `<select>` 的**弹出列表**要在深浅两套主题下各看一次，确认不是白底白字）。
- **后端不支持或无法判定** → 用 CDP 往 `dispatchEvent` 注入两条事件看渲染（配方见 `newui-cdp-probe-auth-bypass`：localStorage 要连 `version` 一起塞，带 query 整页直达）。**在台账里如实写「渲染已验、端到端未验」。**

#141 与 #98 无论如何都要真机走一遍：MCP 详情页点「测试连接」看协议行；桌面 Dock「更多」里找到知识库磁贴、点进 `/ai/knowledge`。

- [ ] **Step 4: 写台账并提交**

`.superpowers/sdd/sp14/closeout.md`：每道门的**原始输出数字**、真浏览器自查的截图或结论、以及所有「未验」项的清单。

```bash
git add .superpowers/sdd/sp14/closeout.md
git commit -m "$(cat <<'EOF'
docs(sp14): record the closeout gates and what stayed unverified

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 自查（写完计划后的核对）

**Spec 覆盖：** 设计文档 §4 的 8 个任务 → 本计划 T1–T9 全部落到具体文件与代码（T1=T1、T2=T2、T3=T3、T4=T4+T5、T5=T6、T6=T7、T7=T8、T8=T9），另加 T0（后端探测，来自 §7 风险 1）与 T10（收尾门，来自 §5/§6）。§3.2 校验分工 → T4 的注释与测试；§3.3 状态机三行表 → T1 的四个用例；§3.4 的「不渲染而非打印 undefined」→ T8 Step 1 的两例；§3.5 的「老用户靠 Dock/AddPanel」→ T9 的 `SYSTEM_APP_KEYS` 去重用例 + Step 3 的红判据。

**类型一致：** `useConfirmResolve` 的返回名（`decision/submitting/expired/submitError/run/fail`）在 T5/T6/T7 三处解构一致；`ElicitField` 的 snake_case 字段名在 T4 定义、T5 使用一致；`McpTestView` 的 `protocolEra/protocolVersion/supportedVersions` 在 T8 的类型、`toTestView`、`protocolLine`、测试四处一致；`resolveElicitation(confirmId, action, content)` 的签名在 T3 定义、T5/T6 调用一致。

**三处刻意留白**（不是占位符，是必须落笔时按现场核对的）：T2 的 `PREFIX` 实际字符串、T8 Step 5 的 import 相对深度、T9 Step 4 的空格子坐标 —— 三处都写明了「按该文件既有形状核对，别照抄我这行」以及核对方法。

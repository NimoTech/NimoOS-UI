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


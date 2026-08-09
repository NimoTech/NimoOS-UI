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


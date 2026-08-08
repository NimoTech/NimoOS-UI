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


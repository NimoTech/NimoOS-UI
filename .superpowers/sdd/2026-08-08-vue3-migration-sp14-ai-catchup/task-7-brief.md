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


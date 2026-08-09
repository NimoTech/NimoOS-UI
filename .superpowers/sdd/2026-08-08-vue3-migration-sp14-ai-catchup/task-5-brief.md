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


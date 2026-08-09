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


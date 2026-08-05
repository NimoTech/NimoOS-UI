## Task 6: WebUI 端口行(改端口 + 新端口探活 + 跳转)

**⚠️ 自查时不要真的提交端口修改** —— 会真的换掉网关端口。正确性靠本任务的单测(校验、探活次数上限、跳转 URL 拼接都是纯逻辑),实机留给用户验收。

**Files:**
- Create: `src/settings/util/checkUiPort.ts`
- Create: `src/settings/util/checkUiPort.test.ts`
- Create: `src/settings/panels/general/WebUiPortRow.vue`
- Create: `src/settings/panels/general/WebUiPortRow.test.ts`

**Interfaces:**
- Consumes: `service.sys.getServerPort()`(返回**字符串**如 `"80"`)、`service.sys.editServerPort({port})`、Task 3 的 `.set-input` / `.set-btn.primary`、`useToast()`
- Produces:
  ```ts
  export function validatePort(raw: string): { ok: true; port: number } | { ok: false }
  export function buildProbeUrl(port: string, loc?: { protocol: string; hostname: string }): string
  export function buildRedirectUrl(port: string, loc?: { protocol: string; hostname: string; pathname: string; hash: string }): string
  export const PROBE_INTERVAL_MS = 1500
  export const PROBE_MAX_TRIES = 40
  /** 单次探活:通了返回后端报的端口字符串,否则 null。不抛。 */
  export function probeUiPort(url: string): Promise<string | null>
  ```

- [ ] **Step 1: 写失败测试**

`src/settings/util/checkUiPort.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { validatePort, buildProbeUrl, buildRedirectUrl, probeUiPort, PROBE_MAX_TRIES } from './checkUiPort'

afterEach(() => { vi.unstubAllGlobals() })

describe('validatePort(对位 Vue2 L1387-1394)', () => {
  it('80 与 65535 是合法边界', () => {
    expect(validatePort('80')).toEqual({ ok: true, port: 80 })
    expect(validatePort('65535')).toEqual({ ok: true, port: 65535 })
  })
  it('79 与 65536 越界', () => {
    expect(validatePort('79').ok).toBe(false)
    expect(validatePort('65536').ok).toBe(false)
  })
  it('空、非数字、负数都不合法', () => {
    for (const v of ['', ' ', 'abc', '-1', '8o80']) expect(validatePort(v).ok).toBe(false)
  })
  it('小数被拒(Vue2 用 parseInt 会把 80.5 吃成 80 —— 这是它的 bug,不照抄)', () => {
    expect(validatePort('80.5').ok).toBe(false)
  })
  it('带空格的纯数字容错', () => {
    expect(validatePort(' 8080 ')).toEqual({ ok: true, port: 8080 })
  })
})

describe('buildProbeUrl', () => {
  it('拼出新端口上的 /v1/gateway/port', () => {
    expect(buildProbeUrl('8080', { protocol: 'http:', hostname: '192.168.1.143' }))
      .toBe('http://192.168.1.143:8080/v1/gateway/port')
  })
})

describe('buildRedirectUrl(移植纪律 #5)', () => {
  it('保留当前路径与 hash —— 否则会把用户甩进 /(旧 Vue2 界面)', () => {
    expect(buildRedirectUrl('8080', {
      protocol: 'http:', hostname: '192.168.1.143', pathname: '/app/', hash: '#/settings/general',
    })).toBe('http://192.168.1.143:8080/app/#/settings/general')
  })
  it('没有 hash 时不拼多余的 #', () => {
    expect(buildRedirectUrl('8080', {
      protocol: 'http:', hostname: 'h', pathname: '/app/', hash: '',
    })).toBe('http://h:8080/app/')
  })
})

describe('probeUiPort', () => {
  it('信封 success=200 时返回后端报的端口', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 200, data: '8080' }) })))
    expect(await probeUiPort('http://h:8080/v1/gateway/port')).toBe('8080')
  })
  it('网络错误返回 null 而不抛(切换期间必然连不上,不能让它冒泡)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await probeUiPort('http://h:8080/v1/gateway/port')).toBeNull()
  })
  it('非 200 信封返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 500, message: 'x' }) })))
    expect(await probeUiPort('u')).toBeNull()
  })
  it('响应不是 JSON 也返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError('bad') } })))
    expect(await probeUiPort('u')).toBeNull()
  })
})

describe('探活次数上限(移植纪律 #4)', () => {
  it('有明确上限常量,不是无限探到组件销毁', () => {
    expect(PROBE_MAX_TRIES).toBe(40)   // 40 × 1500ms ≈ 60s
  })
})
```

`src/settings/panels/general/WebUiPortRow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const state = { port: '80', editCalls: [] as unknown[], editFail: false }
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getServerPort: async () => state.port,
      editServerPort: async (p: { port: string }) => {
        state.editCalls.push(p)
        if (state.editFail) throw new Error('boom')
      },
    },
  },
}))

import WebUiPortRow from './WebUiPortRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
// navigate 是可选 prop(生产环境不传 → 真跳转);测试传 spy。
// 不用 defineExpose 开测试后门 —— 那是只为测试存在的生产接口。
const mountRow = (navigate?: (url: string) => void) =>
  mount(WebUiPortRow, { props: navigate ? { navigate } : {}, global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  state.port = '80'
  state.editCalls = []
  state.editFail = false
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('WebUiPortRow', () => {
  it('挂载后填入当前端口', async () => {
    const w = mountRow()
    await flushPromises()
    expect((w.find('input').element as HTMLInputElement).value).toBe('80')
  })

  it('端口未改动时不显示提交按钮(对位 Vue2 portChanged)', async () => {
    const w = mountRow()
    await flushPromises()
    expect(w.find('.wpr-submit').exists()).toBe(false)
  })

  it('改动后出现提交按钮', async () => {
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    expect(w.find('.wpr-submit').exists()).toBe(true)
  })

  it('越界端口:提示错误且不发请求', async () => {
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('79')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(state.editCalls).toEqual([])
    expect(w.text()).toContain('端口范围为 80-65535')
  })

  it('合法端口:下发字符串形态的 port', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(state.editCalls).toEqual([{ port: '8080' }])
  })

  it('保存配置失败:停在原地并提示,不进入探活', async () => {
    state.editFail = true
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('探活成功后跳转到新端口的当前页(移植纪律 #5)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 200, data: '8080' }) })))
    const assign = vi.fn()
    const w = mountRow(assign)
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign.mock.calls[0][0]).toContain(':8080')
  })

  it('探活到上限仍不通:停表 + 提示手动访问,不无限探(移植纪律 #4)', async () => {
    const fetchSpy = vi.fn(async () => { throw new TypeError('down') })
    vi.stubGlobal('fetch', fetchSpy)
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500 * 45)
    await flushPromises()
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(40)
    expect(w.text()).toContain('新端口没有响应')
  })

  it('组件卸载后停表(不留定时器)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    w.unmount()
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await vi.advanceTimersByTimeAsync(1500 * 5)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm test src/settings/util/checkUiPort.test.ts src/settings/panels/general/WebUiPortRow.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现 `src/settings/util/checkUiPort.ts`**

```ts
/**
 * 换 WebUI 端口后的新端口探活。对位 Vue2 SettingsPanel.vue 的
 * validatePort(L1387) / savePort(L1396) / checkUpdate(L1424)。
 *
 * spec §5.1 明确 checkUiPort 不进共享包 —— 它打的是**任意绝对 URL**
 * (跨端口、跨源),而共享包的 axios 实例带 baseURL、认证头与 401 刷新拦截器,
 * 拿它打别的源既没必要也会把拦截器逻辑牵进来。这里用裸 fetch。
 * 网关对所有响应都带 Access-Control-Allow-Origin: *(2026-07-31 curl 实证),
 * 所以跨源 fetch 可行。
 */
export const PROBE_INTERVAL_MS = 1500
/** 移植纪律 #4:Vue2 只在成功时 clearInterval,失败会一直探到组件销毁。这里给上限 40 次 ≈ 60s。 */
export const PROBE_MAX_TRIES = 40

/**
 * Vue2 用 `parseInt(this.port)` 校验 —— `'80.5'` 会被吃成 80、`'8o80'` 会被吃成 8。
 * 这是它的 bug,不照抄:这里要求整个字符串就是十进制整数。
 */
export function validatePort(raw: string): { ok: true; port: number } | { ok: false } {
  const s = raw.trim()
  if (!/^\d+$/.test(s)) return { ok: false }
  const port = Number(s)
  if (port < 80 || port > 65535) return { ok: false }
  return { ok: true, port }
}

type Loc = { protocol: string; hostname: string }
type FullLoc = Loc & { pathname: string; hash: string }

export function buildProbeUrl(port: string, loc: Loc = window.location): string {
  return `${loc.protocol}//${loc.hostname}:${port}/v1/gateway/port`
}

/**
 * 移植纪律 #5:Vue2 跳 `${protocol}//${host}:${port}`(根路径 = 旧 Vue2 应用)。
 * New-UI 挂在 /app/ 下,照抄会把用户甩出新 UI,所以保留当前 pathname + hash。
 */
export function buildRedirectUrl(port: string, loc: FullLoc = window.location): string {
  return `${loc.protocol}//${loc.hostname}:${port}${loc.pathname}${loc.hash}`
}

/** 单次探活。通了返回后端报的端口字符串,否则 null。**任何异常都吞掉** —— 切换期间连不上是常态。 */
export async function probeUiPort(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const body = (await res.json()) as { success?: number; data?: unknown } | null
    if (body?.success === 200 && typeof body.data === 'string') return body.data
    return null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 实现 `WebUiPortRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L176-208(行)+ L1385-1440(逻辑)。
// 流程:校验 → PUT /v1/gateway/port → 轮询新端口的 /v1/gateway/port → 通了就跳过去。
// 网关换端口是「先起新端口、/ping 确认、再优雅关旧端口」(顶层 CLAUDE.md),
// 所以旧端口上的这个页面在切换窗口内还活着,能完成探活。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import {
  PROBE_INTERVAL_MS, PROBE_MAX_TRIES,
  buildProbeUrl, buildRedirectUrl, probeUiPort, validatePort,
} from '../../util/checkUiPort'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()

const port = ref('')
const originalPort = ref('')
const busy = ref(false)
const error = ref('')
const probing = ref(false)

// 跳转做成**可选 prop**:直接写 window.location.href 在 jsdom 里既测不到也会报警告。
// 用 prop 而不是 defineExpose 的测试后门 —— 后者是只为测试存在的生产接口。
const props = defineProps<{ navigate?: (url: string) => void }>()
function go(url: string) {
  if (props.navigate) props.navigate(url)
  else window.location.href = url
}

let timer: ReturnType<typeof setInterval> | null = null
let tries = 0

const changed = computed(() => port.value.trim() !== '' && port.value.trim() !== originalPort.value)

onMounted(async () => {
  try {
    const p = await service.sys.getServerPort()   // 实测是字符串 "80"
    port.value = p
    originalPort.value = p
  } catch (e) {
    console.warn('[settings] getServerPort failed', e)
  }
})

function stopProbe() {
  if (timer) { clearInterval(timer); timer = null }
  probing.value = false
}
// 移植纪律 #4:Vue2 只在 beforeDestroy 清表,这里卸载与超时都清。
onBeforeUnmount(stopProbe)

async function submit() {
  const v = validatePort(port.value)
  if (!v.ok) {
    error.value = t('settingsPortRange')
    return
  }
  error.value = ''
  busy.value = true
  const next = String(v.port)
  try {
    await service.sys.editServerPort({ port: next })
  } catch (e) {
    busy.value = false
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] editServerPort failed', e)
    return   // 保存都没成功就不要进探活
  }
  startProbe(next)
}

function startProbe(next: string) {
  probing.value = true
  tries = 0
  const url = buildProbeUrl(next)
  timer = setInterval(async () => {
    tries++
    if (tries > PROBE_MAX_TRIES) {
      stopProbe()
      busy.value = false
      error.value = t('settingsPortTimeout')
      return
    }
    const reported = await probeUiPort(url)
    if (reported) {
      stopProbe()
      go(buildRedirectUrl(reported))
    }
  }, PROBE_INTERVAL_MS)
}
</script>

<template>
  <SettingsRow :label="t('settingsWebuiPort')">
    <template #control>
      <input
        v-model="port"
        class="set-input"
        type="text"
        inputmode="numeric"
        :placeholder="t('settingsPortPlaceholder')"
        :disabled="busy"
        @keyup.enter="submit"
      />
      <button v-if="changed" class="set-btn primary wpr-submit" type="button" :disabled="busy" @click="submit">
        ✓
      </button>
    </template>
    <template v-if="error || probing" #hint>
      <span v-if="error" class="set-danger">{{ error }}</span>
      <span v-else class="set-info">{{ t('settingsPortSwitching') }}</span>
    </template>
  </SettingsRow>
</template>
```

- [ ] **Step 5: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/util/checkUiPort.ts src/settings/util/checkUiPort.test.ts \
        src/settings/panels/general/WebUiPortRow.vue src/settings/panels/general/WebUiPortRow.test.ts
git commit src/settings/util/checkUiPort.ts src/settings/util/checkUiPort.test.ts \
           src/settings/panels/general/WebUiPortRow.vue src/settings/panels/general/WebUiPortRow.test.ts \
  -m "feat(settings): WebUI 端口行(改端口 + 新端口探活 + 跳转)(SP9-P1)

- 移植纪律 #4:探活上限 40 次≈60s,超时停表提示;卸载也停表
  (Vue2 只在成功时 clearInterval,端口起不来会一直探到组件销毁)
- 移植纪律 #5:跳转保留 pathname+hash,不跳根路径
  (照抄会把用户从 /app/ 甩进旧 Vue2 界面)
- 校验要求整串是十进制整数(Vue2 用 parseInt,'80.5' 会被吃成 80)
- 探活用裸 fetch 而非共享包 axios:打的是跨源绝对 URL,不该牵进认证拦截器"
```

---


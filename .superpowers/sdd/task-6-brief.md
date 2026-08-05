### Task 6: 日志面板(useAppLogs + LogsPane)

**Files:**
- Create: `NimoOS-New-UI/src/apps/console/useAppLogs.ts`
- Create: `NimoOS-New-UI/src/apps/console/LogsPane.vue`
- Test: `useAppLogs.test.ts`、`LogsPane.test.ts`(同目录)

**Interfaces:**
- Consumes: `service.compose.logs(id, {lines})`(共享包既有)。
- Produces(T7 消费):`<LogsPane :app-id="id" />`,自持轮询生命周期。

```ts
export function useAppLogs(appId: () => string): {
  text: Ref<string>; loading: Ref<boolean>; error: Ref<string>
  refresh(): Promise<void>       // 手动刷新
  start(): void; stop(): void    // 5s 轮询开关(挂载 start,卸载 stop)
}
```

- [ ] **Step 1: 写失败测试**

`useAppLogs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const logsMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: { logs: logsMock } } }))
import { useAppLogs } from './useAppLogs'

beforeEach(() => { vi.useFakeTimers(); logsMock.mockReset().mockResolvedValue('line1\nline2') })
afterEach(() => vi.useRealTimers())

it('refresh 拉日志入 text', async () => {
  const l = useAppLogs(() => 'app1')
  await l.refresh()
  expect(logsMock).toHaveBeenCalledWith('app1', { lines: 1000 })
  expect(l.text.value).toBe('line1\nline2')
})
it('start 后每 5s 再拉;stop 停止', async () => {
  const l = useAppLogs(() => 'app1')
  l.start()
  await vi.advanceTimersByTimeAsync(5000)
  expect(logsMock).toHaveBeenCalledTimes(2) // start 立即 1 次 + 5s 1 次
  l.stop()
  await vi.advanceTimersByTimeAsync(15000)
  expect(logsMock).toHaveBeenCalledTimes(2)
})
it('拉取失败进 error,已有 text 保留', async () => {
  const l = useAppLogs(() => 'app1')
  await l.refresh()
  logsMock.mockRejectedValueOnce(new Error('boom'))
  await l.refresh()
  expect(l.error.value).toBeTruthy()
  expect(l.text.value).toBe('line1\nline2')
})
```

`LogsPane.test.ts` 的安全关键用例:

```ts
it('日志按纯文本渲染 —— HTML 不被解释(Vue2 v-html 隐患的回归锁)', async () => {
  logsMock.mockResolvedValue('<img src=x onerror=alert(1)>')
  const w = mount(LogsPane, { props: { appId: 'a' }, global: { /* 照仓里 i18n 惯例 */ } })
  await flushPromises()
  expect(w.find('img').exists()).toBe(false)
  expect(w.text()).toContain('<img src=x onerror=alert(1)>')
})
```

- [ ] **Step 2: 跑测试确认失败** → FAIL(模块不存在)。

- [ ] **Step 3: 实现**

`useAppLogs.ts`:

```ts
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

const POLL_MS = 5000  // Vue2 AppTerminalPanel 同款节奏
const LINES = 1000    // 后端默认;够看且不撑爆 DOM

export function useAppLogs(appId: () => string) {
  const text = ref(''); const loading = ref(false); const error = ref('')
  let timer: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    loading.value = true
    try { text.value = await service.compose.logs(appId(), { lines: LINES }); error.value = '' }
    catch (e) { error.value = e instanceof Error ? e.message : String(e) } // 旧 text 保留,轮询下一轮自愈
    finally { loading.value = false }
  }
  function start() { if (timer) return; void refresh(); timer = setInterval(() => { void refresh() }, POLL_MS) }
  function stop() { if (timer) { clearInterval(timer); timer = null } }
  return { text, loading, error, refresh, start, stop }
}
```

`LogsPane.vue`(要点:`{{ }}` 插值=纯文本;贴底自动滚动仅当用户本就在底部):

```vue
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppLogs } from './useAppLogs'

const props = defineProps<{ appId: string }>()
const { t } = useI18n()
const logs = useAppLogs(() => props.appId)
const box = ref<HTMLElement | null>(null)

watch(logs.text, () => {
  const el = box.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  if (atBottom) void nextTick(() => { el.scrollTop = el.scrollHeight })
})
onMounted(() => logs.start())
onBeforeUnmount(() => logs.stop())
</script>

<template>
  <div class="logs-wrap">
    <div class="logs-bar">
      <span v-if="logs.error.value" class="logs-err">{{ logs.error.value }}</span>
      <button type="button" class="logs-refresh" data-test="logs-refresh" :disabled="logs.loading.value" @click="logs.refresh()">{{ t('appsConsoleRefresh') }}</button>
    </div>
    <pre ref="box" class="logs-pre" data-test="logs-pre">{{ logs.text.value || t('appsConsoleLogsEmpty') }}</pre>
  </div>
</template>

<style scoped>
.logs-wrap { display: flex; flex-direction: column; height: 480px; border-radius: 12px; overflow: hidden; background: var(--console-bg); }
.logs-bar { display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 6px 10px; }
.logs-err { color: var(--remove-fg); font-size: 12px; margin-right: auto; }
.logs-refresh { padding: 3px 12px; border-radius: 8px; border: 1px solid var(--card-border); background: var(--chip-bg-hi); color: var(--fg); cursor: pointer; font-size: 12px; }
.logs-pre { flex: 1; margin: 0; padding: 10px 14px; overflow: auto; color: var(--console-fg); font: 13px/1.5 Consolas, Monaco, monospace; white-space: pre-wrap; word-break: break-all; }
</style>
```

i18n:`appsConsoleRefresh: '刷新'/'Refresh'`、`appsConsoleLogsEmpty: '暂无日志'/'No logs yet'`。

- [ ] **Step 4: 跑全量确认通过** → `pnpm test -- --run && pnpm exec vue-tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/apps/console/useAppLogs.ts src/apps/console/useAppLogs.test.ts src/apps/console/LogsPane.vue src/apps/console/LogsPane.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(apps-console): 日志面板(5s 轮询+手动刷新+贴底滚动;纯文本渲染修 Vue2 v-html 隐患)"
```

---


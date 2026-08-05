### Task 7: AppConsolePage + 路由 + 卡片入口

**Files:**
- Create: `NimoOS-New-UI/src/apps/views/AppConsolePage.vue`
- Test: `NimoOS-New-UI/src/apps/views/AppConsolePage.test.ts`
- Modify: `NimoOS-New-UI/src/router/index.ts`(routes 数组 `/apps/:name/settings` 行后)
- Modify: `NimoOS-New-UI/src/apps/components/InstalledAppCard.vue`(emit + 菜单项)
- Modify: `NimoOS-New-UI/src/apps/views/InstalledAppsPage.vue:114` 邻域(接 @console)
- Modify: `src/i18n/{zh_cn,en_us}.ts`

**Interfaces:**
- Consumes: T1 `service.compose.containers` → `ComposeContainersInfo`;T5 `TerminalPane`;T6 `LogsPane`;`AreaShell`/`AppsSidebar`(照 `AppSettingsPage.vue:9-11` 引法)。

- [ ] **Step 1: 写失败测试**(mount 惯例、router/i18n 挂法照 `AppSettingsPage.test.ts` 抄)

```ts
const containersMock = vi.fn()
vi.mock('@nimotech/nimoos-service', async (orig) => { /* 照仓里已有部分 mock 惯例,覆盖 service.compose.containers */ })

it('单服务应用:不显示服务选择器,终端 tab 默认激活', async () => {
  containersMock.mockResolvedValue({ main: 'app', containers: { app: { ID: 'c1' } } })
  // mount 后:
  expect(w.find('[data-test="console-svc-select"]').exists()).toBe(false)
  expect(w.findComponent({ name: 'TerminalPane' }).props('containerId')).toBe('c1')
})
it('多服务应用:显示选择器,默认选 main;切换后 TerminalPane 拿到新容器 id', async () => {
  containersMock.mockResolvedValue({ main: 'web', containers: { db: { ID: 'cdb' }, web: { ID: 'cweb' } } })
  const sel = w.find('[data-test="console-svc-select"]')
  expect((sel.element as HTMLSelectElement).value).toBe('web')
  await sel.setValue('db')
  expect(w.findComponent({ name: 'TerminalPane' }).props('containerId')).toBe('cdb')
})
it('日志 tab 懒挂载:切过去才出现 LogsPane,切回终端不销毁日志轮询组件(keep-alive 或 v-show)', async () => {
  // 初始无 LogsPane → 点日志 tab → 有;再点终端 → LogsPane 仍存在(v-show 隐藏)
})
it('应用不存在(containers→undefined):toast + 跳回 /apps', async () => {
  containersMock.mockResolvedValue(undefined)
  // 断言 router.push({name:'apps'}) 被调
})
```

`InstalledAppCard` 追加用例:

```ts
it('⋮ 菜单含「终端与日志」,点击 emit console', async () => { /* 照现有 settings 菜单项用例抄 */ })
```

- [ ] **Step 2: 跑测试确认失败** → FAIL。

- [ ] **Step 3: 实现**

① 路由(`router/index.ts:25` 后):

```ts
import AppConsolePage from '../apps/views/AppConsolePage.vue'
// routes:
  { path: '/apps/:name/console', name: 'apps-console', component: AppConsolePage },
```

② `InstalledAppCard.vue`:emits 加 `(e: 'console'): void`;菜单在 settings 项之后插:

```vue
          <DropdownMenuItem class="ui-drop-item" :disabled="busy" @select="emit('console')">{{ t('appsConsole') }}</DropdownMenuItem>
```

③ `InstalledAppsPage.vue`(`@settings` 行邻域):

```vue
            @console="router.push({ name: 'apps-console', params: { name: a.id } })"
```

④ `AppConsolePage.vue`(骨架抄 `AppSettingsPage.vue` 的 AreaShell/AppsSidebar/标题行结构):

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service, type ComposeContainersInfo } from '@nimotech/nimoos-service'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import TerminalPane from '../console/TerminalPane.vue'
import LogsPane from '../console/LogsPane.vue'
import { useInstalledAppsStore } from '../stores/installedApps'
import { useToast } from '../../stores/toast'

const { t } = useI18n()
const route = useRoute(); const router = useRouter()
const toast = useToast()
const installed = useInstalledAppsStore()
const id = computed(() => String(route.params.name ?? ''))
const app = computed(() => installed.apps.find((a) => a.id === id.value))

const tab = ref<'terminal' | 'logs'>('terminal')
const logsVisited = ref(false)                    // 日志懒挂载;之后 v-show 保活轮询组件
const info = ref<ComposeContainersInfo | null>(null)
const selectedService = ref('')
const containerId = computed(() => info.value?.containers[selectedService.value]?.ID ?? '')
const serviceNames = computed(() => Object.keys(info.value?.containers ?? {}))

onMounted(async () => {
  if (!installed.apps.length) installed.refresh().catch(() => {})   // 深链直达补标题(AppSettingsPage 同款)
  try {
    const r = await service.compose.containers(id.value)
    if (!r || !Object.keys(r.containers).length) { toast.show(t('appsConsoleNotFound')); void router.push({ name: 'apps' }); return }
    info.value = r
    selectedService.value = r.main && r.containers[r.main] ? r.main : Object.keys(r.containers)[0]
  } catch {
    toast.show(t('appsConsoleLoadFailed')); void router.push({ name: 'apps' })
  }
})
function switchTab(v: 'terminal' | 'logs') { tab.value = v; if (v === 'logs') logsVisited.value = true }
</script>

<template>
  <AreaShell>
    <template #sidebar><AppsSidebar /></template>
    <div class="console-page">
      <header class="console-head">
        <h2>{{ app?.title || id }}</h2>
        <select v-if="serviceNames.length > 1" v-model="selectedService" class="set-input console-svc" data-test="console-svc-select">
          <option v-for="s in serviceNames" :key="s" :value="s">{{ s }}</option>
        </select>
        <nav class="console-tabs" role="tablist">
          <button type="button" role="tab" :aria-selected="tab === 'terminal'" :class="{ on: tab === 'terminal' }" @click="switchTab('terminal')">{{ t('appsConsoleTerminal') }}</button>
          <button type="button" role="tab" :aria-selected="tab === 'logs'" :class="{ on: tab === 'logs' }" @click="switchTab('logs')">{{ t('appsConsoleLogs') }}</button>
        </nav>
      </header>
      <template v-if="containerId">
        <!-- 终端按容器 id keyed:切服务=旧连接组件卸载(断线)、新容器全新连接 -->
        <TerminalPane v-show="tab === 'terminal'" :key="containerId" :container-id="containerId" />
        <LogsPane v-if="logsVisited" v-show="tab === 'logs'" :app-id="id" />
      </template>
    </div>
  </AreaShell>
</template>

<style scoped>
.console-page { display: flex; flex-direction: column; gap: 14px; }
.console-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.console-head h2 { margin: 0; font-size: 20px; color: var(--fg); }
.console-svc { width: auto; min-width: 140px; }
.console-tabs { display: flex; gap: 6px; margin-left: auto; }
.console-tabs button { padding: 5px 16px; border-radius: 9px; border: 1px solid var(--card-border); background: transparent; color: var(--fg-muted); cursor: pointer; font-size: 13px; }
.console-tabs button.on { background: var(--chip-bg-hi); color: var(--fg); }
</style>
```

注意:`app?.title` 字段名以 `installedApps` store 的真实类型为准(打开 `stores/installedApps.ts` 核对,AppSettingsPage 顶部同款用法可抄)。终端 v-show 保活(切日志不断连);**切服务**用 `:key="containerId"` 强制重建=符合「新容器新会话」语义。

⑤ i18n:

```ts
  // zh_cn
  appsConsole: '终端与日志', appsConsoleTerminal: '终端', appsConsoleLogs: '日志',
  appsConsoleNotFound: '应用不存在或没有运行中的容器', appsConsoleLoadFailed: '加载失败,请重试',
  // en_us
  appsConsole: 'Terminal & Logs', appsConsoleTerminal: 'Terminal', appsConsoleLogs: 'Logs',
  appsConsoleNotFound: 'App not found or has no running container', appsConsoleLoadFailed: 'Failed to load, please retry',
```

- [ ] **Step 4: 跑全量确认通过** → `pnpm test -- --run && pnpm exec vue-tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/apps/views/AppConsolePage.vue src/apps/views/AppConsolePage.test.ts src/router/index.ts src/apps/components/InstalledAppCard.vue src/apps/views/InstalledAppsPage.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(apps-console): /apps/:name/console 双 tab 页 + 多服务选择器 + 卡片菜单入口"
```

---


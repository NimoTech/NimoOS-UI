## Task 8: `ObservabilitySection`（Agent 监控 / Phoenix）

**Files:**
- Create: `src/ai/components/settings/sections/ObservabilitySection.vue`
- Create: `src/ai/components/settings/sections/ObservabilitySection.test.ts`
- Modify: `src/ai/views/SettingsPage.vue`（映射表 `observability` 项 + import）
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`

**Interfaces:**
- Consumes: `service.ai.getTracingSetting()` / `putTracingSetting({enabled})` / `getObservabilityCompose()`；`service.compose.list()` / `install(yaml)` / `setStatus(id, action)`；`useMessageBus().on(event, handler)`（返回退订闭包）；`AlertDialog`（`src/components/ui/AlertDialog.vue`）；`SetSwitch`
- Produces: 组件 `ObservabilitySection`；i18n 键 `aiCfgContinue`

**Vue2 蓝本：** `sections/ObservabilitySection.vue`（211 行）+ **既有测试 `sections/__tests__/ObservabilitySection.spec.js`（5 例，一条不许丢）**

**这是本期逻辑最重的一个分区**：它要编排 Docker 容器（装 / 启 / 停）、轮询容器状态、订 MessageBus 安装事件、还要处理「乐观先置 enabled 再回滚」。

### i18n（本任务新增 18 键）

| 新键名 | Vue2 key | zh_cn 值（逐字） | en_us 值（逐字） |
|---|---|---|---|
| `aiCfgObservability` **复用** | `Agent monitoring` | Agent 监控 | Agent monitoring |
| `aiCfgObservabilityDesc` | `observabilityDesc` | 用本地 Phoenix 追踪并可视化每一次 Agent 运行,便于调试提示词、工具与记忆的使用情况。 | Trace and visualize every Agent run with a local Phoenix instance to debug prompt, tool, and memory usage. |
| `aiCfgPhoenixTracing` | `Phoenix tracing` | Phoenix 追踪 | Phoenix tracing |
| `aiCfgEnableAgentMonitoring` | `Enable agent monitoring` | 启用 Agent 监控 | Enable agent monitoring |
| `aiCfgObservabilityBanner` | `Visualize each agent run…` | 在本地 Phoenix 界面可视化每次 Agent 运行(系统提示词、工具、记忆、工具调用)。追踪数据不出本机。 | Visualize each agent run (system prompt, tools, memory, tool calls) in a local Phoenix UI. Traces never leave this device. |
| `aiCfgPhoenixStatus` | `Phoenix status:` | Phoenix 状态: | Phoenix status: |
| `aiCfgOpenPhoenix` | `Open Phoenix` | 打开 Phoenix | Open Phoenix |
| `aiCfgInstallingPhoenix` | `Installing Phoenix…` | 正在安装 Phoenix… | Installing Phoenix… |
| `aiCfgPhoenixRunningButOff` | `Phoenix is running but monitoring is off. Turn it on to record traces.` | Phoenix 正在运行但监控未开启。开启后才会记录追踪。 | Phoenix is running but monitoring is off. Turn it on to record traces. |
| `aiCfgPhoenixInstallConfirm` | `Agent monitoring needs the Phoenix app (Docker). Download and install it now?` | Agent 监控需要 Phoenix 应用(Docker)。现在下载并安装? | Agent monitoring needs the Phoenix app (Docker). Download and install it now? |
| `aiCfgDownloadAndInstall` | `Download & install` | 下载并安装 | Download & install |
| `aiCfgPhoenixStopConfirm` | `Turning off will also stop the Phoenix container to save resources. Continue?` | 关闭将同时停止 Phoenix 容器以节省资源,是否继续? | Turning off will also stop the Phoenix container to save resources. Continue? |
| `aiCfgContinue` | `Continue` | 继续 | Continue |
| `aiCfgInstallationFailed` | `Installation failed` | 安装失败 | Installation failed |
| `aiCfgFailedToSaveSetting` | `Failed to save setting` | 保存设置失败 | Failed to save setting |
| `aiCfgPhoenixRunning` | `Running` | 运行中 | Running |
| `aiCfgPhoenixNotInstalled` | `Not installed` | 未安装 | Not installed |
| `aiCfgPhoenixStopped` | `Stopped` | 已停止 | Stopped |

复用键：`aiCancel`（取消）。

- [ ] **Step 1: 写测试（承接 Vue2 5 条 + 新增 12 条）**

Vue2 那 5 条用 `w.vm.turnOn()` 直调实例方法，`<script setup>` 的内部函数**外部不可见** —— 移植方式：全部改成从 DOM 驱动（拨开关、点确认框按钮），断言换成对 `service` mock 的调用断言。逐条对照：

| # | Vue2 用例 | 移植后怎么驱动 | 断言（不变） |
|---|---|---|---|
| 1 | `loads current state (enabled + running)` | 挂载 | 开关开、状态文案「运行中」 |
| 2 | `turning on when installed+running just persists enabled` | 状态 running + 拨开关到开 | `putTracingSetting({enabled:true})` 被调、**`compose.install` 未被调**（否定断言） |
| 3 | `turning on when not installed installs via embedded compose` | 状态 absent + 拨开关 → 点确认框「下载并安装」 | `putTracingSetting({enabled:true})` 先被调（乐观置）、`getObservabilityCompose()` 被调、`compose.install` 被调 |
| 4 | `turning off disables and stops the container` | 状态 running + 拨开关到关 → 点确认框「继续」 | `putTracingSetting({enabled:false})`、`compose.setStatus('arize-phoenix','stop')` |
| 5 | `onToggle with absent phoenix calls dialog.confirm` | 状态 absent + 拨开关到开 | **确认框出现**（Vue2 断言 confirm 被调一次；本仓改成断言 `AlertDialog` 渲染出来了，等价） |

新增 12 条：

6. 状态 `absent` → 文案「未安装」；`exited` → 「已停止」；其它非 running → 「已停止」（Vue2 `statusLabel` 三分支）。
7. `compose.list()` 返回里**没有** `arize-phoenix` 键 → 状态 `absent`（Vue2 `entry ? … : 'absent'`）。
8. 有该键但 `status` 缺失 → `'exited'`（Vue2 `entry.status || 'exited'`）。
9. `compose.list()` reject → 保持当前状态、不抛（Vue2 `catch { keep current }`）。
10. `getTracingSetting` reject → 不抛，仍然去拉容器状态。
11. 状态 running 且 `enabled=false` → 渲染「Phoenix 正在运行但监控未开启。」警告条；enabled=true 时不渲染（对照组）。
12. 安装确认框点「取消」→ 开关**回到关**、不发任何请求（Vue2 `onCancel: () => { this.enabled = false }`）。
13. 停止确认框点「取消」→ 开关**留在开**、不发请求。
14. `app:install-progress` 事件（`app:name='arize-phoenix'`, `app:progress='42'`）→ 渲染「正在安装 Phoenix… 42%」；**其它 app 的同名事件被忽略**（对照组，Vue2 的 `if (res.Properties['app:name'] !== APP_ID) return`）。
15. `app:install-error` 事件 → 显示错误消息、`putTracingSetting({enabled:false})` 被调回滚、开关回关。
16. `app:install-end` 事件 → 退出安装态并重新 `load()`（`getTracingSetting` 第二次被调）。
17. 卸载后再来事件不再改状态（断言退订生效：`useMessageBus().on` 的返回值必须被 `onUnmounted` 调用）。
18. 点「打开 Phoenix」→ `window.open` 收到 `http://<hostname>:6006/` 与 `'_blank'`（`vi.spyOn(window,'open')`）。

⚠️ **轮询在测试里必须可控**：`pollStatus` 用 `setTimeout` 间隔重试（Vue2 是 12 次×1500ms 与 40 次×2000ms）。测试统一 `vi.useFakeTimers()`，并让 `compose.list()` 直接返回目标状态使首轮即命中（Vue2 的 5 条测试就是这么设计的，照抄这个思路）。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/ai/components/settings/sections/ObservabilitySection.test.ts`
Expected: FAIL —— 组件不存在。

- [ ] **Step 3: 加 i18n 键 + 实现组件**

```ts
const APP_ID = 'arize-phoenix'
type PhoenixStatus = 'absent' | 'exited' | 'running' | string

const enabled = ref(false)
const phoenixStatus = ref<PhoenixStatus>('absent')
const busy = ref(false)
const installing = ref(false)
const progress = ref(0)
const error = ref('')
const confirmInstallOpen = ref(false)
const confirmStopOpen = ref(false)

let alive = true                       // 卸载后不再改状态、不再排下一轮轮询
const offs: Array<() => void> = []     // MessageBus 退订闭包

const statusLabel = computed(() => {
  if (phoenixStatus.value === 'running') return t('aiCfgPhoenixRunning')
  if (phoenixStatus.value === 'absent') return t('aiCfgPhoenixNotInstalled')
  return t('aiCfgPhoenixStopped')
})

onMounted(() => {
  const bus = useMessageBus()
  // 【D4 申报】分区内自己订这三个事件、按 app:name 过滤,不复用应用区的
  // installProgress store(用户 2026-07-28 拍板):Phoenix 是一个设置项,不该作为
  // 「安装任务」出现在应用区磁贴与首页事件流里。代价是全仓两处订同一批事件,已知并接受。
  // useMessageBus().on 的 handler 签名是 (props: unknown, raw: unknown) => void,
  // 第一个参数已经由 extractProps 剥好(Properties / properties 都认),所以**不要**
  // 再写 res.Properties['app:name'](Vue2 是那么写的,本仓已经剥过一层)。
  // 但类型是 unknown,索引前必须自己收窄 —— 下面统一用 asProps 收一次。
  const asProps = (p: unknown): Record<string, string> =>
    (p && typeof p === 'object' ? (p as Record<string, string>) : {})

  offs.push(bus.on('app:install-progress', (p) => {
    const props = asProps(p)
    if (props['app:name'] !== APP_ID) return
    progress.value = parseInt(props['app:progress'] || '0', 10) || 0
  }))
  offs.push(bus.on('app:install-end', (p) => {
    if (asProps(p)['app:name'] !== APP_ID) return
    installing.value = false
    busy.value = false
    void load()
  }))
  offs.push(bus.on('app:install-error', (p) => {
    const props = asProps(p)
    if (props['app:name'] !== APP_ID) return
    installing.value = false
    busy.value = false
    error.value = props.message || t('aiCfgInstallationFailed')
    void service.ai.putTracingSetting({ enabled: false }).catch(() => {})   // Vue2 :108 回滚乐观启用
    enabled.value = false
  }))
  void load()
})

onUnmounted(() => {
  alive = false
  offs.forEach((off) => off())
})

async function load() {
  try {
    const s = (await service.ai.getTracingSetting()) as { enabled?: boolean }
    enabled.value = !!s.enabled
  } catch { /* Vue2 :127 同样静默 */ }
  await refreshStatus()
}

async function refreshStatus() {
  try {
    const map = await service.compose.list()
    const entry = map?.[APP_ID] as { status?: string } | undefined
    phoenixStatus.value = entry ? (entry.status || 'exited') : 'absent'
  } catch { /* Vue2 :140 —— keep current */ }
}

async function pollStatus(pred: (s: string) => boolean, tries: number, intervalMs: number) {
  for (let i = 0; i < tries; i++) {
    if (!alive) return false
    await refreshStatus()
    if (pred(phoenixStatus.value)) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}
```

开关与两个确认框的编排（对应 Vue2 `:144-176`，把 `$buefy.dialog.confirm` 换成受控 `AlertDialog`）：

```ts
function onToggle(v: boolean) {
  if (v) {
    if (phoenixStatus.value === 'absent') confirmInstallOpen.value = true   // 等用户确认;开关先视觉置开
    else void turnOnFlow()
    enabled.value = v
  } else if (phoenixStatus.value === 'running') {
    confirmStopOpen.value = true
    enabled.value = v
  } else {
    enabled.value = v
    void turnOff()
  }
}

function onInstallCancel() { enabled.value = false }        // Vue2 :156 onCancel
function onStopCancel() { enabled.value = true }            // Vue2 :167 onCancel 是空函数,但那是因为
                                                            // Buefy 的开关在 confirm 前没变;本仓开关已经
                                                            // 视觉置关了,取消必须拨回去。**申报级偏离。**
```

其余三个流程（`turnOnFlow` / `turnOn` / `confirmInstall` / `turnOff`）**逐字照搬 Vue2 `:178-210`**，只把 `container.*` 换成 `service.compose.*`（对应表见 D4）、`this.$t` 换成 `t`、并在每个 `await` 后加 `if (!alive) return` 守卫（**逻辑修正**：Vue2 卸载后轮询仍在跑并继续 setState；分区属 stack 组，用户切组就会卸载，这个很容易触发）。

「打开 Phoenix」：`window.open(\`http://\${window.location.hostname}:6006/\`, '_blank')`（Vue2 `:209`，端口 6006 是 Phoenix 默认 UI 端口，硬编码照搬）。

模板：`AlertDialog` 用两次 ——

```html
<AlertDialog
  v-model:open="confirmInstallOpen"
  :title="t('aiCfgObservability')"
  :message="t('aiCfgPhoenixInstallConfirm')"
  :confirm-text="t('aiCfgDownloadAndInstall')"
  :cancel-text="t('aiCancel')"
  @confirm="confirmInstall"
/>
```

⚠️ `AlertDialog` 的取消按钮是 reka 的 `AlertDialogCancel`，它**只关闭、不 emit** —— 所以「取消要把开关拨回去」得靠 `watch(confirmInstallOpen)`：当它从 `true` 变 `false` 且本次没走 `@confirm`，就执行 `onInstallCancel()`。写法：

```ts
let installConfirmed = false
watch(confirmInstallOpen, (open) => {
  if (open) { installConfirmed = false; return }
  if (!installConfirmed) onInstallCancel()
})
// @confirm 的处理函数里第一行置 installConfirmed = true
```

两个确认框各一套（测试第 12、13 条锁的就是这个）。

- [ ] **Step 4: 跑测试确认通过（17 例）+ 接映射表 + 全量测试门 + 提交**

```bash
pnpm test src/ai/components/settings/sections/ObservabilitySection.test.ts
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/components/settings/sections/ObservabilitySection.vue \
        src/ai/components/settings/sections/ObservabilitySection.test.ts \
        src/ai/views/SettingsPage.vue src/ai/views/SettingsPage.test.ts \
        src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2b Task 8: ObservabilitySection(Phoenix 追踪,承接 Vue2 5 例 + 卸载守卫)"
git show --stat HEAD && git status
```

- [ ] **Step 5: 智能体组整组验收（本任务是该组最后一块）**

起 dev server，打开 `http://192.168.1.143:5288/app/#/ai/settings?section=blacklist`，确认五个分区竖排在一页、scroll-spy 高亮跟着滚动走、五个分区各自的首屏数据都回填了（**这是「stack 组一次挂载 7 个请求」的第一次真实验证**）。发现问题当场记进台账，不要留到 Task 13。

---


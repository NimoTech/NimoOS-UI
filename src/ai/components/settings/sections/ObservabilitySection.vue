<!--
  SP8-P2b Task 8 —— 1:1 移植自 Vue2 src/views/AI/Settings/sections/ObservabilitySection.vue
  (211 行)+ 既有测试 sections/__tests__/ObservabilitySection.spec.js(5 例,承接见
  本档测试文件头注释的逐条对照表)。

  【D2 申报】状态留在组件本地(ref)、直调 service.ai / service.compose —— 与 Vue2
  归属一致(Vue2 data() 是组件本地状态),不做 store 集中(只有 blacklist 用 store,
  见 BlacklistSection.vue 头注释,用户 2026-07-28 拍板)。

  【D4 申报,架构级偏离】本分区自己订 `app:install-progress` / `app:install-end` /
  `app:install-error` 三个 MessageBus 事件、按 `Properties['app:name'] === 'arize-phoenix'`
  过滤(逐字对应 Vue2 :70-89 的 `sockets:` 块),**不复用应用区的 installProgress
  Pinia store**。理由:Phoenix 是本设置分区内的一个开关,不应作为「安装任务」出现在
  应用区磁贴 / 首页事件流里(用户 2026-07-28 拍板)。代价:全仓两处独立订阅同一批
  事件(本分区 + 应用区 installProgress store),已知并接受。

  【逻辑修正】Vue2 组件卸载后,`pollStatus` 里的 setTimeout 循环仍会继续跑、继续
  `setState`(Vue2 :110-117 没有任何卸载检查)。本分区是 stack 组的一员,用户在设置
  页切换分区就会把它卸载,而 Phoenix 的两条轮询分别要跑 12×1500ms / 40×2000ms,很
  容易撞上。这里引入 `alive` 标记,`onUnmounted` 置 false,并在 `pollStatus`
  以及 `turnOnFlow`/`confirmInstall`/`turnOff` 里每个 `await` 之后都补
  `if (!alive) return`,卸载后不再继续这条流程、也不再写任何 ref。

  【框架 API 差异,非逻辑改动】Vue2 用 `$buefy.dialog.confirm({ onConfirm, onCancel })`
  弹两次确认框;本仓换成两个受控 `AlertDialog`(reka-ui)。reka 的
  `AlertDialogCancel` 只关闭对话框(驱动 `v-model:open` 变 false)、不单独 emit
  取消事件,所以「取消要把开关拨回去」改用 `watch(open)`:开时置一个
  `xxxConfirmed = false` 哨兵,`@confirm` 处理函数第一行把哨兵置 true;
  关闭时哨兵仍是 false 就说明是「取消/点遮罩关闭」,补调 Vue2 `onCancel` 的等价逻辑。

  【final review Fix 4,撤销一处未申报且无必要的偏离】`onToggle` 曾在**仅仅打开**两个
  确认框(`confirmInstallOpen`/`confirmStopOpen` 置 true)的分支里顺手把
  `enabled.value = v` 乐观写掉。Vue2(ObservabilitySection.vue:118-146)两处弹
  `$buefy.dialog.confirm` 前都**不**碰 `this.enabled`——只在各自的 `onConfirm`
  (`confirmInstall()`/`turnOff()`)里等真正成功之后才改。`SetSwitch` 是完全受控组件
  (`:model-value="enabled"`),乐观写的后果是:开关先跳到新状态,但「Phoenix 正在运行但
  监控未开启」警告条的显示条件是 `phoenixStatus === 'running' && !enabled`——乐观写发生
  在确认框**还开着**的时候,会让警告条在确认框背后先冒出来又消失,是个视觉缺陷,且不
  在原实现的申报清单里。现按 Vue2 改回:两处弹确认框的分支都不再写 `enabled.value`,
  开关在对话框打开期间保持原值不动;`turnOnFlow()`/`turnOff()` 直调分支(不经确认框的
  两条路径)不受影响,继续在各自异步流程成功后才改 `enabled`。`onInstallCancel`
  (对应 Vue2 :130 `onCancel: () => { this.enabled = false }`)照 Vue2 保留显式置 false。
  `onStopCancel` 原先的「乐观写需要取消时手动拨回开」的理由(此块之前的版本)随乐观写
  一起撤销——不再乐观写之后,取消时 `enabled` 本就没被动过,`onStopCancel` 现在是
  Vue2 `onCancel: () => {}` 的等价空操作(留一行注释说明,不留死代码赋值)。
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../../../composables/useMessageBus'
import { apiErrorMessage } from '../../../util/apiError'
import SetSwitch from '../SetSwitch.vue'
import AgentIcon from '../../icons/AgentIcon.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'

const APP_ID = 'arize-phoenix'
type PhoenixStatus = 'absent' | 'exited' | 'running' | string

const { t } = useI18n()

const enabled = ref(false)
const phoenixStatus = ref<PhoenixStatus>('absent')
const busy = ref(false)
const installing = ref(false)
const progress = ref(0)
const error = ref('')
const confirmInstallOpen = ref(false)
const confirmStopOpen = ref(false)

let alive = true // 卸载后不再改状态、不再排下一轮轮询(见文件头「逻辑修正」)
const offs: Array<() => void> = [] // MessageBus 退订闭包
let installConfirmed = false
let stopConfirmed = false

const statusLabel = computed(() => {
  if (phoenixStatus.value === 'running') return t('aiCfgPhoenixRunning')
  if (phoenixStatus.value === 'absent') return t('aiCfgPhoenixNotInstalled')
  return t('aiCfgPhoenixStopped')
})

// useMessageBus().on 的 handler 第一个参数已经由 extractProps 剥掉 Properties/properties
// 那层信封(New-UI composable 自己做的,见 src/composables/useMessageBus.ts),类型是
// unknown,这里统一收窄一次,对应 Vue2 直接 `res.Properties['app:name']` 那一层。
function asProps(p: unknown): Record<string, string> {
  return p && typeof p === 'object' ? (p as Record<string, string>) : {}
}

onMounted(() => {
  const bus = useMessageBus()

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
    void service.ai.putTracingSetting({ enabled: false }).catch(() => { /* Vue2 :87 同样吞 */ }) // 回滚乐观启用
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
    if (!alive) return
    enabled.value = !!s.enabled
  } catch { /* Vue2 :99 同样静默 */ }
  if (!alive) return
  await refreshStatus()
}

async function refreshStatus() {
  try {
    const map = await service.compose.list()
    if (!alive) return
    const entry = map?.[APP_ID]
    phoenixStatus.value = entry ? (entry.status || 'exited') : 'absent'
  } catch { /* Vue2 :108 —— keep current */ }
}

async function pollStatus(pred: (s: string) => boolean, tries: number, intervalMs: number): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (!alive) return false
    await refreshStatus()
    if (!alive) return false
    if (pred(phoenixStatus.value)) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

function onToggle(v: boolean) {
  if (v) {
    if (phoenixStatus.value === 'absent') {
      // final review Fix 4:等用户确认;不在这里乐观写 enabled,见文件头注释。
      confirmInstallOpen.value = true
    } else {
      enabled.value = v
      void turnOnFlow()
    }
  } else if (phoenixStatus.value === 'running') {
    // final review Fix 4:等用户确认;不在这里乐观写 enabled,见文件头注释。
    confirmStopOpen.value = true
  } else {
    enabled.value = v
    void turnOff()
  }
}

// 见文件头「框架 API 差异」注释:reka AlertDialogCancel 只驱动 v-model:open 变
// false、不单独 emit,取消要靠这两个 watch 补 Vue2 onCancel 的等价逻辑。
watch(confirmInstallOpen, (open) => {
  if (open) { installConfirmed = false; return }
  if (!installConfirmed) onInstallCancel()
})
watch(confirmStopOpen, (open) => {
  if (open) { stopConfirmed = false; return }
  if (!stopConfirmed) onStopCancel()
})

function onInstallCancel() { enabled.value = false } // Vue2 :130 onCancel
// final review Fix 4:不再乐观写,取消时 enabled 本就没被动过 —— 与 Vue2 :141
// `onCancel: () => {}` 等价的空操作,不留死代码赋值。
function onStopCancel() { /* no-op, 见文件头 final review Fix 4 注释 */ }

function onConfirmInstallClick() {
  installConfirmed = true
  void confirmInstall()
}
function onConfirmStopClick() {
  stopConfirmed = true
  void turnOff()
}

async function turnOnFlow() {
  error.value = ''
  if (phoenixStatus.value !== 'running') {
    busy.value = true
    try {
      await service.compose.setStatus(APP_ID, 'start')
      if (!alive) return
      await pollStatus((s) => s === 'running', 12, 1500)
      if (!alive) return
    } catch { /* Vue2 :154 ignore */ }
    if (!alive) return
    busy.value = false
  }
  if (!alive) return
  await turnOn()
}

async function turnOn() {
  try {
    await service.ai.putTracingSetting({ enabled: true })
    if (!alive) return
    enabled.value = true
  } catch {
    if (!alive) return
    enabled.value = false
    error.value = t('aiCfgFailedToSaveSetting')
  }
}

async function confirmInstall() {
  installing.value = true
  busy.value = true
  progress.value = 0
  await turnOn() // 乐观先置 enabled(Vue2 :169)
  if (!alive) return
  try {
    const yaml = (await service.ai.getObservabilityCompose()) as string
    if (!alive) return
    await service.compose.install(yaml) // 包已带 yaml content-type,不再手搭 header(Vue2 :172 是手搭的)
    if (!alive) return
    const ok = await pollStatus((s) => s === 'running', 40, 2000)
    if (!alive) return
    installing.value = false
    busy.value = false
    if (!ok) error.value = t('aiCfgInstallationFailed')
  } catch (e) {
    if (!alive) return
    installing.value = false
    busy.value = false
    // apiErrorMessage 是 Vue2 :180 手写提取链(e.response.data.message)的等价封装,
    // house style 要求统一走它,行为不变。
    error.value = apiErrorMessage(e, t('aiCfgInstallationFailed'))
    await service.ai.putTracingSetting({ enabled: false }).catch(() => { /* Vue2 :182 同样吞 */ })
    if (!alive) return
    enabled.value = false
  }
}

async function turnOff() {
  busy.value = true
  try {
    await service.ai.putTracingSetting({ enabled: false })
    if (!alive) return
    enabled.value = false
    if (phoenixStatus.value === 'running') {
      await service.compose.setStatus(APP_ID, 'stop')
      if (!alive) return
      await pollStatus((s) => s !== 'running', 10, 1500)
      if (!alive) return
    }
  } catch {
    if (!alive) return
    error.value = t('aiCfgFailedToSaveSetting')
  } finally {
    if (alive) busy.value = false
  }
}

function openPhoenix() {
  window.open(`http://${window.location.hostname}:6006/`, '_blank') // Vue2 :202,6006 是 Phoenix 默认 UI 端口
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgObservability') }}</h1>
      <p class="set-desc">{{ t('aiCfgObservabilityDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgPhoenixTracing') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgEnableAgentMonitoring') }}</div>
            <div class="val end">
              <SetSwitch :model-value="enabled" :disabled="busy" @change="onToggle" />
            </div>
          </div>
        </div>
        <div class="set-banner">
          <span class="ico"><AgentIcon name="waves" :size="12" /></span>
          <span>{{ t('aiCfgObservabilityBanner') }}</span>
        </div>
        <div class="px-status">
          <span class="k">{{ t('aiCfgPhoenixStatus') }}</span>
          <span class="state"><span class="d" />{{ statusLabel }}</span>
          <button v-if="phoenixStatus === 'running'" class="px-open" @click="openPhoenix">
            <AgentIcon name="download" :size="12" /> {{ t('aiCfgOpenPhoenix') }}
          </button>
        </div>
        <p v-if="installing" class="px-msg">{{ t('aiCfgInstallingPhoenix') }} {{ progress }}%</p>
        <p v-if="error" class="px-msg err">{{ error }}</p>
        <div v-if="phoenixStatus === 'running' && !enabled" class="set-banner warn">
          {{ t('aiCfgPhoenixRunningButOff') }}
        </div>
      </div>
    </div>

    <AlertDialog
      v-model:open="confirmInstallOpen"
      :title="t('aiCfgObservability')"
      :message="t('aiCfgPhoenixInstallConfirm')"
      :confirm-text="t('aiCfgDownloadAndInstall')"
      :cancel-text="t('aiCancel')"
      @confirm="onConfirmInstallClick"
    />
    <AlertDialog
      v-model:open="confirmStopOpen"
      :title="t('aiCfgObservability')"
      :message="t('aiCfgPhoenixStopConfirm')"
      :confirm-text="t('aiCfgContinue')"
      :cancel-text="t('aiCancel')"
      @confirm="onConfirmStopClick"
    />
  </div>
</template>

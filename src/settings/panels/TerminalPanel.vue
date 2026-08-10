<script setup lang="ts">
// 设置 · 终端与日志。对位 Vue2 SettingsPanel.vue 的 terminal 分支(L350-373)。
//
// 历史记录(授权偏离 #9,用户 2026-08-01 拍板,已被后续进展取代):当时
//   GET /v1/sys/wsssh 与 GET /v1/terminal/settings 均 404,整个 Terminal 服务不存在,
//   所以终端位与终端安全设置合成一块空态,不放连不上的假 xterm / 只会 404 的密码表单。
//   Terminal 服务在 2026-08-10 上线后,该偏离已作废:SP18 落地了下面的
//   TerminalSecuritySection(锁定策略表单),取代原先的空态;日志卡片本身不受影响,
//   保持原样。
//
// 移植纪律(登记):Vue2 的 5 秒轮询定时器靠 watch(currentTab) 清,组件直接销毁时会漏 →
//   这里在 onUnmounted 里清。
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import LogsCard from './terminal/LogsCard.vue'
import TerminalSecuritySection from './terminal/TerminalSecuritySection.vue'
import { formatSysLog, downloadLogsUrl } from '../util/sysLog'
import { useSessionStore } from '../../stores/session'
import '../styles/settings.css'

const { t } = useI18n()
const session = useSessionStore()
const logText = ref('')
const downloadUrl = computed(() => downloadLogsUrl(localStorage.getItem('access_token')))
let timer: ReturnType<typeof setInterval> | undefined

// 异步过期守卫(全局约束 #2,就地实现,不抽公共 helper):
// 挂载取数与 5 秒轮询是同一个 loadLogs,理论上一次请求慢于下一轮定时器触发时,
// 旧请求可能晚于新请求落定。用代际计数器标记"当前是第几次 loadLogs 发起的",
// 落定时只有代数仍是最新的那一次才允许写 logText —— 更旧的一次即使后落定也丢弃。
let loadSeq = 0

async function loadLogs() {
  const seq = ++loadSeq
  try {
    // ⚠️ 这个端点单次返回约 2.67MB(2026-08-01 实测),没有 tail/limit 参数 —— 后端票 D24。
    const data = await service.sys.getLogs()
    if (seq !== loadSeq) return // 已被更新的一次 loadLogs 取代,丢弃这份旧结果
    logText.value = formatSysLog(data)
  } catch {
    // 拉取失败保留上一次内容,不把已显示的日志清掉(不吞错到别处,这里就是既定行为)。
  }
}

onMounted(() => {
  void loadLogs()
  timer = setInterval(() => void loadLogs(), 5000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <SettingsSection>
    <!-- SP18: the Security section replaces the former unavailable empty state.
         Admin-gated on the frontend, 1:1 with Vue2 (v-if isAdmin); non-admins
         see only the logs card below. The section itself falls back to the
         unavailable empty state when the service does not answer. -->
    <TerminalSecuritySection v-if="session.isAdmin" />

    <p class="set-comp-group-title">{{ t('settingsTermLogs') }}</p>
    <LogsCard :text="logText">
      <template #tools>
        <a class="set-btn set-logs-download" :href="downloadUrl" :title="t('settingsTermDownloadLogs')">
          {{ t('settingsTermDownloadLogs') }}
        </a>
      </template>
    </LogsCard>
  </SettingsSection>
</template>

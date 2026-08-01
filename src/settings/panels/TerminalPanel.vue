<script setup lang="ts">
// 设置 · 终端与日志。对位 Vue2 SettingsPanel.vue 的 terminal 分支(L350-373)。
//
// 授权偏离 #9(用户 2026-08-01 拍板):**终端位与终端安全设置合成一块空态**。
//   实测 GET /v1/sys/wsssh → 404(NimoOS/route/v1.go:106 已被注释)、
//        GET /v1/terminal/settings → 404(整个 Terminal 服务不存在,
//        /v1/gateway/components 里 "Terminal" 也是 unexpected status Not Found)。
//   政策二:不放连不上的 xterm 假装能用;也不放一个只会 404 失败的密码表单
//   (Vue2 的 TerminalSecuritySection 要求输入账户密码才能改锁定策略)。债务 D7 / D25。
//
// 移植纪律(登记):Vue2 的 5 秒轮询定时器靠 watch(currentTab) 清,组件直接销毁时会漏 →
//   这里在 onUnmounted 里清。
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import LogsCard from './terminal/LogsCard.vue'
import { formatSysLog, downloadLogsUrl } from '../util/sysLog'
import '../styles/settings.css'

const { t } = useI18n()
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
    <div class="set-term-empty">
      <p class="set-row-label">{{ t('settingsTermUnavailable') }}</p>
      <p class="set-row-sub">{{ t('settingsTermUnavailableHint') }}</p>
    </div>

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

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
import { formatSysLog, downloadLogsUrl, logPage, logPageCount } from '../util/sysLog'
import { useSessionStore } from '../../stores/session'
import '../styles/settings.css'

const { t } = useI18n()
const session = useSessionStore()
const logText = ref('')
const downloadUrl = computed(() => downloadLogsUrl(localStorage.getItem('access_token')))
let timer: ReturnType<typeof setInterval> | undefined

// Paging (fixes the "page unresponsive" freeze). The endpoint returns the whole log
// file -- 5 MB / 19943 lines on a 4-month-old device -- and rendering all of it into
// one <pre> cost 682-1180 ms of blocked main thread per 5-second refresh and +1162 MB
// of renderer memory (measured in headless Chrome against the real payload). Machines
// with less headroom cross Chrome's 5-second unresponsive-input threshold, so the next
// click pops the "page unresponsive" dialog. Only LOG_PAGE_SIZE lines ever reach the
// DOM now; see util/sysLog.ts for the numbers.
//
// `page` is 1-based and counts from the tail: page 1 is the newest lines and stays
// live, higher pages walk backwards through history.
const page = ref(1)
// Snapshot captured when leaving page 1. Paging has to run against frozen text: the
// log keeps growing at the tail, and tail-anchored page boundaries computed from a
// moving total would shift under the reader -- the classic offset-pagination-over-a-
// live-list bug, showing duplicated or skipped lines. `null` means "live".
const frozen = ref<string | null>(null)

const pagedSource = computed(() => frozen.value ?? logText.value)
const shownText = computed(() => logPage(pagedSource.value, page.value))
const pageCount = computed(() => logPageCount(pagedSource.value))
const isLive = computed(() => page.value === 1)

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

function startPolling() {
  if (timer) return
  timer = setInterval(() => void loadLogs(), 5000)
}
function stopPolling() {
  if (timer) { clearInterval(timer); timer = undefined }
}

function goOlder() {
  if (page.value >= pageCount.value) return
  // Freeze on the way out of page 1, not on every step, so the snapshot is the text
  // the reader was actually looking at when they started paging back.
  if (page.value === 1) { frozen.value = logText.value; stopPolling() }
  page.value += 1
}

function goNewer() {
  if (page.value <= 1) return
  page.value -= 1
  if (page.value === 1) {
    frozen.value = null
    startPolling()
    void loadLogs() // don't make the reader wait up to 5 s for the tail to catch up
  }
}

onMounted(() => {
  void loadLogs()
  startPolling()
})
onUnmounted(() => stopPolling())
</script>

<template>
  <SettingsSection>
    <!-- SP18: the Security section replaces the former unavailable empty state.
         Admin-gated on the frontend, 1:1 with Vue2 (v-if isAdmin); non-admins
         see only the logs card below. The section itself falls back to the
         unavailable empty state when the service does not answer. -->
    <TerminalSecuritySection v-if="session.isAdmin" />

    <p class="set-comp-group-title">{{ t('settingsTermLogs') }}</p>
    <LogsCard :text="shownText">
      <template #tools>
        <a class="set-btn set-logs-download" :href="downloadUrl" :title="t('settingsTermDownloadLogs')">
          {{ t('settingsTermDownloadLogs') }}
        </a>
      </template>
      <!-- Only shown once there is more than one page, so a small log keeps the
           card exactly as it looked before. Download still hands out the full file. -->
      <template #footer>
        <div v-if="pageCount > 1" class="set-logs-pager" data-test="logs-pager">
          <button
            type="button"
            class="set-btn"
            data-test="logs-older"
            :disabled="page >= pageCount"
            @click="goOlder"
          >{{ t('settingsTermLogsOlder') }}</button>
          <span class="set-logs-pager-page" data-test="logs-page">
            {{ t('settingsTermLogsPage', { page, total: pageCount }) }}
          </span>
          <button
            type="button"
            class="set-btn"
            data-test="logs-newer"
            :disabled="page <= 1"
            @click="goNewer"
          >{{ t('settingsTermLogsNewer') }}</button>
          <span v-if="isLive" class="set-logs-pager-state" data-test="logs-live">
            {{ t('settingsTermLogsLive') }}
          </span>
          <span v-else class="set-logs-pager-state is-paused" data-test="logs-paused">
            {{ t('settingsTermLogsPaused') }}
          </span>
        </div>
      </template>
    </LogsCard>
  </SettingsSection>
</template>

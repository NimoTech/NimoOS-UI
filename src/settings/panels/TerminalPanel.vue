<script setup lang="ts">
// Settings · Terminal & logs. Matches the terminal branch of Vue2 SettingsPanel.vue (L350-373).
//
// Historical note (authorized deviation #9, decided by the owner on 2026-08-01, since
//   superseded): at the time, GET /v1/sys/wsssh and GET /v1/terminal/settings both
//   returned 404 -- the whole Terminal service did not exist yet -- so the terminal
//   slot and the terminal security settings were merged into a single empty state,
//   instead of shipping an xterm that could never connect or a password form that
//   would only ever 404.
//   Once the Terminal service shipped on 2026-08-10, this deviation was retired: SP18
//   landed the TerminalSecuritySection below (the lockout-policy form), replacing the
//   former empty state; the logs card itself is unaffected and stays as it was.
//
// Porting discipline (logged): Vue2's 5-second polling timer is cleared via
//   watch(currentTab), which leaks if the component is destroyed directly ->
//   here it's cleared in onUnmounted instead.
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

// Async staleness guard (global constraint #2, implemented in place, no shared helper
// extracted): the mount-time fetch and the 5-second poll are the same loadLogs; in
// principle, if one request is slower than the next timer tick, an older request can
// resolve after a newer one. A generation counter marks "which loadLogs call this is",
// and on resolution only the call whose generation is still the latest is allowed to
// write logText -- an older call is discarded even if it resolves later.
let loadSeq = 0

async function loadLogs() {
  const seq = ++loadSeq
  try {
    // ⚠️ This endpoint returns about 2.67MB per call (measured 2026-08-01), with no tail/limit parameter -- backend ticket D24.
    const data = await service.sys.getLogs()
    if (seq !== loadSeq) return // superseded by a newer loadLogs call, discard this stale result
    logText.value = formatSysLog(data)
  } catch {
    // On fetch failure, keep the previous content instead of clearing the displayed logs (this is not swallowing the error elsewhere -- it is the intended behavior here).
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

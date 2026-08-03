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

// 交错防护(评审 fix 3,同 TimezoneRow.vue / DiskStandbyRow.vue 的理由):真实网络延迟下,
// 用户可能在 onMounted 的读取返回前就已经改了输入框 —— 读取回调不能把显示值冲回服务端的旧快照。
// 就地布尔标志,不抽公共 helper(本仓库此前评审裁定这是过早抽象)。
// 注意:标志要在"用户编辑输入框"时就置位,而不是等到点提交才置位 —— 用户可能编辑了
// 但还没点提交,这时如果加载 resolve,仍不能覆盖已经在输入框里的内容。
let touched = false

function onInput(e: Event) {
  touched = true
  port.value = (e.target as HTMLInputElement).value
}

onMounted(async () => {
  try {
    const p = await service.sys.getServerPort()   // 实测是字符串 "80"
    if (touched) return
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
        :value="port"
        class="set-input"
        type="text"
        inputmode="numeric"
        :placeholder="t('settingsPortPlaceholder')"
        :disabled="busy"
        @input="onInput"
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

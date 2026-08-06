<!--
  SP8-P2a Task 9 —— 1:1 移植自 Vue2
  `src/views/AI/Settings/sections/ModelsSection.vue`(222 行)。三张卡:

    1. 已装模型:卡头(标题 + 计数 + 刷新)· 下载进度横幅(每个
       store.hfImportJobs 条目一条,四态:downloading / creating model /
       success / error)· 加载中 / 空态 / 表格(名称 / 体积 / 删除)
    2. 从 Ollama 拉取:输入框 + 拉取按钮 + 在途提示
    3. 从 HuggingFace 导入 GGUF:搜索框 + 仓库结果列表 + 选中仓库的文件列表

  【Buefy → New-UI 替换】
  - $buefy.dialog.confirm(删模型)→ 共享 AlertDialog,destructive。
    reka-ui 的 AlertDialogAction 点击时先派发 update:open(false) 再派发
    confirm——deleteDlg 把 open 与待删 name 打包在同一个 ref、v-model:open
    只改 .open,confirm 处理器仍能读到正确的 name(同
    AgentSidebar.vue:111-120 的既定手法,及其头注释引用的
    InstalledAppsPage.vue:25-70 SP5-P1 教训)。
  - $buefy.toast.open({type:'is-success'}) → toast.show(msg)(info 档)。
  - type:'is-danger' → toast.show(msg, 1500, 'danger')。

  【结构调整,非行为改动】formatSize/etaLabel 原是 Vue2 组件 methods,抽成独立
  纯函数 formatModelSize/formatEtaSeconds(../../../util/formatModelSize.ts),
  这样能精确单测 GB/MB 边界、sec/min/hr 边界、0/null/undefined —— 抽出只是让
  测试够到边界,行为逐字未变。

  【i18n 结构差】etaLabel 原是 Vue2 组件内的 `this.$t('{n} sec' | '{n} min' |
  '{n} hr', {n})`;纯函数只返回 { unit, n } 结构体(不持地化文本,与 P1c2
  formatDuration 同款),本组件里再按 unit 挑 aiCfgEtaSec/Min/Hr 三个键过 t()。

  【观察项,照搬不改,settingsStore.ts:218-224 已登记】pullingModels[name] 在
  store 的 finally 里立即删除,"拉取中" 提示实际只在 HTTP 请求在途的那一瞬间
  显示,与文案宣称的"后台运行中"语义不符。后端 POST /pull 是否同步阻塞未知,
  这里不擅自改。

  【AlertDialog 需要 title,Buefy 原调用没有】共享 AlertDialog 组件要求
  title/confirmText/cancelText 三个必填 prop,而 Vue2 的
  `$buefy.dialog.confirm({message, type})` 没有单独的标题概念(Buefy 自带默认
  外观)。这不是在修 Vue2 的 bug,是接一个更严格的共享原语时必须补的参数——
  照 AgentSidebar.vue:192-200 的先例,title 与 confirmText 都复用「删除」这个
  动作名(aiCfgDelete),不新造一个通用「确认」文案。
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'
import { formatModelSize, formatEtaSeconds } from '../../../util/formatModelSize'

const store = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

const pullingNames = computed(() => Object.keys(store.pullingModels))
const hasPulling = computed(() => pullingNames.value.length > 0)

function formatSize(bytes: number | null | undefined): string {
  return formatModelSize(bytes)
}

/** ModelsSection.vue:176-180 `etaLabel` —— 纯函数分档 + 本组件挑 i18n 键。 */
function etaLabel(secs: number): string {
  const { unit, n } = formatEtaSeconds(secs)
  const key = unit === 'sec' ? 'aiCfgEtaSec' : unit === 'min' ? 'aiCfgEtaMin' : 'aiCfgEtaHr'
  return t(key, { n })
}

// ── 删除模型确认(见文件头「Buefy → New-UI 替换」说明)──
const deleteDlg = ref<{ open: boolean; name: string | null }>({ open: false, name: null })

function requestDelete(name: string) {
  deleteDlg.value = { open: true, name }
}

async function onDeleteConfirm() {
  const name = deleteDlg.value.name
  if (name === null) return
  try {
    await store.deleteModel(name)
    toast.show(t('aiCfgDeletedName', { name }))
  } catch {
    toast.show(t('aiCfgDeleteFailed'), 1500, 'danger')
  }
}

// ── 从 Ollama 拉取(ModelsSection.vue:195-204)──
async function onPull() {
  const name = store.pullModelInput.trim()
  if (!name) return
  try {
    await store.pullModel()
    toast.show(t('aiCfgPullStartedFor', { name }))
  } catch {
    toast.show(t('aiCfgPullRequestFailed'), 1500, 'danger')
  }
}

// ── HuggingFace 搜索 / 导入(ModelsSection.vue:205-219)──
async function onSearch() {
  try {
    await store.searchHF()
  } catch {
    toast.show(t('aiCfgSearchFailed'), 1500, 'danger')
  }
}

async function onImport(file: string) {
  try {
    await store.importHF(file)
    toast.show(t('aiCfgImportStartedFor', { file }))
  } catch {
    toast.show(t('aiCfgImportFailed'), 1500, 'danger')
  }
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgLocalModels') }}</h1>
      <p class="set-desc">{{ t('aiCfgModelsDesc') }}</p>
    </div>

    <!-- 已装模型 -->
    <div class="sk-section">
      <div class="sk-section-body">
        <div class="set-cardhead">
          <span class="t">{{ t('aiCfgInstalledModels') }}</span>
          <span class="ct">{{ store.installedModels.length }}</span>
          <span class="sp"></span>
          <button class="set-minibtn" @click="store.loadModels()">
            <AgentIcon name="refresh" :size="13" /> {{ t('aiCfgRefresh') }}
          </button>
        </div>

        <!-- Download progress banners -->
        <div
          v-for="(job, filename) in store.hfImportJobs"
          :key="filename"
          class="dl-banner"
          :class="job.status"
        >
          <div class="dl-banner-header">
            <div class="dl-banner-title">
              <div class="dl-dot"></div>
              <span v-if="job.status === 'success'">{{ t('aiCfgImportComplete') }}</span>
              <span v-else-if="job.status === 'error'">{{ t('aiCfgImportFailed') }}</span>
              <span v-else-if="job.status === 'creating model'">{{ t('aiCfgRegisteringModel') }}</span>
              <span v-else>{{ t('aiCfgImporting') }}</span>
            </div>
            <button
              v-if="job.status !== 'success'"
              class="dl-cancel-btn"
              @click="job.status === 'error'
                ? store.dismissImportJob(filename)
                : store.cancelImportJob(filename)"
            >{{ job.status === 'error' ? t('aiCfgClose') : t('aiCfgCancel') }}</button>
          </div>
          <div class="dl-filename">{{ filename }}</div>
          <div class="dl-prog-track">
            <div
              class="dl-prog-fill"
              :style="{ width: job.total > 0 ? ((job.completed / job.total) * 100).toFixed(1) + '%' : '0%' }"
            ></div>
          </div>
          <div v-if="job.status !== 'error'" class="dl-stats">
            <span><b>{{ job.total > 0 ? ((job.completed / job.total) * 100).toFixed(0) + '%' : '—' }}</b></span>
            <span>{{ formatSize(job.completed) }} / {{ formatSize(job.total) }}</span>
            <span v-if="job.speed > 0">{{ job.speed.toFixed(1) }} MB/s</span>
            <span v-if="job.etaSecs">{{ t('aiCfgEtaApprox', { eta: etaLabel(job.etaSecs) }) }}</span>
          </div>
          <div v-else class="dl-stats" style="color: var(--danger);">{{ job.error }}</div>
          <div v-if="job.status === 'downloading' || job.status === 'creating model'" class="dl-warn">
            {{ t('aiCfgDownloadWarning') }}
          </div>
        </div>

        <div v-if="store.modelsLoading" class="set-note">{{ t('aiCfgLoadingEllipsis') }}</div>
        <div v-else-if="store.installedModels.length === 0" class="set-note">
          {{ t('aiCfgNoModelsYet') }}
        </div>
        <table v-else class="set-table">
          <thead>
            <tr><th>{{ t('aiCfgColName') }}</th><th class="num">{{ t('aiCfgColSize') }}</th><th class="act">{{ t('aiCfgColActions') }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in store.installedModels" :key="m.name">
              <td><span class="mono">{{ m.name }}</span></td>
              <td class="num">{{ formatSize(m.size_bytes) }}</td>
              <td class="act">
                <button class="set-tbtn danger" @click="requestDelete(m.name)">
                  <AgentIcon name="trash" :size="13" /> {{ t('aiCfgDelete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pull from Ollama -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgPullFromOllama') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-addrow">
          <input type="text" class="set-input mono"
                 :placeholder="t('aiCfgModelNamePlaceholder')"
                 v-model="store.pullModelInput"
                 @keydown.enter="onPull" />
          <button class="set-addbtn" :disabled="!store.pullModelInput"
                  @click="onPull">
            <AgentIcon name="download" :size="13" /> {{ t('aiCfgPull') }}
          </button>
        </div>
        <div v-if="hasPulling" class="set-actions">
          <span class="hint">
            {{ t('aiCfgPullingHint', { names: pullingNames.join(', ') }) }}
          </span>
        </div>
      </div>
    </div>

    <!-- HuggingFace import -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgImportGgufTitle') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-addrow">
          <input type="text" class="set-input"
                 :placeholder="t('aiCfgSearchModelsPlaceholder')"
                 v-model="store.hfQuery"
                 @keydown.enter="onSearch" />
          <button class="set-addbtn ghost" @click="onSearch"
                  :disabled="!store.hfQuery.trim() || store.hfSearchLoading">
            <AgentIcon name="search" :size="13" /> {{ t('aiCfgSearchBtn') }}
          </button>
        </div>

        <div v-if="store.hfSearchLoading" class="set-note">{{ t('aiCfgSearchingEllipsis') }}</div>

        <div v-if="store.hfResults.length > 0" class="hf-results">
          <button v-for="r in store.hfResults" :key="r.id" class="hf-repo"
                  :data-active="store.hfSelectedRepo === r.id"
                  @click="store.selectHFRepo(r.id)">
            <span>{{ r.id }}</span>
            <span class="hf-meta">↓ {{ r.downloads || 0 }}</span>
          </button>
        </div>

        <div v-if="store.hfSelectedRepo" class="hf-files-area">
          <div class="hf-files-header">
            <span>{{ t('aiCfgSelectedRepo', { repo: store.hfSelectedRepo }) }}</span>
            <button class="set-minibtn" @click="store.loadHFFiles()"
                    :disabled="store.hfFilesLoading">
              {{ t('aiCfgLoadFiles') }}
            </button>
          </div>
          <div v-for="f in store.hfFiles" :key="f" class="hf-file">
            <span>{{ f }}</span>
            <button class="set-tbtn" @click="onImport(f)">
              <AgentIcon name="download" :size="13" /> {{ t('aiCfgImportBtn') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <AlertDialog
      v-model:open="deleteDlg.open"
      :title="t('aiCfgDelete')"
      :message="t('aiCfgConfirmDeleteModel', { name: deleteDlg.name || '' })"
      :confirm-text="t('aiCfgDelete')"
      :cancel-text="t('aiCfgCancel')"
      destructive
      @confirm="onDeleteConfirm"
    />
  </div>
</template>

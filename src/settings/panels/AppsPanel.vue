<script setup lang="ts">
// 设置 · 应用。对位 Vue2 SettingsPanel.vue apps 分支(模板 L587-665)+
// loadAppsData()(:1910-1971)+ pruneDocker()(:1973)+ clearLocalUploads()(:2010)。
//
// 三块:① 「App 数据存储位置」four rows (app_data / images / database / photos_data;
//         from Task 2's buildAppPathRows, photos_data is the fourth row Task 3 added,
//         matching Vue 2 #103)
//      ② Docker 缓存清理(二次确认 + service.container.prune())
//      ③ 清理本地待上传缓存 —— 政策三「做样子」,见下方专门注释。
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type SystemPaths } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import AppPathRow from './apps/AppPathRow.vue'
import AppPathDialog from './apps/AppPathDialog.vue'
import { buildAppPathRows, type AppPathKey, type AppPathRow as AppPathRowData } from '../util/appPaths'
import { mapVolumes, type StorageVolume } from '../../storage/util/storageMap'
import { renderSize } from '../../files/util/format'
import { toVirtualPath } from '../../files/util/pathUtils'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

const { t } = useI18n()
const toast = useToast()

const ROW_LABEL_KEY: Record<AppPathKey, string> = {
  app_data: 'settingsAppsAppData',
  images: 'settingsAppsImages',
  database: 'settingsAppsDatabase',
  photos_data: 'settingsAppsPhotosData',
}

// ── 取数(App 数据存储位置四行) ──────────────────────────────────────────
const paths = ref<SystemPaths | null>(null)
const volumes = ref<StorageVolume[]>([])
const rows = computed(() => buildAppPathRows(paths.value, volumes.value))

// 评审 Important #3:取数在途时不能渲染四行 0 值——尤其是「用户数据库」那行,pathText()
// 无条件拼四目录后缀,取数未落定时会显示成缺前缀的假路径(如
// "/Documents & Downloads & Gallery & Media")。加载态收敛条件选「两个接口都落定」,
// 不是「路径那条落定即可」:因为 pathText() 依赖 displayNames(由 volumes 算出),
// paths 先落定而 volumes 还没落定时,虚拟路径转换会失败、同样会短暂显示一段不对的裸路径——
// 那和 brief 描述的"假路径"是同一类错误读数,只等 paths 不够。
const loading = ref(true)

// 就地守卫(不抽公共 helper,同 StoragePanel.vue/SystemStatusPanel.vue 先例):防止两个
// 并发请求中任意一个落定时组件已卸载、仍去回写已卸载组件的 ref。本面板没有用户可编辑的
// 控件,守卫纯粹是防御性的(取数在途时用户切走这个 tab)。
let alive = true
onUnmounted(() => { alive = false })

async function loadPaths() {
  try {
    const data = await service.sys.getSystemPaths()
    if (!alive) return
    paths.value = data
  } catch {
    if (!alive) return
    paths.value = null
  }
}

async function loadVolumes() {
  try {
    const raw = await service.storage.list({ system: 'show' })
    if (!alive) return
    volumes.value = mapVolumes(raw)
  } catch {
    if (!alive) return
    volumes.value = []
  }
}

onMounted(() => {
  // 并发发起,互不等待——两个接口独立取数、独立回退,任一失败不影响另一个;
  // 加载态在两个都落定(不论成功失败)后才收敛。
  void Promise.allSettled([loadPaths(), loadVolumes()]).then(() => {
    if (!alive) return
    loading.value = false
  })
})

// displayNames:根挂载点 "/" 显示为 /DATA(与 home/stores/folders.ts:loadDisks 同一口径 ——
// 后端 GET /v1/storage 里系统盘的 mount_point 就是裸 "/",但 /v1/sys/paths 返回的路径
// (如 /DATA/AppData)是相对于 /DATA 这个虚拟根写的;toVirtualPath 是纯前缀匹配,必须让
// displayNames 的 key 与路径前缀真实对齐,所以这里不能照抄「原样用 v.mountPoint 当 key」
// 的字面写法——那样对根盘会拿 "/" 去匹配 "/DATA/AppData",匹配不上,虚拟路径就转不出来)。
// 非根挂载点原样使用真实 mountPoint,不做任何改写。
const displayNames = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const v of volumes.value) {
    if (!v.mountPoint) continue
    const mp = v.mountPoint === '/' ? '/DATA' : v.mountPoint
    map[mp] = v.name || (mp === '/DATA' ? 'NimoOS-HD' : mp)
  }
  return map
})

function sizeText(row: AppPathRowData): string {
  return `${renderSize(row.size)} / ${row.total ? renderSize(row.total) : '—'}`
}

function pathText(row: AppPathRowData): string {
  const virtual = toVirtualPath(row.path, displayNames.value)
  // Vue2 模板 SettingsPanel.vue:627 对用户数据库那行写死追加这四个目录名,界面 1:1 照留
  // (不是这里发明的;这四个目录本身就是 database 路径下的真实子目录,只是后端 /sys/paths
  // 不单独列出来,Vue2 选择直接拼字符串展示给用户)。
  if (row.key === 'database') return `${virtual}/Documents & Downloads & Gallery & Media`
  return virtual
}

// ── 更改存储位置弹窗 ──────────────────────────────────────────────────────
const dialogOpen = ref(false)
const dialogType = ref<AppPathKey>('app_data')
const dialogRow = computed(() => rows.value.find((r) => r.key === dialogType.value))

function openDialog(key: AppPathKey) {
  dialogType.value = key
  dialogOpen.value = true
}

function onDialogFinish() {
  // 迁移完成:重新取一次路径(该行的 path/size 已经变了),不用重新拉分区列表。
  void loadPaths()
}

// ── Docker 缓存清理 ───────────────────────────────────────────────────────
// ⛔ POST /v1/container/prune 会删掉**全部已停止的容器**(后端是 ContainersPrune 空过滤器,
//    NimoOS-AppManagement/service/container.go:902)+ 悬空镜像。开发机上从没真跑过 —— 用户
//    2026-08-01 拍板不点(本机会误删桌面小组件容器 nimoos-demo-widget / todo-widget)。债务 D23。
const pruneConfirmOpen = ref(false)
const pruning = ref(false)

function askPrune() {
  if (pruning.value) return
  pruneConfirmOpen.value = true
}

async function confirmPrune() {
  pruneConfirmOpen.value = false
  pruning.value = true
  try {
    await service.container.prune()
    // 面板级提示,不是弹窗内报错——toast 在这里是对的(弹窗已经关闭,不会被遮罩压住糊掉)。
    toast.show(t('settingsAppsDockerCleanDone'))
  } catch (e) {
    toast.show(t('settingsAppsDockerCleanFailed'))
    console.warn('[settings] docker prune failed', e)
  } finally {
    pruning.value = false
  }
}

// 「清理本地待上传缓存」= 政策三「做样子」:界面 1:1、按钮禁用、标注待相册区迁移完成后启用。
//    数据源是**相册**的 IndexedDB 上传队列(Vue2 @/views/Photos/upload/idb.js),SP7 尚未迁。
//    ⚠️ 别拿 src/files/upload/idb.ts 顶 —— 那是 SP4 文件区的独立 TUS 队列,两套东西。债务 D13。
</script>

<template>
  <SettingsSection :title="t('settingsTabApps')">
    <p class="set-comp-group-title">{{ t('settingsAppsPathTitle') }}</p>
    <div v-if="loading" class="set-skeleton">{{ t('settingsNetLoading') }}</div>
    <div v-else class="set-card">
      <AppPathRow
        v-for="row in rows" :key="row.key"
        :label="t(ROW_LABEL_KEY[row.key])"
        :size-text="sizeText(row)"
        :path-text="pathText(row)"
        @change="openDialog(row.key)"
      />
    </div>

    <div class="set-card">
      <button class="set-list-item clickable set-app-prune" type="button" @click="askPrune">
        <span class="set-row-text">
          <span class="set-row-label">{{ t('settingsAppsDockerCleanTitle') }}</span>
          <span class="set-row-sub">
            {{ pruning ? t('settingsAppsDockerCleaning') : t('settingsAppsDockerCleanSub') }}
          </span>
        </span>
        <span class="set-chevron" aria-hidden="true">›</span>
      </button>
    </div>

    <div class="set-card">
      <div class="set-list-item">
        <span class="set-row-text">
          <span class="set-row-label">{{ t('settingsAppsPendingTitle') }}</span>
          <span class="set-row-sub">{{ t('settingsAppsPendingNone') }}</span>
        </span>
        <span class="set-row-ctl">
          <button class="set-btn set-app-pending-btn" type="button" disabled>
            {{ t('settingsAppsPendingClear') }}
          </button>
        </span>
      </div>
      <p class="set-row-hint">{{ t('settingsAppsPendingDisabledHint') }}</p>
    </div>

    <AppPathDialog
      v-if="dialogRow"
      :open="dialogOpen"
      :type="dialogType"
      :current-path="dialogRow?.path ?? ''"
      :required-space="dialogRow?.size ?? 0"
      :volumes="volumes"
      :display-names="displayNames"
      @update:open="dialogOpen = $event"
      @finish="onDialogFinish"
    />
  </SettingsSection>

  <AlertDialog
    :open="pruneConfirmOpen"
    :title="t('settingsAppsDockerCleanConfirmTitle')"
    :message="t('settingsAppsDockerCleanConfirmMsg')"
    :confirm-text="t('settingsAppsDockerCleanConfirmOk')"
    :cancel-text="t('settingsCancel')"
    destructive
    @update:open="pruneConfirmOpen = $event"
    @confirm="confirmPrune"
  />
</template>

<script setup lang="ts">
// 设置 · 存储。**授权偏离 #3**(spec §5.5,用户 2026-07-31 拍板):
//   Vue2 在这个 tab 里重做了一整套概览/系统盘/存储列表/回收站,而 SP6 已经把这套完整迁到
//   了 /storage 路由页。在设置区再实现一遍 = 同一功能两处维护 → 这里只放
//   **一张容量概览卡 + 一张「打开存储区」入口卡**,点击跳 /storage。
//
// 容量口径逐字照 Vue2 SettingsPanel.vue:1139-1171(8% 系统盘启发式),保证读数与旧 UI 一致:
//   storageTotal = 全部分区 size 之和;storageOsUsed = 系统分区 min(usedSize, size*0.08);
//   storageDataUsed = 其余已用;storageAvail = total - used。这里不调用 raid.list() 做
//   RAID 过滤——Vue2 这段计算直接吃 /v1/storage 原始列表,不排除 RAID 卷,与 SP6
//   /storage 页(useStorageStore,会用 raid.list 排重)是两套不同的口径,本 tab 照 Vue2。
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import { mapVolumes, type StorageVolume } from '../../storage/util/storageMap'
import { renderSize } from '../../files/util/format'
import '../styles/settings.css'

const { t } = useI18n()
const router = useRouter()
const volumes = ref<StorageVolume[]>([])
const loaded = ref(false)

const total = computed(() => volumes.value.reduce((s, v) => s + v.size, 0))
const osUsed = computed(() =>
  volumes.value.reduce((s, v) => (v.isSystem ? s + Math.min(v.usedSize, v.size * 0.08) : s), 0),
)
const dataUsed = computed(() =>
  volumes.value.reduce(
    (s, v) => s + (v.isSystem ? v.usedSize - Math.min(v.usedSize, v.size * 0.08) : v.usedSize),
    0,
  ),
)
const avail = computed(() => total.value - osUsed.value - dataUsed.value)
const osPct = computed(() => (total.value ? (osUsed.value / total.value) * 100 : 0))
const dataPct = computed(() => (total.value ? (dataUsed.value / total.value) * 100 : 0))

// 就地守卫(不抽公共 helper):防止请求在途时组件被卸载、迟到的结果仍去回写已卸载组件的 ref。
let alive = true
onUnmounted(() => { alive = false })

onMounted(async () => {
  try {
    const vols = mapVolumes(await service.storage.list({ system: 'show' }))
    if (!alive) return // 组件已卸载,不回写
    volumes.value = vols
  } catch {
    if (!alive) return
    volumes.value = []
  } finally {
    if (alive) loaded.value = true
  }
})
</script>

<template>
  <SettingsSection :title="t('settingsTabStorage')">
    <!-- 评审 Important #3:取数在途时(!loaded)不能落到下面的 v-else 分支去渲染概览卡——
         那样会显示一段错误读数(0 Bytes 可用 + 空进度条),不是中性空态。加一个显式的
         加载态分支,收敛条件是 onMounted 里那个 try/catch/finally 的 finally(不论
         成功失败都会落 loaded=true),与 AppsPanel 的"两个接口都落定"同一收敛口径。 -->
    <div v-if="!loaded" class="set-skeleton">{{ t('settingsNetLoading') }}</div>
    <div v-else-if="!volumes.length" class="set-empty">{{ t('settingsStoreNoStorage') }}</div>
    <div v-else class="set-card set-store-overview">
      <div class="set-store-head">
        <span class="set-row-label">{{ t('settingsStoreTotal') }}</span>
        <span class="set-row-sub">{{ renderSize(avail) }} {{ t('settingsStoreAvailable') }}</span>
      </div>
      <div class="set-store-bar">
        <div class="set-store-seg-os" :style="{ width: osPct + '%' }" />
        <div class="set-store-seg-data" :style="{ width: dataPct + '%' }" />
      </div>
      <div class="set-store-legend">
        <span><i class="set-store-legend-dot set-store-seg-os" />{{ t('settingsStoreSystem') }}</span>
        <span><i class="set-store-legend-dot set-store-seg-data" />{{ t('settingsStoreFiles') }}</span>
        <span>{{ renderSize(osUsed + dataUsed) }} / {{ renderSize(total) }}</span>
      </div>
    </div>

    <button class="set-list-item clickable set-store-entry" type="button" @click="router.push('/storage')">
      <span class="set-row-text">
        <span class="set-row-label">{{ t('settingsStoreEntryTitle') }}</span>
        <span class="set-row-sub">{{ t('settingsStoreEntrySub') }}</span>
      </span>
      <span class="set-chevron" aria-hidden="true">›</span>
    </button>
  </SettingsSection>
</template>

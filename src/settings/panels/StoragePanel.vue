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
import { ref, computed, onMounted } from 'vue'
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

// 异步过期守卫(全局约束 #2,就地实现,不抽公共 helper):
// 本组件默认只有 onMounted 一次取数,但加了一个手动刷新按钮(见下方模板 .set-store-refresh,
// 理由见 StoragePanel.test.ts 顶部注释——不写测试后门,刷新按钮本身也是合理功能)。
// 挂载取数与手动刷新可能并发:刷新点下去后,挂载那次更慢的旧请求仍可能后落定。
// 用代际计数器标记"当前是第几次 load 发起的",落定时只有代数仍是最新的那一次才允许写
// volumes——更旧的一次即使后落定也必须被丢弃。
let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  try {
    const data = await service.storage.list({ system: 'show' })
    if (seq !== loadSeq) return // 已被更新的一次 load 取代,丢弃这份旧结果
    volumes.value = mapVolumes(data)
  } catch {
    if (seq !== loadSeq) return
    volumes.value = []
  } finally {
    if (seq === loadSeq) loaded.value = true
  }
}
onMounted(load)
</script>

<template>
  <SettingsSection :title="t('settingsTabStorage')">
    <div v-if="loaded && !volumes.length" class="set-empty">{{ t('settingsStoreNoStorage') }}</div>
    <div v-else class="set-card set-store-overview">
      <div class="set-store-head">
        <span class="set-row-label">{{ t('settingsStoreTotal') }}</span>
        <button
          class="set-btn set-store-refresh" type="button"
          :title="t('settingsStatusRefresh')" @click="load"
        >
          {{ t('settingsStatusRefresh') }}
        </button>
      </div>
      <p class="set-row-sub">{{ renderSize(avail) }} {{ t('settingsStoreAvailable') }}</p>
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

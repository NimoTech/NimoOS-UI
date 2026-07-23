<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import RaidCard from '../storage/components/RaidCard.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useDiskHotplug } from '../composables/useDiskHotplug'
import { useGuardedPoll } from '../composables/useGuardedPoll'
import { resolveRaidState, isRebuildingList } from '../storage/util/raidView'

const store = useStorageStore()
const router = useRouter()
const { t } = useI18n()

// 热插拔:第三个消费者,复用 T1 composable
useDiskHotplug(() => store.loadRaid())

// 重建中时 5000ms 单飞重拉状态(活体进度);无重建则不发请求
const anyRebuilding = () =>
  isRebuildingList(store.raidArrays.map((a) => resolveRaidState(a, store.raidStatusMap[String(a.id)])))
useGuardedPoll(() => store.loadRaid(), { intervalMs: 5000, active: anyRebuilding })

// 创建任务检测:mount 时探测一次,命中 creating 后 1500ms 单飞轮询(卡片 UI 见 T8)
onMounted(() => { store.detectCreatingTask() })
useGuardedPoll(() => store.pollCreateTaskOnce(), {
  intervalMs: 1500,
  active: () => !!store.creatingTask && store.creatingTask.status === 'creating',
})

const arrays = computed(() => store.raidArrays)
function openDetail(id: number | string) { router.push(`/storage/raid/${id}`) }
</script>

<template>
  <StorageShell>
    <div v-if="store.raidLoading && !arrays.length" class="st-hint">{{ t('storageLoading') }}</div>
    <div v-else-if="!arrays.length" class="st-hint">{{ t('raidNoArrays') }}</div>
    <template v-else>
      <RaidCard v-for="a in arrays" :key="a.id" :array="a" :status="store.raidStatusMap[String(a.id)]" @select="openDetail(a.id)" />
    </template>
  </StorageShell>
</template>

<style scoped>
.st-hint { padding: 24px 4px; color: var(--fg-muted); font-size: 14px; }
</style>

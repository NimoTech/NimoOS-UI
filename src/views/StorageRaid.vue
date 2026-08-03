<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import RaidCard from '../storage/components/RaidCard.vue'
import RaidCreatingCard from '../storage/components/RaidCreatingCard.vue'
import RaidCreateProgressModal from '../storage/components/RaidCreateProgressModal.vue'
import RaidReplacingCard from '../storage/components/RaidReplacingCard.vue'
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
// 换盘看板在场时也必须轮询,不能只看 anyRebuilding:刚提交那几秒内核还没接手,
// rebuild_pct 是 -1、live_state 也还没出现 recovering,isRebuilding 为 false ——
// 只挂 anyRebuilding 会一拍都不发请求,看板永远转下去、完成也观察不到。
useGuardedPoll(() => store.loadRaid(), {
  intervalMs: 5000,
  active: () => anyRebuilding() || !!store.replaceTask,
})

// 创建任务检测:mount 时探测一次,命中 creating 后 1500ms 单飞轮询(卡片 UI 见 T8)
onMounted(() => { store.detectCreatingTask() })
useGuardedPoll(() => store.pollCreateTaskOnce(), {
  intervalMs: 1500,
  active: () => !!store.creatingTask && store.creatingTask.status === 'creating',
})

const arrays = computed(() => store.raidArrays)
function openDetail(id: number | string) { router.push(`/storage/raid/${id}`) }
const progressOpen = ref(false)
</script>

<template>
  <StorageShell>
    <div class="sv-toolbar">
      <button class="sv-create" type="button" @click="router.push('/storage/raid/create')">
        {{ t('raidCreateBtn') }}
      </button>
    </div>
    <RaidCreatingCard
      v-if="store.creatingTask"
      :task="store.creatingTask"
      @open-modal="progressOpen = true"
      @dismiss="store.dismissCreateTask()"
    />
    <RaidCreateProgressModal v-if="store.creatingTask" v-model:open="progressOpen" :task="store.creatingTask" />
    <RaidReplacingCard
      v-if="store.replaceTask"
      :task="store.replaceTask"
      :status="store.raidStatusMap[store.replaceTask.arrayId]"
      @dismiss="store.dismissReplaceTask()"
    />
    <div v-if="store.raidLoading && !arrays.length" class="st-hint">{{ t('storageLoading') }}</div>
    <div v-else-if="!arrays.length" class="st-hint">{{ t('raidNoArrays') }}</div>
    <template v-else>
      <RaidCard v-for="a in arrays" :key="a.id" :array="a" :status="store.raidStatusMap[String(a.id)]" @select="openDetail(a.id)" />
    </template>
  </StorageShell>
</template>

<style scoped>
.st-hint { padding: 24px 4px; color: var(--fg-muted); font-size: 14px; }
.sv-toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }
.sv-create {
  padding: 7px 18px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.sv-create:hover { background: var(--chip-bg-hi); }
</style>

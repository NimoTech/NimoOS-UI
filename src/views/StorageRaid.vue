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

// Hot-plug: the third consumer, reuses the T1 composable
useDiskHotplug(() => store.loadRaid())

// While rebuilding, single-flight refetch of state every 5000ms (live progress); no request when nothing is rebuilding
const anyRebuilding = () =>
  isRebuildingList(store.raidArrays.map((a) => resolveRaidState(a, store.raidStatusMap[String(a.id)])))
// Must also poll while the replace/reclaim board is present, not just on anyRebuilding: in the
// few seconds right after submit the kernel hasn't taken over yet — rebuild_pct is still -1,
// live_state hasn't reached recovering yet either (the --re-add disk is still parked in spare
// state), and isRebuilding is false. Gating only on anyRebuilding would never fire a single
// request, so the board would spin forever with completion never observed.
useGuardedPoll(() => store.loadRaid(), {
  intervalMs: 5000,
  active: () => anyRebuilding() || !!store.replaceTask || !!store.reclaimTask,
})

// Create-task detection: probe once on mount, then single-flight poll every 1500ms once it hits creating (card UI, see T8)
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
